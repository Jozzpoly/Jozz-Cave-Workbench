# Jaskinia v1 — what the owner's recordings show (13 Oct 2026)

## R1 (desktop, 97 s, normal use)
- Granie layout: Zagraj on Combat Lab, Character Controller, JV Web -> each opens in a new tab, he plays, comes back. The "quickly play" path works.

## R2 (desktop, 245 s)
- 0-23 s Granie: plays JV Web (new tab), selects JV Web Public, plays ReflexBrain (its lab page).
- 25-52 s: uses the project picker in a window header (Rytm i zegar) a lot: Gloopipelago, JURE, Box3D CC, Medium, LLM Live NPC, JV Web. Long dropdown, he scrolls in it. Works.
- 53-107 s his own Statystyki layout (Rok w commitach + Kiedy i jak + Projekty w okresie + Commity dzień po dniu):
  - switches ranges 7/28/90/rok/od początku; clicks ranking rows to select; drags borders so ranking is huge and the daily chart a narrow sliver -> chart becomes illegible (record label, tiny bars).
  - "od początku": the daily chart is a long empty stretch (2025 → May 2026) then everything crammed at the right.
  - family filter via header menu: Żywe istoty, Gry ze znajomymi -> KPIs change. Works.
- ~108-160 s (seen earlier): wall + other layouts.
- 165-188 s WALL: small round badges (lod S) cannot be moved: pressing them starts the corner-resize instead (readout shows "56×56 · znaczek"). Exactly his complaint.

## R3 (desktop, 250 s, deliberate destruction)
- New layout "Mój układ"; splits again and again -> dozens of tiny "Pusty" windows. The chooser ("Co ma pokazywać to okno?" + tile grid) is clipped/useless in small windows.
- Maximizes a Pusty window, picks "Kiedy i jak" -> works.
- Ściana: cards crushed against the top edge (J, PROJE..., Box3D Chara..., Combat Lab, MultiWorld, JURE in one row), small badges overlapping each other at the bottom-right (four badge names printed over one another).
- Text selection everywhere while dragging/clicking (orange ::selection over kataster, karta title "Jozzue Vehicles", Stan według repo) -> ugly, accidental.
- Do zagrania squeezed narrow: tile names break mid-word ("Comb at Lab").
- Help popover opened, read.
- Tabs: created Mój układ 2, (kopia), Granie 2, Projekt 2, Granie 3, renamed to gibberish "sadasdasda", "1!@#SAd132412" -> tab bar overflows, tabs run off the right edge, no visible way to reach them. Right-click tab menu works (Zmień nazwę/Powiel/Przywróć/Usuń).
- Map zoomed in (Ctrl+wheel): map redraws smaller in local px -> parcel names vanish (only "nr" numbers), selected parcel an empty white box.
- Kataster zoomed: filters big, native select "Kolejność" works.
- TOP BAR SHOWS "null" next to the selected project (bug: replaceChildren(null) -> text "null").

## Phone (Chrome Android, file opened from Downloads, 1080x2400, 185 s)
- Stack mode: windows stacked, each ~82% of screen height -> very long scroll; navigating between windows is hard.
- Map: tiny; tapping parcels shows desktop tooltips over everything AND triggers Chrome "Touch to Search" (Google bar with "1 nr 14 3 nr 6 Żywe istoty 5 światów LLM..."): tapping SVG text selects it. Selection does change (top chip -> LLM Live NPC). He: "mapa działek totalnie nie działa".
- "null" also in the phone top bar.
- Granie: Zagraj opens game in new tab (JV Web driving with touch controls works, Combat Lab, PROJECT ANVIL editor) — fine.
- Statystyki stacked: KPIs, chart, Kiedy i jak, ranking, Rok w commitach (heatmap tiny), Ciekawostki. Window menu (⋯) opened and stayed 5 s.
- Projekt stacked: karta PROJECT ANVIL, stan, gałęzie, rytm/zegar: long.
- Ściana on phone: total mess — cards overlapping, names over names; dragging small cards resizes them ("Box3D Character Controller: 56×56 · znaczek", "56×190", "Splat Game Lab 181×62 karta", "90×142 znaczek"; FrameMatter 219×173 / 253×241).
- Split on phone -> chooser as one long column of tiles.
- Ustalenia: tapped "wszystkie gałęzie" -> GitHub branches in new tab (works).
- Top-bar picker with on-screen keyboard: works; selected Companion Brain.
- Header icon buttons are tiny for fingers.

## His words (14 Oct)
- Best web app UX/UI any AI made for him; "to jest prawie to"; but devil in details; push harder now.
- Map colours: red -> green; livelier = greener; red = warning/informative role; neutral = blue or background; a well-finished project with donors shouldn't glow red because nobody touched it for a year.
- Wall: most broken on desktop and mobile, most ambitious; wants persistence there; needs the biggest reincarnation.
- Shell: advanced use reveals missing options everywhere, features that only pretend; no reset of the whole Jaskinia; no saving of layouts; no settings/options; future: interface languages; THEMES (like my earlier sketches: Neon, Piwnica, Kataster) — many people with different backgrounds may use Jaskinia as their own.
- More customization, more influence on UI/UX; everything thought through many times over.
- Mobile: map doesn't work; navigation hard; interface must be thought out for mobile; mobile is support, need not be perfect now, but must be fundamentally/architecturally capable of most of desktop; might play an unforeseen role later.
- Use Opera freely; read GPT chats "zweryfikuj i kontynuuj" (Medium project) and "pożegnanie z asystentem".
