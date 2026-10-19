# Jaskinia v6.3: a release older tabs cannot undo (19 Oct 2026, night)

v6.2 answered the owner's remarks. Before it reached the public preview, the GPT lines on PR #4 reported a set of
findings about v6.1. Most of them were source-level reproductions, and GPT-6 reproduced two in real Chromium:

- **`OLD_V6_OVERWROTE_NEW_V61`.** A published v6 tab still open on the same address wrote its old state over newer notes
  when it left. A v6.1 tab took that write in as if the other tab had changed them, with no copy.
- **`V6_ERASED_V61_SETTING_REVISION`.** An old v6 material editor rewrote a record and dropped the settings revisions a
  newer build had made, so a place pinned to `{material, set: 2}` lost its look.

So publishing a new Jaskinia over an old one could cost the owner work: compass point 4 broken by our own release. The
public preview waited. v6.3 makes the release safe and closes the smaller seams from the same review. It also takes the
facts the other lines verified overnight.

## What changed

**Older builds cannot overwrite the live state** (`15-store.js`, `50-shell.js`).
- The live state has a new key, `jaskinia:v3`. Builds before v6.3 only know `jaskinia:v2`.
- On its first start in a browser, v6.3 takes the `v2` state over once. From then on it only watches `v2`.
- What an older tab still writes there is never taken as the newest state:
  - its whole state goes into an automatic copy, so nothing it holds is lost. Every different state gets its own copy
    (two older tabs may each hold a layout the other does not; GPT-6 found that replacing the previous copy lost the
    first one). The same state written again adds nothing, and only the newest four such copies stay, so an old tab
    left open cannot push Jozz's own copies out of the ten;
  - a note that is newer there comes in, and the text it replaces goes into a copy first;
  - layouts are not taken, because an old tab's layouts may be a day old.
- Jozz is told once, with "Pokaż", that an older tab is writing and should be closed.
- Copies now also carry the saved layouts. A restored copy brings back the ones missing here.

