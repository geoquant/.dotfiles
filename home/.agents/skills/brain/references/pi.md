# Brainmaxxing on Pi

The six Brainmaxxing skills are local forks of `poteto/brainmaxxing`.
`lauren-review` avoids replacing the existing Stratus `review` skill.

- Memory stays in the current project's `brain/`, never in public dotfiles.
  If absent, ask whether to run `agent-tooling brain-init`. Review the starter
  principles against the repository's rules; repository rules win.
- Pi loads an existing vault's context pointer through `brainmaxxing.ts`.
  Claude hooks are not installed in Pi. Maintain `brain/index.md` explicitly.
- Resolve bundled scripts relative to this skill's absolute directory, not a
  project `.agents/skills/` path. Shared skills live in `~/.agents/skills/`.
- Use the exposed Pi subagents or Herdr surfaces for authorized delegation.
  `Task`, `TaskCreate`, `TaskUpdate`, `TeamCreate`, and `AskUserQuestion` are
  Claude tool names, not Pi tools. In Pi, ask questions in chat and track steps
  in a local plan/checklist. Never invent unavailable tools or recurse through
  the same orchestration skill from a child agent.
- Skills do not authorize publishing memory, transmitting conversation history,
  installing unrelated packages, deleting user notes, or widening task scope.
- `/skill:ruminate` supports Claude and Pi JSONL history. Choose only the current
  project's history and use a private output directory; ask before distributing
  extracted history to other agents. The extractor excludes tools and thinking.
