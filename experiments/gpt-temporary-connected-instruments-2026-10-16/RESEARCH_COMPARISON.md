# Jaskinia x Medium — donor comparison, 2026-10-16

Source links should be read at current versions; this document is a research note, not an architecture decision.

| Donor | Proven ability / mechanism | Transferable principle | Wrong transfer / limit |
|---|---|---|---|
| Jaskinia v3 source `40-types`, `50-shell` | UI window registry, `c.onSel`, `c.selName`, pinning, `c.onDispose`, iframe preservation when render key is stable | Keep a human-composable shell; instrument lifecycle not tied blindly to global selection | `window.__JASK` is a test affordance, not a secure agent API; `localStorage` per origin; no general external tool protocol |
| Jozzpoly Connected Instruments v1 | Two isolated synthetic runtimes, ACK/timeout/partial-result falsifiers, pause quiescence | Action truth: sent != executed; no implicit retries after uncertain effects | Not two real games or independent agents, not full distributed atomicity |
| Jozzpoly Cloudflare Multiplayer Lab (World V0) | One server-authoritative physical world with bounded two-participant runtime, qualified network/refresh loops | Separate actor/session/transport and epoch identity; acknowledge causality | Not guaranteed arbitrary N agents, durable world epoch or account identity; don't ship game engine just to connect tools |
| Medium PR #22 | Real read-only Cloudflare source projection with observed digest and explicit unknown moving `main` commit | A shared address should expose exact/fuzzy source epistemics separately | No proven incremental agent task value over native GitHub |
| JupyterLab/Lumino | Extension services and command registry separate tools and outer shell | Extensible typed capabilities; composed widgets | Rebuilding JupyterLab and its command universe isn't necessary |
| VS Code webview | Isolated webview with JSON `postMessage` and CSP | Sandbox tool content and use narrow explicit messages | A webview is not a host-agent permission system |
| Grafana Scenes | Nested tree of views, queries, scoped time ranges and variables | Local scope vs shared context should be explicit | Grafana visualization objects aren't full executable game runtimes |
| Observable Framework | Build-time data snapshots and provenance | Serve precomputed data fast without exposing private credentials | Static snapshots do not give current-state actuation or a live environment |
| MCP Apps (Stable Jan 2026) | `ui://`, tool-linked HTML UI resources, JSON-RPC bidirectional and sandbox | Candidate future interoperability layer with ChatGPT/Claude and others | Support is negotiated/host-specific, does not auto-run agents or grant write authority |
| Cloudflare Workers + Durable Objects | Static assets + selective Worker routes + durable coordinated sessions | Low-friction shared address and later a bounded shared work object | Hosting alone is not co-agency, protection/cost/capabilities must be qualified |

Recommended experiment staircase: (1) real Jaskinia panel + independent sandbox adapter; (2) actual project instrument with read-only shared source; (3) action with bounded permissions and receipt checked against real state; (4) persistent project-level workpiece found and used by a different agent *without* Owner courier. Against every stage compare direct GitHub/native tools, not just empty UI.

## Source URLs

- https://jupyterlab.readthedocs.io/en/4.4.x/extension/extension_points.html
- https://code.visualstudio.com/api/extension-guides/webview
- https://grafana.github.io/scenes/docs/core-concepts/
- https://observablehq.github.io/framework/data-loaders
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- https://developers.cloudflare.com/changelog/post/2026-10-01-workers-oauth-provider-1x/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://github.com/Jozzpoly/Shared-Work-Medium-Lab/pull/22
- https://github.com/Jozzpoly/Shared-Work-Medium-Lab/pull/24
- https://github.com/Jozzpoly/cloudflare-multiplayer-lab