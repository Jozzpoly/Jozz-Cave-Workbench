# v6.4.1: Ruch keeps his decision on the part he chose (22 Oct 2026)

Maintenance only. Within 40 minutes of the v6.4 push, five lines reviewed it on PR #4 and found that Ruch kept his data but could lose the meaning of his decision. Each finding came with a reproducer. This build fixes the ones that were cheap to fix and keeps every reproducer as a check (`tools/jk641_test.mjs`, 27 checks, most of them red on v6.4).

No new feature. The next generation of Jaskinia is being discussed separately; nothing here decides it.

## What was wrong, who found it, what changed

| Finding | Found by | Now |
|---|---|---|
| Two groups both called `wheel` swap places in a new version of the file: the motion goes to the other wheel, Ruch says "1 z 1", and a reload keeps the wrong part | GPT-6 (source falsifier), the Browser line, Astra (real host, 13 checks) | A part also keeps where each of its nodes sits in the file (`boxes`: the middle and size of its box in the rest pose). Where names repeat, the node whose box matches is taken. Motion kept before 6.4.1 has no boxes; when two nodes fit, nothing is guessed: the part is not carried, nothing is written, and Ruch says which part to point at again |
| The right part, carried with the old file's axis point: a wheel moved in the file orbits the old point instead of turning in place | Medium (source and maths, 4 checks) | Moved without changing its size: the pivot moves with it, and Ruch says so. Its shape changed: an axis or pivot that came from a proposal is proposed again; one he chose stays; he is asked to look. Motion kept before 6.4.1 is carried as before, with a note that its place was not checked |
| Two Materiały windows on one model: the later save replaced the whole list, so the first window's part disappeared | Medium (source, 5 checks) | A save sends only what that window added, changed or took back since it last read the record. The other window takes the new parts in |
| A second finger lifted first ended the gesture of the finger holding a part | Feniks GPT (real pointer events, 2 checks) | Only the pointer that took the part moves it and lets it go; a second finger neither steals nor ends it |
| In a compact floating window the corner handle covered the middle of the close button | Astra (real host, hit test) | The header's buttons sit above the stretching edges; the corner still stretches outside the button |
| Pointing at the map and then straight at a chart in a window above it: the chart's note appeared and vanished 0.12 s later, because the map said its late goodbye to the shared note (also in v6.2 to v6.4) | our own suite, 22 Oct (`jk62`: the check failed on v6.4 and on this build alike; it passed before only because the map's parcels lay elsewhere) | A chart that lets its note go late hides only the note it put up itself (`tip()` returns a number, `untip(n)` hides only that one): the map, Puls and Statystyki |

## Still open

- **Ctrl+Z does not undo a Ruch change** (Medium). Ruch writes to the material record, outside layout undo. An undo of its own belongs with the next real use of Ruch.
- **Texture by name** across folders (GPT, v6.3 review): shows a wrong picture, loses nothing. Not touched here.
- **A hinge whose pivot should stay on a wall that did not move** while the door moved: the pivot now moves with the door, and Ruch says so. Which is right is his call.
- **Motion carried by v6.4** before this build may already sit on the wrong part. Nothing can tell that afterwards; the owner's eye can.

## For anyone who reads a Ruch record

The export (`jaskinia: 'ruch v1'`, the JSON file and `Jaskinia.materialy.ruch(id)`) is unchanged. The new `boxes` live only in the material record inside the browser. A reader of `ruch v1` outside Jaskinia gets kinematics without geometry, joints or physics. Whether `boxes` should go into the export, as a first anchor between a part and its geometry, is a question for those readers before anyone changes the format.

The build string now has three parts (`6.4.1`). A check that expected `6.x` (`jk6`) was widened; anything else that parses `Jaskinia.build.v` should accept `6.x.y`.

## Checks

`node tools/jk641_test.mjs` (WebGL through SwiftShader, served over http like the other suites). The scenarios are the reviewers' own: Astra's two-wheel model, Medium's moved wheel, Feniks GPT's two pointers. The same file run against `fd93caa` (v6.4) fails 20 of its checks; on this build all pass. Every older suite passes as before.
