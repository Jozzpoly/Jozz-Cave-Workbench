# GPT-6 / Combat Lab × Jaskinia — Worldbench v0 (6 Nov 2026)

## Metodologiczna korekta / 9 XI 2026 — świat naprawdę ukryty, a nie dopiero przywrócony

**Nowy, wyraźnie lepszy test:** [GitHub Actions #42711325258](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/42711325258), rzeczywisty Chromium, Jaskinia v6.4.1 i przypięty fizyczny P10b Rapier. Wysłano dwa niezależne, powiązane ze źródłowym iframe żądania odczytu **gdy samo okno wciąż miało `hidden=true`**. Nie przywracano go między próbkami.

- 53 kroki Rapiera w poprzedzającym **widocznym** oknie 850 ms.
- Dwa odczyty ukrytego świata oddzielone ~1080 ms: `tick=121` oraz `tick=121`, czyli **zero** kroków pomiędzy nimi.
- Odpowiedź na `postMessage` dotarła z ukrytej ramki; źródło pozostawało dostępne do odczytu, mimo że jego pętla `requestAnimationFrame` nie postępowała w tym przedziale.
- Identyfikator fizycznego runtime przed ukryciem i po powrocie pozostał ten sam. Bezpośredni odczyt zaraz po pokazaniu nadal wskazał `tick=121`.

**Poprzedni wynik 1–2 kroków „w tle” był obciążony błędem metody:** odczyt wykonywano dopiero *po przywróceniu widoku*, a `p10-ui.js:frame()` po wznowionym `requestAnimationFrame` może wykonać kilka kroków (delta ograniczona do 0.05 s). Poprzedni iloraz ~1–2.3% **nie jest poprawnym oszacowaniem fizyki wykonywanej podczas ukrycia** i nie powinien być używany dalej.

**Granica uogólnienia:** wynik dotyczy badanego, ukrytego `iframe` w Chromium i pętli P10b, nie wszystkich przeglądarek, systemów, Workerów ani wszystkich światów. `0` zmierzonych kroków nie dowodzi, że nic innego (wiadomości, zdarzenia, pamięć, sieć) w tle nie może działać. To dowód rozdzielenia: *istnienie instancji* / *możliwość odczytu* / *postęp fizyki* / *utrwalenie stanu*. Ostatniego nie badano.

**Następny ważny falsyfikator etapu I:** czy host może bez przywrócenia widoku bezpiecznie wskazać i odczytać istniejący świat z innej pracowni? Sam Worldbench `capture(id)` obecnie sprawdza `L.wins[id]`, czyli układ **aktywny**, i może odrzucić działający obiekt w nieaktywnej przestrzeni; surowy test źródłowy dotarł do iframe przez zachowane `__JASK.RT`. Nie przyjmować tego hacka za projekt nowego API. Najpierw określić intencjonalną politykę dostępu oraz izolację i autorytet źródła.


## 7 Nov — critical continuity correction, after interrupted conversation

**State recovery:** The repo, not a chat claim, is the persistent evidence. Draft Jaskinia PR #7 (this branch) and draft Combat PR #15 (`experiment/gpt6-worldbench-witness-2026-11-06`) are open and unmerged. New-Jaskinia issue #4 communicates the donor; it does NOT authorize changing that repo's `main`. The platform-level reason for the interrupted chat is not observable; no evidence of GitHub source loss. Some earlier Actions screenshot artifacts expire after 7 days; source code, tests and source-level findings are in Git.

### Confirmed new falsifier: preserving an iframe is not preserving a living world

[Real browser controlled negative probe, CI #42316083721](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/42316083721). Real cross-origin Vite/Rapier P10b, same host, same runtime identity; sampled physical solver tick when its Jaskinia workspace was visible for 850 ms, then switched to another workspace for 1400 ms and returned:

- visible **52 solver steps / 850 ms**;
- hidden **2 steps / 1400 ms**;
- time-normalized hidden/visible progression **~0.023**;
- instance identity preserved. All other physical witness / native Jaskinia tests remained PASS.

Thus prior "keeps running" wording must be read ONLY as "not reloaded; state survived" in these circumstances, NOT "continuously simulated while invisible". Old Jaskinia docs already suspected the different-origin hidden-rAF throttle; this directly verifies it on the actual donor.

**This is not proof that every world should continue in the background.** The required experimental question is which world-time semantics are intended: freeze/park; catch up on return; keep a bounded live runner; or actually remain continuously authoritative outside the view. Browser hidden-frame rAF, browser tab suspension, OS sleep and network hosting are distinct conditions. Keeping the old iframe instance is NOT a clock policy. Do not silently advance simulated time to match wall-clock seconds, nor assume exact replay.

### Two additional red-team conclusions

1. **Native touch access is not complete embodied control.** On emulated Pixel 7 we tested tapping Pause/Open and switching native windows; we did not validate expressive movement, manipulation, zoom, combat feel or gesture affordances. Inspect P10b `p10-ui.js`: moving matter by drag currently requires Ctrl+drag while paused, and actor movement uses keyboard input. Those conditions do not translate naturally to a phone. Canvas 100% visible is a geometry measurement, not an experiential PASS.
2. **Independent new Jaskinia already has its own provisional records/heads/journal proposal** (as of 4 Nov, `Jozzpoly/Jaskinia/docs/rdzen-zapisow-szkic.md`). Worldbench's 30 JSON observations are ephemeral within its own window; export is a file, not persistent resumption, provenance-linked experiment or shared versioned authoring. Do not build a competing record core from P10b pressure. Compare as a donor and demand three distinct consumer falsifiers before any generalization.

### Stop rule and next high-value experiment

Technical integration is no longer the primary unknown. The next step must distinguish **(a) interesting natural physical interaction and causal understanding in Combat Lab** from **(b) interface/session infrastructure**. Prototype exactly one direct physical question in a dedicated *visible* Lab with a clear before-condition, operator intervention, actual after-behaviour, exact source and environmental constraints, and an inexpensive path for Owner to freely break it. Compare the experience standalone against the native focused Jaskinia composition. Only after an actual return/use case should we add resumable experiment records; no new framework merely for screenshots or workflow green checkmarks.

The immediate evidence targets are **background world-time semantics** and **actual phone body/material gestures**; not another status panel, and not an Opus-dependent implementation plan.

## Executed update: 2026-11-06, native Jaskinia × genuine Rapier P10b

**Current narrow machine gate: PASS at [CI #42309795677](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/42309795677); NOT OWNER EXPERIENCED/ACCEPTED; NOT A REPLAY/SAVE OR PRODUCTION JASKINIA.** Actual browser desktop, focused dual-window space, cross-origin Vite-built P10b WASM, and touch-mobile physical runtime were executed. Two draft PRs: [old Jaskinia #7](https://github.com/Jozzpoly/Jozz-Cave-Workbench/pull/7), [Combat P10b #15](https://github.com/Jozzpoly/Combat-Lab/pull/15).

New achieved behaviours beyond the initial read-only donor:

- **Actual source-domain authoring:** P10b shows an explicit in-game "Zezwól na edycję z Jaskini" permission toggle when embedded. Only when owner grants it and the physics world is paused can the native Jaskinia microscope request the exact allowed physical edit `p10b.aperture.widen` or its bounded physical inverse `p10b.aperture.narrow`. The live P10b source checks exact runtime identity, before-aperture, edit revision, idempotency and operation whitelist. Native UI receives the post-physics source trace. Request without permission and stale before-state were rejected in **real Chromium**, not just the Node mock. Do not generalize this P10b domain operation to RPG/VAW.
- **Observed old Jaskinia UX deficiency:** First real world-pane in crowded default view was unusable in its initial CSS; the physics canvas was entirely below the fold (`canvasVisibleFraction=0`). Reworked **embedded-only** P10b responsive CSS without altering stand-alone desktop layout. In final machine geometry its entire canvas was visible (360×616 pane, ~350×390 canvas). This is a measured gate, NOT evidence of intuitive controls, touch feel or good bodily graphics.
- **An explicit task-focused native workspace rather than a fake CSS desktop:** `launchFocus(url)` creates a new named **Combat Lab · Badanie** Jaskinia space with a real compositor `row` split: ~71% live world and ~29% microscope. The previous workspace and its independent P10b runtime stay untouched; returning to either native workspace retains each distinct runtime. Exact measured focused world canvas: 1121 px at 1600×950.
- **Live, situated context:** click/select a physically real actor in the P10b iframe (actual keyboard `2` for bulky), and its source-grounded mass, coordinates, velocity, stance, true grip count, physical aperture and edits appear in the microscope automatically (1 Hz source telemetry, no extra manual capture). Real Chrome read `bulky #14, 160 kg`. The human-facing live context is source-reported evidence, not proof of causal explanation.
- **Actual mobile donor:** Pixel 7 emulated touch Chrome launched native focused workspace with real P10b Rapier; tapped Pause and physically widened slot, read source evidence, switched to native Jaskinia microscope via dock, showed live selected-body card, then returned to the SAME physical runtime without loss. `stageWidth=402`, visible fraction `1`. Real hand-held Owner Opera and intuitive touch dragging remain untested.
- **Evidence:** CI saved desktop Jaskinia with live world after physical action, separate full-width focused workshop, mobile native source/microscope and native protocol desktop/mobile photos. 7-day retention. Static screenshots were actually reviewed by GPT-6; real UI is visibly simple 2D circle/rectangle Rapier matter and plain contextual readouts, *not impressive natural organism feel*. Human decision still open.
- **GitHub safety:** all changes on two visibly named isolated branches and draft PRs, no `main`, Jaskinia release, Combat rehearsal, Pages deploy, cloud account or Owner browser state modified.

Critical limits/next falsifiers: i) no single-click freely accessible permanent preview (CI artifact is research evidence and expires); ii) no actual source snapshot/replay/branchable experiment or long-lived user-owned save; iii) old Jaskinia same-origin risks remain and the parent handshake is not a production authorization protocol for arbitrary hosts; iv) no validated multi-world API or persistent cross-agent authoring surface; v) unit/browser PASS is subordinate to actual Owner unscripted play and judgement. Preserve these negatives as first-class donor evidence.

**Different research question now earned:** not "can a page be embedded?", but "can a situated actor/material intervention, observed outcome and unfinished question become one navigable, durable, resumable research act across laboratories and agents?" The next experiment must use genuine Combat Lab phenomena and compare independent no-Jaskinia controls; do not add a generic framework/launcher or silently adopt Coopege's `setTile` semantics.


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
