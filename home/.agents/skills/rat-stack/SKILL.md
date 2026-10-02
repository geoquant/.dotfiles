---
name: rat-stack
description: Use Joel Hooks' rat-stack scaffold and its pinned Effect, XState, Alchemy and verification fence. Use when creating a rat-stack project, studying its architecture, or refreshing its exact stack pins.
---

# rat-stack scaffold

`rat-stack` is a repository template, not a globally installed Pi extension.
`agent-tooling sync` refreshes the reference checkout at
`~/.local/share/agent-tooling/sources/joelhooks--rat-stack/`.

Before using the scaffold, read that checkout's `AGENTS.md`, `VISION.md`, and
`README.md`. The manifests are authoritative for the required Node and pnpm
versions. Use the scoped runtime (for example `fnm exec --using 24.18.0`) without
changing the runtime of unrelated projects.

For a new project, get approval for its name and visibility before
`gh repo create <name> --template joelhooks/rat-stack`. Clone the result outside
dotfiles, follow its bootstrap instructions, retain exact pins and install its
local hooks. Verify with its documented check/test/build gate. Never deploy
infrastructure or loosen the fence just to make bootstrap pass.

The reference checkout is not a dependency migration policy. Existing Stratus
projects retain their own APIs, versions, authorization, and repository rules.
Do not load rat-stack's project extension globally or copy its laws into other
repositories. Report a bootstrap failure with evidence rather than claiming
that having a checkout means its fence passed.
