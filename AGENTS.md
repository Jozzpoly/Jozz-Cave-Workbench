# AGENTS.md: start here

For any agent (Claude, GPT, Codex) working on Jaskinia. Read this, then [docs/2026-10-16-z-gory.md](docs/2026-10-16-z-gory.md) (Polish: what we are fighting for, honest state, next steps), then [docs/design/2026-10-14-jaskinia-v2-decisions.md](docs/design/2026-10-14-jaskinia-v2-decisions.md).

## The owner

Jozz, a solo game developer and graphic designer, writes in Polish and casually. He builds with several agents and judges work by using it. His screen recordings are the strongest evidence there is. Mechanical tests passing never overrule his verdict. He does not want to be the scheduler of agents or the carrier of their context. Carry your own continuity: recover the goal, the state and the last real boundary, then do the next valuable step.

## Rules the code and the tests enforce

- **Nothing disappears silently.** A broken workspace goes to the trash (`broken`) and the rest keeps working. An unreadable store is kept in the rescue box and the last backup is loaded, with a visible banner. Deleting goes to the trash. "Delete forever" exists only inside the trash.
- **Risky operations make a backup first** (reset, import, load-all, delete forever) and offer "Cofnij" (undo) in a toast.
- **Notes live outside layout undo.** Their text is in `store.notes`; a notes window only holds `st.note` (an id). Ctrl+Z of a layout never rewinds typing.
- **The wall never rearranges itself.** Arranging happens only on request ("Ułóż…") and is one undo step. Camera position is per window in `store.views` and is not part of undo.
- **Colours say something true.** Life colours measure time since the last commit at snapshot time, not "now", so an old snapshot does not make living projects look dead. Green means alive, older fades to calm blue and the background, red only marks findings that need a decision.
- **Unknown is not zero.** When the API could not see a repository (`api: false`), PRs, CI and description are shown as unknown.
- **Facts and meaning stay apart.** Families and the one-line "why" of each project are Claude's hypotheses (marked "HIPOTEZA CLAUDE" in the interface) until the owner ratifies them. Agents propose; their proposals never silently become the owner's decisions.
- **"Od początku" starts where real work starts** (`workStart`): a thin prelude (under 10% of commits before a silence longer than 60 days) is left out and named at the chart's edge. The account's whole life is the "od konta" range.
- **No pretend features.** If something only looks like it works, it is a bug.
- **The project is public, the instance is private.** Code, tools, tests, docs and the public repositories' data belong here. The owner's private repositories and his own words live in the private layer (`private/knowledge_private.json` plus the full snapshot) and never enter this repository. Make the public copy with `python3 -I tools/public_copy.py DEST`: it rebuilds from public data only and fails on any private trace. Never commit screen recordings or unreviewed frames either: they show the owner's whole screen.

## How the page is put together

`tools/render.py --app jaskinia` concatenates `src/app.js` (the Library core, run with `BIB_MODE = "jaskinia"`, which exposes its panels and helpers as `window.__BIB`) and then every `src/jaskinia/*.js` in file-name order inside one IIFE. Fonts, CSS and `data/library.json` are inlined. The result is one HTML file.

| file | role |
|---|---|
| `00-base.js` | device preferences (`jaskinia:prefs`), `t()` / `tn()` for language, icons, small helpers |
| `05-i18n.js` | English beside the Polish source strings (key = the Polish sentence; arrays = singular/plural) |
| `10-model.js` | pure layout model: split tree, floating windows, ids |
| `15-store.js` | store v2 in `localStorage` (`jaskinia:v2`), backups (`jaskinia:kopie`), rescue box (`jaskinia:ratunek`), migration from `jaskinia:v1` (left untouched), repair, export/import |
| `20-stats.js` | statistics from the snapshot (day 0 = snapshot day), periods, chart binning (day → week → month when bars get thinner than 3 px) |
| `30-wall.js` | the wall: world coordinates, camera, semantic zoom (level of detail by on-screen size), frames, sticky notes, links, minimap, gestures |
| `40-types.js` | the window-type registry `TYPES` (24 types: map, wall, Kataster, list, play, findings, changes, card, game, branches, rhythm, state, data, stats, chart, ranking, year, clock, pulse, history, notes, knowledge, settings, empty chooser) |
| `45-settings.js` | themes (`data-jk`), life ramps (`data-life`), density, the Settings window, export/import |
| `50-shell.js` | the shell: top bar, workspaces (tabs), windows, dividers, drag and drop, menus and sheets, phone mode, undo/redo, trash, reset, toasts |

Phone mode switches on when the stage is narrower than 700 px: one window at a time, a dock of window chips at the bottom, menus as bottom sheets.

A window type is an entry in `TYPES` with a `name`, a `glyph`, a `desc` and `render(box, c)`. `c` is the context: the window, its layout, the selected repo, `save()`, `setView()`, `busy()`. Optional flags: `sized` (needs its size), `fill`, `zoomKey`, `noZoom`, `ranged` (stats periods), `ctx` (header controls).

Interface strings are written in Polish in the source and wrapped in `t('…')`. The English dictionary sits beside them. Panels that come from the Library are still Polish only.

## Before you propose a change

- Run `node tools/jk_test.mjs`, `node tools/jk2_test.mjs` and `node tools/jk2_chaos.mjs 400 <seed>`. All must pass. They open the pages over http (`tools/serve.mjs`), because headless Chromium can drop the `localStorage` of `file://` pages across reloads, which would test the browser instead of Jaskinia.
- For anything visible, take screenshots on desktop and phone (`tools/jk2_look.mjs` shows how) and look at them.
- Work on a branch and open a pull request. `main` is the owner's.
- Do not commit generated test pages (`dist/_*.html`) or screenshot folders.
- Never put tokens anywhere in the repository.

## Known debts (as of 16 Oct 2026)

1. The data is a snapshot taken in an agent's sandbox, with no automatic refresh yet.
2. State lives in one browser; no sync between devices.
3. There is no layer for the owner's own judgment of projects (finished, donor, return to it).
4. Library panels are glued in through a compatibility hook and are Polish only.
5. The window system is concatenated scripts with shared state. Tests are mostly end-to-end.
6. In the claude.ai artifact, games open in a new tab, not in a window.

The order in which to tackle these is in the view from above.
