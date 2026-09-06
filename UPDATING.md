# Updating & Sync Flow (jonnie)

This repo is a personalized copy of [dmmulroy/.dotfiles](https://github.com/dmmulroy/.dotfiles).
The goal: stay mostly in sync with Dillon while carrying a small set of
personal commits on top (identity, credentials wiring, and my own skills).

```
upstream = dmmulroy/.dotfiles   (Dillon — read-only)
origin   = geoquant/.dotfiles   (mine — push here)
```

## Divergence policy

Keep personal changes **additive** (new files) wherever possible so rebases
onto Dillon's history stay conflict-free:

- **My skills** → new directories under `home/.agents/skills/` (e.g. `animate/`,
  `design/`, `review/`). Dillon never touches these paths.
- **Docs like this one** → new files (`UPDATING.md`), not edits to `README.md`.
- **Edited shared files** (the only rebase-conflict surface, all tiny):
  - `home/.config/git/config` — my identity + signing key
  - `home/.config/git/work_config` — work identity and Cloudflare SSH signing key (applies under `~/Code/work/` or by GitLab remote URL, including worktrees)
  - `dot` — `GITHUB_EMAIL`
  - `home/.plannotator/config.json` — `displayName`
  - `README.md` — clone URLs
  - `home/.pi/agent/mcp.json` — my MCP servers (context7, grep_app,
    agentation, cf-portal); Dillon's points at his private servers
- **My additive fish config** (never conflicts):
  - `conf.d/jonnie.fish` — personal aliases (eza/bat/ks/oc/claude), extra
    paths, python→python3, and an `npx`/`bunx` un-alias guard when `vpx`
    isn't installed
  - `conf.d/{direnv,fnm,opencode,profile-guard}.fish`, `functions/{grel,__git.delete_branches}.fish`
- **Paid/licensed skills live in the PRIVATE repo `geoquant/skills-private`**
  (ui.sh, animations.dev / Emil Kowalski content). They are gitignored here
  and symlinked into `home/.agents/skills/`. On a new machine:
  `git clone git@github.com:geoquant/skills-private.git ~/.skills-private`
  then `for n in ~/.skills-private/skills/*; ln -s $n ~/.dotfiles/home/.agents/skills/(basename $n); end`
- **Per-machine, gitignored, recreate by hand on each machine:**
  - `~/.config/fish/conf.d/secrets.fish` — API keys
  - `~/.config/fish/conf.d/machine.fish` — MACHINE_PROFILE (personal/work)
    + expected opencode key fingerprint

If Dillon adds a skill with the same name as one of mine, rename mine once.

## Git identities and signing

Personal repositories use the identity in `home/.config/git/config`. Work
repositories select `work_config` by their GitLab remote URL (SSH or HTTPS),
regardless of checkout location, or by the existing `~/Code/work/` fallback.
Do not put an unconditional work identity in `~/.gitconfig`: Git reads that file
later and it overrides the shared personal/work selection.

Authentication and commit signing are separate. GitHub HTTPS uses the existing
`gh` credential helper; Cloudflare SSH authentication remains managed by the
Cloudflare setup. Work signing uses `~/.ssh/cloudflare/id_ed25519.pub` and its
private key/agent. Personal signing defaults to `~/.ssh/id_ed25519.pub`; it needs
a separate personal key registered as a signing key on GitHub. Never copy private
keys or tokens into this repository or reuse the work key for personal signing.

For machine-specific overrides, create real, **unstowed** files:

- `~/.config/git/local_config` — personal identity/signing overrides, loaded
  before work selection.
- `~/.config/git/work_local_config` — work signing overrides, loaded last within
  `work_config`.

These files stay outside the dotfiles repository and survive restows. A personal
`gpg.ssh.program` override can load an encrypted signing key from macOS Keychain
before invoking `ssh-keygen`; `work_config` resets the program to `ssh-keygen`
so work commits do not depend on personal credentials. Keep machine-specific
helpers (for example `~/.config/git/git-sign-personal`), allowed-signers files,
and keys outside this repository. Do not use `~/.local/bin` for machine-local
helpers when that directory is itself a Stow symlink into the repository.

On macOS, store an encrypted key's passphrase using
`/usr/bin/ssh-add --apple-use-keychain <private-key-path>`. A signing helper can
run that command again before signing to reload the key after an agent restart.
Register only the public key with GitHub using
`gh ssh-key add <public-key-path> --type signing`; the CLI needs the
`admin:ssh_signing_key` scope. This does not change HTTPS authentication.

Signing remains required; a new machine must provision its own keys before
committing. Each machine has its own private key and Keychain entry; neither is
synced by `dot update`.
Check effective settings inside each repository with
`git config --show-origin --get user.email` and
`git config --show-origin --get user.signingkey`.

## Day-to-day: sync my own machines

```fish
dot update        # pulls origin/main, updates brew, re-stows, updates pi
```

Pushing changes made on one machine:

```fish
cd ~/.dotfiles
git add -A && git commit -m "..." && git push
```

## Periodically: pull in Dillon's changes

```fish
cd ~/.dotfiles
git fetch upstream
git rebase upstream/main          # replays my commits on top
git push --force-with-lease origin main
./dot stow                        # re-link if files moved
```

Conflicts only ever occur in the "edited shared files" list above — resolve
in my favor (keep my identity), `git rebase --continue`.

## New machine bootstrap

```fish
git clone https://github.com/geoquant/.dotfiles.git ~/.dotfiles
cd ~/.dotfiles
./dot init --skip-font    # mono-lisa is Dillon's private font repo
```

Then restore secrets (never committed — gitignored):

| Secret | File |
|---|---|
| Exa + Context7 API keys | `~/.config/fish/conf.d/secrets.fish` |
| pi provider auth (opencode) | `~/.pi/agent/auth.json` (or re-login via pi) |
| opencode (anthropic + opencode) | `~/.local/share/opencode/auth.json` (`opencode auth login`) |
| Figma MCP | `~/.local/share/opencode/mcp-auth.json` (re-auth on first use) |

Only `secrets.fish` must be restored by hand; the auth files regenerate
through login flows.

## Skills: single source of truth

All agent skills live in `home/.agents/skills/` (stowed to `~/.agents/skills`,
which pi, Codex, and other harnesses read). Do **not** put skills in
`~/.pi/agent/skills/` or per-project `.agents/skills/` mirrors — duplicate
names across locations cause collision warnings at pi startup.

To add a new personal skill:

```fish
mkdir ~/.dotfiles/home/.agents/skills/my-skill
$EDITOR ~/.dotfiles/home/.agents/skills/my-skill/SKILL.md
cd ~/.dotfiles && git add -A && git commit -m "Add my-skill" && git push
```
