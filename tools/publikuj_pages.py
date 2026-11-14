#!/usr/bin/env python3
"""Put a fresh, tested Jaskinia build into a checkout of the gh-pages branch (10 Nov 2026).

Usage: python3 -I tools/publikuj_pages.py GH_PAGES_DIR BUILD_DIR [--commit SHA] [--run URL]
    BUILD_DIR holds what the workflow's build job uploaded: jaskinia-web.html, library.json and the facts it was
    built from (git.json, gh.json, zagraj.json, knowledge.json, wejscia.json).

Writes index.html (the page), biblioteka-dla-agentow.md (the agent brief the page links to),
dane/library.json (its data: the next build diffs against it, so the page's
"what changed" means "since this page was published"), status.json and README.md (what this page is now).
Writes only when something real changed since the page was last published: a fact collected from the repositories
(git, the GitHub API, the Zagraj check, knowledge.json, wejscia.json) or the page's own code. Time passing alone
is not a change, so the branch does not grow by a 2.5 MB page every few hours. One exception: once the published
data is more than 20 hours old it is written anyway, because the page works out "how long ago" and "still fresh"
when it is built, and those must not drift by more than a day.
It never commits or pushes; the workflow does. After a rollback the workflow marks the page paused (--wstrzymaj),
and nothing is published until a run with --wznow (the workflow's "wznow" action) clears it.
Prints zmiana=tak|nie, powod, dane=<snapshot time> and odcisk, also to $GITHUB_OUTPUT when that is set.
Status: tymczasowe, together with the self-refreshing Home (.github/workflows/dom-odswiezanie.yml).
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "Jozzpoly/Jozz-Cave-Workbench"


def load(path, default=None):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


VOLATILE = {"generated", "generated_ts", "seconds", "collected_ts", "fetched_at", "checked_at", "checked_ts", "ms"}
FACTS = ("git.json", "gh.json", "zagraj.json", "knowledge.json", "wejscia.json")
STALE_H = 20


def strip(x):
    """The collected facts without the moments and durations of collecting them."""
    if isinstance(x, dict):
        return {k: strip(v) for k, v in x.items() if k not in VOLATILE}
    if isinstance(x, list):
        return [strip(v) for v in x]
    return x


def page_code(html):
    """The page without its data: the page's own code, fonts and styles."""
    return re.sub(r'(<script[^>]*id="lib-data"[^>]*>)[\s\S]*?(</script>)', r"\1\2", html, count=1)


def fingerprint(build, html):
    h = hashlib.sha256(page_code(html).encode())
    for name in FACTS:
        h.update(name.encode() + b"\0" + json.dumps(strip(load(os.path.join(build, name))), sort_keys=True, ensure_ascii=False).encode())
    return h.hexdigest()[:16]


