#!/usr/bin/env python3
"""X (Twitter) API v2 helper for agents. Read-only, app-only bearer auth.

Token: $X_BEARER_TOKEN, else ~/.pi/agent/credentials/x-bearer-token.
HTTP goes through curl because Python's SSL store rejects the WARP CA.

Usage:
  x.py search QUERY [--all] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
                    [--sort relevancy|recency] [--max N] [--json FILE]
  x.py tweet ID
  x.py replies ID [--max N] [--json FILE]
  x.py quotes ID [--max N] [--json FILE]
  x.py user HANDLE [--max N] [--json FILE]
  x.py usage
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

API = "https://api.x.com/2/"
TOKEN_FILE = Path.home() / ".pi/agent/credentials/x-bearer-token"
FIELDS = {
    "tweet.fields": "created_at,public_metrics,author_id,conversation_id,lang,note_tweet",
    "expansions": "author_id",
    "user.fields": "username,name,public_metrics",
}


def token() -> str:
    value = os.environ.get("X_BEARER_TOKEN") or (
        TOKEN_FILE.read_text().strip() if TOKEN_FILE.exists() else ""
    )
    if not value:
        sys.exit(f"No X token: set X_BEARER_TOKEN or create {TOKEN_FILE}")
    return value


def get(path: str, params: dict) -> dict:
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    proc = subprocess.run(
        ["curl", "-sS", url, "-H", "Authorization: Bearer " + token()],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        sys.exit(f"curl failed: {proc.stderr.strip()}")
    data = json.loads(proc.stdout)
    if "data" not in data and (data.get("errors") or data.get("title")):
        sys.exit("X API error: " + json.dumps(data)[:500])
    return data


def paginate(path: str, params: dict, limit: int, token_param: str) -> list:
    tweets, users, cursor = [], {}, None
    while len(tweets) < limit:
        page = dict(params, **FIELDS)
        page["max_results"] = max(10, min(100, limit - len(tweets)))
        if cursor:
            page[token_param] = cursor
        data = get(path, page)
        tweets += data.get("data", [])
        for user in data.get("includes", {}).get("users", []):
            users[user["id"]] = user
        cursor = data.get("meta", {}).get("next_token")
        if not cursor:
            break
        time.sleep(1.1)  # full-archive search allows 1 request/second
    for tweet in tweets:
        user = users.get(tweet.get("author_id"), {})
        tweet["username"] = user.get("username")
        tweet["followers"] = user.get("public_metrics", {}).get("followers_count")
        if tweet.get("note_tweet"):
            tweet["text"] = tweet["note_tweet"]["text"]
    return tweets[:limit]


def score(tweet: dict) -> int:
    m = tweet.get("public_metrics", {})
    return (
        m.get("like_count", 0)
        + 2 * m.get("retweet_count", 0)
        + m.get("bookmark_count", 0)
        + 3 * m.get("quote_count", 0)
    )


def emit(tweets: list, json_file: str | None) -> None:
    if json_file:
        Path(json_file).write_text(json.dumps(tweets))
        print(f"wrote {len(tweets)} tweets to {json_file}", file=sys.stderr)
    for t in sorted(tweets, key=score, reverse=True):
        m = t.get("public_metrics", {})
        text = re.sub(r"\s+", " ", re.sub(r"https://t\.co/\S+", "", t["text"])).strip()
        print(
            f"@{t.get('username')} {t.get('created_at', '')[:10]} "
            f"likes={m.get('like_count', 0)} bookmarks={m.get('bookmark_count', 0)} "
            f"views={m.get('impression_count', 0)} https://x.com/i/status/{t['id']}\n  {text[:400]}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="X API v2 helper")
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--all", action="store_true", help="full archive instead of last 7 days")
    s.add_argument("--since")
    s.add_argument("--until")
    s.add_argument("--sort", default="relevancy", choices=["relevancy", "recency"])
    for name in ("replies", "quotes", "user"):
        p = sub.add_parser(name)
        p.add_argument("target")
    for p in (s, *[sub.choices[n] for n in ("replies", "quotes", "user")]):
        p.add_argument("--max", type=int, default=100)
        p.add_argument("--json")
    sub.add_parser("tweet").add_argument("id")
    sub.add_parser("usage")
    args = parser.parse_args()

    if args.cmd == "usage":
        print(json.dumps(get("usage/tweets", {})["data"]))
    elif args.cmd == "tweet":
        data = get(f"tweets/{args.id}", FIELDS)
        emit([dict(data["data"], username=data.get("includes", {}).get("users", [{}])[0].get("username"))], None)
    elif args.cmd == "search":
        params = {"query": args.query, "sort_order": args.sort}
        if args.since:
            params["start_time"] = args.since + "T00:00:00Z"
        if args.until:
            params["end_time"] = args.until + "T00:00:00Z"
        path = "tweets/search/all" if args.all else "tweets/search/recent"
        emit(paginate(path, params, args.max, "next_token"), args.json)
    elif args.cmd == "replies":
        root = get(f"tweets/{args.target}", {"tweet.fields": "created_at"})["data"]
        params = {"query": f"conversation_id:{args.target}", "start_time": root["created_at"]}
        emit(paginate("tweets/search/all", params, args.max, "next_token"), args.json)
    elif args.cmd == "quotes":
        emit(paginate(f"tweets/{args.target}/quote_tweets", {}, args.max, "pagination_token"), args.json)
    elif args.cmd == "user":
        uid = get(f"users/by/username/{args.target.lstrip('@')}", {})["data"]["id"]
        params = {"exclude": "retweets,replies"}
        emit(paginate(f"users/{uid}/tweets", params, args.max, "pagination_token"), args.json)


if __name__ == "__main__":
    main()
