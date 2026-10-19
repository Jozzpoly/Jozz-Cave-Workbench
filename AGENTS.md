# AGENTS.md: start here

For any agent (Claude, GPT, Codex) working on Jaskinia. **First read the [Jaskinia compass (issue #5)](https://github.com/Jozzpoly/Jozz-Cave-Workbench/issues/5)**, in Polish: what Jaskinia is for, who holds what, and how we work with the owner. It is the one place for that; changes go there, not into new START_HERE files. Then read this file, then these, in order:
1. [docs/2026-10-18-v62-uwagi.md](docs/2026-10-18-v62-uwagi.md): v6.2, the owner's ten remarks from using v6, each answered by behaviour, and **his conventions** (below).
2. [docs/2026-10-18-v61-fundament.md](docs/2026-10-18-v61-fundament.md): v6.1, the foundation after the owner's look from above (several tabs merge, addresses, the agents window, material settings revisions) and the next steps in order.
3. [docs/2026-10-16-z-gory.md](docs/2026-10-16-z-gory.md): in Polish, what we are fighting for, the honest state and the next steps.
4. [docs/2026-10-18-v6-materialy.md](docs/2026-10-18-v6-materialy.md): v6, the owner's own models in 3D and walking inside them; the shared goal with Feniks Studio (Astra) and the `window.Jaskinia` API.
5. [docs/2026-10-16-szwy.md](docs/2026-10-16-szwy.md): the evening review of 16 Oct, covering the seams found with GPT, Medium and the Studio line, the measurements, and the current order of work.
6. [docs/design/2026-10-14-jaskinia-v2-decisions.md](docs/design/2026-10-14-jaskinia-v2-decisions.md).

## The owner

Jozz, a solo game developer and graphic designer, writes in Polish and casually. He builds with several agents and judges work by using it. His screen recordings are the strongest evidence there is. Mechanical tests passing never overrule his verdict. He does not want to be the scheduler of agents or the carrier of their context. Carry your own continuity: recover the goal, the state and the last real boundary, then do the next valuable step.

## The owner's hands (conventions, v6.2)

He judges Jaskinia with his hands. These hold in every window, and a new window follows them from the start.

- **Mouse in 3D.**
  - Left button turns.
  - The wheel button (and the right one) **always moves the view**.
  - Turning the wheel zooms toward the cursor.
  - Never give the wheel button another job.
- **Walking and flying, as in Minecraft and Unreal.**
  - WASD walks.
  - Space jumps; flying, Space goes up and Shift goes down. Shift runs on foot.
  - F flies.
  - The wheel sets the speed.
  - A key let go is let go. A browser shortcut or leaving the tab clears every held key.
- **Games.** "Zagraj" switches the game in the game window. Shift opens a new window beside. Ctrl opens a browser tab. A game window taken into use gets the keyboard (`focusGame`).
- **One answer to pointing.** Every chart mark answers with the same `tip()` note:
  - it brightens softly;
  - the note follows the pointer;
  - it fades back.

  Never draw a mark with only an SVG `<title>` (it is upgraded automatically, but write the note on purpose). Hover effects fade; nothing flashes. A chart with its own richer note marks itself `data-own-tip`.
- **Pixels are sharp.** His models are Blockbench pixel art: nearest sampling, no mipmaps, by default. `prefs.pixels` is the one switch for every model (`swPixels`).
- **Compact on a desk, large on touch.** Window tools stay quiet until the header is pointed at.
- **Only his.** Never offer, ship or call "his" a model, asset or text without checking who made it.
- **His remarks are the strongest signal after his recordings.** Read them in "Dla agentów" (`#agenci`) before working on Jaskinia. When you act on one, add an answer to `private/uwagi_odpowiedzi.json` (keyed by the remark's moment, private layer only), so he sees it under the remark and other agents see it is no longer open.

## Rules the code and the tests enforce

- **Nothing disappears silently.** A broken workspace goes to the trash (`broken`) and the rest keeps working. An unreadable store is kept in the rescue box and the last backup is loaded, with a visible banner. Deleting goes to the trash. "Delete forever" exists only inside the trash.
- **Risky operations make a backup first** (reset, import, load-all, delete forever) and offer "Cofnij" (undo) in a toast.
- **Deleting for good keeps a way back.** A copy holds layouts, notes and views, not the trash, so `makeBackup(why, forgotten)` puts what leaves the trash for good inside the copy made just before, and restoring that copy puts it back in the trash. If the copy cannot be written, nothing is deleted.
- **Several tabs merge, they never overwrite (v6.1).** A tab writes only after it changed something. Every written state names itself and its parent (`rev`, `par`), and another tab's write is merged three ways against the state it grew from: layouts window by window, notes by their newer text, views, saved states and trash item by item. A real clash keeps this tab's version, puts the other in an automatic copy and says so once. Note editors write back only typed text. Never call `persistNow()` to save a change: call `persist()` (it marks the change), as every app path does.
- **Everything has an address (v6.1).** `#repo~Name`, `#m~id`, `#uklad~id`, `#agenci` and window names work from outside, when typed and from links inside windows (`59-adresy.js`). A link in a window that goes nowhere is a bug, not something to hide with CSS.
- **An older Jaskinia never erases what a newer one wrote.** Every Jaskinia downloaded to one computer shares the same `file://` storage, and the public build shares it with the private one. A window type or a pinned project that a build does not know waits in `w.lost` and comes back in a build that knows it.
- **A running lab is never reloaded by Jaskinia.**
  - Window types with `live: true` (`przyrzad`, `gra`) are rebuilt only when what they run changes (`liveKey`). Theme, density, zoom, a layout change or a narrow window never rebuild them.
  - Switching the interface language still relaunches all of Jaskinia (debt 8).
  - Loaded is not always running: a lab from another origin stops animating while its window is in another layout, and a resize reaches the lab ([docs/2026-10-16-szwy.md](docs/2026-10-16-szwy.md)).
  - Labs that speak the instrument contract ([docs/przyrzad/KONTRAKT.md](docs/przyrzad/KONTRAKT.md)) are heard only from frames Jaskinia opened, and only as text.
- **Note text never enters the log.** A menu item whose label comes from something the owner wrote carries a `log` label (the notes menu logs "notatka"), and a package without notes scrubs every note's title and lines out of the log.
- **Materials are the owner's files, kept whole.** The same bytes are the same material (id from SHA-256). A changed file with the same name is a new version beside the old one, never a silent replacement. Deleting is soft and has "Cofnij". Materials live outside layout undo, in IndexedDB `jaskinia-materialy`.
- **Notes live outside layout undo.** Their text is in `store.notes`; a notes window only holds `st.note` (an id). Ctrl+Z of a layout never rewinds typing.
- **The wall never rearranges itself.** Arranging happens only on request ("Ułóż…") and is one undo step. Camera position is per window in `store.views` and is not part of undo.
- **Colours say something true.** Life colours measure time since the last commit at snapshot time, not "now", so an old snapshot does not make living projects look dead. Green means alive, older fades to calm blue and the background, red only marks findings that need a decision.
- **Unknown is not zero.** When the API could not see a repository (`api: false`), PRs, CI and description are shown as unknown.
- **Facts and meaning stay apart.** Families and the one-line "why" of each project are Claude's hypotheses (marked "HIPOTEZA CLAUDE" in the interface) until the owner ratifies them. Agents propose; their proposals never silently become the owner's decisions.
- **"Od początku" starts where real work starts** (`workStart`): a thin prelude (under 10% of commits before a silence longer than 60 days) is left out and named at the chart's edge. The account's whole life is the "od konta" range.
- **No pretend features.** If something only looks like it works, it is a bug.
- **Every build names itself.** Raise `src/jaskinia/version.txt` for every version the owner gets, and add a row to [docs/VERSIONS.md](docs/VERSIONS.md). His recordings are matched to builds by the number in the top bar.
- **Where it runs is detected, not assumed.** `PLACE` is `plik` (a downloaded file: `file:` or `content:`), `web` (the owner's own server) or `claude` (the artifact). Games may open in a window only outside claude.ai. Tests set `window.__JASK_PLACE` to pretend.
- **The data's age is visible.** The top bar says how old the snapshot is; charts never draw the days after the snapshot as empty days.
- **Feedback is cheap.** Anything new that changes the layout should go through `commit()` (it lands in undo and in the log). The log and the notes stay on the device; the package leaves only when the owner hands it over, without note texts unless he ticks it.
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
| `50-shell.js` | the shell: top bar, workspaces (tabs), windows, dividers, drag and drop, menus and sheets, phone mode (Back closes a sheet, two fingers zoom a window), undo/redo, trash, reset, toasts |
| `52-przyrzady.js` | instruments: the owner's labs and games running in `przyrzad` and `gra` windows, the instrument contract (hello, state, signals, events, remarks back), the live "Sygnały" window, the picker of what to run, and the demo lab carried inside (`LAB_DEMO`) |
| `56-swiat.js` | the 3D runtime every 3D window shares: `swStage` (light, theme colours, metre grid, framing, the 1.8 m person, adaptive resolution, renders only on change, the owner's mouse), `swPixels` (sharp or smooth texture pixels) and `swWalk` (first person at 1:1, a capsule against a BVH, step-up, jump, fly, phone sticks) |
| `56b-blockbench.js` | Blockbench's `.bbmodel` read directly into three.js (cubes, meshes, pivots, ZYX rotations, embedded pictures; 16 px = 1 m) and `bbLook()`, the Blockbench material that `.obj` exports get too |
| `57-materialy.js` | Materiały: the owner's models and pictures in IndexedDB (files by SHA-256, materials with versions, orientation and scale defaults), the window, file drops anywhere in Jaskinia, his models from his public repositories |
| `59-adresy.js` | addresses (`#repo~`, `#m~`, `#uklad~`, window names): at start, on `hashchange` and from links in windows; the address follows the selection; the "Dla agentów" window (`agenci`) |
| `58-api.js` | `window.Jaskinia` v1, the surface other tools may use: `ext.type/icon/strings/open`, `materialy.*`, `swiat.*` (see the v6 doc) |
| `../vendor/swiat3d.js` | three.js 0.180.0 + addons + three-mesh-bvh 0.9.2, bundled by `tools/swiat/build.mjs`; `render.py` puts it before Jaskinia's script; it only defines a factory until a 3D window asks |
| `55-feedback.js` | the feedback loop: the log (`jaskinia:dziennik`), "To mnie uwiera" notes pinned to the moment (`jaskinia:uwagi`, correctable, merged across tabs, with agents' answers from the private layer as `UW_ODP`), "Paczka dla Claude'a" (file or text), the Settings section "Uwagi i paczka" |
| `version.txt` | the version number the top bar shows; `render.py` stamps it with the build time into `JASK_BUILD` |

Phone mode switches on when the stage is narrower than 700 px: one window at a time, a dock of window chips at the bottom, menus as bottom sheets.

Code outside this repository (Feniks Studio first) adds window types through `Jaskinia.ext.type(key, def)` instead of editing these files. A window type is an entry in `TYPES` with a `name`, a `glyph`, a `desc` and `render(box, c)`. `c` is the context: the window, its layout, the selected repo, `save()`, `setView()`, `busy()`. Optional flags: `sized` (needs its size), `fill`, `zoomKey`, `noZoom`, `ranged` (stats periods), `ctx` (header controls).

Interface strings are written in Polish in the source and wrapped in `t('…')`. The English dictionary sits beside them. Panels that come from the Library are still Polish only.

## Before you propose a change

- Run `node tools/jk_test.mjs`, `node tools/jk2_test.mjs`, `node tools/jk4_test.mjs`, `node tools/jk5_test.mjs`, `node tools/jk6_test.mjs [shots] [models]`, `node tools/jk61_test.mjs`, `node tools/jk62_test.mjs` and `node tools/jk2_chaos.mjs 400 <seed>`. The v6 checks run WebGL in SwiftShader and need a folder of the owner's public models (see the script's header). All must pass. They open the pages over http (`tools/serve.mjs`), because headless Chromium can drop the `localStorage` of `file://` pages across reloads, which would test the browser instead of Jaskinia.
- For anything visible, take screenshots on desktop and phone (`tools/jk4_look.mjs [dir] [scenario]` shows how) and look at them.
- **Playwright's Chromium is not the owner's browser.** It turns storage partitioning off and changes some throttling. A claim about storage, origins, hidden frames or folder access needs a run with partitioning on (`node tools/probes/hosting.mjs` shows how), a note of the flags it ran with, and finally the owner's own browser.
- Work on a branch and open a pull request. `main` is the owner's.
- Do not commit generated test pages (`dist/_*.html`) or screenshot folders.
- Never put tokens anywhere in the repository.

## Known debts (as of 16 Oct 2026, v5, with the evening review in [docs/2026-10-16-szwy.md](docs/2026-10-16-szwy.md))

1. The data is a snapshot taken in an agent's sandbox, with no automatic refresh yet.
2. State lives in one browser; no sync between devices. The owner often runs Jaskinia as a downloaded file, so a sync built only on the claude.ai artifact would not reach him.
3. There is no layer for the owner's own judgment of projects (finished, donor, return to it).
4. Library panels are glued in through a compatibility hook and are Polish only.
5. The window system is concatenated scripts with shared state. Tests are mostly end-to-end.
6. In the claude.ai artifact, games open in a new tab, not in a window (a downloaded file and the owner's own server can open them in a window since v4). The demo lab is the exception: it is carried inside the page.
7. The instrument contract reaches labs only in a window. A lab opened in a separate tab (the phone's default for games) does not talk to Jaskinia yet, and no real lab speaks the contract yet: the first adopters decide whether it is worth it.
8. Changing the interface language rebuilds Jaskinia, so running labs start again.
9. ~~A game window is not an instance (GPT's M1).~~ Fixed in v6, and corrected in v6.2 by the owner's use. v6 opened every next game beside the last one, which he did not want. Now a plain "Zagraj" switches the game in the game window, Shift opens a new one beside it (sharing the width when floating), and a game already open is brought forward. The lesson: an audit can name a seam, but only his hands decide the default.
10. **Origins.**
    - On GitHub Pages, Jaskinia and the games share one origin: a game can read Jaskinia's storage (M2), and copies of a game share one save.
    - Other hosting changes what a framed game sees and can do (table 2 in the evening review).
    - The contract's drop-in answers any parent (F1).
11. **Old files.** Builds v2–v4 still rewrite `jaskinia:v2` and drop what they do not know (F2). `w.lost` only protects against v4.1 and later.
12. **Hidden windows.** Windows of another layout are hidden with `display:none`, which stops the animation of a lab from another origin.
13. **Keys.**
    - The shell's shortcuts ignore `defaultPrevented`, and Ctrl+S saves the layout even from a text field.
    - ~~A game window is never given focus.~~ Fixed in v6.2: a game window taken into use gets the keyboard.
    - JV steering failed in the owner's test because the game never had the keyboard. Fixed in v6.2; the owner's confirmation is pending.
14. **Backups and trash (D7).**
    - Backup dedupe ignores views.
    - The trash silently stops at 200 items.
    - The "Cała Jaskinia" export is not disaster recovery.
15. **Materials (v6).** One browser only, no sync; on GitHub Pages the storage is shared with every page of `jozzpoly.github.io`. Draco/meshopt glTF, KTX2 and FBX are not read; several models in one file are one material; Blockbench animations are not played. Skinned meshes collide in their rest pose. A folder import reads only models and their pictures; files of other kinds are not read. (The owner's rule about `.vox` is for agents searching his disk: never open, list or copy his MagicaVoxel files there. It does not forbid Jaskinia from reading a `.vox` he drops himself.)

The order in which to tackle these is in [docs/2026-10-16-szwy.md](docs/2026-10-16-szwy.md), which replaces the order in the view from above.
