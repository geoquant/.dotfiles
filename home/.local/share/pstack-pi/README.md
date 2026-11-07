# Vendored pstack Pi adaptation

Upstream https://github.com/backnotprop/pstack at fce11a3442cfd59a21136de0b7010474c6a10ef5, with the existing local Pi portability adaptations. LICENSE retained. All 52 skills included; bro/how/reflect/teach/tdd register as pstack-prefixed names to preserve the user's other skills.

Stowed to ~/.local/share/pstack-pi and installed by agent-tooling sync. No model/provider credentials are included. Run /skill:setup-pstack on each computer to choose available models. Private ~/.agents/pstack-models.md takes precedence; do not copy work-only model IDs into public dotfiles. Script dependencies are not vendored: for the optional poteto-mode scripts, run `bun install --frozen-lockfile` in skills/poteto-mode/scripts when needed.
