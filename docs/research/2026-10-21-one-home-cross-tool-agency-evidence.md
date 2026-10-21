# ONE HOME — Cross-tool authoring action, bounded evidence (2026-10-21)

**Status: RESEARCH PASS for a narrowly staged interaction; NOT a deployable Jaskinia feature, NOT an Owner feel PASS.**
Research branch: `research/gpt-recovery-api-e2e-20261020` in Jozz-Cave-Workbench, no merge to Opus's `v6-materialy`.
Original untouched host: `dist/jaskinia-web.html` v6.3, pinned Git blob `3ff64ec0cb25b94c1fa1381b86f45e3c7c3c59e9` (2,450,637 bytes).
Original untouched Medium donors from `Jozzpoly/Shared-Work-Medium-Lab@419b9c9dbf49301ed9fb9bf65e39de33d35f17bb`:
- `two-instruments-one-world-gpt6.html`: real fluid-physics PRZESMYK and authored topology, `__mediumPortable`.
- `second-life-signal-gpt6.html`: separate signal-route interpretation and receiver decision, `__mediumSignal`.

## Owner intent, not optional UI polish

Jaskinia is the **one Home** through which Owner and agents can naturally encounter, alter and benefit from many independent projects' abilities. Medium must enhance that one experience; it must not become a competing portal or mandatory central backend. **Labs may be substantially adapted or replaced upward**, rather than weakening good lab experiences to fit today's Jaskinia. Value = new genuine agency and legible consequence, not number of tabs, iframes, metadata or generic widgets. Preserve specialized expertise, physics, authorship, agent discovery and spontaneous play.

## Demonstrated event chain

[Full original-host run, 13/13 action assertions](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39525641480).
Reproduce through `node tools/gpt_onehome_ui_action_probe.mjs` in CI (the workflow checks out pinned Medium donor).
1. In unchanged Jaskinia open **exactly two** `przyrzad` windows, source PRZESMYK and recipient ŚLAD.
2. An ephemeral research-only button + result strip is installed **in PRZESMYK's native authoring UI**, not a new Jaskinia/Medium catalogue. Playwright performs a real pointer edit at the dam lens; PRZESMYK topology changes before ŚLAD changes.
3. On **one actual button click**, source emits an origin-scoped `postMessage` from its own JS realm. Parent allows this exact source window + expected origin + exact action only. A pinned, lab-specific test adapter reads source's authored `medium.przesmyk.variant.v1` and submits it to the **real recipient importer** with recipient-owned receiver metadata.
4. ŚLAD validates/accepts; its geometry changes. PRZESMYK reports the **actual** recipient interpretation in place: `ŚLAD: trasa istnieje · 64 kroków siatki · nowa interpretacja konstrukcji`. `64` represents grid-route cost, **not physical sound travel time**.
5. Another **real pointer edit** walls over ŚLAD's receiver (62,52). The same action is rejected by the real recipient as invalid; ŚLAD retains its previous state, and the source shows an intelligible refusal.
6. Owner-style correction with PRZESMYK's existing chisel, followed by the same action, succeeds. Receiver identity remains (62,52). Two host windows remain intact; no copied JSON or third portal.

Related [actual host source↔signal semantics run, 11/11](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39521541099): topology survives another tool, signal-specific receiver meaning may be lost when re-exported via source; blind preservation can become physically invalid after an edit, and the recipient then correctly rejects it without mutation. Capsule import resets live fluid simulation history; workpiece preservation != world checkpoint. Lifecycle/versions/own-origin save gates were tested separately and must not be conflated with above.

## Disqualifying gaps / falsifiers

