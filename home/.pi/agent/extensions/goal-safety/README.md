# Task budget (goal-safety)

One rule: a single task never spends more than USD 100.

- **Task** = an active goal (its spend is shared across sessions and restarts), otherwise one user prompt plus everything that runs automatically after it (tool loops, compaction continuations, queued extension messages). Typing a new prompt starts a new task.
- Before every provider request the worst-case cost of that request (current context + headroom at the highest input rate, plus max output) is reserved. If spent + reservations + this request would cross USD 100, the request is aborted and the task is stopped. Stopped goals are marked `blocked`; resuming the same goal stays stopped.
- Models that report no price (e.g. `opencode.cloudflare.dev` gateway models, cost 0) are metered from token counts at flagship fallback rates (`FALLBACK_RATES_PER_MTOK`: $10 in / $50 out / $1 cache read / $12.5 cache write per Mtok). Adjust there if your real rates differ.
- Subagents / child `pi` processes inherit `PI_GOAL_BUDGET_ID` and charge the parent's task.
- Nothing else is blocked: all tools, MCP, codemode and subagents run normally. Ledger/tooling faults cancel only the current request with a visible notice; they never persist a stop.
- Paused/stale goal continuations are discarded so a paused goal can't resume itself.

Ledger: `~/.pi/agent/goal-safety-ledger/<task-id>.json`. To manually lift a stop, delete that file.

Limits: local admission guard. Model calls made outside Pi's provider hooks (non-Pi processes, extensions that call models in-process) are not counted.

Tests: from `~/.pi`, run `node --import tsx --test agent/extensions/tests/goal-safety*.test.ts agent/extensions/tests/continue-after-compaction.test.ts`.
