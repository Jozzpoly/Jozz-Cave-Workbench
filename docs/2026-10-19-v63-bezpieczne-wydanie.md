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
  - its whole state goes into an automatic copy, so nothing it holds is lost;
  - a note that is newer there comes in, and the text it replaces goes into a copy first;
  - layouts are not taken, because an old tab's layouts may be a day old.
- Jozz is told once, with "Pokaż", that an older tab is writing and should be closed.
- Copies now also carry the saved layouts. A restored copy brings back the ones missing here.

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

**Smaller seams.**
- **Two `texture.png` inside one glTF stay two pictures.** A companion is found by the path the model names it with, and
  by name only when the name is unique.
- **Leftovers of a failed import are swept later.** They go only when no material uses them and they are older than ten
  minutes, so an import running in another tab can never lose a picture it is about to save. Files written by older
  builds carry no time and are never swept.
- **"Dla agentów" redraws itself** when a note, a remark, a material or another tab's write changes what it shows. It
  also says when and from which browser it reads, and that it is not shared memory: another browser, profile or
  address has its own Jaskinia.

**Fresh data and honest play entries** (`tools/regen.py`, `data/wejscia.json`).
- The snapshot was collected again on 19 Oct 01:04 UTC from all 29 repositories.
  - VAW now has its Pages entry from the data itself (`has_pages`), not from the hand edit of the published page in
    `099788b`.
  - New commits since 14 Oct: Jaskinia +132, Shared-Work-Medium-Lab +55, VAW +16, Tysiąc +12, Mini_Feniks +10,
    cloudflare-multiplayer-lab +4.
- `data/wejscia.json` holds play addresses that someone verified, with who, when and why. Tysiąc's real address is its
  Cloudflare worker; `jozzpoly.github.io/Tysi-c-The-Game/` answered "Site not found". It works only in its own tab: its
  seat token lives in the game's own storage, which a browser may partition inside a frame. So "Zagraj", the game window,
  the instruments picker and the Library's player all open it in a tab, and its game window says why.

## Checks

`node tools/jk63_test.mjs` runs 23 checks. The older builds come from git: `2fde987` is the published v6.
- **The old-tab release sequence, in real Chromium on one origin.** The published v6 loads first, v6.3 saves a newer note
  and closes, then v6 leaves (a real pagehide).
  - A new v6.3 tab still has the newer note.
  - A later edit in the old tab comes in; both the old tab's state and the replaced note wait in copies.
  - Jozz is told.
- **Mixed-side merge:** both losers are in copies. A conflict in one window, and a rename in both tabs, are kept too.
- **Materials:**
  - an older build rewriting a record without revisions;
  - a pinned revision still resolving;
  - two tabs numbering at once;
  - the two-texture glTF (red and blue);
  - sweeping only old leftovers, and never a used file.
- **"Dla agentów"** following a note written in another tab.
- **Tysiąc and VAW** play entries.

`jk61_test.mjs` reads `jaskinia:v3` now. Its leftover check sweeps aged leftovers instead of expecting them gone at once.

## Still open (named, not hidden)

- **One origin for everything on `jozzpoly.github.io`.** A same-origin game can read Jaskinia's storage, and a sandboxed
  frame alone does not fix that, because the same game opened in a tab still shares it. That is the "one home"
  decision (debt 10, compass), and it belongs to the owner and the infrastructure line.
- **Simultaneous close of two v6.3 tabs.** Both read, then both write, with no compare-and-swap, so the last one wins until
  the next start merges. GPT named this a logical interleaving, not a measured one. Copies and the merge on the next open
  limit it, and no check proves it closed.
- **The repository list is from 14 Oct.** New repositories (Splot, Feniks-Studio) are not in the snapshot until the
  list is refreshed with access to them.
- **Automatic refresh of the data stays a question** for the GPT infrastructure line (the owner's remark 10). It is not
  built.
