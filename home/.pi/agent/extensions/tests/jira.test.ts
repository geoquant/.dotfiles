import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Value } from "typebox/value";

import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type ExecResult, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerLocalJiraTool from "../jira.ts";

async function jiraToolHarness(result: ExecResult, command: "help" | "show" | "create" = "show", args: string[] = ["EXAMPLE-123"]) {
	const calls: { executable: string; args: string[] }[] = [];
	let text = "";
	let failed: boolean | undefined;
	const controller = new AbortController();
	const host: Pick<ExtensionAPI, "registerTool" | "exec"> = {
		registerTool(tool) {
			assert.equal(tool.name, "jira");
			assert.equal(tool.exposure, "direct");
			assert.equal(tool.executionMode, "sequential");
			assert.ok(tool.promptGuidelines?.[0]?.includes("local CLI"));
			// Parse through the registered schema just as Pi does at the tool boundary.
			// SAFETY: Value.Parse validates the actual registered schema. The workspace has
			// two TypeBox copies whose generic StaticType identities differ in TypeScript.
			const params = Value.Parse(tool.parameters, { command, args }) as Parameters<typeof tool.execute>[1];
			// SAFETY: the tool reads only cwd; a Proxy rejects unexpected context reads.
			const ctx = new Proxy({ cwd: process.cwd() }, { get(target, key) { if (key === "cwd") return target.cwd; throw new Error(`Unexpected context read: ${String(key)}`); } }) as Parameters<typeof tool.execute>[4];
			pending = tool.execute("test-jira", params, controller.signal, undefined, ctx).then(output => {
				text = output.content.filter(block => block.type === "text").map(block => block.text).join("\n");
				failed = output.isError;
			});
		},
		async exec(executable, arguments_, options) {
			calls.push({ executable, args: arguments_ });
			assert.equal(options?.signal, controller.signal);
			assert.equal(options?.timeout, 120000);
			return result;
		},
	};
	let pending: Promise<void> | undefined;
	registerLocalJiraTool(host);
	await pending;
	return { calls, text, failed };
}

const success = { stdout: "EXAMPLE-123: Synthetic task\nStatus: In Progress", stderr: "", code: 0, killed: false };

test("registered Jira tool invokes installed CLI directly, without a shell or auth probes", async () => {
	const result = await jiraToolHarness(success);
	assert.match(result.calls[0]?.executable ?? "", /(?:\.local\/bin|dev\/me\/jira)\/jira$/);
	assert.deepEqual(result.calls[0]?.args, ["show", "EXAMPLE-123"]);
	assert.match(result.text, /Status: In Progress/);
	assert.equal(result.failed, false);
});

test("Jira tool preserves argument boundaries and maps help to --help", async () => {
	const result = await jiraToolHarness(success, "create", ["Synthetic summary; not a shell", "--project", "EXAMPLE", "--assign"]);
	assert.deepEqual(result.calls[0]?.args, ["create", "Synthetic summary; not a shell", "--project", "EXAMPLE", "--assign"]);
	const help = await jiraToolHarness(success, "help", []);
	assert.deepEqual(help.calls[0]?.args, ["--help"]);
});

test("Jira tool redacts credentials before model output", async () => {
	const token = `${"a".repeat(30)}.${"b".repeat(30)}.${"c".repeat(30)}`;
	const result = await jiraToolHarness({ ...success, stdout: `\u001b[32mFetched token:\n${token}\nCF-Access-Token: synthetic-secret\nPassword=synthetic-password` });
	assert.ok(!result.text.includes(token));
	assert.ok(!result.text.includes("synthetic-secret"));
	assert.ok(!result.text.includes("synthetic-password"));
	assert.ok(!result.text.includes("\u001b"));
});

test("failed, misleading zero-exit and timed-out mutations are not retried", async () => {
	for (const result of [{ ...success, code: 1 }, { ...success, stderr: "parse error: Invalid numeric literal" }, { ...success, killed: true }]) {
		const observed = await jiraToolHarness(result, "create", ["Synthetic task", "--project", "EXAMPLE", "--assign"]);
		assert.equal(observed.failed, true);
		assert.equal(observed.calls.length, 1);
		assert.match(observed.text, /outcome may be uncertain/);
	}
});

test("Pi standard global discovery loads Jira as an active tool outside Stratus", async () => {
	const settingsManager = SettingsManager.inMemory({ packages: [] });
	const resourceLoader = new DefaultResourceLoader({ cwd: "/tmp", agentDir: join(homedir(), ".pi/agent"), settingsManager });
	await resourceLoader.reload();
	const { session } = await createAgentSession({ cwd: "/tmp", settingsManager, resourceLoader, sessionManager: SessionManager.inMemory() });
	try {
		assert.ok(session.getAllTools().some(tool => tool.name === "jira"));
		assert.ok(session.getActiveToolNames().includes("jira"));
	} finally {
		session.dispose();
	}
});
