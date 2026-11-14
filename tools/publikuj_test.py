#!/usr/bin/env python3
"""Publishing writes when a fact changed, and only then (10 Nov 2026).

Usage: python3 -I tools/publikuj_test.py
1. The first publication writes the page, its data, status.json and README.md; status.json keeps the fields the
   earlier previews had and says the refresh is automatic.
2. The facts collected again 6 hours later, nothing new in them: tools/publikuj_pages.py writes nothing, even though
   the page's own "how long ago" values moved.
3. The same with one new open issue in one repo: it writes.
4. The same facts in a page whose code changed: it writes.
5. Nothing new for 21 hours: it writes anyway, so "how long ago" on the page never drifts by more than a day.
Uses this repository's data/ in a temporary folder and a stand-in page; no network, no browser.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []


def ok(cond, label, extra=""):
    print(("PASS " if cond else "FAIL ") + label + (f" ({extra})" if extra else ""))
    if not cond:
        FAILS.append(label)


def page(lib, code="v1"):
    data = json.dumps(lib, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<!doctype html><html><head><title>Jaskinia</title><script id="lib-data" type="application/json">{data}</script></head><body><script>/*{code}*/</script></body></html>'


def build(repo, shift_h=0, issue=False):
    """Collect again shift_h hours later: the collectors stamp new times and durations, the facts stay."""
    g = json.load(open(os.path.join(repo, "data", "git.json")))
    g["generated_ts"] += shift_h * 3600
    g["seconds"] = 40 + shift_h
    json.dump(g, open(os.path.join(repo, "data", "git.json"), "w"))
    gh = json.load(open(os.path.join(repo, "data", "gh.json")))
    gh["collected_ts"] += shift_h * 3600
    json.dump(gh, open(os.path.join(repo, "data", "gh.json"), "w"))
    if issue:
        gh = json.load(open(os.path.join(repo, "data", "gh.json")))
        r = next(x for x in gh["repos"] if isinstance(x.get("issues_open"), list))
        r["issues_open"].append({"n": 999, "title": "Nowe zgłoszenie", "created_at": "2026-11-10T12:00:00Z", "comments": 0})
        json.dump(gh, open(os.path.join(repo, "data", "gh.json"), "w"))
    r = subprocess.run([sys.executable, "-I", os.path.join(repo, "tools", "build.py")], capture_output=True, text=True, cwd=repo)
    assert r.returncode == 0, r.stderr[-400:]
    return json.load(open(os.path.join(repo, "data", "library.json")))


def publish(tmp, repo, pages, lib, code="v1", extra=()):
    b = os.path.join(tmp, "build")
    shutil.rmtree(b, ignore_errors=True)
    os.makedirs(b)
    open(os.path.join(b, "jaskinia-web.html"), "w", encoding="utf-8").write(page(lib, code))
    json.dump(lib, open(os.path.join(b, "library.json"), "w"), ensure_ascii=False)
    open(os.path.join(b, "biblioteka-dla-agentow.md"), "w", encoding="utf-8").write("# Brief")
    for f in ("git.json", "gh.json", "knowledge.json", "wejscia.json"):
        shutil.copy(os.path.join(repo, "data", f), os.path.join(b, f))
    env = {k: v for k, v in os.environ.items() if k != "GITHUB_OUTPUT"}
    r = subprocess.run([sys.executable, "-I", os.path.join(HERE, "tools", "publikuj_pages.py"), pages, b, "--commit", "abc1234def", *extra],
                       capture_output=True, text=True, env=env)
    assert r.returncode == 0, r.stderr[-400:]
    return dict(l.split("=", 1) for l in r.stdout.splitlines() if "=" in l)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        repo = os.path.join(tmp, "repo")
        os.makedirs(os.path.join(repo, "tools"))
        shutil.copytree(os.path.join(HERE, "data"), os.path.join(repo, "data"))
        for f in os.listdir(os.path.join(HERE, "tools")):
            if f.endswith(".py"):
                shutil.copy(os.path.join(HERE, "tools", f), os.path.join(repo, "tools", f))
        pages = os.path.join(tmp, "pages")
        os.makedirs(pages)
        json.dump({"schema": "jaskinia-public-preview-v1", "source": {"commit": "85aaaae"}, "limitations": ["experimental_only"],
                   "data": {"historical_snapshot": "2026-10-19", "auto_refresh": False}}, open(os.path.join(pages, "status.json"), "w"))
        first = publish(tmp, repo, pages, build(repo))
        ok(first.get("zmiana") == "tak" and os.path.exists(os.path.join(pages, "index.html")), "the first publication writes the page")
        ok(os.path.exists(os.path.join(pages, "dane", "library.json")), "and its data, for the next diff")
        ok(os.path.exists(os.path.join(pages, "biblioteka-dla-agentow.md")), "and the agent brief the page links to, so that link is not a 404 at the address")
        st = json.load(open(os.path.join(pages, "status.json")))
        ok(st["data"]["auto_refresh"] is True and st["data"]["fingerprint"] == first["odcisk"], "status.json says the refresh is automatic and holds the fingerprint")
        wpisy = json.load(open(os.path.join(HERE, "data", "ograniczenia.json"), encoding="utf-8"))["wpisy"]
        ok(st["limitations"] == wpisy and st["provenance"]["previous"]["commit"] == "85aaaae",
           "status.json takes the page's limits from data/ograniczenia.json (not silently from the previous page) and names the page it replaced")
        ok(st["schema"] == "jaskinia-public-preview-v1" and st["data"]["historical_snapshot"] and st["data"]["repository_count"] > 0, "the fields earlier readers knew are still there")
        mtime = os.path.getmtime(os.path.join(pages, "index.html"))
        lib6 = build(repo, shift_h=6)
        ages = [r["age"] for r in lib6["repos"]] != [r["age"] for r in json.load(open(os.path.join(pages, "dane", "library.json")))["repos"]]
        later = publish(tmp, repo, pages, lib6)
        ok(later.get("zmiana") == "nie" and ages, "6 hours later with no new fact: nothing is written, though the page's ages moved", later.get("powod", ""))
        ok(os.path.getmtime(os.path.join(pages, "index.html")) == mtime, "the page on the branch is untouched")
        moved = publish(tmp, repo, pages, build(repo, issue=True))
        ok(moved.get("zmiana") == "tak", "one new open issue in one repo: the page is written", moved.get("powod", ""))
        code = publish(tmp, repo, pages, json.load(open(os.path.join(pages, "dane", "library.json"))), code="v2")
        ok(code.get("zmiana") == "tak", "the same facts in a page whose code changed: the page is written", code.get("powod", ""))
        stale = publish(tmp, repo, pages, build(repo, shift_h=21), code="v2")
        ok(stale.get("zmiana") == "tak" and "20 h" in stale.get("powod", ""), "nothing new for 21 hours: written anyway, so ages never drift by more than a day", stale.get("powod", ""))
        # after a rollback the automat is paused: a changed build waits, "wznow" publishes it and clears the pause
        r = subprocess.run([sys.executable, "-I", os.path.join(HERE, "tools", "publikuj_pages.py"), pages, os.path.join(tmp, "build"),
                            "--wstrzymaj", "strona nie wstała"], capture_output=True, text=True)
        ok(r.returncode == 0 and json.load(open(os.path.join(pages, "status.json"))).get("wstrzymane"), "a rollback marks the page paused")
        paused = publish(tmp, repo, pages, build(repo, issue=True), code="v3")
        ok(paused.get("zmiana") == "nie" and "wstrzymany" in paused.get("powod", ""), "while paused, even a changed build waits", paused.get("powod", ""))
        back = publish(tmp, repo, pages, build(repo, issue=True), code="v3", extra=("--wznow",))
        ok(back.get("zmiana") == "tak" and not json.load(open(os.path.join(pages, "status.json"))).get("wstrzymane"), "wznow publishes it and clears the pause")
    print(f"\n{'all passed' if not FAILS else str(len(FAILS)) + ' failed'}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
