# GPT TEMPORARY experiment — connected instruments inside Jaskinia

**2026-10-16 · ISOLATED, DISPOSABLE RESEARCH, NOT JASKINIA V4 · NOT OWNER ACCEPTANCE**

Branch: `experiment/gpt-temporary-connected-instruments-2026-10-16`, forked from Jaskinia's public `4567a0ea09afd11213d979daf54a393ba9017be0` (v3 code). Main/Claude are unaffected.

## Specific question

Can the existing Jaskinia shell host **more than one independent, sandboxed instrument** which receives the currently selected project, without restarting the instrument, while honestly distinguishing delivered input, acknowledged input and unknown execution? This is a bridge toward an actual instrument workbench, not another top-level dashboard, and NOT a multi-agent environment or product-ready integration.

## Exact integration

- `src/jaskinia/42-gpt-temporary-instrument.js` gets automatically concatenated after `40-types.js` and before `50-shell.js` by the existing `tools/render.py`; no shell or core files are modified.
- It registers one new **temporary** window kind: `Instrument GPT — eksperyment` (`TYPES.gpt_instrument_temp`). It uses the real Jaskinia `c.onSel`, `c.selName`, `c.onDispose`, `c.save` contract. `follows:false` is deliberate: switching projects does *not* destroy and re-create the iframe.
- `adapter.html` is a small separately sandboxed experimental recipient. Load it explicitly from within the new window, then choose **Połącz z wyborem projektu**. Make two such Jaskinia windows and switch the global project using Kataster, Spis or the Map. A real receiving instrument would have to implement the documented message contract; an arbitrary third-party game will not respond.
- Strictly scoped `event.source === iframe.contentWindow`, random per-instance channel + nonce, request sequence, explicit readiness, matching ACK and no silent retry on timeout. The iframe sandbox is `allow-scripts` (opaque origin, no `allow-same-origin`); only a project name whose `R[name].private === false` is sent; unknown/private selections are blocked (no private repo metadata), tokens or owner notes.
- The sandbox means the parent cannot simply treat `event.origin` as a verified origin. A matching iframe ACK is a **statement by the recipient**, not independent proof of a game step or scientific result. Arbitrary remote URLs need threat modeling, capability budgets and more restrictive policy before product use.

## Build and try in Jaskinia (from repo root)

```sh
npm ci
python3 -I tools/render.py --app jaskinia --host web
python3 -m http.server 8000
```

Open `http://localhost:8000/dist/jaskinia-web.html`. Add a new/empty window, change it to **Instrument GPT — eksperyment**, use the default iframe URL (the fixture lives under `experiments/.../adapter.html`). For two independent instances, add a second new window. Select a different project elsewhere in Jaskinia; with links on, the two instruments receive and ACK that selection without resetting their runtimes.

The already committed `dist/jaskinia-web.html` does **not** contain this experimental window; it must be regenerated on this branch. No file from this branch is implicitly deployed to Cloudflare.

## Executed evidence (limited)

`python experiments/gpt-temporary-connected-instruments-2026-10-16/test_protocol.py`

The Python Playwright harness uses a minimal shell context with the **exact** Jaskinia callbacks this module consumes, `page.set_content` on `about:blank`, and an **actual isolated Chromium sandbox iframe** populated with `srcdoc`. It uses the same adapter HTML and unmodified module JS.

Observed: 9/9 asserted cases passed, no page errors:
1. window type registered;
2. two independent iframe handshakes/ACKs;
3. both follow a new selected project;
4. missing ACK is marked uncertain (no implicit retry);
5. failure in one iframe does not block the other;
6. false/stale ACK rejected;
7. `javascript:` URL refused;
8. window disposal unsubscribes listener;
9. private/unknown project not relayed to the iframe.

**Not tested:** actual generated Jaskinia in Chromium, Jaskinia layout/resize/phone UX, ordinary `http://localhost` navigation (the execution Chromium blocks it), remote cross-origin iframe with a real app, cloud hosting, browser refresh, MCP Apps, auth, multiplayer, signed receipts, or Owner acceptance. There is no reason to merge until a real receiving-project scenario demands it.

## Important research crosscheck

Compare JupyterLab extensible shell/command registry, VS Code webview sandboxed messaging, Grafana Scenes nested variable scopes, Observable Framework build-time snapshots, MCP Apps `ui://` + JSON-RPC + sandbox, and existing Jozzpoly Connected Instruments v1 / Cloudflare Multiplayer Lab / Medium PR #22. This local message contract is a laboratory donor, NOT a standard competitor to MCP Apps.

A genuinely meaningful next falsifier would connect **two real, independently running Jozzpoly project builds**, with a bounded question, explicit action effects or source receipts, and a native-source/ordinary browser counterfactual. Merely drawing two panes has no Medium value.

## Do not merge or deploy by momentum

Keep the public Jaskinia `main` under Claude's control. Treat this experiment as expendable and remove it if C1/v4 or real trials make the idea redundant. In any future live experiment separate `Owner felt it works` from `Chromium asserted it` and `recipient confirmed action` from `parent sent input`.