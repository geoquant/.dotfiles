import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

function findLocalJiraCli(): string | undefined {
	for (const path of [join(homedir(), ".local/bin/jira"), join(homedir(), "dev/me/jira/jira")]) {
		try {
			accessSync(path, constants.X_OK);
			return path;
		} catch {
			// Try the canonical source when the PATH-facing symlink is unavailable.
		}
	}
	return undefined;
}

function redactJiraOutput(output: string): string {
	return output
		.replace(/\u001b\[[0-9;]*m/g, "")
		.replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\b/g, "[REDACTED ACCESS TOKEN]")
		.replace(/((?:authorization|cf-access-token|password|api[_-]?token)\s*[:=]\s*)([^\r\n]+)/gi, "$1[REDACTED]");
}

/** Register the authenticated local Jira CLI as an always-discoverable global Pi tool. */
export default function registerLocalJiraTool(pi: Pick<ExtensionAPI, "registerTool" | "exec">): void {
	pi.registerTool(defineTool({
		name: "jira",
		label: "Local Jira CLI",
		exposure: "direct",
		executionMode: "sequential",
		promptSnippet: "Use Jonnie's authenticated local Jira CLI for tickets, boards, assignment and transitions.",
		promptGuidelines: ["For Jira work, call the jira tool first. It uses the installed local CLI and its existing authentication; a separate REST/MCP probe is not evidence that the CLI is unavailable."],
		description: "Run Jonnie's installed, authenticated LOCAL Jira CLI (~/.local/bin/jira; source ~/dev/me/jira/jira). Use this tool FIRST for Jira, not MCP or separate REST/auth probes. Commands: help, show TICKET, board, my, move TICKET [STATUS], assign TICKET, create SUMMARY --project PROJECT --assign [--description TEXT --status STATUS --type Task]. Pass each argument separately. CLI owns existing authentication; do not ask the user to authenticate based on an unrelated API probe. Create/assign/move require user authorization; never automatically retry an uncertain mutation. After mutations, use show to verify assignment/status. Credentials are redacted from output.",
		parameters: Type.Object({
			command: Type.Union(["help", "show", "board", "my", "move", "assign", "create"].map(value => Type.Literal(value))),
			args: Type.Optional(Type.Array(Type.String({ maxLength: 30000 }), { maxItems: 30, description: "CLI arguments, one string per argument; no shell syntax." })),
			timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 300, default: 120 })),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const cli = findLocalJiraCli();
			if (!cli) {
				return { isError: true, content: [{ type: "text", text: "Local Jira CLI missing: checked ~/.local/bin/jira and ~/dev/me/jira/jira." }], details: { command: params.command, code: null } };
			}
			try {
				const result = await pi.exec(cli, [params.command === "help" ? "--help" : params.command, ...(params.args ?? [])], {
					cwd: ctx.cwd,
					...(signal ? { signal } : {}),
					timeout: (params.timeoutSeconds ?? 120) * 1000,
				});
				const output = redactJiraOutput(`${result.stdout}\n${result.stderr}`).trim();
				const failed = result.code !== 0 || result.killed || /(?:parse error:|Could not resolve host|^\s*Error:)/im.test(output);
				const bounded = output.length > 24000 ? `${output.slice(0, 24000)}\n[Output truncated]` : output;
				return {
					isError: failed,
					content: [{ type: "text", text: `Local Jira CLI: ${params.command}; exit ${result.code}${result.killed ? "; interrupted/timed out" : ""}\n${bounded || "(No output)"}${failed && ["create", "assign", "move"].includes(params.command) ? "\nMutation outcome may be uncertain. Verify with show before any retry." : ""}` }],
					details: { command: params.command, cli, code: result.code, killed: result.killed },
				};
			} catch {
				// Executor exceptions may contain raw output or credentials: never forward them.
				return { isError: true, content: [{ type: "text", text: "Local Jira CLI execution failed or was cancelled. Verify any mutation with show before retrying; no automatic retry was performed." }], details: { command: params.command, code: null } };
			}
		},
	}));
}