- **Not a safe product broker:** both iframes are deliberately served from the same test origin and adapter directly calls test interfaces; this grants inappropriate access if generalized. A future off-origin narrow capability/permission seam must be researched, without handing labs unrestricted host storage/API. Real per-origin message identity gating was verified when an earlier parent-realm synthetic callback got correctly rejected; installing the action listener in the child realm fixed the test without weakening the gate.
- **Not yet agent self-discovery:** test already knows which action and import functions exist. Neither Jaskinia's public extension API nor generic telemetry provides an inventory of editable affordances. Do not claim Shinden-style independent discovery.
- **Not yet a single coherent visual workspace:** despite useful in-place domain readout, recipient full visualization remains in another Jaskinia window. The UI is experimental; no Owner experience evaluation, no tested physical phone. The visual proof shows a credible direction but not an interaction design approval.
- **No cross-engine shared live world:** separate solvers interpret transferred authoring topology; they are not the same physical state.
- **No persistence and provenance contract for the action:** current link is an ephemeral explicit action in current browser session. No guaranteed future ability to restore build, recipient meaning or execution history.
- **No guarantee generality:** one hand-picked pair of labs supports a specific useful transformation; this proves a candidate architectural pressure point, not a universal API for all games.
- **Potential latency/performance issues:** earlier hosted PRZESMYK was slow/irregular under crowded headless Chromium but demonstrably advanced (step 0→2); no defensible conclusion about Owner device feel.

## Recommended next falsifier

A cold, non-author agent must discover *one useful scoped operation* from a Jaskinia-hosted lab with no hand-coded route to the final click; Owner can observe and approve exactly what changes. Try the same operation **off-origin** using restricted messages and recipient-owned validation. Compare with the lab's standalone workflow and reject any integration that reduces authoring feel or adds a competing Home. Keep the prototype unmerged until technical + Owner experience evidence exists.

Evidence locations: `tools/gpt_onehome_ui_action_probe.mjs`, `tools/gpt_onehome_cross_tool_gate.mjs` and the research workflow. Artifact `real-host-recovery-e2e` from run 39525641480 includes screenshot `_gpt_onehome_ui_action.png`; artifact retention is temporary, source test is reproducible.

## Update after handoff — 21 Oct, independent off-origin gate (newer evidence)

The original off-origin attempt [run 39526443036](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39526443036) was **FAIL**, but source-level debugging isolated a **test-adapter bug**, not an established Jaskinia limitation: `{type:'offer', ...d}` let d.type='request' overwrite the destination message type; likewise a recipient `receipt` was overwritten with `outcome`. The narrow repair orders spread fields before the intended message type. **Do not repeat the earlier FAIL as the current implementation result without this correction.**

[Independent real Jaskinia cross-origin CI gate 39531183796 — 9/9 PASS](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39531183796). The same original public v6.3 host, two different loopback **origins** and pinned actual Medium donor programs were used. The browser correctly denied Jaskinia direct cross-origin access to the donor's runtime (`SecurityError`). The parent routed one explicitly known operation through origin- and source-window-checked `postMessage`. A human-style pointer edit on PRZESMYK, real recipient import and signal-analysis readout, receiver-specific validation, atomic refusal, repair and retry all passed. The source lab advertised one scoped action and explicitly described that a new interpretation was **not** a shared solver or checkpoint. This evidence is separate from the same-origin instrument demo.

**Do not confuse this with a secure production broker or agent discovery.** Permission/consent was implicitly test-authorized rather than acquired from Owner. Adapter and exact source/target pairing were hard-coded; any party at the specified lab origin could still require stronger lab identity/permission checks for production, and capabilities were not sandboxed against all adversarial payloads. No revocation or interruption semantics, provenance, persistent sessions, arbitrary independent agents or real phone/Owner evaluation. The experiment proves that the browser origin boundary can be retained while accomplishing one real authored cross-tool action, not that the whole trust design is solved.

**Relevance to Opus's new collaboration push:** the extension API `Jaskinia.ext.type` is an intentionally **trusted in-page** mechanism, not an origin sandbox. Its registration allows external-type key replacement; a separate real v6.3 smoke experiment demonstrated two independent agents registering the same `agentcanvas` key: existing A window kept rendering A, a new window of the same declared type rendered B, with no exception. Distinct keys coexist. A future independent contribution integration needs collision/provenance qualification and a promotion boundary between agent-tested candidate and trusted Owner Home. No mass plugin platform required now.
