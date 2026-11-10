#!/usr/bin/env python3
"""Run Jaskinia's browser suites and decide whether a build may replace the owner's page (10 Nov 2026).

Usage: python3 -I tools/testy.py [--stara PUBLISHED.html] [--scisle] [suite ...]
    suite      a name like jk62_test (runs tools/<suite>.mjs); default: every tools/jk*_test.mjs except the ones
               tools/znane_bledy.json lists under "pominiete" (each named in the summary with its reason)
    --stara    the page published now (gh-pages index.html). Adds tools/dom_ciaglosc_test.mjs, which opens that page
               and then the fresh dist/jaskinia-web.html at one address and checks that the owner's layouts, windows
               and notes come through.
    --scisle   strict: the page's code differs from the published page's code (the workflow decides this from git)

Three kinds of suites, because a failure means different things in each:
- continuity (dom_ciaglosc_test): any failure blocks. Never retried, never let through by a list.
- the owner's state (suites named under "klasa_stanu" in tools/znane_bledy.json: storage, tabs, older tabs, his
  parts' records): any new failure blocks, without a retry. A failure on the known list is let through only when
  the page's code is the same as the code published now, that is when only the data changed; with --scisle it blocks.
- everything else: a new failure gets one retry. If it does not come back, it is reported as unstable (a ::warning::
  and its own section) and lets the run through. A known failure is let through with its reason.
In every kind, a known failure that passes again is reported out loud (unless it is marked "niestabilne"), a suite
that stops without its PASS/FAIL lines blocks, and a part a suite skips by itself (a line like "(... skipped)") is
named in the summary, so fewer checks never pass for the usual number.
Each suite's output goes to shots/logi/<suite>.txt; a Markdown table goes to $GITHUB_STEP_SUMMARY when that is set.
Status: tymczasowe, together with the self-refreshing Home (.github/workflows/dom-odswiezanie.yml).
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
CONTINUITY = "dom_ciaglosc_test"


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
    healed = [k for k in mine if not k.get("niestabilne") and any(p.startswith(k["test"]) for p in passes)]
    inner = [l.strip() for l in lines if re.match(r"^\s*\(.*\bskipped\b.*\)\s*$", l)]
    # a suite that dies of an uncaught error stops checking; with a FAIL line before it, the exit code alone would
    # not show it (10 Nov 2026: jk2 lost 8 phone checks this way behind a listed failure)
    err = out.split("\n--- stderr ---\n", 1)[1] if "\n--- stderr ---\n" in out else ""
    crashed = code not in (0, 1) or bool(re.search(r"^(\w*Error\b|node:internal|\s+at \S)", err, re.M))
    return {"passes": passes, "fails": fails, "known": hits, "unknown": unknown, "healed": healed, "inner": inner,
            "broken": code != 0 and (not fails or crashed), "code": code, "tail": "\n".join(lines[-12:])}


def kind_of(name, state_suites):
    return "ciaglosc" if name == CONTINUITY else "stan" if name in state_suites else "inne"


def decide(name, kind, r, again, strict):
    """What one suite's result means for publishing. `again` runs the suite once more and judges it (or None).

    Returns the final judgement and the failures sorted into: blocking (with why), let through (known, with the
    entry), unstable (failed first, passed on the retry).
    """
    note, unstable = "", []
    if kind == "inne" and (r["unknown"] or r["broken"]) and again:
        r2 = again()
        if not r2["unknown"] and not r2["broken"]:
            unstable = [f for f in r["unknown"]] + ([f"przerwał się (kod {r['code']})"] if r["broken"] else [])
            note = ", za drugim razem przeszło"
        else:
            note = ", za drugim razem też padło"
        r = r2
    blocking = [(f, "nowy błąd") for f in r["unknown"]]
    if r["broken"]:
        blocking.append((f"zestaw przerwał się (kod {r['code']})", "przerwany"))
    let_through = []
    for k in r["known"]:
        if kind == "ciaglosc":
            blocking.append((k["test"], "ciągłość nie ma wyjątków"))
        elif kind == "stan" and strict:
            blocking.append((k["test"], "znany, ale zmienił się kod strony, a to sprawdzenie chroni stan Ownera"))
        else:
            let_through.append(k)
    return {"r": r, "note": note, "blocking": blocking, "let_through": let_through, "unstable": unstable}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("suites", nargs="*")
    ap.add_argument("--stara", help="the page published now, for the continuity check")
    ap.add_argument("--scisle", action="store_true", help="the page's code differs from the published page's code")
    ap.add_argument("--timeout", type=int, default=1200, help="seconds per suite")
    ap.add_argument("--logi", default=P("shots", "logi"))
    a = ap.parse_args()
    listed = json.load(open(P("tools", "znane_bledy.json"), encoding="utf-8"))
    known, skip = listed["bledy"], {s["zestaw"]: s for s in listed.get("pominiete", [])}
    state_suites = set(listed.get("klasa_stanu", []))
    every = sorted(os.path.basename(p)[:-4] for p in glob.glob(P("tools", "jk*_test.mjs")))
    suites = a.suites or [s for s in every if s not in skip]
    skipped = [] if a.suites else [skip[s] for s in every if s in skip]
    plan = [(s, [P("tools", s + ".mjs"), P("shots", s)]) for s in suites]
    if a.stara:
        plan.append((CONTINUITY, [P("tools", "dom_ciaglosc_test.mjs"), os.path.abspath(a.stara)]))
    os.makedirs(a.logi, exist_ok=True)
    rows, let_through, blocking, healed, unstable, inner = [], [], [], [], [], []
    for name, args in plan:
        t0 = time.time()
        out, code = run_suite(args, a.timeout)
        open(os.path.join(a.logi, name + ".txt"), "w", encoding="utf-8").write(out)

        def again(name=name, args=args):
            out2, code2 = run_suite(args, a.timeout)
            open(os.path.join(a.logi, name + ".2.txt"), "w", encoding="utf-8").write(out2)
            return judge(name, out2, code2, known)

        kind = kind_of(name, state_suites)
        d = decide(name, kind, judge(name, out, code, known), again, a.scisle)
        r = d["r"]
        let_through += [(name, k) for k in d["let_through"]]
        blocking += [(name, f, why) for f, why in d["blocking"]]
        unstable += [(name, f) for f in d["unstable"]]
        healed += [(name, k) for k in r["healed"]]
        inner += [(name, x) for x in r["inner"]]
        dt = round(time.time() - t0)
        rows.append((name, kind, len(r["passes"]), len(r["fails"]), len(d["let_through"]), r["code"], dt))
        print(f"{name} [{kind}]: {len(r['passes'])} PASS, {len(r['fails'])} FAIL (przepuszczone: {len(d['let_through'])}), "
              f"kod {r['code']}, {dt} s{d['note']}", flush=True)

    for name, f, why in blocking:
        print(f"::error title=Zatrzymuje publikację: {name}::{f[:300]} ({why})")
    for name, f in unstable:
        print(f"::warning title=Niestabilne w {name}::padło, a za drugim razem przeszło: {f[:300]}")
    for name, k in healed:
        print(f"::warning title=Znany błąd już nie występuje::{name}: „{k['test']}” przechodzi. Zdejmij go z tools/znane_bledy.json.")

    tp, tf = sum(r[2] for r in rows), sum(r[3] for r in rows)
    mode = "ścisły (kod strony się zmienił)" if a.scisle else "zwykły (kod strony taki sam jak opublikowany)"
    md = [f"### Testy Jaskini: {len(rows)} zestawów, {tp} PASS, {tf} FAIL; tryb {mode}", "",
          "| zestaw | rodzaj | PASS | FAIL | przepuszczone | kod | czas |", "| --- | --- | --- | --- | --- | --- | --- |"]
    md += [f"| {n} | {k} | {p} | {f} | {l} | {c} | {t} s |" for n, k, p, f, l, c, t in rows]
    if blocking:
        md += ["", "**Zatrzymuje publikację:**"]
        md += [f"- {n}: {f[:300]} ({why})" for n, f, why in blocking]
    if let_through:
        md += ["", "**Znane błędy, przepuszczone z powodem** (tools/znane_bledy.json):"]
        md += [f"- {n}: „{k['test']}” · {k['dlaczego']} Zdejmij, gdy: {k['zdejmij_gdy']}." for n, k in let_through]
    if unstable:
        md += ["", "**Niestabilne** (padło, a za drugim razem przeszło; nie zatrzymuje publikacji, ale warto to zbadać):"]
        md += [f"- {n}: {f[:300]}" for n, f in unstable]
    if healed:
        md += ["", "**Znany błąd już nie występuje — zdejmij go z listy:**"]
        md += [f"- {n}: „{k['test']}”" for n, k in healed]
    if inner:
        md += ["", "**Części pominięte przez same zestawy** (mniej sprawdzeń niż zwykle):"]
        md += [f"- {n}: {x}" for n, x in inner]
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
    sys.exit(1 if blocking else 0)


if __name__ == "__main__":
    main()