**A copy that does not fit never costs the earlier ones** (`15-store.js`, `50-shell.js`, `45-settings.js`; Feniks GPT
on PR #4).
- When the browser's storage was too full even for the newest copy, the list of copies was rewritten as empty, so every
  earlier copy was gone. Now the copies stored before stay as they were.
- A reset, an import, restoring a copy or a saved state, and deleting a note for good do not happen when their copy
  cannot be written, and Jozz is told why (deleting from the trash already worked this way). "Zrób kopię teraz" no
  longer says "Kopia zrobiona" when it was not.

**Merges keep every loser.**
- A merge in which both sides lose something (a layout here, a note there) now writes both copies. Before, the `||` kept
  only the first.
- A conflict inside one window (for example two pins) counts as a conflict and keeps the other side in a copy. So does a
  layout renamed in both tabs.
- Filters and focus still merge quietly: they change with every click.
- If the browser's storage is too full for a copy, Jozz is told to save the whole Jaskinia to a file. The merge is not
  presented as safe.

**Material settings survive older builds** (`57-materialy.js`).
- Revisions also live in a second IndexedDB database, `jaskinia-materialy-ustawienia`, which older builds never open.
- A revision dropped from a record comes back from there.
- A turn or scale an older build changed in place becomes one more revision with a fixed number. A place pinned to
  revision 2 keeps its look.
- A new revision is numbered and written in one transaction, so two tabs changing one material at once get two
  numbers.
- The change is then written onto the newest record (`matApplySettings`), not onto a window's stale copy of it.
  - The slow part (loading the model again, measuring it, drawing its picture) runs first. The number is taken and the
    record written right after each other, the record in one transaction on what it holds at that moment.
  - When two tabs apply a change at once, the record ends on the one numbered later, so it always shows the newest
    revision.
- **A tab reading while another applies a change adds nothing.** Medium/GPT reported it on PR #4 at `32c25d4` from the
  source, and I hit it on my own on 19 Oct while waiting for the suites: in the
  moment between numbering a revision and writing the record, a tab reading the library saw a record that did not match
  the newest revision. It took that for an older build's change in place, so it added the old look as one more revision
  ("starsza wersja"), and the real change came after it. Now a record that still matches the revision it names, with a
  newer one taken less than a minute ago, counts as being applied. Still behind after a minute (an apply that never
  finished, or an older build writing its copy back) counts as before.
- **A window no longer writes back its own copy of a material.** The same seam GPT found for settings was still open
  for deleting: a Materiały window kept the record it showed, so deleting there (and "Cofnij") wrote that copy back
  over a scale another tab had made since, and the old look became the newest revision. Now deleting, Cofnij, dropping
  a deleted file again and the drop of the Box3D meshes change the record as it is at that moment, in one transaction.
  A window showing a material another tab turned or scaled shows it again as it is now (not during a walk), and a
  quarter turn counts from the turn the material has now. A window showing a material another tab deleted lets it go
  and shows the next one; "Cofnij" there brings it back to the list.
- A record that an older build rewrote is healed on the first read of the library. Its revisions go back into the record
  itself, so a v6.1 or v6.2 tab, which reads only the record, sees them again. The heal is one transaction on the record
  as it is then, so it never writes back an older look.

**Smaller seams.**
- **Two `texture.png` inside one glTF stay two pictures.** A companion is found by the path the model names it with, and
  by name only when the name is unique.
- **Leftovers of a failed import are swept later.** They go only when no material uses them and they are older than ten
  minutes, so an import running in another tab can never lose a picture it is about to save. Files written by older
  builds carry no time and are never swept.
- **"Dla agentów" redraws itself** when a note, a remark, a material or another tab's write changes what it shows. It
  also says when and from which browser it reads, and that it is not shared memory: another browser, profile or
  address has its own Jaskinia.
- **A reload does not reopen windows.** The address of the selected project is one Jaskinia wrote itself, so it puts
  nothing on screen again. Any other address is acted on once, then the address returns to the selected project. The
  chaos run with seed 11 found this: every reload added a card.
- **"Kiedy i jak" answers pointing too.** Its hour and weekday bars, the branch mix, the findings counts and the wall's
  badges had only the browser's own tooltip. They now give the same note as every other chart.
- **Fullscreen asks for the keyboard inside the click**, before anything is awaited. The Chrome documentation does not
  say whether entering fullscreen uses up the click; headless Chromium accepts both orders.

**Fresh data and honest play entries** (`tools/regen.py`, `data/wejscia.json`).
- The snapshot was collected again on 19 Oct (01:26 UTC). The list now holds all 31 repositories: **Splot** and
  **Feniks-Studio** are new.
  - Both are in their families as hypotheses: Splot in Materia i świat, Feniks Studio in Feniks.
  - The GitHub API is not attached for them in this session, so their PRs and CI show as unknown, not zero.
  - VAW now has its Pages entry from the data itself (`has_pages`), not from the hand edit of the published page in
    `099788b`.
  - New commits since 14 Oct: Jaskinia +132, Shared-Work-Medium-Lab +55, VAW +16, Tysiąc +12, Mini_Feniks +10,
    cloudflare-multiplayer-lab +4.
- Every Pages address in the snapshot was checked by fetching it. All answer except Tysiąc's.
- `data/wejscia.json` holds play addresses that someone verified, with who, when and why. `url: null` means the project's
  page is not a game: Cave Workbench's Pages is the public preview of Jaskinia, and "Zagraj" there opened Jaskinia inside
  Jaskinia. The default selection is a game that can run in the game window. Tysiąc's real address is its
  Cloudflare worker; `jozzpoly.github.io/Tysi-c-The-Game/` answered "Site not found". It works only in its own tab: its
  seat token lives in the game's own storage, which a browser may partition inside a frame. So "Zagraj", the game window,
  the instruments picker and the Library's player all open it in a tab, and its game window says why.

## Checks

`node tools/jk63_test.mjs` runs 41 checks. The older builds come from git: `2fde987` is the published v6.
- **The old-tab release sequence, in real Chromium on one origin.** The published v6 loads first, v6.3 saves a newer note
  and closes, then v6 leaves (a real pagehide).
  - A new v6.3 tab still has the newer note.
  - A later edit in the old tab comes in; both the old tab's state and the replaced note wait in copies.
  - Jozz is told.
  - The same with a v6.2 tab (`6e6b8f3`), the build his artifact ran before: a note written there later comes in, the
    newer note stays, and its state waits in a copy.
  - Two published v6 tabs with different layouts: both layouts wait in copies (the previous code kept only the second),
    the same state again adds no copy, and many writes keep the newest four.
- **Mixed-side merge:** both losers are in copies. A conflict in one window, and a rename in both tabs, are kept too.
- **No room for a copy** (storage full only for copies, a new copy too big even alone): the earlier copies stay, reset
  and restoring change nothing and say why, "Zrób kopię teraz" does not claim a copy; with room again, reset works.
- **Materials:**
  - an older build rewriting a record without revisions;
  - a pinned revision still resolving;
  - two tabs numbering at once, and the record ending on the newer one;
  - a tab reading in the middle of another tab's change (the old code added revisions 7 and 8 here), also for a material
    changed for the first time, whose record names no revision yet (Astra's probe found that case still open);
  - a window following a scale made in another tab, then deleting and "Cofnij" there keeping that scale (the old code
    put scale 1 back and added it as revision 3);
  - a third tab letting the deleted material go and getting it back on "Cofnij" (the old code kept showing it);
  - the two-texture glTF (red and blue);
  - sweeping only old leftovers, and never a used file.
- **"Dla agentów"** following a note written in another tab.
- **Tysiąc and VAW** play entries, and Jaskinia's own preview not offered as a game: a fresh Granie layout frames VAW,
  and the "Do zagrania" shelf does not list Jaskinia (Medium/GPT-6 found the self-offer at `32c25d4`).
- **Reloads**: an address opens its window once, and reloading adds nothing.

**Astra's probe** (`probe-material-read-race.mjs` from PR #4, run on the final public page): no phantom revision at
either of her two gates, the reader's default object is revision 2, the pinned revision stays right, no page errors.
Her first gate no longer opens at all, because the model is measured before the number is taken.

**GPT's own harness, run against v6.3** (again on the final build, 19 Oct). These are GPT-6's two scripts from `experiment/gpt-v61-oldtab-2026-10-18`, with
only the key the new build reads (`jaskinia:v3`) and the direction of the gate changed:
- the old-tab script reports `releaseGate: PASS` (`afterReopen: SYNTHETIC_NEW`);
- the material script reports `REVISION_SURVIVED`: revisions 1 and 2 stay, the old editor's turn becomes revision 3, and
  the record is healed.

`jk61_test.mjs` reads `jaskinia:v3` now. Its leftover check sweeps aged leftovers instead of expecting them gone at once.

## Still open (named, not hidden)

- **A model without its own texture takes a neighbour's** (GPT on PR #4, 19 Oct). In a folder import, when a model
  names `texture.png` but has none beside it, and exactly one `texture.png` lies beside another model, that one is
  taken. It has been so since v6 and shows a wrong picture rather than losing anything, so it waits for the next build:
  with folder paths known, a file beside another model will not be taken, and the material will say what is missing.

- **One origin for everything on `jozzpoly.github.io`.** A same-origin game can read Jaskinia's storage, and a sandboxed
  frame alone does not fix that, because the same game opened in a tab still shares it. That is the "one home"
  decision (debt 10, compass), and it belongs to the owner and the infrastructure line.
- **Simultaneous close of two v6.3 tabs.** Both read, then both write, with no compare-and-swap, so the last one wins until
  the next start merges. GPT named this a logical interleaving, not a measured one. Copies and the merge on the next open
  limit it, and no check proves it closed.
- **GitHub's API data for Splot and Feniks-Studio.** Both are in the snapshot now (31 repositories), but this session has
  no API access to them, so their pull requests and CI show as unknown.
- **Automatic refresh of the data stays a question** for the GPT infrastructure line (the owner's remark 10). It is not
  built.
