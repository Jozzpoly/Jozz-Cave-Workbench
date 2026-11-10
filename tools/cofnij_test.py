#!/usr/bin/env python3
"""tools/cofnij_pages.sh on a made-up gh-pages history (10 Nov 2026). No network.

Usage: python3 -I tools/cofnij_test.py
A first refresh adds dane/library.json and changes index.html and status.json; a rollback must give back exactly the
page from before it (the added file gone too), mark it paused, and refuse when there is no refresh to undo.
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []


def ok(cond, label):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        FAILS.append(label)


def git(d, *a):
    return subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, check=True).stdout


def main():
    with tempfile.TemporaryDirectory() as d:
        git(d, "init", "-q", "-b", "gh-pages")
        git(d, "config", "user.email", "t@t"); git(d, "config", "user.name", "t")
        open(os.path.join(d, "index.html"), "w").write("stara strona")
        json.dump({"data": {"fingerprint": None, "historical_snapshot": "2026-10-19"}}, open(os.path.join(d, "status.json"), "w"))
        git(d, "add", "-A"); git(d, "commit", "-q", "-m", "claude(preview): v6.4.1")
        script = os.path.join(HERE, "tools", "cofnij_pages.sh")
        r = subprocess.run([script, d, "test"], capture_output=True, text=True)
        ok(r.returncode == 3, "no refresh by the automat yet: nothing is rolled back")
        open(os.path.join(d, "index.html"), "w").write("nowa strona")
        os.makedirs(os.path.join(d, "dane")); open(os.path.join(d, "dane", "library.json"), "w").write("{}")
        json.dump({"data": {"fingerprint": "nowy"}}, open(os.path.join(d, "status.json"), "w"))
        git(d, "add", "-A"); git(d, "commit", "-q", "-m", "dom(odświeżenie): dane z 2026-11-10")
        r = subprocess.run([script, d, "strona nie wstała", "https://example/run"], capture_output=True, text=True)
        ok(r.returncode == 0, "a refresh is rolled back" + ("" if r.returncode == 0 else ": " + r.stderr[-300:]))
        ok(open(os.path.join(d, "index.html")).read() == "stara strona", "the page from before the refresh is back")
        ok(not os.path.exists(os.path.join(d, "dane", "library.json")), "a file the refresh added is gone")
        st = json.load(open(os.path.join(d, "status.json")))
        ok(st["data"].get("historical_snapshot") == "2026-10-19" and st.get("wstrzymane", {}).get("powod") == "strona nie wstała", "status.json is the old one, marked paused, with the reason")
        ok(git(d, "status", "--porcelain").strip() == "" and git(d, "log", "-1", "--format=%s").startswith("dom(cofnięcie)"), "all of it is one commit, ready to push")
    print(f"\n{'all passed' if not FAILS else str(len(FAILS)) + ' failed'}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
