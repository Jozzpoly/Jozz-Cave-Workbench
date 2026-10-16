# Jaskinia v5: instruments

GPT's independent review put the gap plainly: Jaskinia shows the owner's works better than it lets him work in them.
v5 starts closing that gap. The owner's labs and games now run in Jaskinia windows as **instruments**: he can run them,
watch them and leave remarks on them, and Jaskinia never restarts them on its own. Claude's reasoning for this direction
is in a private write-up for the owner and GPT ("C2"). The protocol for labs is [przyrzad/KONTRAKT.md](przyrzad/KONTRAKT.md).

## What the owner can do now

- **Run anything in a window.** An empty window has a new group, "Na żywo". A "Przyrząd" window runs one of these:
  - a project's page,
  - a lab it has run before (remembered by the name the lab gives itself),
  - any address he pastes.
  A "Gra" window is an instrument too.
- **Keep it running.** A change of theme, density or window zoom, maximize, floating, another layout, a narrow
  browser window or selecting another project no longer restarts the lab.
  - v4.1 restarted a game in a window when the theme changed, and v4 restarted it whenever the window became narrow.
  - "Samo" (the default) now decides window or tab by the device, a phone-sized touch screen, not by the window's
    width.
- **See what a lab says about itself.** A lab that adds the small script [przyrzad/jaskinia-przyrzad.js](przyrzad/jaskinia-przyrzad.js)
  tells Jaskinia:
  - who it is, which names the window,
  - what is happening, shown in a strip under the lab,
  - its numbers,
  - its events, which go to the log with their times.
- **Watch the numbers live.** "Sygnały" opens beside the lab: one plot per number, the last 10 s, 1 min or 5 min, the lab's
  events as thin lines and the owner's remarks as dashed ones.
- **Leave a remark pinned to the lab.** The flag under the lab, or Ctrl+. inside it, opens "To mnie uwiera". The remark
  keeps:
  - the lab's name, address and its own state at that second,
  - and, if the lab asks for remarks, a copy that the lab keeps in its own trace.
- **Hand it over.** "Paczka dla Claude'a" gets a section for instruments:
  - each lab's state,
  - a summary of its numbers,
  - its last events,
  - the times of the owner's remarks.
- **Try it without any lab ready.** "Piłki: pokaz kontraktu" is a small physics toy carried inside Jaskinia. It speaks
  the whole contract and works offline, even inside claude.ai.

## Decisions

- **The contract runs from the lab to Jaskinia.** GPT's experiment D13 pushed the selected project into the lab. A game
  does not care what is selected in the cadastre; the owner cares what happens in the game.
- **Labs keep their own origin.** No `sandbox` that would cut them off from their own saves (MiniFeniks keeps its world
  in its browser storage). Trust comes from Jaskinia accepting messages only from frames it opened and treating them as
  text.
- **Nothing is shared but words and numbers.** No common data model, no common undo, no common storage. Each lab keeps
  its runtime and its agent; Jaskinia keeps the workspace. This is the "one workshop, many instruments" line from C2.
- **Small first.** Ten message kinds at most, optional on both sides. The first real labs that adopt the contract
  should decide what it needs next.

## Not yet

- A lab opened in a separate tab, which is the phone's default for games, does not talk to Jaskinia yet.
- No real lab speaks the contract yet. MiniFeniks (its "Ślad gry" already collects feedback) and JV Web (telemetry for
  driving) are the natural first candidates; their agents decide.
- Changing the interface language rebuilds Jaskinia, so running labs start again.

## Checks

`tools/jk5_test.mjs`, 42 checks:

- the demo lab in both window types, on a desktop and on a phone, through every change listed above;
- the messages and their limits (sizes, finite numbers, text only), and that forged messages are refused;
- the remark round trip, the package, the picker, and the demo running inside claude.ai.

All older suites pass as well.