def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pages")
    ap.add_argument("build")
    ap.add_argument("--commit", default="")
    ap.add_argument("--run", default="")
    ap.add_argument("--wznow", action="store_true", help="publish even though an earlier rollback paused the automat")
    ap.add_argument("--wstrzymaj", metavar="POWOD", help="only mark the published page as paused (after a rollback)")
    a = ap.parse_args()
    if a.wstrzymaj:
        # after a rollback: the next scheduled run must not put the same build back by itself
        st = load(os.path.join(a.pages, "status.json"), {}) or {}
        st["wstrzymane"] = {"od": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "powod": a.wstrzymaj, "przebieg": a.run,
                            "wznowienie": "Actions → Dom odświeża się sam → Run workflow, akcja: wznow"}
        json.dump(st, open(os.path.join(a.pages, "status.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("zmiana=tak")
        return
    html = open(os.path.join(a.build, "jaskinia-web.html"), encoding="utf-8").read()
    lib = load(os.path.join(a.build, "library.json"))
    zag = load(os.path.join(a.build, "zagraj.json"), {}) or {}
    old = load(os.path.join(a.pages, "status.json"), {}) or {}
    fp = fingerprint(a.build, html)
    gen, gen_ts = lib["estate"]["generated"], lib["estate"]["generated_ts"]
    od = old.get("data") or {}
    if old.get("wstrzymane") and not a.wznow:
        why = "bez zmian: automat wstrzymany po cofnięciu (" + str(old["wstrzymane"].get("powod", "")) + "); wznowienie: akcja wznow"
    elif fp != od.get("fingerprint"):
        why = "nowe fakty albo nowy kod strony" if od.get("fingerprint") else "pierwsza publikacja z automatu"
    elif gen_ts - (od.get("generated_ts") or 0) > STALE_H * 3600:
        why = f"bez nowych faktów, ale opublikowane dane mają ponad {STALE_H} h"
    else:
        why = "bez zmian od ostatniej publikacji"
    changed = not why.startswith("bez zmian")
    out = {"zmiana": "tak" if changed else "nie", "powod": why, "dane": gen, "odcisk": fp}
    if changed:
        shutil.copyfile(os.path.join(a.build, "jaskinia-web.html"), os.path.join(a.pages, "index.html"))
        os.makedirs(os.path.join(a.pages, "dane"), exist_ok=True)
        shutil.copyfile(os.path.join(a.build, "library.json"), os.path.join(a.pages, "dane", "library.json"))
        # The agent brief the page links to ("biblioteka-dla-agentow.md" in the agents window).
        # Until 14 Nov 2026 it was built but never published, so the link in the page was a 404
        # at the address — the one entry point an agent is handed, and it led nowhere.
        brief = os.path.join(a.build, "biblioteka-dla-agentow.md")
        if os.path.exists(brief):
            shutil.copyfile(brief, os.path.join(a.pages, "biblioteka-dla-agentow.md"))
        m = re.search(r"const JASK_BUILD = (\{[^}]*\});", html)
        ver = json.loads(m.group(1)).get("v") if m else open(os.path.join(ROOT, "src", "jaskinia", "version.txt"), encoding="utf-8").read().strip()
        cov = lib["estate"]["coverage"]
        res = zag.get("results") or {}
        n = len(lib["repos"])
        status = {
            "schema": "jaskinia-public-preview-v1",
            "preview": True,
            "public": True,
            "title": f"Jaskinia v{ver} — publiczny podgląd odświeżany automatycznie; bez prywatnej warstwy",
            "source": {"repository": REPO, "ref": "main", "commit": a.commit,
                       "html_blob": blob_sha(open(os.path.join(a.pages, "index.html"), "rb").read()),
                       "workflow_run": a.run},
            "data": {"repository_count": n, "scope": "public-repositories-only",
                     "historical_snapshot": gen[:10], "generated": gen, "generated_ts": gen_ts, "auto_refresh": True,
                     "refresh": "scheduled every 3 h on main, but GitHub drops scheduled runs under load: measured 14 Nov 2026, only about two runs a day actually fire. Published when a fact or the page changed, or the data is over 20 h old; 'generated' above says how old this data really is (.github/workflows/dom-odswiezanie.yml)",
                     "coverage": f"{cov.get('collected')}/{cov.get('expected')}",
                     "api_unknown": cov.get("api_unknown", []),
                     "zagraj": {"checked_at": zag.get("checked_at"), "answering": sum(1 for v in res.values() if v.get("ok")),
                                "of": len(res), "method": zag.get("method")},
                     "fingerprint": fp},
            # Do 14 XI 2026 ograniczenia byly przepisywane z poprzedniej strony i nigdy nie pokazywaly sie
            # w diffie, wiec wpisy z 16 X jechaly dalej bez niczyjej oceny. Teraz zrodlem jest plik w repo;
            # gdy go nie ma (stary klon, test), zostaje stare zachowanie.
            "limitations": (load(os.path.join(ROOT, "data", "ograniczenia.json"), {}) or {}).get("wpisy") or old.get("limitations", []),
            "provenance": {
                "packaged_by": "GitHub Actions, .github/workflows/dom-odswiezanie.yml (written by Claude Opus 5.5, 10 Nov 2026)",
                "owner_approval": "activated once by merging the workflow into main (owner, 10 Nov 2026); the repository variable PUBLIKUJ_PAGES = nie turns it off",
                "tested_before_publishing": "Jaskinia's browser suites (tools/testy.py) and continuity from the page published before (tools/dom_ciaglosc_test.mjs)",
                "previous": {"commit": (old.get("source") or {}).get("commit"),
                             "data": (old.get("data") or {}).get("generated") or (old.get("data") or {}).get("historical_snapshot")},
            },
        }
        json.dump(status, open(os.path.join(a.pages, "status.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(os.path.join(a.pages, "README.md"), "w", encoding="utf-8").write(
            f"# Jaskinia public preview v{ver}, refreshed automatically\n"
            f"Public data only ({n} public repositories, data of {gen.replace('T', ' ').replace('+00:00', ' UTC')}). "
            "A workflow on main asks to collect the facts every 3 hours — GitHub drops some scheduled runs, so in "
            "practice it is about twice a day; 'generated' above says how old this data really is. It opens every Zagraj entry, builds the page and runs its "
            "browser tests, including one that the layouts, windows and notes kept in your browser come through from the "
            "page published before. It publishes when a fact or the page changed, or at least once a day. "
            "status.json says what this page is.\n"
            "This is not a private Owner workspace. Do not store private notes here. No cross-device sync. Materials "
            "(your models) and the motion you give their parts stay in this browser.\n"
            f"Built from {REPO}@{a.commit[:7] or '?'}.\n")
    for k, v in out.items():
        print(f"{k}={v}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write("".join(f"{k}={v}\n" for k, v in out.items()))


if __name__ == "__main__":
    main()
