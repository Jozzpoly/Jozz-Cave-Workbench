> [!IMPORTANT]
> **Stan na 14 XI 2026 (Opus czatu, autor większości tego repo; tylko dokumentacja).** Kilka zdań niżej jest nieaktualnych:
> - „Status: v6.4, 21 Oct, in the owner's private claude.ai artifact” — żywa jest **v6.4.1 na GitHub Pages**, publikowana automatem `dom-odswiezanie.yml` (od 10 XI; harmonogram co 6 h, w praktyce GitHub odpala ok. 2× na dobę).
> - „26 public repositories” — żywe dane obejmują **28** (`gh-pages/status.json`).
> - Przyciski osądu właściciela (Potwierdź / Popraw / Odrzuć, Zajmę się / Zleć agentowi) są w kodzie (`src/app.js` ~592–640, ~862–945), ale działają tylko z bazą artefaktu claude.ai; pod adresem Pages ich nie ma i **nigdzie nie zapisały ani jednej decyzji** (sprawdzone 13 XI).
> - `src/jaskinia/58-api.js` obiecuje okna „from another repository without editing src/jaskinia/*” — Jaskinia nie ma czym wczytać kodu spoza własnego buildu; obcy kod wchodzi tylko jako strona w oknie „przyrząd”.
> - Odnośnik „biblioteka-dla-agentow.md” w oknie dla agentów prowadzi do 404 pod adresem Pages.
>
> Kierunek: następca powstaje w repo [`Jaskinia`](https://github.com/Jozzpoly/Jaskinia); to repo zostaje codziennym oknem właściciela i dawcą uruchamialnych buildów.

# Jozz Cave Workbench: Jaskinia

**Jaskinia** ("the cave") is Jozz's workbench over all of his repositories. It is one full-screen page of windows that he arranges himself, the way Blender lets you compose editors into workspaces. The windows can show:

- a map of projects as parcels grouped by family
- a wall of project cards to move, zoom and annotate
- a catalogue of every repository and its state
- statistics in the style of YouTube Studio
- a playable-games shelf, notes and settings
- his 3D materials (Blockbench and glTF models from his disk or his repositories), with a walk among them at 1:1

Everything is generated from the repositories themselves: git history, the GitHub API, and a small hand-written knowledge layer.

> Jaskinia to warsztat Jozza nad wszystkimi jego repo: jeden ekran z oknami, które układa sam. Dane biorą się z gita i GitHuba, a znaczenie projektów należy do Ownera. Generator jest opisany po polsku w [GENERATOR.md](GENERATOR.md), a widok z góry z 16.10.2026 w [docs/2026-10-16-z-gory.md](docs/2026-10-16-z-gory.md).

**Status:** v6.4, 21 Oct 2026, in the owner's private claude.ai artifact: Ruch (he sets his own parts in motion by hand in Materiały) and games that say what they are ([docs/2026-10-20-v64-ruch.md](docs/2026-10-20-v64-ruch.md)). The [public preview](https://jozzpoly.github.io/Jozz-Cave-Workbench/) still runs v6.3 ([docs/2026-10-19-v63-bezpieczne-wydanie.md](docs/2026-10-19-v63-bezpieczne-wydanie.md)) until the owner says to update it. Every version: [docs/VERSIONS.md](docs/VERSIONS.md). The data is a snapshot of 19 Oct 2026, 01:26 UTC.

**Multi_World 2P.** The current Worker 2P is a separate-tab `Zagraj` entry in `data/wejscia.json`.
- [PR #6](https://github.com/Jozzpoly/Jozz-Cave-Workbench/pull/6) was squash-merged at `2d813488`, and its guidance was corrected in `457bfab`.
- Machine evidence:
  - hosted 2P same-ActorSession resume: [CI #39340405745](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39340405745);
  - v6.3 regression 43/43: [run #39341348105](https://github.com/Jozzpoly/Jozz-Cave-Workbench/actions/runs/39341348105).
- It reached the owner's 31-project artifact with v6.4, packaged from the private workspace ([handoff](https://github.com/Jozzpoly/Jozz-Cave-Workbench/pull/4#issuecomment-6280025085)). The public preview gets it only with a public v6.4.
- No MF6 deployment and no owner or mobile qualification is implied.

**The project is public; the instance is private.** This repository holds everything needed to build, test and study Jaskinia, with data for the owner's **26 public repositories**. His own Jaskinia also covers 5 private repositories and his own words from conversations. That layer stays private (`private/`, never committed). [tools/public_copy.py](tools/public_copy.py) produces this public copy and scans it for private traces.

## Open it

| file | what |
|---|---|
| `dist/jaskinia-web.html` | Jaskinia as one self-contained page (about 2.4 MB, data inside). Open it in a browser; games open inside windows. |
| `dist/jaskinia.html` | The same page for the claude.ai artifact host. Inside claude.ai games open in a new tab, because the host does not allow frames; the same file opened from a disk plays them in windows. |
| `dist/biblioteka*.html` | The Library, Jaskinia's single-page predecessor, built from the same data. |
| `dist/biblioteka-dla-agentow.md` | A plain-text brief of every project for agents. |

State (layouts, notes, settings) lives in the browser's `localStorage`, so each browser and each address has its own Jaskinia. Settings → Dane exports and imports it as a file. Open the page from a web address (the artifact, or any http server). In our tests, headless Chromium sometimes lost the saved state of a page opened as a local `file://` on reload; over http it never did.

## Build identity

Every build shows its version next to the name in the top bar (from `src/jaskinia/version.txt`) and its build time in Settings → O Jaskini. The data differs between copies: this repository has the 26 public repositories, while the owner's artifact has all 31. Versions of the claude.ai artifact are listed in [docs/VERSIONS.md](docs/VERSIONS.md).

## Build and test

```
npm install                                        # fonts (inlined into the page) and Playwright for the tests
python3 -I tools/render.py --app jaskinia          # dist/jaskinia.html
python3 -I tools/render.py --app jaskinia --host web
node tools/jk_test.mjs                             # 52 checks: windows, splits, floats, gestures, persistence
node tools/jk2_test.mjs                            # 76 checks: store v2, notes, trash, backups, import, wall, stats periods, phone
node tools/jk4_test.mjs                            # 61 checks: the recordings of 15–16 Oct, the feedback loop, the three places it runs, a real file:// start, the package without note text, the trash's way back, older builds
node tools/jk5_test.mjs                            # 43 checks: labs and games running in windows (instruments), the contract, the Sygnały window, the phone
node tools/jk6_test.mjs [shots] [models]           # 53 checks: Materiały, the shared 3D stage, Wejdź, window.Jaskinia (needs a folder of public models, see its header)
node tools/jk61_test.mjs                           # 29 checks: tabs that merge, addresses, the agents window, material revisions
node tools/jk62_test.mjs                           # 39 checks: the owner's ten remarks from v6 (3D mouse, flying, Zagraj, chart notes, sharp pixels)
node tools/jk63_test.mjs                           # 43 checks: older tabs (v6, v6.2) cannot undo a release, merges keep both losers, copies when storage is full, materials across tabs, play entries
node tools/jk64_test.mjs                           # 56 checks: Ruch (his own parts set in motion by hand), games that say what they are
node tools/jk641_test.mjs                          # 27 checks: the PR #4 reviewers' Ruch cases (repeated names, a moved part, two windows, two fingers, the close button)
node tools/jk2_chaos.mjs 400 7                     # destruction run: hundreds of random actions on desktop and phone, invariants, reload = same state
```

A full refresh of the data needs local clones of every repository and an authenticated `gh`: `python3 -I tools/regen.py` (see [GENERATOR.md](GENERATOR.md)).

**Automatic refresh (10 Nov 2026, tymczasowe).** [.github/workflows/dom-odswiezanie.yml](.github/workflows/dom-odswiezanie.yml) rebuilds the public page every 6 hours from the public repositories. It opens every Zagraj entry, runs the suites through `python3 -I tools/testy.py`, and checks that layouts, windows and notes come through from the page published before (`tools/dom_ciaglosc_test.mjs`). Continuity has no exceptions; the suites that guard the owner's state get no retries and let a known failure through only when the page's code is unchanged; known failures are listed with their reasons in `tools/znane_bledy.json`. Merging it into `main` is the one activation: from then on it publishes to Pages by itself, asks GitHub to build Pages, checks the live address in a browser and rolls back and pauses if the page does not come up. Setting the repository variable `PUBLIKUJ_PAGES` to `nie` turns publishing off; Actions → Run workflow offers `odswiez`, `cofnij` and `wznow`. Background: [docs/2026-10-19-odswiezanie-danych.md](docs/2026-10-19-odswiezanie-danych.md).

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

## Where this is and what is next to it

This workbench does not stand alone. The addresses are here so that nobody has to reconstruct them
from memory again.

| Thing | Address | What it is |
| --- | --- | --- |
| this workbench, live | [jozzpoly.github.io/Jozz-Cave-Workbench](https://jozzpoly.github.io/Jozz-Cave-Workbench/) | the owner's Dom today: windows, layouts, materials, the Kataster. Refreshed by CI every six hours |
| Jaskinia on Cloudflare | [repo](https://github.com/Jozzpoly/Jaskinia) · [live](https://jaskinia.jozzpoly.workers.dev) | a newer workshop built from this one module by module; every branch there gets its own preview address, and `/dom/` there serves this page under that address |
| Medium | [repo](https://github.com/Jozzpoly/Shared-Work-Medium-Lab) | research into what agents' bodies can actually reach and how to prove it; negative results that exist nowhere else |
| Feniks Studio | [repo](https://github.com/Jozzpoly/Feniks-Studio) | a tool for authoring places and matter, paused until it is decided where it grows |

> Po polsku: ten warsztat nie stoi sam. Adresy sąsiadów są tutaj, a nie w czyjejś pamięci, bo
> 14 XI 2026 zmierzono, że z dwunastu możliwych kierunków między repozytoriami właściciela
> dziewięć nie miało ani jednego odnośnika: repozytoria o sobie wspominały i nigdzie nie prowadziły.
