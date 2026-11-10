#!/usr/bin/env python3
"""Open every "Zagraj" entry the page will offer and record whether it answers.

Usage: python3 -I tools/sprawdz_wejscia.py [data/gh.json] [data/wejscia.json] [data/zagraj.json]

Run it where the pages are reachable (GitHub Actions; an agent's sandbox often is not).
The URL is computed the same way as in tools/build.py: an entry from data/wejscia.json,
otherwise https://jozzpoly.github.io/<repo>/ when the GitHub API says the repo has Pages.
An entry with url null is not a game and is skipped. The result goes to data/zagraj.json,
which build.py attaches to each repo and to the coverage notes; a short Markdown table goes
to stdout for the Actions job summary.

A page that answers is not yet a page that plays: this checks the address, not the game.
Status: tymczasowe. The facts observer planned for the rebuilt Jaskinia replaces it.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(HERE, *a)


def load(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def url_for(name, gh_by, wej):
    if name in wej:
        return wej[name].get("url")
    meta = (gh_by.get(name) or {}).get("meta") or {}
    return f"https://jozzpoly.github.io/{name}/" if meta.get("has_pages") else None


def check(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Jaskinia-sprawdzanie-wejsc/1 (+github.com/Jozzpoly)"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read(300_000).decode("utf-8", "replace")
            m = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
            title = re.sub(r"\s+", " ", m.group(1)).strip()[:120] if m else None
            # GitHub Pages answers 404 for a missing site, but a few hosts answer 200 with an error page
            dead = bool(title) and re.search(r"site not found|page not found|404", title, re.I)
            return {"status": r.status, "final": r.geturl(), "title": title, "ok": 200 <= r.status < 400 and not dead,
                    "ms": round((time.time() - t0) * 1000)}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "ok": False, "error": str(e)[:200], "ms": round((time.time() - t0) * 1000)}
    except Exception as e:  # DNS, TLS, timeout: the address did not answer
        return {"status": None, "ok": False, "error": f"{type(e).__name__}: {e}"[:200], "ms": round((time.time() - t0) * 1000)}


def main():
    gh_path = sys.argv[1] if len(sys.argv) > 1 else P("data", "gh.json")
    wej_path = sys.argv[2] if len(sys.argv) > 2 else P("data", "wejscia.json")
    out_path = sys.argv[3] if len(sys.argv) > 3 else P("data", "zagraj.json")
    gh = load(gh_path, {"repos": []})
    gh_by = {r["name"]: r for r in gh.get("repos", [])}
    wej = {k: v for k, v in load(wej_path, {}).items() if not k.startswith("_")}
    names = sorted(set(gh_by) | set(wej))
    todo = [(n, url_for(n, gh_by, wej)) for n in names]
    todo = [(n, u) for n, u in todo if u]
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = dict(zip([n for n, _ in todo], ex.map(lambda x: {"url": x[1], **check(x[1])}, todo)))
    now = int(time.time())
    data = {"checked_ts": now, "checked_at": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(now)),
            "method": "HTTP GET bez przeglądarki: adres odpowiada albo nie. To nie jest test samej gry.",
            "results": res}
    json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = sum(1 for v in res.values() if v["ok"])
    bad = sorted(n for n, v in res.items() if not v["ok"])
    md = [f"### Wejścia „Zagraj” ({data['checked_at']}): odpowiada {ok} z {len(res)}", "",
          "Sprawdzany jest adres (czy strona odpowiada), nie sama gra.", "",
          "| repo | adres | wynik |", "| --- | --- | --- |"]
    for n, v in sorted(res.items(), key=lambda kv: (kv[1]["ok"], kv[0])):
        what = f"{v.get('status')} · {v.get('title') or ''}".strip(" ·") if v["ok"] else f"✗ {v.get('status') or ''} {v.get('error') or v.get('title') or ''}".strip()
        md.append(f"| {n} | {v['url']} | {what.replace('|', '/')} |")
    print("\n".join(md))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("\n".join(md) + "\n\n")
    # last line: regen.py shows only this one
    print(f"Zagraj: odpowiada {ok} z {len(res)}" + (f"; nie odpowiada: {', '.join(bad)}" if bad else ""))


if __name__ == "__main__":
    main()
