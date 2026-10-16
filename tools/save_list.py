#!/usr/bin/env python3
"""Save the account's repo list (the raw JSON a `list_repos` call returns) as data/connector_repos.json.

    python3 -I tools/save_list.py < list_repos.json

Claude sessions get the list from the Claude Code Remote connector; outside Claude use `regen.py --list gh`.
"""
import json, os, sys
from datetime import datetime, timezone

raw = json.load(sys.stdin)
repos = raw.get("repos", raw) if isinstance(raw, dict) else raw
out = {"source": "Claude Code Remote · list_repos(limit=200)", "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "repos": [{"name": r["full_name"].split("/", 1)[1], "pushed_at": r.get("pushed_at"), "visibility": r.get("visibility")}
                 for r in repos if r.get("full_name", "").startswith("Jozzpoly/")]}
if isinstance(raw, dict) and raw.get("has_more"):
    sys.exit("lista ma kolejne strony (has_more): zwiększ limit, inaczej pokrycie skłamie (przypadek C16)")
path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "connector_repos.json")
json.dump(out, open(path, "w"), ensure_ascii=False, indent=1)
print(f"{len(out['repos'])} repo · sprawdzone {out['checked_at']} → {os.path.relpath(path)}")
