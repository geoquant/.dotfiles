# Personal agent stack

The stack is installed locally and reproduced from this repository. Live Pi
settings, models, credentials, memory and Muster state remain machine-local.

| Layer | Upstream / local integration |
| --- | --- |
| Pi | `@earendil-works/pi-coding-agent`; npm extension workspace under `home/.pi` |
| Herdr | Homebrew `herdr`; existing sessions are never restarted automatically |
| Time | `joelhooks/pi-until`; session watches and recurring wakes |
| Hands | `joelhooks/pi-bellwether`; direct Herdr tools and bounded watches |
| Factories | `joelhooks/pi-muster`; projects, lanes, workers, verified packets, desk |
| Messaging | `nicobailon/pi-intercom`; required by Muster |
| Floor | `joelhooks/rat-stack`; separate reference/template checkout, scoped Node/pnpm |
| Matt Pocock | Engineering + productivity skills; current source revision and fork mode in `skill-sources.json` |
| Lauren Tan | Brainmaxxing memory loop, Noodle CLI skill, How, behavior-verification fork |

## Bootstrap and update

```sh
./dot init                 # Homebrew tools, stow, install Pi and reconcile packages
agent-tooling sync          # install missing packages, refresh reference repositories
agent-tooling doctor        # versions, packages, source revisions, Herdr restart status
dot update                  # upgrade Homebrew and Pi; restow and reconcile this stack
```

Package sources are in `home/.config/agent-tooling/pi-packages.txt`. The sync
command adds missing entries without replacing existing Pi settings or package
filters. Source repositories live outside stowed directories at
`~/.local/share/agent-tooling/sources/`. Dirty source checkouts fail closed.

Run `/reload` or start a new Pi session after changing extensions or skills.
A Pi binary upgrade takes effect in a new process. Fish's `pi` function and
`agent-tooling sync` use scoped Node 24.18.0; existing project Node defaults stay
unchanged. Check `herdr status` before
using new server features. Restart Herdr only at a safe time: do not stop a server
from an active pane or assume updating its binary updated the running server.

## Skills: combine and fork

Skills live once in `home/.agents/skills/` and stow to `~/.agents/skills/`.
Do not run a skill installer over these symlinks. Review upstream source diffs,
then merge the canonical copies; `sync` deliberately preserves forks.

Matt's stable engineering/productivity collection is included, not his
`in-progress` or miscellaneous experiments. Existing no-recursion and
user-invocation guards stay intact. `/skill:ask-matt` is the router;
`/skill:setup-matt-pocock-skills` configures an individual project on request.
`matt-pr` avoids the existing Stratus `pr` skill.

Lauren's memory skills are `brain`, `reflect`, `meditate`, `ruminate`, `plan`,
and `lauren-review` (leaving the existing `review` unchanged). They share Pi
portability guidance in `brain/references/pi.md`. `how` explains architecture;
`lauren-verification` adapts the fictional verification example to real drivers.
Its upstream intentionally omits the Atlas driver; this setup does not pretend
that Atlas is an installed product. Source attribution and licenses are tracked
under `home/.config/agent-tooling/` and in the imported skill trees.

## Memory is opt-in and project-local

```sh
cd /path/to/project
agent-tooling brain-init
```

This creates `brain/` from Lauren's public starter vault only if absent. Review
its principles against project policy. The Pi extension discovers an existing
vault through a small pointer; it never seeds or publishes memory automatically.
Maintain indexes explicitly. The Claude hooks are not Pi hooks.

`ruminate` can extract Claude and Pi JSONL text, excluding tools and thinking,
into a private directory. Select one project's history and obtain approval before
handing private history to analysis agents. No real history ships in this repo.
Paid skills and the local tldraw skill remain in `~/.skills-private`, not GitHub
public dotfiles; restore their ignored links separately on another machine.

## Muster portability and safety

A private `~/.config/muster/roster.json` is seeded from the live Pi default model
only when absent. Existing rosters are never overwritten. No private gateway
model IDs are committed. Edit the roster when your preferred role models change.

Fish exports `MUSTER_WORKER_WORKTREE=$HOME/.local/bin/muster-worker-worktree`.
The adapter produces the `worktree`, `branch`, and exact `base` receipts Muster
requires, using independent Git clones. It refuses dirty/untracked/ignored work and
unharvested commits on normal removal. `--force` is destructive and requires
approval; Muster additionally requires verified packet evidence before using it.

The upstream author's optional private desk extension is not copied. Use
Muster's built-in `desk_inbox`, `desk_answer`, and Switchboard instead. Clone
workers, packet verification and packet landing use the portable adapter; a
live factory launch still needs explicit project/lane/agent authorization.
No factories, recurring watches or Noodle loops start just by installing tools.

Noodle is installed through the narrowly trusted Homebrew formula
`poteto/tap/noodle`. Its portable CLI skill is global. Project backlog adapters,
provider selection, and scheduled skills are configured per project; no Noodle
loop is started and no Stratus project settings are changed by this bootstrap.

## rat-stack is a scaffold, not an ambient migration

```sh
agent-tooling rat-check
```

This uses scoped Node 24.18.0 and pnpm 11.3.0, installs exact dependencies and
hooks, builds the cold-clone core dependency, fetches pinned code objects, and
runs the upstream check/test/build fence. It leaves unrelated projects' runtimes
unchanged. If fnm downloads fail behind a corporate CA, fix its trust setup or
install a checksum-verified official binary; never disable TLS verification.
Create a new template repository only after agreeing its name and visibility.
Do not globally load rat-stack's project extension or deploy its infrastructure.

## Verification and known limits (2026-10-02)

- Pi 1.0.0 and Herdr binary 0.9.2 installed; live Herdr server 0.8.2 retained.
- Noodle 0.1.5 installed. Until 0.6.0, Bellwether 1.5.0, Muster 0.1.0 and
  Intercom 0.16.0 loaded from the verified GitHub sources.
- Pi loader: no extension errors or skill collisions. Bounded Bellwether
  current-pane read and watch/cancel passed; Until list and Muster's missing
  project refusal passed without model calls or creating lanes.
- Local Pi workspace checks and clone/history/brain behavior tests pass.
- Until upstream declares a host-provided Pi TUI package as a runtime dependency;
  Pi warns. It loads successfully; no local upstream patch is hidden here.
- Pi 1.0.0's published shrinkwrap pins `brace-expansion` 5.0.9. npm audit reports
  a high-severity denial-of-service advisory; routine update/audit-fix does not
  override that shrinkwrap. A fixed upstream release is needed. Do not claim a
  clean security audit or disable shrinkwrap integrity to silence it.
- rat-stack installs, its CLI/core build passes, and 57 of 58 fence tasks pass.
  One upstream content test expects empty stderr but receives a local npm config
  warning for `${NPM_TOKEN}`. The test's child process does not retain the caller's
  npm-config overrides. The fence remains failing; no rule/test is weakened.

Local verification:

```sh
python3 tests/test-agent-tooling.py -v
bash -n dot home/.local/bin/agent-tooling
shellcheck home/.local/bin/agent-tooling
fish --no-execute home/.config/fish/conf.d/agent-tooling.fish
(cd home/.pi && npm run check)
(cd home/.pi && node --import tsx --test agent/extensions/tests/brainmaxxing.test.ts)
git diff --check
```
