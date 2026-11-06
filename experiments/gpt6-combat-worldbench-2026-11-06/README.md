# GPT-6 / Combat Lab × Jaskinia — Worldbench v0 (6 Nov 2026)

**ISOLATED SCIENTIFIC EXPERIMENT. NOT DEPLOYED. NOT OWNER-ACCEPTED. NOT A NEW JASKINIA API CONTRACT.**

Branches:
- Jaskinia: `experiment/gpt6-combat-worldbench-2026-11-06` from old Jaskinia main `7fcedfa6`.
- Combat Lab: `experiment/gpt6-worldbench-witness-2026-11-06` from P10b branch `72ac69af`. These are sibling source experiments, not a merge.
- Neither existing Jaskinia nor Combat Lab default branch was altered.

## Why this line is not another launcher

The Owner corrected an excessive dependency on Opus to build "the new Jaskinia". This line has authority to experiment with new Jaskinia behaviour on its own isolated branch, then offer strong findings and donor code to other agents. Old Jaskinia is a **material donor and experiment host**, not the design ceiling.

Specific observed blocker from the Coopege C3 branch: `Jaskinia.ext.open` opens individual windows, while agents need an ergonomic way to **compose native windows** around an already-live experiment, without reaching for private `__JASK.store` internals or making a one-off fixed CSS-grid shell.

## A concrete technical vertical slice

1. An additive `src/jaskinia/59a-gpt6-worldbench.js` registers **Worldbench · mikroskop (GPT-6)** as a native Jaskinia window kind. It reads current real `LIVE` instruments, not repository-level facades.
2. Experimental capability `Jaskinia.ext.worldbench.openBeside(anchorId,type,opts)` creates an actual native adjacent window using Jaskinia's `winBeside`; `launch(url)` composes a **real instrument window and real microscope** as **one undoable native layout transaction**, preserving other windows. It is deliberately **NOT** claimed as a final public API or stable old-Jaskinia release.
3. `capture(windowId)` asks the specifically opened iframe for a read-only observation, with an unpredictable per-request id, frame-source matching, a timeout and a size guard. A generic lab with no witness protocol produces **host telemetry only**. Neither result is a solver snapshot.
4. P10b's separately branched `src/p10-jaskinia-witness.js` opts in to a read-only request via `jozz-worldbench/v0`, using the **actual** `world.trace()` and active camera/operator state. The running physics does not accept any commands from Jaskinia. Its state report says `restorable:false` and has a volatile runtime identity to restrict comparisons to the same page instance.
5. The microscope can capture an observation, show source state and export a bounded JSON evidence packet. It can call the **existing native Jaskinia note/remark** for the chosen instrument. Any readout from the lab is explicitly marked `source-reported`; **no independent post-physics proof** is implied by a message.
6. The experiment runs in a fully **disposable** Jaskinia build / fresh browser context. Do not open it on the origin/profile containing the Owner's private Jaskinia: this addon does not solve the old same-origin storage and security coupling.

### Basic invocation (isolated local HTTP environment)

Build old Jaskinia on this branch, then launch a REAL P10b Vite build on the separate Combat branch, using a different local HTTP port. In the test Jaskinia, choose `Worldbench · mikroskop (GPT-6)` and supply the P10b `/p10.html` URL. The microscope opens the real lab in a native Jaskinia window (not inside its own fixed-width simulated shell). The tested API `Jaskinia.ext.worldbench.launch(url)` creates a native split pair programmatically.

Use only public/isolated sources. No private Owner storage, models, chats, notes or saves in the test origin. Do **not** use existing deployment URLs as a substitute: public Combat Lab Pages remains the neutral baseline and P10b is NOT published there.

### Verification levels — do not widen

- Node witness contract tests: expected origin/frame isolation, error on oversized evidence and explicit non-replayable record.
- Jaskinia integration browser test: actual old compositor, mounted lab and preserved boot across a native split, native divider drag, atomic layout undo/redo, desktop/mobile, and a **synthetic protocol fixture** for capture. This proves shell+protocol mechanics, NOT actual P10b physics.
- Required independent **full integration gate still open**: compiled real Vite P10b + old-Jaskinia native host, genuine Rapier witness after real operator input, inspect screenshot and all storage/origin/focus boundaries. A green synthetic fixture is not enough.
- Required Owner gate still open: ease of exploring/experiencing actual Combat Lab and whether this capability changes what the Owner can discover or build.
- No source checkpoint / Rapier serialization, no full input history, no controlled A/B, no autonomous actor cognition, no continuous external-host simulation, no authoritative shared world, no cloud persistence.
- Existing negative P10b anatomy, material pressure and gameplay Owner judgement remain unchanged.

## Tests

```
npm ci
npx playwright install chromium
python3 tools/render.py --app jaskinia --host web
node tools/gpt6_worldbench_test.mjs
```

The branch-only action should run the same browser gate and attach raw desktop/mobile screenshots, without a Pages deployment.

## Falsifiers / red-team

- A native split operation causes the already-running instrument to restart; or undo does not remove just the new pair.
- Repeated quick opening silently reuses the wrong world, collapses the user's layout or loses notes.
- A forged message from another iframe satisfies `capture`.
- Output data implies a replay, determinism, or physical verification unsupported by the runtime.
- An isolated build touches original Jaskinia storage keys or opens under the Owner's persistent origin.
- Real P10b screenshots show the same pointless diagram with no incremental increase in experimental agency. In that case preserve this seam as an infrastructure donor but do not market it as an experience improvement.

## Other agents

These are hypotheses and **donor-grade code**. Critique, replace or fork them. Do not merge into Opus's current main, modify the protected Jaskinia Compass, or generalize this one physical specimen into a universal world schema. Credit code to GPT-6 and user control to Jozz; connecting the same GitHub identity is not proof of Owner authorship.
