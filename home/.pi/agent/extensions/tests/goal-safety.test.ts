import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskSpendLedger, goalContinuationDisposition, messageCostUsd, requestCostUpperBound, FALLBACK_RATES_PER_MTOK } from "../goal-safety/goal-safety-policy.ts";

function withLedger(run: (ledger: TaskSpendLedger, dir: string) => void) {
	const dir = mkdtempSync(join(tmpdir(), "task-budget-test-"));
	try { run(new TaskSpendLedger(dir), dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("stale, replaced and paused continuations are discarded; active identity runs", () => {
	const prompt = '<pi_goal_continuation goal_id="goal-a">continue</pi_goal_continuation>';
	assert.equal(goalContinuationDisposition(prompt, null), "discard");
	for (const status of ["paused", "blocked", "budgetLimited", "complete"]) assert.equal(goalContinuationDisposition(prompt, { goalId: "goal-a", status }), "discard");
	assert.equal(goalContinuationDisposition(prompt, { goalId: "goal-b", status: "active" }), "discard");
	assert.equal(goalContinuationDisposition(prompt, { goalId: "goal-a", status: "active" }), "run");
	assert.equal(goalContinuationDisposition("Please fix the guard", { goalId: "goal-a", status: "paused" }), "ordinary");
});

test("reservations across sessions keep a task under USD 100; stop is terminal for that task only", () => withLedger((a, dir) => {
	const b = new TaskSpendLedger(dir);
	assert.equal(a.reserve("task-a", "r1", 60), true);
	assert.equal(b.reserve("task-a", "r2", 41), false);
	assert.match(a.read("task-a").stoppedReason ?? "", /100/);
	assert.equal(a.reserve("task-a", "r3", 0.01), false);
	assert.equal(b.reserve("task-b", "r4", 1), true);
}));

test("charge settles the reservation, is idempotent, and exhausts at the cap", () => withLedger(ledger => {
	assert.equal(ledger.reserve("t", "r1", 30), true);
	ledger.charge("t", "m1", 2, "r1");
	ledger.charge("t", "m1", 2);
	const record = ledger.read("t");
	assert.equal(record.spentUsd, 2);
	assert.deepEqual(record.reservations, {});
	ledger.charge("t", "m2", 98);
	assert.match(ledger.read("t").stoppedReason ?? "", /exhausted/);
}));

test("stale lock from a crashed process is recovered; arbitrary IDs are sanitized", () => withLedger((ledger, dir) => {
	const lock = join(dir, "t.json.lock");
	mkdirSync(lock);
	const old = new Date(Date.now() - 60_000);
	utimesSync(lock, old, old);
	assert.equal(ledger.reserve("t", "r", 1), true);
	assert.equal(ledger.reserve("goal-019:abc/def", "r", 1), true);
}));

test("corrupt ledger throws instead of silently resetting spend", () => withLedger((ledger, dir) => {
	writeFileSync(join(dir, "t.json"), "{}");
	assert.throws(() => ledger.reserve("t", "r", 1), /corrupt/);
}));

test("unpriced models are estimated with fallback rates instead of being refused", () => {
	const unpriced = { contextWindow: 272_000, maxTokens: 128_000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
	const bound = requestCostUpperBound(unpriced, 50_000);
	const expected = (70_000 * Math.max(FALLBACK_RATES_PER_MTOK.input, FALLBACK_RATES_PER_MTOK.cacheWrite) + 128_000 * FALLBACK_RATES_PER_MTOK.output) / 1e6;
	assert.equal(bound, expected);
	assert.ok(requestCostUpperBound(undefined, null) > 0);
	assert.equal(messageCostUsd({ input: 1_000_000, output: 0, cost: { total: 0 } }), FALLBACK_RATES_PER_MTOK.input);
	assert.equal(messageCostUsd({ input: 1_000_000, cost: { total: 3 } }), 3);
});

test("priced models use their own rates", () => {
	const priced = { contextWindow: 200_000, maxTokens: 10_000, cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } };
	assert.equal(requestCostUpperBound(priced, null), (200_000 * 3.75 + 10_000 * 15) / 1e6);
});
