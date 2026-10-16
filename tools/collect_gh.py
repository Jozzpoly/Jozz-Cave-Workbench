#!/usr/bin/env python3
"""Library v1 — GitHub-side collector (metadata, languages, PRs, CI runs, open issues).

Usage: python3 -I collect_gh.py OUT.json [REPO_LIST.json]
Without REPO_LIST.json it reads data/connector_repos.json next to this folder.
"""
import json, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

OUT = sys.argv[1]
OWNER = "Jozzpoly"
REPOS = []  # from REPO_LIST.json, by default data/connector_repos.json


def api(path, paginate=False):
    args = ["gh", "api", "-H", "Accept: application/vnd.github+json", path]
    if paginate:
        args.insert(2, "--paginate")
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        return {"_error": (r.stderr or r.stdout)[:300]}
    txt = r.stdout.strip()
    if paginate and txt.startswith("[") and "][" in txt:
        txt = txt.replace("]\n[", ",").replace("][", ",")
    try:
        return json.loads(txt) if txt else None
    except json.JSONDecodeError:
        return {"_error": "json"}


def api_lines(path):
    """Manual pagination (the proxy blocks numeric-id 'next' links)."""
    items, page = [], 1
    while page < 30:
        sep = "&" if "?" in path else "?"
        r = subprocess.run(["gh", "api", "-H", "Accept: application/vnd.github+json", f"{path}{sep}page={page}"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            return items if items else {"_error": (r.stderr or r.stdout)[:300]}
        chunk = json.loads(r.stdout or "[]")
        items += chunk
        if len(chunk) < 100:
            break
        page += 1
    return items


def first_line(t, n=200):
    if not t:
        return None
    for l in t.splitlines():
        l = l.strip().lstrip("#").strip()
        if l and not l.startswith(("<!--", "|", "---")):
            return l[:n]
    return None


def collect(name):
    base = f"repos/{OWNER}/{name}"
    m = api(base)
    out = {"name": name}
    if not isinstance(m, dict) or "_error" in m:
        out["_error"] = m
        return out
    out["meta"] = {k: m.get(k) for k in ("full_name", "description", "topics", "homepage", "has_pages", "private",
                                         "visibility", "fork", "created_at", "pushed_at", "updated_at", "size",
                                         "language", "default_branch", "open_issues_count", "archived",
                                         "stargazers_count", "forks_count", "has_issues", "has_wiki")}
    out["meta"]["license"] = (m.get("license") or {}).get("spdx_id")
    out["languages"] = api(f"{base}/languages") or {}
    prs = api_lines(f"{base}/pulls?state=all&per_page=100")
    plist = []
    if isinstance(prs, list):
        for p in prs:
            item = {"n": p["number"], "title": p.get("title"), "state": p.get("state"), "draft": p.get("draft"),
                    "merged_at": p.get("merged_at"), "created_at": p.get("created_at"), "closed_at": p.get("closed_at"),
                    "updated_at": p.get("updated_at"), "head": (p.get("head") or {}).get("ref"),
                    "head_sha": (p.get("head") or {}).get("sha"), "base": (p.get("base") or {}).get("ref"),
                    "user": (p.get("user") or {}).get("login"), "body_first": first_line(p.get("body"))}
            if p.get("state") == "open":
                body = (p.get("body") or "").strip()
                item["body"] = body[:700]
            plist.append(item)
    out["prs"] = plist
    runs = api(f"{base}/actions/runs?per_page=100")
    rl = []
    if isinstance(runs, dict) and "workflow_runs" in runs:
        out["runs_total"] = runs.get("total_count")
        seen = set()
        for w in runs["workflow_runs"]:
            key = (w.get("head_branch"), w.get("name"))
            if key in seen:
                continue
            seen.add(key)
            rl.append({"branch": w.get("head_branch"), "name": w.get("name"), "status": w.get("status"),
                       "conclusion": w.get("conclusion"), "created_at": w.get("created_at"),
                       "sha": w.get("head_sha"), "url": w.get("html_url"), "event": w.get("event")})
    out["runs_latest"] = rl
    iss = api(f"{base}/issues?state=open&per_page=100")
    out["issues_open"] = [{"n": i["number"], "title": i.get("title"), "created_at": i.get("created_at"),
                           "comments": i.get("comments")} for i in (iss if isinstance(iss, list) else []) if "pull_request" not in i]
    return out


def main():
    global REPOS
    import os
    lst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "connector_repos.json")
    REPOS = [x["name"] for x in json.load(open(lst))["repos"]]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(collect, REPOS))
    json.dump({"collected_ts": int(time.time()), "repos": res}, open(OUT, "w"), ensure_ascii=False)
    errs = [r["name"] for r in res if "_error" in r]
    print(f"{len(res)} repos, {sum(len(r.get('prs', [])) for r in res)} PRs, errors={errs}, {round(time.time()-t0,1)} s")


if __name__ == "__main__":
    main()
