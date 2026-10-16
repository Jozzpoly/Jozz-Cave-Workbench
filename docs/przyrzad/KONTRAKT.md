# The instrument contract (v1)

**Po polsku, w skrócie:** przyrząd to Twój lab albo gra działająca w oknie Jaskini. Jaskinia nigdy sama go nie restartuje.
Jeśli lab doda mały skrypt `jaskinia-przyrzad.js`, powie Jaskini, kim jest, co się w nim dzieje i jakie ma liczby, a w
zamian dostanie Twoje uwagi z flagi do swojego śladu.

An *instrument* is one of the owner's labs, games or tools running in a Jaskinia window. Two window types hold one:

- **Przyrząd** (`przyrzad`) runs any address the owner picks: a project's page, a recent lab, or a pasted address.
- **Gra** (`gra`) runs the selected (or pinned) project's page.

Any page works in these windows. A page that also speaks this contract tells Jaskinia what is happening inside it. The
contract is small, optional and one-way safe: a lab that adds it still runs exactly the same on its own.

## What Jaskinia promises a running instrument

Jaskinia never reloads it on its own. The page stays loaded through all of these:

- a theme, light/dark, life colours, density, window zoom or the games setting;
- maximize and back, float out and dock back, other layouts and back;
- a narrow browser window (phone layout) and back;
- selecting another project, when the window is pinned or is a `przyrzad`;
- undo and redo of other changes.

It restarts only when the owner asks for it: another address, "Uruchom od nowa", closing the window, or switching the
interface language (that rebuilds all of Jaskinia).

When its window is hidden (another layout, behind a maximized window, another window on a phone, or a hidden browser
tab), the instrument hears `visible: false` and may rest. It hears `visible: true` when it is back.

**Loaded is not always running.** Measured in Chromium ([2026-10-16-szwy.md](../2026-10-16-szwy.md); run
`node tools/probes/hosting.mjs`):

- When the instrument comes from another origin than Jaskinia, the browser stops its `requestAnimationFrame` while its
  window sits in another layout. Jaskinia hides such windows with `display:none`. Timers keep running. On GitHub Pages
  today Jaskinia and the owner's games share one origin, so they keep animating. In a downloaded Jaskinia they do not.
  Jaskinia will park hidden windows so they keep painting; until then, a world that must not pause should not depend
  on `requestAnimationFrame` alone.
- Maximizing, floating, docking, other layouts of different proportions and the phone layout change the size of the
  page's viewport, and the page hears `resize`. A lab that sizes its world by its viewport changes its world. Hiding
  and showing do not resize anything.

## Adding it to a lab

Copy [`jaskinia-przyrzad.js`](jaskinia-przyrzad.js) next to the page, or paste it into the page, then:

```js
Jaskinia.hello({ name: 'MiniFeniks', version: 'kampania 04', wants: ['remark'] }); // once, at start
Jaskinia.state('Dzień 3, 14:20 · Ania niesie deski', { dzien: 3 });                // whenever it changes, or every second
Jaskinia.signals({ fps: 58, zapas: 12 });                                           // a few times a second
Jaskinia.event('Ania porzuciła zamiar: brak desek', 'uwaga');                       // when something happens
Jaskinia.onRemark(r => trace.push(r));         // { text, at }: the owner's remark, if you asked for 'remark'
Jaskinia.onStateRequest(() => ({ text, data }));   // optional: a fresh state for the moment of the flag
Jaskinia.onVisible(v => { paused = !v; });     // optional
```

Opened on its own, with no Jaskinia around, every call does nothing. Ctrl+. inside the lab opens Jaskinia's
"To mnie uwiera" note, pinned to this lab and this second. [`demo.html`](demo.html) is a complete example: a small
physics toy that uses every call, and the page the checks run against.

## Messages

All messages are plain objects sent with `postMessage` and marked `jaskinia: 1`.

| from | `type` | fields | what Jaskinia does with it |
| --- | --- | --- | --- |
| lab | `hello` | `name` (≤ 60 characters), `version` (≤ 40), `wants` (`['remark']`) | names the window and its bar; the picker remembers the lab by this name |
| lab | `state` | `text` (≤ 240), `data` (JSON, ≤ 8 KB) | shows the text under the lab; pins it to a remark; puts it in the package |
| lab | `signals` | `values`: `{ name: number }` (≤ 24 names of ≤ 32 characters, finite numbers only) | draws them live in a "Sygnały" window, keeps the last 10 minutes (≤ 6000 points each) |
| lab | `event` | `text` (≤ 200), `level` (`info`, `uwaga`, `blad`) | writes it to the log (at most 4 a second; the rest stays in the lab's own list) and marks it on the plots |
| lab | `flag` | none | opens the "To mnie uwiera" note for this lab |
| Jaskinia | `hi` | `v: 1` | sent when the page loads; answer with `hello` (the drop-in does) |
| Jaskinia | `state?` | none | sent when the owner presses the flag; answer with a fresh `state` within 0.4 s, or the last one is used |
| Jaskinia | `remark` | `text`, `at` (local time with offset) | sent only to labs that said `wants: ['remark']` |
| Jaskinia | `visible` | `visible` (boolean) | the window was hidden or shown again |

Unknown types and fields are ignored, so the contract can grow without breaking older labs or older Jaskinias.

## Trust and limits

- Jaskinia takes messages only from pages it opened in its own windows. Another frame, or the page itself, cannot
  pretend to be a lab.
- Everything a lab says is the lab's own claim. Jaskinia shows it as text, never as HTML, and never runs it. The package
  says these are what each instrument reported.
- The owner's remark goes to a lab only if the lab asked for remarks, and the note says so before it is saved.
- Labs keep their own storage, undo, runtime and data. Jaskinia stores none of it, except what the package captures at
  the moment it is made.
- This is not a sandbox, and it is not isolation either. Which storage a framed lab sees depends on where Jaskinia
  runs ([2026-10-16-szwy.md](../2026-10-16-szwy.md)):
  - On GitHub Pages, Jaskinia and the owner's games share one origin (`https://jozzpoly.github.io`). A framed page
    can read Jaskinia's own storage, notes included. Two copies of one game share one save.
  - A Jaskinia on another site (and a downloaded one) gives a framed lab a separate, partitioned save, not the one
    the lab has when opened on its own.
  - Isolation and the same save together need Jaskinia and the labs on subdomains of one site.
  - Run addresses you trust, and keep nothing private in Jaskinia at a shared origin.
- The drop-in does not yet check who frames the lab. Any page that frames it hears its state and can send it remarks.
  Lab authors: do not adopt it until it accepts only the parents the lab lists.

## Where it works

- A downloaded Jaskinia file and Jaskinia at its own address run instruments in windows.
- Inside claude.ai, other sites cannot be embedded, so the window offers a link to a new tab instead.
- A site that forbids framing (`X-Frame-Options`, `frame-ancestors`) or needs a login inside a frame stays blank;
  "Nowa karta" under it opens it in a tab. The bridge does not reach a lab in a separate tab yet.
- On a phone, an instrument window works like any other window: one at a time, with the flag button under the lab.

## Checks

`node tools/jk5_test.mjs` runs the demo lab in both window types, on a desktop and on a phone, through every change in
the list above, and checks the messages, the limits, the remark round trip and the package.
