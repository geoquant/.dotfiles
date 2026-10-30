import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Maximum USD one task may spend. A task is an active goal, or one user prompt plus its automatic follow-ups. */
export const TASK_SPEND_LIMIT_USD = 100;

/**
 * Per-million-token rates used when a model reports no price (e.g. internal gateway models priced at 0).
 * Flagship-tier so the estimate errs high rather than letting a task run past the cap.
 */
export const FALLBACK_RATES_PER_MTOK = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 } as const;

const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 3_000;

export interface TaskSpendRecord {
	spentUsd: number;
	reservations: Record<string, number>;
	chargedMessages: Record<string, true>;
	stoppedReason?: string;
}

function finiteNonnegative(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseRecord(value: unknown): TaskSpendRecord {
	if (!value || typeof value !== "object") throw new Error("Task budget: invalid ledger");
	const record = value as Record<string, unknown>;
	if (!finiteNonnegative(record.spentUsd) || !record.reservations || typeof record.reservations !== "object" || !record.chargedMessages || typeof record.chargedMessages !== "object") {
		throw new Error("Task budget: corrupt ledger");
	}
	const reservations: Record<string, number> = {};
	for (const [id, cost] of Object.entries(record.reservations)) {
		if (!finiteNonnegative(cost)) throw new Error("Task budget: corrupt reservation");
		reservations[id] = cost;
	}
	const chargedMessages: Record<string, true> = {};
	for (const [id, charged] of Object.entries(record.chargedMessages)) if (charged === true) chargedMessages[id] = true;
	const stoppedReason = typeof record.stoppedReason === "string" ? record.stoppedReason : undefined;
	return { spentUsd: record.spentUsd, reservations, chargedMessages, stoppedReason };
}

function sleep(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

/** Cross-process spend ledger keyed by task ID. Reservations are taken before each provider request. */
export class TaskSpendLedger {
	constructor(private readonly directory: string) {}

	private acquire(lock: string): void {
		const deadline = Date.now() + LOCK_WAIT_MS;
		for (;;) {
			try { mkdirSync(lock, { mode: 0o700 }); return; }
			catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
				// Operations hold the lock for milliseconds; an old lock belongs to a crashed process.
				try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { rmSync(lock, { recursive: true, force: true }); continue; } } catch { continue; }
				if (Date.now() > deadline) throw new Error("Task budget: ledger lock busy");
				sleep(20);
			}
		}
	}

	private transaction<T>(taskId: string, operation: (record: TaskSpendRecord) => T): T {
		const safeId = taskId.replace(/[^A-Za-z0-9_-]/g, "_");
		mkdirSync(this.directory, { recursive: true, mode: 0o700 });
		const file = join(this.directory, `${safeId}.json`);
		const lock = `${file}.lock`;
		this.acquire(lock);
		try {
			let record: TaskSpendRecord;
			try { record = parseRecord(JSON.parse(readFileSync(file, "utf8"))); }
			catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
				record = { spentUsd: 0, reservations: {}, chargedMessages: {} };
			}
			const result = operation(record);
			const temporary = `${file}.${process.pid}.tmp`;
			writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
			renameSync(temporary, file);
			return result;
		} finally { rmSync(lock, { recursive: true, force: true }); }
	}

	read(taskId: string): TaskSpendRecord { return this.transaction(taskId, record => structuredClone(record)); }

	/** Returns false (and stops the task) when spent + outstanding reservations + this request would exceed the cap. */
	reserve(taskId: string, requestId: string, upperBoundUsd: number): boolean {
		if (!finiteNonnegative(upperBoundUsd)) throw new Error("Task budget: invalid request estimate");
		return this.transaction(taskId, record => {
			if (record.stoppedReason) return false;
			const committed = record.spentUsd + Object.values(record.reservations).reduce((sum, cost) => sum + cost, 0);
			if (committed + upperBoundUsd > TASK_SPEND_LIMIT_USD) {
				record.stoppedReason = `USD ${TASK_SPEND_LIMIT_USD} task budget reached (spent $${record.spentUsd.toFixed(2)}, next request could cost up to $${upperBoundUsd.toFixed(2)})`;
				return false;
			}
			record.reservations[requestId] = upperBoundUsd;
			return true;
		});
	}

	/** Settle a reservation with the actual cost. Idempotent per message ID. */
	charge(taskId: string, messageId: string, actualUsd: number, requestId?: string): void {
		if (!finiteNonnegative(actualUsd)) actualUsd = 0;
		this.transaction(taskId, record => {
			if (requestId !== undefined) delete record.reservations[requestId];
			if (record.chargedMessages[messageId]) return;
			record.spentUsd += actualUsd;
			record.chargedMessages[messageId] = true;
			if (record.spentUsd >= TASK_SPEND_LIMIT_USD) record.stoppedReason = `USD ${TASK_SPEND_LIMIT_USD} task budget exhausted (spent $${record.spentUsd.toFixed(2)})`;
		});
	}

	release(taskId: string, requestId: string): void { this.transaction(taskId, record => { delete record.reservations[requestId]; }); }
}

export interface GoalIdentity { goalId: string; status: string }

/** Paused/stale goal continuations are consumed instead of reanimating the goal. */
export function goalContinuationDisposition(text: string, goal: GoalIdentity | null): "ordinary" | "run" | "discard" {
	if (/A queued hidden goal continuation was stale and has been cancelled before running\./.test(text)) return "discard";
	const id = /<pi_goal_continuation\s+goal_id="([^"]+)"/.exec(text)?.[1];
	if (id === undefined) return "ordinary";
	return goal?.goalId === id && goal.status === "active" ? "run" : "discard";
}

export interface PricedModel {
	contextWindow: number;
	maxTokens: number;
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** The model's own rates, or flagship fallback rates when the model is unpriced. */
export function effectiveRates(model: PricedModel | undefined): PricedModel["cost"] {
	const cost = model?.cost;
	if (cost && finiteNonnegative(cost.input) && finiteNonnegative(cost.output) && cost.input > 0 && cost.output > 0) return cost;
	return FALLBACK_RATES_PER_MTOK;
}

/** Worst-case cost of the next request: current context (plus headroom) at the highest input rate, plus max output. */
export function requestCostUpperBound(model: PricedModel | undefined, contextTokens: number | null | undefined): number {
	const rates = effectiveRates(model);
	const window = model && model.contextWindow > 0 ? model.contextWindow : 1_000_000;
	const output = model && model.maxTokens > 0 ? model.maxTokens : 128_000;
	const input = finiteNonnegative(contextTokens) && contextTokens > 0
		? Math.min(window, Math.max(contextTokens * 1.25, contextTokens + 20_000))
		: window;
	return (input * Math.max(rates.input, rates.cacheWrite) + output * rates.output) / 1_000_000;
}

export interface UsageLike {
	input?: number; output?: number; cacheRead?: number; cacheWrite?: number;
	cost?: { total?: number };
}

/** Reported cost when the provider prices it; otherwise tokens × fallback rates. */
export function messageCostUsd(usage: UsageLike | undefined): number {
	const reported = usage?.cost?.total;
	if (finiteNonnegative(reported) && reported > 0) return reported;
	const n = (value: unknown) => (finiteNonnegative(value) ? value : 0);
	const r = FALLBACK_RATES_PER_MTOK;
	return (n(usage?.input) * r.input + n(usage?.output) * r.output + n(usage?.cacheRead) * r.cacheRead + n(usage?.cacheWrite) * r.cacheWrite) / 1_000_000;
}
