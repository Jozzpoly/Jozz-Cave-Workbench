# GPT-6 / Jaskinia v5 — isolated multi-game launch candidate (2026-10-16)

**STATUS:** Experimental source-only branch based exactly on Opus v5 `8d7b114`. Not merged, not deployed, not Owner-accepted, not fully Chromium-qualified. No changes to Opus PR #2.

## Owner-observed need

In the first GitHub Pages Owner test, the owner could play real games inside Jaskinia windows. This is positive experience evidence, not merely demo approval. But he could not naturally keep different games independent across multiple 'Gra' windows. A separate Owner test found JV Web steering not working; fixing Jaskinia launch must not promote that gameplay FAIL to PASS.

## Source cause in v5

`src/jaskinia/50-shell.js`, `B.HOOK.play`:
1. Always calls `select(r.name)`, affecting all windows following global selection.
2. Locates first existing `gra` window and reuses it. A pinned `gra` may have its pin overwritten.
3. Thus the second 'Zagraj' action can commandeer the first running game even though LIVE supports multiple window IDs.

Independent partner analysis of Owner's diagnostic package identified two 'Gra' windows pointing at the same actual URL. This branch addresses the launch hook, **not** a claimed full reconstruction of the Owner recording.

## Candidate behavior

- In `gamesInWindow()` mode, each ordinary `Zagraj` opens a **fresh, pinned `gra` window** to that exact repository, leaving the global selected project untouched.
- 'A → B → A' intentionally creates three distinct windows. Existing games should continue.
- A user-created, unpinned 'Gra' window can continue to follow global project selection; we do not remove that separate mode.
- In 'new tab' mode, the link continues to open a new tab and select its project as previously.

This is intentionally a minimal intervention in the launch hook, not a redesign of session management.

## Test added

`tools/jk5_multi_game_probe.mjs`, run **after npm ci**, calls `npm run jaskinia`, launches actual generated v5 in Playwright Chromium, injects **two local fixture games** (no real game/autosave touched) and checks:
- two successive play actions create two distinct pinned windows and frame executions;
- changing unrelated project selection/theme does not restart them;
- replaying A creates another instance, independent in-memory counter;
- unchanged global selection during in-window launches;
- **negative invariant:** same-origin frames still share localStorage; thus this does **NOT** prove three independent save profiles;
- diagnostic output for initial window overlap (not assigned PASS or FAIL without Owner UX evaluation).

**Execution evidence (two layers):**
1. **Exact handler simulation:** base v5 A→B→A reuses one game; candidate creates three pinned windows; new-tab fallback retains old behavior — PASS.
2. **Actual v5 production HTML, public GitHub Pages archive** (GitHub run `38940015259`, `index.html` SHA256 `a0a023b214c9359b316fb5d658048c99c4ead92b33202aa6f5c7fe383c2da6a5`): loaded into isolated Chromium via `page.set_content`; the exact hook change was injected in-memory, with Jaskinia's shipped `pokaz:pilki` demo substituted for two public project URLs. **BASELINE reproduces:** two plays → one pinned game, with reboot and global selection change. **CANDIDATE reproduces:** two plays → two independent iframe runtimes, manual test placement side by side without restarts, selecting another project/changing theme without restarts, A→B→A → three separate runtimes, no pageerrors. Screenshots and the reproducible Python script were generated outside this repository. This is real app/DOM evidence, not a hypothetical model.

**Still unqualified:** The in-memory `about:blank` context has opaque origin and **does not reproduce real GitHub Pages/file:// storage or framing policy**. Real games, real origin/session isolation, local save behavior, full Opus regression suites, chaos, true mouse-drag Owner workflow and mobile review remain **untested**. The branch should not be merged or deployed on the strength of this narrow positive evidence alone.

## Open product decisions and risks

1. **Window overlap:** `openWinOfType` floats new windows centered by default. Multiple windows may exist, yet remain heavily superimposed. Do not claim multi-game UX solved until real user can see and manage them intuitively. A separate choice is whether to auto-tile, cascade, or offer a clear 'beside existing' action.
2. **Instance vs saved session:** independent `iframe` runtime does not isolate `localStorage`/cookies for same-origin games. Starting two copies of MiniFeniks may share one autosave. Never test valuable saves in this fashion.
3. **Trust F1:** Opus drop-in accepts messages from arbitrary embedding parents (independently reproduced elsewhere). Not repaired here. Do not attach private state to this candidate.
4. **Old storage F2:** old downloaded Jaskinia can damage new workspace data when sharing `jaskinia:v2`. Not repaired here.
5. **Same-origin child DOM access:** Jaskinia and several games hosted at `jozzpoly.github.io` are not origin-isolated simply because they occupy different URL paths. The existing no-sandbox frame is suitable only for trusted public experiments, not a private multi-agent authority boundary.
6. **Real integrations:** none. This test uses deliberately tiny fixture games. A game opened in a separate tab still lacks contract telemetry.

## Acceptance criteria before any promotion

- Run all pre-existing tests specified by AGENTS.md; run `node tools/jk5_multi_game_probe.mjs` and inspect all output.
- Verify desktop and mobile screenshots; ensure new windows are visibly discoverable and manipulable, not merely present in state.
- Test from actual public game links, not only local dummy pages: launch two distinct real games, switch workspace/theme/project, return and independently control both.
- Distinguish a failed embedded game, a refused iframe, and a failed input/focus system (e.g. JV Web steering).
- Qualify save isolation separately before duplicate same-game sessions, multiplayer or agent operators.
- Get Owner experiential verdict; machine tests alone do not mean a good product.

## Continuation

This candidate is offered for comparison or rejection by Opus and the Owner. Do **not** merge it reflexively, upgrade it into an architecture or replace Opus's branch with it. Its value is a small, falsifiable response to a real Owner friction point.
