#!/usr/bin/env python3
"""Run Jaskinia's browser suites and hold every failure against a written list of known ones (10 Nov 2026).

Usage: python3 -I tools/testy.py [--stara PUBLISHED.html] [suite ...]
    suite      a name like jk62_test (runs tools/<suite>.mjs); default: every tools/jk*_test.mjs except the ones
               tools/znane_bledy.json lists under "pominiete" (each named in the summary with its reason)
    --stara    the page published now (gh-pages index.html). Adds tools/dom_ciaglosc_test.mjs, which opens that page
               and then the fresh dist/jaskinia-web.html at one address and checks that the owner's layouts, windows
               and notes come through.

A failure that is not in tools/znane_bledy.json fails the run, unless it does not come back when the suite runs a
second time: then it is reported as unstable (a ::warning:: and its own section) and lets the run through. A failure
that is listed there is reported with its reason. A listed failure that passes again is reported out loud (a
::warning:: in GitHub Actions): the list says when it has stopped being true instead of hardening into scenery.
A suite that stops without its PASS/FAIL lines fails the run. Each suite's full output goes to
shots/logi/<suite>.txt; a Markdown table goes to $GITHUB_STEP_SUMMARY when that is set.
Status: tymczasowe, together with the self-refreshing Home (.github/workflows/dom-odswiezanie.yml).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)


def run_suite(args, timeout):
    try:
        r = subprocess.run(["node", *args], cwd=ROOT, capture_output=True, text=True, errors="replace", timeout=timeout)
        return (r.stdout or "") + ("\n--- stderr ---\n" + r.stderr if r.stderr else ""), r.returncode
    except subprocess.TimeoutExpired as e:
        out = e.stdout.decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        return out + f"\n--- przerwane po {timeout} s ---\n", "timeout"


def judge(name, out, code, known):
    lines = out.splitlines()
    passes = [l[5:] for l in lines if l.startswith("PASS ")]
    fails = [l[5:] for l in lines if l.startswith("FAIL ")]
    mine = [k for k in known if k["zestaw"] == name]
    hits, unknown = [], []
    for f in fails:
        k = next((k for k in mine if f.startswith(k["test"])), None)
        (hits.append(k) if k else unknown.append(f))
    healed = [k for k in mine if any(p.startswith(k["test"]) for p in passes)]
    return {"passes": passes, "fails": fails, "known": hits, "unknown": unknown, "healed": healed,
            "broken": code != 0 and not fails, "tail": "\n".join(lines[-12:])}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("suites", nargs="*")
    ap.add_argument("--stara", help="the page published now, for the continuity check")
    ap.add_argument("--timeout", type=int, default=1200, help="seconds per suite")
    ap.add_argument("--logi", default=P("shots", "logi"))
    a = ap.parse_args()
    listed = json.load(open(P("tools", "znane_bledy.json"), encoding="utf-8"))
    known, skip = listed["bledy"], {s["zestaw"]: s for s in listed.get("pominiete", [])}
    every = sorted(os.path.basename(p)[:-4] for p in glob.glob(P("tools", "jk*_test.mjs")))
    suites = a.suites or [s for s in every if s not in skip]
    skipped = [] if a.suites else [skip[s] for s in every if s in skip]
    plan = [(s, [P("tools", s + ".mjs"), P("shots", s)]) for s in suites]
    if a.stara:
        plan.append(("dom_ciaglosc_test", [P("tools", "dom_ciaglosc_test.mjs"), os.path.abspath(a.stara)]))
    os.makedirs(a.logi, exist_ok=True)
    rows, let_through, unknown, healed, broken, unstable = [], [], [], [], [], []
    for name, args in plan:
        t0 = time.time()
        out, code = run_suite(args, a.timeout)
        open(os.path.join(a.logi, name + ".txt"), "w", encoding="utf-8").write(out)
        r = judge(name, out, code, known)
        again = ""
        if r["unknown"] or r["broken"]:
            # Once more. A failure that does not come back is reported as unstable, never hidden: it lets this run
            # through, and the summary and a warning say what failed the first time.
            out2, code2 = run_suite(args, a.timeout)
            open(os.path.join(a.logi, name + ".2.txt"), "w", encoding="utf-8").write(out2)
            r2 = judge(name, out2, code2, known)
            if not r2["unknown"] and not r2["broken"]:
                unstable += [(name, f) for f in r["unknown"]] + ([(name, f"przerwał się (kod {code})")] if r["broken"] else [])
                again = ", za drugim razem przeszło"
            else:
                again = ", za drugim razem też padło"
            r, code = r2, code2
        let_through += [(name, k) for k in r["known"]]
        unknown += [(name, f) for f in r["unknown"]]
        healed += [(name, k) for k in r["healed"]]
        if r["broken"]:
            broken.append((name, code, r["tail"]))
        dt = round(time.time() - t0)
        rows.append((name, len(r["passes"]), len(r["fails"]), len(r["known"]), code, dt))
        print(f"{name}: {len(r['passes'])} PASS, {len(r['fails'])} FAIL (znane: {len(r['known'])}), kod {code}, {dt} s{again}", flush=True)

    for name, f in unknown:
        print(f"::error title=Nowy błąd w {name}::{f[:300]}")
    for name, code, tail in broken:
        print(f"::error title={name} przerwał się::kod {code}. Koniec wyjścia: {tail[-300:]}")
    for name, f in unstable:
        print(f"::warning title=Niestabilne w {name}::padło, a za drugim razem przeszło: {f[:300]}")
    for name, k in healed:
        print(f"::warning title=Znany błąd już nie występuje::{name}: „{k['test']}” przechodzi. Zdejmij go z tools/znane_bledy.json.")

    tp, tf = sum(r[1] for r in rows), sum(r[2] for r in rows)
    md = [f"### Testy Jaskini: {len(rows)} zestawów, {tp} PASS, {tf} FAIL (znane: {len(let_through)})", "",
          "| zestaw | PASS | FAIL | z tego znane | kod | czas |", "| --- | --- | --- | --- | --- | --- |"]
    md += [f"| {n} | {p} | {f} | {k} | {c} | {t} s |" for n, p, f, k, c, t in rows]
    if let_through:
        md += ["", "**Znane błędy, przepuszczone z powodem** (tools/znane_bledy.json):"]
        md += [f"- {n}: „{k['test']}” · {k['dlaczego']} Zdejmij, gdy: {k['zdejmij_gdy']}." for n, k in let_through]
    if unknown or broken:
        md += ["", "**Nowe błędy (zatrzymują publikację):**"]
        md += [f"- {n}: {f[:300]}" for n, f in unknown]
        md += [f"- {n}: zestaw przerwał się (kod {c})" for n, c, _ in broken]
    if unstable:
        md += ["", "**Niestabilne** (padło, a za drugim razem przeszło; nie zatrzymuje publikacji, ale warto to zbadać):"]
        md += [f"- {n}: {f[:300]}" for n, f in unstable]
    if healed:
        md += ["", "**Znany błąd już nie występuje — zdejmij go z listy:**"]
        md += [f"- {n}: „{k['test']}”" for n, k in healed]
    if skipped:
        md += ["", "**Pominięte zestawy** (nie da się ich tu uruchomić):"]
        md += [f"- {s['zestaw']}: {s['dlaczego']} Zdejmij, gdy: {s['zdejmij_gdy']}." for s in skipped]
    if not a.stara:
        md += ["", "Ciągłość (opublikowana strona → nowa) nie była sprawdzana: brak --stara."]
    text = "\n".join(md)
    print("\n" + text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text + "\n\n")
    sys.exit(1 if unknown or broken else 0)


if __name__ == "__main__":
    main()
