import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	TaskSpendLedger, TASK_SPEND_LIMIT_USD, goalContinuationDisposition, messageCostUsd, requestCostUpperBound,
	type GoalIdentity,
} from "./goal-safety-policy.ts";

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue | null {
	return value !== null && typeof value === "object" ? value as RecordValue : null;
}
function textContent(value: unknown): string {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return "";
	return value.map(part => { const p = object(part); return p?.type === "text" && typeof p.text === "string" ? p.text : ""; }).join("\n");
}
function currentGoal(ctx: ExtensionContext): GoalIdentity | null {
	let goal: GoalIdentity | null = null;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== "pi-codex-goal") continue;
		const data = object(entry.data);
		if (data?.kind === "clear") goal = null;
		const next = object(data?.goal);
		if (data?.kind === "set" && typeof next?.goalId === "string" && typeof next.status === "string") goal = { goalId: next.goalId, status: next.status };
		if (data?.kind === "usage" && goal && goal.goalId === data.goalId && typeof data.status === "string") goal.status = data.status;
	}
	return goal;
}

const BUDGET_ENV = "PI_GOAL_BUDGET_ID";
const TASK_ENTRY = "pi-goal-safety-task";
// A child Pi process (subagent) inherits its parent's task budget. Captured once per process,
// before this extension starts setting the variable for its own children.
const globalState = globalThis as { __piTaskBudgetInherited?: string | null };
if (!("__piTaskBudgetInherited" in globalState)) globalState.__piTaskBudgetInherited = process.env[BUDGET_ENV] || null;

/**
 * Caps the spend of a single task at USD 100.
 * Task = an active goal (shared across sessions), otherwise one user prompt plus its automatic follow-ups
 * (compaction continuations, queued extension messages). Child pi processes share the parent's task budget.
 */
export default function taskBudget(pi: ExtensionAPI): void {
	const ledger = new TaskSpendLedger(join(homedir(), ".pi", "agent", "goal-safety-ledger"));
	const inherited = globalState.__piTaskBudgetInherited;
	let taskId = "";
	let request: { taskId: string; id: string } | null = null;
	let discard = false;

	const identity = (ctx: ExtensionContext): string => {
		if (inherited) return inherited;
		const goal = currentGoal(ctx);
		return goal?.status === "active" ? `goal-${goal.goalId}` : taskId;
	};
	const notify = (ctx: ExtensionContext, message: string, level: "warning" | "error"): void => {
		if (ctx.hasUI) ctx.ui.notify(message, level);
	};
	const stop = (ctx: ExtensionContext, id: string, reason: string): void => {
		ctx.abort();
		pi.appendEntry("pi-goal-safety", { kind: "stop", taskId: id, reason });
		const goal = currentGoal(ctx);
		if (goal && `goal-${goal.goalId}` === id) {
			const entry = [...ctx.sessionManager.getBranch()].reverse().find(e => e.type === "custom" && e.customType === "pi-codex-goal" && object(e.data)?.kind === "set");
			const saved = entry?.type === "custom" ? object(object(entry.data)?.goal) : null;
			const now = Math.floor(Date.now() / 1000);
			if (saved) pi.appendEntry("pi-codex-goal", { version: 1, kind: "set", source: "runtime", goal: { ...saved, status: "blocked", blockedReason: reason, updatedAt: now }, at: now });
		}
		notify(ctx, `Task stopped: ${reason}. Send a new prompt to start a new task.`, "error");
	};
	const startTask = (ctx: ExtensionContext): void => {
		taskId = `task-${ctx.sessionManager.getSessionId()}-${randomUUID().slice(0, 8)}`;
		pi.appendEntry(TASK_ENTRY, { taskId });
	};

	pi.on("session_start", (_event, ctx) => {
		taskId = `task-${ctx.sessionManager.getSessionId()}`;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === TASK_ENTRY) {
				const id = object(entry.data)?.taskId;
				if (typeof id === "string") taskId = id;
			}
		}
	});

	pi.on("input", (event, ctx) => {
		if (goalContinuationDisposition(event.text, currentGoal(ctx)) === "discard") return { action: "handled" };
		// A prompt the user typed starts a new task; extension-sent messages continue the current one.
		if (event.source !== "extension") { startTask(ctx); return undefined; }
		try {
			const record = ledger.read(identity(ctx));
			if (record.stoppedReason) return { action: "handled" };
		} catch { /* admission will recheck */ }
		return undefined;
	});

	pi.on("before_agent_start", (event, ctx) => {
		discard = goalContinuationDisposition(event.prompt, currentGoal(ctx)) === "discard";
		if (discard) ctx.abort();
	});
	pi.on("context", (event, ctx) => {
		// Last-moment check for goal continuations queued before the goal was paused.
		for (const message of [...event.messages].reverse()) {
			if (message.role === "assistant" || message.role === "toolResult") continue;
			if (goalContinuationDisposition(textContent(object(message)?.content), currentGoal(ctx)) === "discard") { discard = true; ctx.abort(); }
			break;
		}
	});

	const admit = (ctx: ExtensionContext): void => {
		if (discard) { ctx.abort(); return; }
		if (request !== null) return;
		const id = identity(ctx);
		try {
			const estimate = requestCostUpperBound(ctx.model, ctx.getContextUsage()?.tokens);
			const requestId = randomUUID();
			if (!ledger.reserve(id, requestId, estimate)) {
				stop(ctx, id, ledger.read(id).stoppedReason ?? `USD ${TASK_SPEND_LIMIT_USD} task budget reached`);
				return;
			}
			request = { taskId: id, id: requestId };
		} catch (error) {
			// Ledger unreadable: refuse this request only; never persist a stop for a tooling fault.
			ctx.abort();
			notify(ctx, `Task budget check failed, request cancelled: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	};
	pi.on("turn_start", (_event, ctx) => admit(ctx));
	pi.on("before_provider_request", (_event, ctx) => admit(ctx));

	pi.on("message_end", (event, ctx) => {
		if (event.message.role !== "assistant") return;
		const pending = request;
		request = null;
		if (!pending) return;
		try {
			ledger.charge(pending.taskId, `${ctx.sessionManager.getSessionId()}:${event.message.timestamp}`, messageCostUsd(event.message.usage), pending.id);
			const record = ledger.read(pending.taskId);
			if (record.stoppedReason) stop(ctx, pending.taskId, record.stoppedReason);
		} catch (error) {
			notify(ctx, `Task budget could not record spend: ${error instanceof Error ? error.message : String(error)}`, "warning");
		}
	});

	pi.on("tool_call", (_event, ctx) => {
		if (discard) { ctx.abort(); return { block: true, reason: "Stale goal continuation cancelled", terminate: true }; }
		// Subagents and other child pi processes inherit the env and charge the same task.
		process.env[BUDGET_ENV] = identity(ctx);
		return undefined;
	});

	pi.on("agent_end", () => {
		if (request) { try { ledger.release(request.taskId, request.id); } catch { /* best effort */ } request = null; }
		discard = false;
		if (!inherited) delete process.env[BUDGET_ENV];
	});
}
