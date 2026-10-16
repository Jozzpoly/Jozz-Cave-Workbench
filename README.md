# Jozz Cave Workbench: Jaskinia

**Jaskinia** ("the cave") is Jozz's workbench over all of his repositories. It is one full-screen page of windows that he arranges himself, the way Blender lets you compose editors into workspaces. The windows can show:

- a map of projects as parcels grouped by family
- a wall of project cards to move, zoom and annotate
- a catalogue of every repository and its state
- statistics in the style of YouTube Studio
- a playable-games shelf, notes and settings

Everything is generated from the repositories themselves: git history, the GitHub API, and a small hand-written knowledge layer.

> Jaskinia to warsztat Jozza nad wszystkimi jego repo: jeden ekran z oknami, które układa sam. Dane biorą się z gita i GitHuba, a znaczenie projektów należy do Ownera. Generator jest opisany po polsku w [GENERATOR.md](GENERATOR.md), a widok z góry z 16.10.2026 w [docs/2026-10-16-z-gory.md](docs/2026-10-16-z-gory.md).

**Status:** v2, published 14 Oct 2026 as a private claude.ai artifact. The data is a snapshot of 14 Oct 2026, 08:21 (Warsaw).

**The project is public; the instance is private.** This repository holds everything needed to build, test and study Jaskinia, with data for the owner's **24 public repositories**. His own Jaskinia also covers 5 private repositories and his own words from conversations. That layer stays private (`private/`, never committed). [tools/public_copy.py](tools/public_copy.py) produces this public copy and scans it for private traces.

## Open it

| file | what |
|---|---|
| `dist/jaskinia-web.html` | Jaskinia as one self-contained page (about 1.3 MB, data inside). Open it in a browser; games open inside windows. |
| `dist/jaskinia.html` | The same page for the claude.ai artifact host. Games open in a new tab there, because the host does not allow frames. |
| `dist/biblioteka*.html` | The Library, Jaskinia's single-page predecessor, built from the same data. |
| `dist/biblioteka-dla-agentow.md` | A plain-text brief of every project for agents. |

State (layouts, notes, settings) lives in the browser's `localStorage`, so each browser and each address has its own Jaskinia. Settings → Dane exports and imports it as a file. Open the page from a web address (the artifact, or any http server). In our tests, headless Chromium sometimes lost the saved state of a page opened as a local `file://` on reload; over http it never did.

## Build identity

The code in this repository is the code of the build the owner recorded himself using on 14–16 Oct 2026. The data differs: the copy here has the 24 public repositories, while his artifact has all 29. Versions of the claude.ai artifact are listed in [docs/VERSIONS.md](docs/VERSIONS.md).

## Build and test

```
npm install                                        # fonts (inlined into the page) and Playwright for the tests
python3 -I tools/render.py --app jaskinia          # dist/jaskinia.html
python3 -I tools/render.py --app jaskinia --host web
node tools/jk_test.mjs                             # 52 checks: windows, splits, floats, gestures, persistence
node tools/jk2_test.mjs                            # 76 checks: store v2, notes, trash, backups, import, wall, stats periods, phone
node tools/jk2_chaos.mjs 400 7                     # destruction run: hundreds of random actions on desktop and phone, invariants, reload = same state
```

A full refresh of the data needs local clones of every repository and an authenticated `gh`: `python3 -I tools/regen.py` (see [GENERATOR.md](GENERATOR.md)).

## Layout of this repository

```
src/app.js, src/style.css     the Library core: data model and panels (Kataster, project card, rhythm, branches...)
src/jaskinia/*.js, *.css      the window system, concatenated in file-name order after app.js
tools/collect_git.py          git side: every branch, full history, days, hours, README, state notes
tools/collect_gh.py           GitHub API side: metadata, PRs, CI runs, open issues
tools/knowledge.py            hand-written layer: families, one-line "why" hypotheses, laws, lessons, cases
tools/build.py, findings.py   build data/library.json and the findings (rules over git and the API)
tools/render.py               inline fonts, CSS, data and code into one page
tools/public_copy.py          the public copy of the project, scanned for private traces
tools/jk*_*.mjs, serve.mjs    Playwright tests (served over http) and screenshot scripts
tools/feedback/keyframes.py   turn screen recordings into timestamped frames for agents
data/                         the snapshot: raw collections, knowledge, built dataset, previous dataset, history
docs/                         design decisions, notes from the owner's recordings, feedback intake, view from above
```

## Working here

Agents start with [AGENTS.md](AGENTS.md). In one line: the owner's judgment decides, facts and hypotheses stay apart, nothing is lost silently, the private layer never enters this repository, and every change comes with a test and a screenshot.
