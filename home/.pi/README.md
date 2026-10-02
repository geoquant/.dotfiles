# .pi

Global pi config, synced via dotfiles and stowed into `~/.pi`.

`dot stow`, `dot init`, and `dot update` also ensure Pi's built-in Mermaid
renderer is enabled with `markdown.mermaid: "streaming"`, skill commands are
enabled, and the `/show-me` compatibility alias is available. The settings
file stays machine-local because it contains provider and package preferences;
the dotfiles bootstrap adds these display/tooling settings and reconciles the
portable package manifest without overwriting provider/model preferences.
See [the personal tooling stack](../../TOOLING.md) for sources, updates, skill
forks, memory, Muster portability, and verification limits. Pi renders diagrams as Unicode terminal art,
so very wide diagrams may still need a wider terminal or shorter labels.

## Extension dependency workspace

Package-style global extensions stay in `agent/extensions/` so pi can still auto-discover them from:

- `~/.pi/agent/extensions/*.ts`
- `~/.pi/agent/extensions/*/index.ts`

This directory is now the shared npm workspace root for extensions with their own `package.json` files.

Install or refresh all extension dependencies from here:

```bash
npm install
```

Run workspace checks:

```bash
npm run check
```

Current workspace-managed extensions live under:

- `agent/extensions/private-gateway`
- `agent/extensions/pi-skill-toggle`
- `agent/extensions/save-md`

Pi Web Tools is maintained at [dmmulroy/pi-web-tools](https://github.com/dmmulroy/pi-web-tools) and installed through `agent/settings.json` as a Git package.

MCP servers use Pi's built-in MCP support and are tracked in `agent/mcp.json`.
OAuth credentials remain machine-local in Pi's credential store. Executor replaces
the disabled grep.app integration, but its GitHub source must be connected in the
Executor web app before GitHub tools appear.

After changing extension code, package settings, or MCP configuration, reload pi with `/reload`.
