# Create prompt

A global prompt-writing skill distilled from *The Art of Proper Speech — Volume
VI: The Prompt Architect*. Creates copy-ready prompts for LLMs, tool-using agents,
and human collaborators without executing the resulting task.

## Pi usage

```text
/create-prompt
/create-prompt Write a prompt to review a technical design for operational risks
/create-prompt Improve this prompt: "Summarize this report"
/skill:create-prompt Draft a brief for a human editor
```

With no brief, the skill asks what you want to accomplish and who will receive
the prompt. With enough context, it returns one prompt and flags any essential
assumptions. It can also be discovered automatically for prompt-writing requests.

Pi exposes skills as `/skill:name`. The exact `/create-prompt` command is a thin
prompt template at `home/.pi/agent/prompts/create-prompt.md` that loads the same
skill. The workflow lives only in `SKILL.md`; detailed technique selection lives
in `references/techniques.md`.

## Install and sync

The dotfiles `home/` tree mirrors the home directory. GNU Stow installs:

- `home/.agents/skills/create-prompt/` → `~/.agents/skills/create-prompt/`
- `home/.pi/agent/prompts/create-prompt.md` → `~/.pi/agent/prompts/create-prompt.md`

On an existing machine after pulling the dotfiles changes:

```sh
cd ~/.dotfiles
git pull --ff-only origin main
dot stow
```

The normal `dot update` workflow also pulls and restows. On a new machine, use
the repository's `dot init` workflow. In an already-running Pi session, run
`/reload`; new sessions discover both resources globally, regardless of project.

There are no additional packages, API keys, or executable dependencies. The
long-form source essay is not bundled; its incomplete citations, historical
model examples, and numerical performance claims are not treated as verified
facts. The skill preserves its practical principles while using explicit
uncertainty, authority boundaries, and observable completion checks.
