#!/usr/bin/env python3
"""What tools/testy.py lets through, checked on made-up suite outputs (10 Nov 2026). No browser, no network.

Usage: python3 -I tools/testy_test.py
The two cases the Menadżer reproduced on the first version of the gate (Commons STAN, 10 Nov evening) come first:
(a) continuity fails once and passes on a retry, (b) a known, repeatable failure in a suite that guards the owner's
state. Both let the first version through. Here (a) must block, and (b) must block whenever the page's code changed.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("testy", os.path.join(HERE, "tools", "testy.py"))
T = importlib.util.module_from_spec(spec)
spec.loader.exec_module(T)
FAILS = []


def ok(cond, label):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        FAILS.append(label)


KNOWN = [
    {"zestaw": "jk61_test", "test": "two tabs at once", "dlaczego": "x", "zdejmij_gdy": "y", "niestabilne": True},
    {"zestaw": "jk5_test", "test": "a lab in a window", "dlaczego": "x", "zdejmij_gdy": "y"},
]
STATE = {"jk61_test"}


def out(*lines, code=None):
    text = "\n".join(lines)
    fails = any(l.startswith("FAIL ") for l in lines)
    return text, (code if code is not None else (1 if fails else 0))


def run(name, first, second=None, strict=False):
    calls = []

    def again():
        calls.append(1)
        return T.judge(name, *second, KNOWN) if second else T.judge(name, *first, KNOWN)
    d = T.decide(name, T.kind_of(name, STATE), T.judge(name, *first, KNOWN), again, strict)
    return d, len(calls)


def main():
    # (a) continuity: FAIL, then PASS on a retry
    d, n = run("dom_ciaglosc_test", out("PASS a", "FAIL his note is there"), out("PASS a", "PASS his note is there"))
    ok(d["blocking"] and n == 0, "(a) continuity that fails once blocks, and is never retried")
    # (b) a known, repeatable failure in a suite that guards the owner's state
    d, _ = run("jk61_test", out("PASS a", "FAIL two tabs at once"), strict=True)
    ok(bool(d["blocking"]) and not d["let_through"], "(b) a known failure guarding his state blocks when the page's code changed")
    d, _ = run("jk61_test", out("PASS a", "FAIL two tabs at once"), strict=False)
    ok(not d["blocking"] and len(d["let_through"]) == 1, "(b') the same failure is let through, named, when only the data changed")
    # a new failure in a state suite: no retry, blocks
    d, n = run("jk61_test", out("PASS a", "FAIL a new merge problem"), out("PASS a", "PASS a new merge problem"))
    ok(bool(d["blocking"]) and n == 0, "a new failure guarding his state blocks at once, without a retry")
    # continuity with a listed entry is still blocked (nothing on a list can excuse it)
    T_KNOWN = KNOWN + [{"zestaw": "dom_ciaglosc_test", "test": "his note is there", "dlaczego": "x", "zdejmij_gdy": "y"}]
    d = T.decide("dom_ciaglosc_test", "ciaglosc", T.judge("dom_ciaglosc_test", *out("FAIL his note is there"), T_KNOWN), None, False)
    ok(bool(d["blocking"]) and not d["let_through"], "a continuity failure blocks even if someone lists it")
    # other suites: fails once, passes on the retry → unstable, not blocking
    d, n = run("jk5_test", out("PASS a", "FAIL a chart note"), out("PASS a", "PASS a chart note"))
    ok(not d["blocking"] and d["unstable"] == ["a chart note"] and n == 1, "elsewhere a failure that does not come back is unstable, reported, not blocking")
    # other suites: fails twice → blocks
    d, n = run("jk5_test", out("FAIL a chart note"), out("FAIL a chart note"))
    ok(bool(d["blocking"]) and n == 1, "elsewhere a failure that comes back blocks")
    # a suite that stops without PASS/FAIL lines blocks
    d, _ = run("jk5_test", out("Error: boom", code=1), out("Error: boom", code=1))
    ok(any("przerwał się" in f for f, _ in d["blocking"]), "a suite that stops without its PASS/FAIL lines blocks")
    # a listed failure followed by an uncaught error: the checks after it never ran, so it blocks
    crash = "PASS a\nFAIL a lab in a window\n--- stderr ---\nTimeoutError: locator.tap: Timeout 30000ms exceeded\n    at /x/jk5_test.mjs:9:1"
    d = T.decide("jk5_test", "inne", T.judge("jk5_test", crash, 1, KNOWN), None, False)
    ok(any("przerwał się" in f for f, _ in d["blocking"]), "a suite that dies after a listed failure blocks: its later checks never ran")
    # a known failure elsewhere is let through; when it passes again it is reported
    d, _ = run("jk5_test", out("FAIL a lab in a window"))
    ok(not d["blocking"] and len(d["let_through"]) == 1, "a known failure elsewhere is let through with its reason")
    r = T.judge("jk5_test", *out("PASS a lab in a window"), KNOWN)
    ok(len(r["healed"]) == 1, "a known failure that passes again is reported, so the list cannot harden")
    r = T.judge("jk61_test", *out("PASS two tabs at once"), KNOWN)
    ok(r["healed"] == [], "an entry marked unstable is not reported as healed when it happens to pass")
    r = T.judge("jk62_test", *out("PASS a", "   (no export folder here: the check on real files is skipped)"), KNOWN)
    ok(r["inner"] == ["(no export folder here: the check on real files is skipped)"], "a part a suite skips by itself is noticed")
    print(f"\n{'all passed' if not FAILS else str(len(FAILS)) + ' failed'}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
