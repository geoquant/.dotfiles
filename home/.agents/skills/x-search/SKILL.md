---
name: x-search
description: Search X (Twitter) through the official API v2. Use when a task needs tweets, X/Twitter trends or sentiment, reactions to a launch (replies, quote-posts), or a user's recent posts.
---

Read-only X API v2 access with an app-only bearer token at `~/.pi/agent/credentials/x-bearer-token` (machine-local, mode 600; `$X_BEARER_TOKEN` overrides it). Keep the token out of output, files and commits: the helper reads it itself.

## Setup on another machine

The skill and helper sync through `geoquant/.dotfiles`; run `dot update` on each machine. Requires Python 3.10+ and `curl`; no Python packages are needed.

Provision the X API app-only bearer token separately on each machine: set `X_BEARER_TOKEN` in your private environment, or create `~/.pi/agent/credentials/x-bearer-token` with mode `600` inside a directory with mode `700`. Use a private editor or secret manager to populate it. Never commit the token or include it in command output. Verify access with `python3 ~/.agents/skills/x-search/scripts/x.py usage`.

## Helper

`scripts/x.py` (relative to this skill directory) prints tweets ranked by engagement (likes + 2×reposts + bookmarks + 3×quotes) with handle, date, metrics and link. Add `--json FILE` to keep the raw results for later analysis.

```bash
X=~/.agents/skills/x-search/scripts/x.py
python3 $X search 'shadcn lint -is:retweet lang:en' --all --since 2026-09-01 --max 200
python3 $X search '"design system" agents -is:retweet' --sort recency   # last 7 days
python3 $X replies 2099534231114314145 --max 300   # whole conversation under a post
python3 $X quotes 2099534231114314145
python3 $X user shadcn --max 50                     # recent original posts
python3 $X tweet 2099534231114314145
python3 $X usage                                    # monthly read usage vs cap
```

## Query craft

- `search` defaults to the last 7 days; add `--all` for the full archive (back to 2006), with `--since`/`--until` to bound it.
- Append `-is:retweet lang:en` to most queries; reposts otherwise flood relevancy results.
- Operators: `from:handle`, `conversation_id:ID`, `"exact phrase"`, `(a OR b)`, `-term`, `has:links`, `is:quote`. Engagement filters (`min_faves`) are unsupported; rank locally with the helper's score instead.
- Relevancy-sorted broad queries pull in off-topic noise (crypto, generic "I wish" threads). Pair a distinctive term with a topic term, then skim before quoting.
- For launch reception, combine `replies` and `quotes` on the launch post. Bookmarks close to likes signal intent to use the thing, not just applause.

## Budget

Each returned tweet counts against the project's monthly read cap (3M, resets on day 5). Check `usage` before a large sweep; a 20-query research pass costs about 4k reads. Full-archive search is rate limited to 1 request/second (the helper sleeps between pages).
