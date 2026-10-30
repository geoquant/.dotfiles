import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { discoverAndLoadExtensions, ExtensionRunner, ModelRegistry, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

async function withRuntime(run: (runner: ExtensionRunner, session: SessionManager, aborts: () => number) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "task-budget-runtime-"));
	const home = process.env.HOME;
	const budgetId = process.env.PI_GOAL_BUDGET_ID;
	const budgetState = globalThis as { __piTaskBudgetInherited?: string | null };
	const inheritedBudget = budgetState.__piTaskBudgetInherited;
	delete process.env.PI_GOAL_BUDGET_ID;
	budgetState.__piTaskBudgetInherited = null;
	process.env.HOME = cwd;
	try {
		const modelRuntime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, allowModelNetwork: false });
		const loaded = await discoverAndLoadExtensions([join(import.meta.dirname, "..", "goal-safety", "index.ts")], cwd, join(cwd, ".agent"));
		assert.deepEqual(loaded.errors, []);
		const session = SessionManager.create(cwd);
		loaded.runtime.appendEntry = (customType, data) => { session.appendCustomEntry(customType, data); };
		let count = 0;
		const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, cwd, session, new ModelRegistry(modelRuntime));
		runner.bindCore(loaded.runtime, {
			getModel: () => undefined, getScopedModels: () => [], isIdle: () => false,
			isProjectTrusted: () => true, getSignal: () => undefined, abort: () => { count++; },
			hasPendingMessages: () => false, shutdown: () => undefined, getContextUsage: () => undefined,
			compact: () => undefined, getSystemPrompt: () => "",
		});
		await run(runner, session, () => count);
	} finally {
		process.env.HOME = home;
		if (budgetId === undefined) delete process.env.PI_GOAL_BUDGET_ID;
		else process.env.PI_GOAL_BUDGET_ID = budgetId;
		if (inheritedBudget === undefined) delete budgetState.__piTaskBudgetInherited;
		else budgetState.__piTaskBudgetInherited = inheritedBudget;
		await rm(cwd, { recursive: true, force: true });
	}
}

test("cancelled goal bookkeeping is consumed silently", async () => withRuntime(async (runner, _session, aborts) => {
	const result = await runner.emitInput("A queued hidden goal continuation was stale and has been cancelled before running.\nCurrent status: paused.", undefined, "extension");
	assert.equal(result.action, "handled");
	assert.equal(aborts(), 0);
}));

test("paused goal continuation is rejected before dispatch", async () => withRuntime(async (runner, session) => {
	session.appendCustomEntry("pi-codex-goal", { kind: "set", goal: { goalId: "goal-runtime-test", status: "paused" } });
	const result = await runner.emitInput('<pi_goal_continuation goal_id="goal-runtime-test">continue</pi_goal_continuation>', undefined, "extension");
	assert.equal(result.action, "handled");
}));

test("requests are admitted when the model is unknown or unpriced (no spurious aborts)", async () => withRuntime(async (runner, _session, aborts) => {
	await runner.emit({ type: "session_start" } as never);
	await runner.emitInput("hello", undefined, "interactive");
	await runner.emit({ type: "turn_start", turnIndex: 0, timestamp: Date.now() });
	await runner.emitBeforeProviderRequest({ messages: [] });
	assert.equal(aborts(), 0);
}));

test("subagents and other tools are not blocked", async () => withRuntime(async (runner) => {
	await runner.emit({ type: "session_start" } as never);
	for (const toolName of ["subagent", "codemode", "mcp__paper__get_basic_info"]) {
		const result = await runner.emitToolCall({ type: "tool_call", toolCallId: toolName, toolName, input: {} });
		assert.notEqual(result?.block, true);
	}
	const bash = await runner.emitToolCall({ type: "tool_call", toolCallId: "b", toolName: "bash", input: { command: "ls ~/.pi && pi --help" } });
	assert.notEqual(bash?.block, true);
}));

test("hitting USD 100 stops the task; follow-ups are refused; a new user prompt starts a fresh task", async () => withRuntime(async (runner, _session, aborts) => {
	await runner.emit({ type: "session_start" } as never);
	await runner.emitInput("long task", undefined, "interactive");
	await runner.emit({ type: "turn_start", turnIndex: 0, timestamp: Date.now() });
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 100 } };
	await runner.emit({ type: "message_end", message: { role: "assistant", content: [], usage, stopReason: "stop", timestamp: Date.now() } } as never);
	assert.ok(aborts() > 0);
	const before = aborts();
	const followUp = await runner.emitInput("Compaction has just completed. Resume.", undefined, "extension");
	assert.equal(followUp.action, "handled");
	await runner.emit({ type: "turn_start", turnIndex: 1, timestamp: Date.now() });
	assert.ok(aborts() > before);
	const after = aborts();
	await runner.emitInput("new task", undefined, "interactive");
	await runner.emit({ type: "turn_start", turnIndex: 0, timestamp: Date.now() });
	assert.equal(aborts(), after);
}));
