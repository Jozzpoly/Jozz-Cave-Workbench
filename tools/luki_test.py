#!/usr/bin/env python3
"""Unknown is not zero, from the collector to the page data (10 Nov 2026).

Usage: python3 -I tools/luki_test.py

1. collect_gh.py with a fake `gh`: the PR list breaks on page 2 and CI runs answer 403.
   The repo must come out with parts {prs: partial, runs: error} and None in place of lists,
   not with a shorter PR list and zero CI runs (Astra's 403 trial of 9 Nov).
2. build.py on a copy of this repository's data with one such gap: the repo must get api false
   (the page then says "nieznane"), the coverage must name it, and the totals must leave it out.
3. An old snapshot whose languages hold the error dict must not crash the build.
No network; everything happens in a temporary folder.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []


def ok(cond, label):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        FAILS.append(label)


FAKE_GH = r'''#!/usr/bin/env python3
import json, sys
path = [a for a in sys.argv[1:] if a.startswith("repos/")][-1]
if path.endswith("/languages"):
    print(json.dumps({"Python": 1000}))
elif "/pulls?" in path:
    if "page=1" in path:
        print(json.dumps([{"number": i, "title": f"PR {i}", "state": "closed", "merged_at": None, "created_at": "2026-11-01T00:00:00Z",
                           "head": {"ref": f"b{i}", "sha": "x"}, "base": {"ref": "main"}, "user": {"login": "u"}} for i in range(100)]))
    else:
        sys.stderr.write("HTTP 403: rate limit")
        sys.exit(1)
elif "/actions/runs" in path:
    sys.stderr.write("HTTP 403: Resource not accessible")
    sys.exit(1)
elif "/issues?" in path:
    print("[]")
else:
    print(json.dumps({"full_name": "Jozzpoly/Luka", "description": "test", "has_pages": False, "private": False,
                      "default_branch": "main", "created_at": "2026-01-01T00:00:00Z", "pushed_at": "2026-11-01T00:00:00Z"}))
'''


def collector_part(tmp):
    bin_dir = os.path.join(tmp, "bin")
    os.makedirs(bin_dir)
    gh = os.path.join(bin_dir, "gh")
    open(gh, "w").write(FAKE_GH)
    os.chmod(gh, 0o755)
    lst = os.path.join(tmp, "list.json")
    json.dump({"repos": [{"name": "Luka"}]}, open(lst, "w"))
    out = os.path.join(tmp, "gh.json")
    env = dict(os.environ, PATH=bin_dir + os.pathsep + os.environ.get("PATH", ""))
    r = subprocess.run([sys.executable, "-I", os.path.join(HERE, "tools", "collect_gh.py"), out, lst],
                       capture_output=True, text=True, env=env)
    ok(r.returncode == 0, "collect_gh.py finishes with a fake gh")
    rec = json.load(open(out))["repos"][0]
    parts = rec.get("parts") or {}
    ok(parts.get("prs") == "partial", "PR list broken on page 2 is marked partial")
    ok(rec.get("prs") is None, "a partial PR list is unknown (None), not a 100-item list passing for complete")
    ok(parts.get("runs") == "error" and rec.get("runs_latest") is None, "CI runs after 403 are unknown, not an empty list")
    ok(parts.get("issues") == "ok" and rec.get("issues_open") == [], "zero open issues that did arrive stay zero")
    ok(parts.get("languages") == "ok" and rec.get("languages") == {"Python": 1000}, "languages that arrived are kept")
    ok(bool(rec.get("fetched_at")), "the record says when it was fetched")


def build_part(tmp):
    repo = os.path.join(tmp, "repo")
    os.makedirs(os.path.join(repo, "tools"))
    shutil.copytree(os.path.join(HERE, "data"), os.path.join(repo, "data"))
    for f in os.listdir(os.path.join(HERE, "tools")):
        if f.endswith(".py"):
            shutil.copy(os.path.join(HERE, "tools", f), os.path.join(repo, "tools", f))
    ghp = os.path.join(repo, "data", "gh.json")
    gh = json.load(open(ghp))
    victim = next(r for r in gh["repos"] if "_error" not in r and (r.get("prs") or []))
    victim["parts"] = {"languages": "ok", "prs": "ok", "runs": "error", "issues": "ok"}
    victim["runs_latest"] = None
    other = next(r for r in gh["repos"] if "_error" not in r and r is not victim)
    other["languages"] = {"_error": "HTTP 403"}  # what the collector before 10 Nov stored
    json.dump(gh, open(ghp, "w"))
    before = json.load(open(os.path.join(HERE, "data", "library.json")))
    r = subprocess.run([sys.executable, "-I", os.path.join(repo, "tools", "build.py")], capture_output=True, text=True, cwd=repo)
    ok(r.returncode == 0, "build.py runs with a gap and an old error dict in languages" + ("" if r.returncode == 0 else ": " + r.stderr[-300:]))
    if r.returncode != 0:
        return
    lib = json.load(open(os.path.join(repo, "data", "library.json")))
    rec = next(x for x in lib["repos"] if x["name"] == victim["name"])
    ok(rec["api"] is False, f"{victim['name']}: a CI gap makes its GitHub numbers unknown (api false), not zero")
    ok(rec["api_gaps"] == ["runs"], f"{victim['name']}: the gap is named (api_gaps = runs)")
    cov = lib["estate"]["coverage"]
    ok(victim["name"] in cov.get("api_unknown", []), "coverage names the repo with unknown GitHub numbers")
    ok(any(victim["name"] in x for x in cov["limits"]), "the page's coverage notes say it in words")
    prs_before = next(x for x in before["repos"] if x["name"] == victim["name"])["prs"]["total"]
    ok(lib["estate"]["totals"]["prs"] <= before["estate"]["totals"]["prs"], "totals do not grow from a repo whose numbers are unknown")
    ok(prs_before > 0, f"(control) {victim['name']} had PRs in the real snapshot")
    oth = next(x for x in lib["repos"] if x["name"] == other["name"])
    ok(oth["langs"] == [], f"{other['name']}: an old error dict in languages gives no languages instead of a crash")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        collector_part(tmp)
        build_part(tmp)
    print(f"\n{'all passed' if not FAILS else str(len(FAILS)) + ' failed'}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
