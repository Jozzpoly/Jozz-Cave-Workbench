# Biblioteka Jozzpoly — brief dla agentów

Zrzut: 2026-10-14 06:21 UTC. Pokrycie: 24/24 repo (24 publicznych, 0 prywatnych). To migawka, nie żywa prawda: przed działaniem sprawdź żywy branch, PR i CI.

## Zasady pracy
- Zdania „po co jest to repo” i przypisanie do rodzin to hipotezy Claude; Owner je zatwierdza, poprawia albo odrzuca w Bibliotece.
- Najnowsza gałąź to nie front. Gdzie żyje praca, mówią README/dokumenty wejścia i PR-y (pole `wskazana`).
- Nieodwracalne decyzje (kasowanie gałęzi, publikacja prywatnych rzeczy) tylko bezpośrednio od Ownera; wspólne konto nie jest podpisem.
- Nic nie znika, dopóki jego sens nie jest zapisany gdzie indziej.

## Żywe istoty
_Czy postać w grze może naprawdę żyć: czuć, pamiętać, działać sama i być partnerem?_ (hipoteza)

### Llm-Live-NPC
- Po co (hipoteza): NPC napędzany małym LLM, który mieszka w świecie: widzi tylko swoje, pamięta i działa wyłącznie przez sprawdzone możliwości świata.
- README: Experimental web laboratory for embodied LLM-driven NPCs. Core research question: Can a lightweight LLM-driven NPC become a believable resident of a game world by receiving bounded perception, maintaining its own experience/beliefs, and acting only through validated world affordances rather than dir
- Życie: żywe · ostatnia aktywność: 1 dni temu · commitów 2622 · gałęzi 77 · PR otwartych 41
- Stan według repo (`docs/PROJECT_STATE.md`, 2026-09-05): „P0 — infrastructure + replaceable model transport qualified. Ready to close and move to P1.”
  - dalej według notatki: Can a lightweight LLM-driven NPC become a believable resident of a game world by receiving bounded perception, maintaining its own experience/beliefs, and acting only…
- [poważne] main stoi od 5 wrz, a najświeższy commit jest na research/spc-r6-five-resident-relational-episode-20261011 (12 paź).
- [poważne] 77 gałęzi na remote; 50 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- Dokumenty wejścia: `README.md`, `docs/PROJECT_STATE.md`
- Repo: https://github.com/Jozzpoly/Llm-Live-NPC

### ReflexBrain-Lab
- Po co (hipoteza): Czy tani, lokalny mechanizm uczący się wyciągnie znaczenie z prywatnego doświadczenia żyjącego, ucieleśnionego aktora.
- README: This main branch is a historical R0 baseline, not the current ReflexBrain experiment. The active research has deliberately remained on qualified experimental branches; the repository entrypoint was not maintained until this correction. The R0 code on main has not been merged with, or replaced by, th
- Życie: żywe · ostatnia aktywność: 2 dni temu · commitów 1263 · gałęzi 90 · PR otwartych 16
- [średnie] 90 gałęzi na remote; 13 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- Dokumenty wejścia wskazują gałęzie: `research/pre-o0-foundations-campaign`
- Dokumenty wejścia: `README.md`
- Pages: https://jozzpoly.github.io/ReflexBrain-Lab/
- Repo: https://github.com/Jozzpoly/ReflexBrain-Lab

### Cognitive-Ecology-Lab
- Po co (hipoteza): Pytało, czy mechanizmy poznawcze, które współpracują albo rywalizują, dają przewagę, której żaden nie ma osobno. Zamknięte werdyktem Ownera 9 paź 2026 (FAIL); pytanie zostaje zapisane, laboratorium nie jest kontynuowane.
- README: FINAL OWNER PRODUCT VERDICT (2026-10-09): FAIL. Do not resume, present, recommend or develop this lab. The Owner requested its removal.
- Życie: zakończone · ostatnia aktywność: 4 dni temu · commitów 72 · gałęzi 2 · PR otwartych 0
- Stan według repo (`docs/STATE.md`, 2026-10-09): „TERMINATED · OWNER FAIL · REPOSITORY REMOVAL REQUESTED.”
- [poważne] Repo samo o sobie mówi: „TERMINATED” (9 paź).
- Dokumenty wejścia: `AGENTS.md`, `README.md`, `docs/STATE.md`
- Repo: https://github.com/Jozzpoly/Cognitive-Ecology-Lab

### Companion-Brain-Lab
- Po co (hipoteza): Towarzysz gracza z prawdziwym, lokalnym mózgiem: autonomia, współpraca taktyczna i szybkie polecenia.
- README: Research laboratory for embodied player-companion intelligence: a strong local live brain, useful autonomy, tactical cooperation, fast player direction, and companions that increasingly feel like teammates rather than followers.
- Życie: stygnące · ostatnia aktywność: 15 dni temu · commitów 1409 · gałęzi 1 · PR otwartych 0
- Stan według repo (`docs/CURRENT.md`, 2026-09-27): „CANONICAL EXECUTION ENTRYPOINT · STRATEGIC RECOVERY / QUESTION-DRIVEN EXECUTION”
  - dalej według notatki: The project does not currently have a justified linear feature roadmap.
  - dalej według notatki: a new compact situation;
  - dalej według notatki: a missing World/interaction capability that unlocks several situations;
- Dokumenty wejścia: `README.md`, `archive/README.md`, `docs/CURRENT.md`
- Pages: https://jozzpoly.github.io/Companion-Brain-Lab/
- Repo: https://github.com/Jozzpoly/Companion-Brain-Lab

### Gloopipelago
- Po co (hipoteza): Obserwatorium żywej ewolucji: mały świat, w którym proste organizmy tworzą czytelne historie.
- README: Gloopipelago is a living evolution observatory: a small spatial world where simple organisms and their environment can create legible evolutionary histories, while the same underlying world remains experimentally inspectable enough that surprising outcomes can be investigated rather than merely narr
- Życie: uśpione · ostatnia aktywność: 33 dni temu · commitów 179 · gałęzi 20 · PR otwartych 4
- Stan według repo (`docs/CURRENT_STATE.md`, 2026-09-10): „Gloopipelago is a living evolution observatory: the living world is primary; causal apparatus is enabling infrastructure.”
  - dalej według notatki: Promote the qualified M3 contract, then create a fresh bounded M3 implementation branch from the resulting live main.
- [średnie] 10 gałęzi mieści się w całości w main: ich usunięcie nie straci żadnego commita.
- Dokumenty wejścia: `README.md`, `docs/CURRENT_STATE.md`
- Repo: https://github.com/Jozzpoly/Gloopipelago

## Ciało i ruch
_Jak dać graczowi i aktorowi fizyczne ciało, które słucha intencji, zamiast przeszkadzać?_ (hipoteza)

### Combat-Lab
- Po co (hipoteza): Odkrywanie ucieleśnionej walki i ruchu. Na main stoi neutralna próbka, a prawdziwe eksperymenty żyją na osobnych gałęziach.
- README: Combat Lab is a research laboratory for discovering embodied combat, movement and world-interaction possibilities.
- Życie: żywe · ostatnia aktywność: 2 dni temu · commitów 1973 · gałęzi 45 · PR otwartych 9
- Stan według repo (`docs/RESEARCH_STATE.md`, 2026-10-11): „Cel: odkrywać w otwartym, edytowalnym świecie fizycznie odmienne organizmy, rzeczywisty ruch i nacisk, relacje ciał/materii, crowds, reakcje, a w przyszłości walkę. Nie budować ponownie ruchu kulek po trasach ani…”
- Dokumenty wejścia wskazują gałęzie: `archive/forensic-pre-cleanroom-2026-10-06`, `experiment/b1-physical-envelope-gate`, `experiment/commons-w1-composition`, `experiment/contact-only-relations-z1`, `experiment/e1-local-encounter-whole`, `experiment/embodied-effectors-v0`, `experiment/g0-physical-ground-reaction`, `experiment/ground-contact-s2`, `experiment/integrated-organism-field-v0`, `experiment/k1-kinetic-shelter-scouter`, `experiment/k2-concurrent-contact-choice`, `experiment/m0-physical-phenotypes`, `experiment/material-commons-x0-whole`, `experiment/p0-material-pressure-yard`, `experiment/p10-material-workshop-whole`, `experiment/p10b-affordance-legibility`, `experiment/p10c-offline-owner-firstlook`, `experiment/p11-material-brace-source`, `experiment/p12-material-pushoff`, `experiment/p12b-momentum-integrity`, `experiment/p2-contact-transport-scout`, `experiment/p3-contested-material-agency`, `experiment/p4-load-contact-reflex`, `experiment/p5-free-material-commons`, `experiment/p6-body-envelope-pressure`, `experiment/p7-contested-doorway-crowd`, `experiment/p8-tactile-slip-human-control`, `experiment/p9-topology-clearance-controls`, `experiment/posture-contact-k1`, `experiment/relational-possibilities-y1`, `experiment/w2-embodied-material-commons`, `experiment/z1-anatomy-null-t0`, `rehearsal/current`
- Dokumenty wejścia: `README.md`, `docs/RESEARCH_STATE.md`, `docs/history/RESEARCH_STATE_OVERLAYS_THROUGH_2026-10-10.md`
- Pages: https://jozzpoly.github.io/Combat-Lab/
- Repo: https://github.com/Jozzpoly/Combat-Lab

### Jozz-Universal-Rig-Editor
- Po co (hipoteza): Lokalny warsztat do riggowania intencji na prawdziwych assetach. Fundament przetestowałeś, potem świadomie go wstrzymałeś.
- README: JURE is a local web workbench for visually authoring rig intent on real assets without making source files, renderer state, or runtime state the authored truth.
- Życie: wstrzymane · ostatnia aktywność: 33 dni temu · commitów 372 · gałęzi 49 · PR otwartych 1
- Stan według repo (`docs/STATUS.md`): „The owner-tested foundation is usable and the project is intentionally paused before the next fundamental product/design phase.”
  - dalej według notatki: Design JURE as the owner's practical visual rigging workbench for current projects, with JV/JV-Web as the first real consumer and later native JV / JV+VAW possible…
  - dalej według notatki: minimal SourceRevision vs placed source instance/registration semantics;
  - dalej według notatki: how many real source joints/parts/meshes map to multiple RigElements without importing renderer ontology into the kernel;
- [poważne] 49 gałęzi na remote; 43 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- Dokumenty wejścia wskazują gałęzie: `checkpoint/foundation-bind00-owner-tested-2026-08-15`
- Dokumenty wejścia: `AGENTS.md`, `README.md`, `docs/STATUS.md`
- Repo: https://github.com/Jozzpoly/Jozz-Universal-Rig-Editor

### Box3d-Character-Controler
- Po co (hipoteza): Laboratorium ucieleśnionego gracza: fizyczne ciało, które nie odbiera kontroli ani frajdy. Tu powstała lekcja E17.
- README: Public browser laboratory for one broader question: How can a player possess a physically meaningful body while retaining enough control, readability and fun that physics becomes part of gameplay rather than an obstacle?
- Życie: uśpione · ostatnia aktywność: 33 dni temu · commitów 974 · gałęzi 20 · PR otwartych 0
- Stan według repo (`docs/PROJECT_STATE.md`, 2026-09-10): „The repository remains an Embodied Player Laboratory, not a realistic-ragdoll project.”
- [średnie] 20 gałęzi na remote; 19 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- Dokumenty wejścia wskazują gałęzie: `archive/pre-cleanup-2026-09-09-dca388f4`
- Dokumenty wejścia: `README.md`, `docs/PROJECT_STATE.md`, `docs/README.md`
- Pages: https://jozzpoly.github.io/Box3d-Character-Controler/
- Repo: https://github.com/Jozzpoly/Box3d-Character-Controler

## Materia i świat
_Z czego jest zrobiony świat: edytowalna materia, cała planeta, skan, który można dotknąć?_ (hipoteza)

### FrameMatter-Lab
- Po co (hipoteza): Edytowalna materia świata, która bywa statyczna albo dynamiczna i nie traci przy tym tożsamości (Godot).
- README: Research lab for an editable systemic-world substrate where local Matter can become static or dynamic physical space without logical identity collapsing into engine representation.
- Życie: żywe · ostatnia aktywność: 3 dni temu · commitów 796 · gałęzi 12 · PR otwartych 1
- [średnie] main stoi od 15 wrz, a najświeższy commit jest na rebuild/p1-interactive-foundation (11 paź).
- Dokumenty wejścia: `README.md`, `docs/archive/README.md`, `docs/evidence/README.md`
- Repo: https://github.com/Jozzpoly/FrameMatter-Lab

### Jozz-Splat-Game-Lab
- Po co (hipoteza): Prawdziwe skany Gaussian Splatting zamienione w światy gry, które można fizycznie testować.
- README: Evidence-driven R&D for turning real Gaussian Splatting captures into spatially grounded, physically testable game worlds.
- Życie: uśpione · ostatnia aktywność: 59 dni temu · commitów 184 · gałęzi 13 · PR otwartych 1
- Stan według repo (`docs/PROJECT_STATE.md`, 2026-08-15): „W0.2 GRAVITY — VERIFIED / W0.3 METRIC SCALE NEXT”
  - dalej według notatki: W0.3 must infer one metric scale from independently known real-world distances while preserving raw source evidence.
  - dalej według notatki: W0.3a — two-point foreground distance measurement;
  - dalej według notatki: W0.3b — explicit entry of known real metres + provenance note;
- [średnie] 4 dokumenty wejścia na main: AGENTS.md, AI_PROJECT_MEMORY.md, README.md, docs/PROJECT_STATE.md.
- Dokumenty wejścia wskazują gałęzie: `agent/w0-2-gravity`
- Dokumenty wejścia: `AGENTS.md`, `AI_PROJECT_MEMORY.md`, `README.md`, `docs/PROJECT_STATE.md`
- Repo: https://github.com/Jozzpoly/Jozz-Splat-Game-Lab

## Maszyny i pojazdy
_Zbuduj, uruchom, obserwuj, popraw, wsiądź i jedź: warsztat maszyn od wokseli po natywny C._ (hipoteza)

### JV-Box3D-Web-experiment
- Po co (hipoteza): JV Web: przeglądarkowa linia Jozz Vehicle, którą można prowadzić na komputerze i telefonie; demo dla znajomych.
- README: JV Web is the browser product line for Jozz Vehicle: a driveable desktop/mobile product, practical vehicle-physics R&D surface and evidence-backed experimentation environment.
- Życie: żywe · ostatnia aktywność: 3 dni temu · commitów 2000 · gałęzi 3 · PR otwartych 0
- Stan według repo (`docs/PROJECT_STATE.md`, 2026-09-13): „NORMAL PRODUCT ITERATION / SPAWN QOL ACCEPTED”
  - dalej według notatki: Spawn no longer controls the schedule.
  - dalej według notatki: useful natural physical steering self-return;
  - dalej według notatki: visual wheel presentation / width judgement;
- [średnie] 5 dokumentów wejścia na main: AGENTS.md, AI_PROJECT_MEMORY.md, README.md, docs/HANDOFF.md i inne.
- Dokumenty wejścia wskazują gałęzie: `preview/owner-control`
- Dokumenty wejścia: `AGENTS.md`, `AI_PROJECT_MEMORY.md`, `README.md`, `docs/HANDOFF.md`, `docs/PROJECT_STATE.md`
- Pages: https://jozzpoly.github.io/JV-Box3D-Web-experiment/
- Repo: https://github.com/Jozzpoly/JV-Box3D-Web-experiment

### WebXR-Lab
- Po co (hipoteza): Riftworks: inżynieryjny sandbox w przeglądarce i VR z krótką pętlą zbuduj, uruchom, obserwuj, popraw.
- README: Riftworks is a browser/VR engineering sandbox focused on a short creative loop: build → run → observe → improve
- Życie: stygnące · ostatnia aktywność: 28 dni temu · commitów 300 · gałęzi 3 · PR otwartych 1
- Dokumenty wejścia: `AGENTS.md`, `README.md`
- Repo: https://github.com/Jozzpoly/WebXR-Lab

### Jozzue_Vehicles_Sandbox
- Po co (hipoteza): Następna generacja Jozz Vehicle w pętli: buduj, uruchom, obserwuj, popraw, wsiądź i jedź.
- README: Research repository for the next generation of Jozz Vehicle. Experiments are evidence, not architecture.
- Życie: uśpione · ostatnia aktywność: 37 dni temu · commitów 257 · gałęzi 41 · PR otwartych 0
- [poważne] 41 gałęzi na remote; 33 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- Dokumenty wejścia wskazują gałęzie: `rep4-b3-owner-checkpoint`
- Dokumenty wejścia: `README.md`
- Repo: https://github.com/Jozzpoly/Jozzue_Vehicles_Sandbox

### Box3d_FunProject
- Po co (hipoteza): Natywny sandbox pojazdów w C17 na silniku Box3D Erina Catto. README na main to wciąż README samego silnika.
- README: Box3D is a 3D physics engine for games.
- Życie: uśpione · ostatnia aktywność: 39 dni temu · commitów 581 · gałęzi 5 · PR otwartych 0
- Stan według repo (`docs/CURRENT_STATE_INDEX_PL.md`, 2026-07-08): „Status (2026-07-08): M2.5/M3A/M3B.3 + M4 + M5.2 zwalidowane; fizyka przebudowana”
  - dalej według notatki: 2026-07-11 — aktywny plan: PLAN_FINALIZACJA_NADWOZIA_I_RIGU_2026_07_11_PL.md
- [poważne] README na main to README silnika Box3D, a nie Twojego projektu.
- [średnie] Ostatni przebieg CI na main jest czerwony (24 lip).
- Dokumenty wejścia: `README.md`, `assets/README.md`, `docs/CURRENT_STATE_INDEX_PL.md`
- Repo: https://github.com/Jozzpoly/Box3d_FunProject

### PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory
- Po co (hipoteza): Maszyny z materii zamiast katalogu części: malujesz w materii właściwości, a laboratorium kompiluje je do fizyki.
- README: Machine Matter / Physical Fabric Laboratory PROJECT ANVIL is an experimental R&D laboratory for a deliberately unusual idea: Author persistent semantic matter and local physical intent, then compile them into disposable runtime representations appropriate to the simulation.
- Życie: uśpione · ostatnia aktywność: 43 dni temu · commitów 602 · gałęzi 55 · PR otwartych 3
- Stan według repo (`docs/CURRENT_HANDOFF.md`): „SEALED — HANDOFF READY / ANVIL-10 ACCEPTED / EPOCH I CLOSED / P06 PRODUCT DESIGN ACCEPTED / C6 IMPLEMENTATION READY / NO ACTIVE MATERIAL WORK / I1 NEXT”
- [średnie] 55 gałęzi na remote; 24 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- [średnie] 30 gałęzi mieści się w całości w main: ich usunięcie nie straci żadnego commita.
- [średnie] 4 dokumenty wejścia na main: AGENTS.md, AI_PROJECT_MEMORY.md, README.md, docs/CURRENT_HANDOFF.md.
- Dokumenty wejścia wskazują gałęzie: `integration/studio-v0-i1-first-loop`
- Dokumenty wejścia: `AGENTS.md`, `AI_PROJECT_MEMORY.md`, `README.md`, `docs/CURRENT_HANDOFF.md`
- Pages: https://jozzpoly.github.io/PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory/
- Repo: https://github.com/Jozzpoly/PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory

### JV-Box3D-Web-Public
- Po co (hipoteza): Publiczne wdrożenie JV Web, zawierające wyłącznie gotowe artefakty.
- README: Public, artifact-only deployment repository for JV Web.
- Życie: uśpione · ostatnia aktywność: 52 dni temu · commitów 50 · gałęzi 2 · PR otwartych 0
- Stan według repo (`HANDOFF.md`): „This repository is public artifact/provenance only. Product development belongs in Jozzpoly/JV-Box3D-Web-experiment.”
- [średnie] 5 plików większych niż 5 MB na main (największy: __jv_scan__/tiles/tile_003.bin, 11.5 MB).
- Dokumenty wejścia wskazują gałęzie: `preview/p1-2-owner`
- Dokumenty wejścia: `AGENTS.md`, `HANDOFF.md`, `README.md`
- Pages: https://jozzpoly.github.io/JV-Box3D-Web-Public/
- Repo: https://github.com/Jozzpoly/JV-Box3D-Web-Public

### voxel-aeronautics-workshop
- Po co (hipoteza): Warsztat maszyn budowanych blok po bloku: budujesz, uruchamiasz w fizyce i rozumiesz, dlaczego lecą albo się rozpadają.
- README: Workbench Foundation - Gate C Stable Base Desktop voxel engineering sandbox where the player builds, tests and pilots their own machine. Gate C is the stable gameplay base: Blueprint v12 Assembly Spaces, deterministic multi-body compilation, articulated real-Cannon flight, strict runtime ownership a
- Życie: uśpione · ostatnia aktywność: 58 dni temu · commitów 409 · gałęzi 14 · PR otwartych 1
- Stan według repo (`AI_PROJECT_MEMORY.md`): „Current source of truth: Workbench Foundation on stable Gate C.”
- [średnie] 14 gałęzi na remote; 13 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- [średnie] 5 dokumentów wejścia na main: AI_PROJECT_MEMORY.md, README.md, docs/README.md, docs/recovery/README.md i inne.
- Dokumenty wejścia: `AI_PROJECT_MEMORY.md`, `README.md`, `docs/README.md`, `docs/recovery/README.md`, `tools/blockbench_import_studio/README.md`
- Repo: https://github.com/Jozzpoly/voxel-aeronautics-workshop

## Gry ze znajomymi
_Grać razem: karty przy wspólnym stole, wspólny fizyczny świat, kooperacja w sieci lokalnej._ (hipoteza)

### cloudflare-multiplayer-lab
- Po co (hipoteza): MultiWorld: wspólny fizyczny świat w przeglądarce. Serwer na Cloudflare liczy fizykę Box3D.
- README: Evidence-driven R&D laboratory for multiplayer / shared-world technology.
- Życie: stygnące · ostatnia aktywność: 24 dni temu · commitów 1960 · gałęzi 3 · PR otwartych 0
- Dokumenty wejścia wskazują gałęzie: `archive/multi-world-history-2026-09-18`
- Dokumenty wejścia: `AGENTS.md`, `README.md`
- Repo: https://github.com/Jozzpoly/cloudflare-multiplayer-lab

### Tysi-c-The-Game
- Po co (hipoteza): Tysiąc w przeglądarce dla znajomych: prywatne stoły, boty i fizyczny język kart.
- README: Codename: Tysiąc The Game Browser-first Tysiąc for desktop and mobile: private friend tables, bots, explicit rule profiles, and a presentation layer rebuilt around a more physical digital-card language.
- Życie: stygnące · ostatnia aktywność: 24 dni temu · commitów 1066 · gałęzi 73 · PR otwartych 4
- Stan według repo (`docs/EXECUTION_STATE.md`, 2026-09-17): „Finalization mode. Latest main is Owner-tested and close to acceptable; mobile performance/responsiveness is the remaining product-quality blocker before final stable promotion and the real friend session.”
- [poważne] 73 gałęzie na remote; 58 z nich nie ruszało się od ponad 3 tygodni i nie mieści się w main.
- [średnie] 14 gałęzi mieści się w całości w main: ich usunięcie nie straci żadnego commita.
- [średnie] 4 dokumenty wejścia na main: AGENTS.md, README.md, docs/EXECUTION_STATE.md, docs/HANDOFF_NEXT_CONVERSATION.md.
- Dokumenty wejścia: `AGENTS.md`, `README.md`, `docs/EXECUTION_STATE.md`, `docs/HANDOFF_NEXT_CONVERSATION.md`
- Pages: https://jozzpoly.github.io/Tysi-c-The-Game/
- Repo: https://github.com/Jozzpoly/Tysi-c-The-Game

## Medium
_Jak Ty i agenci dzielicie rzeczywistość projektów, żebyś nie był kurierem między nimi?_ (hipoteza)

### Shared-Work-Medium-Lab
- Po co (hipoteza): Medium: wspólna praca Ciebie, ChatGPT, Codexa i Claude nad rzeczywistością projektów. Stąd wyrasta ta Biblioteka.
- README: Experimental public laboratory for a developing shared work medium between an Owner, Browser ChatGPT, Codex, other agents, tools, and project reality.
- Życie: żywe · ostatnia aktywność: 1 dni temu · commitów 726 · gałęzi 29 · PR otwartych 6
- Stan według repo (`docs/RESEARCH_STATE.md`, 2026-10-11): „Owner product FAIL remains; Quiet Presence (#5), visual Library (#17), Cloudflare source observation (#22), archival event-cursor (#23) and spatial World (#24) are distinct unmerged experiments; Issue #7 is the broader…”
  - dalej według notatki: Read the preserved checkpoint.
- [średnie] Na main nie ma kodu: 16 plików, same dokumenty i konfiguracja.
- [średnie] 7 dokumentów wejścia na main: AGENTS.md, README.md, START_HERE.md, docs/HANDOFF_2026-10-04_QUIET_PRESENCE_CODEX_COLLAB.md i inne.
- Dokumenty wejścia wskazują gałęzie: `campaign/open-substrate-2026-10-04`, `campaign/quiet-presence-2026-10-04`, `experiment/semantic-medium-v0`, `research/medium-physics-experiment-design`
- Dokumenty wejścia: `AGENTS.md`, `README.md`, `START_HERE.md`, `docs/HANDOFF_2026-10-04_QUIET_PRESENCE_CODEX_COLLAB.md`, `docs/NORTH_STAR.md`, `docs/RESEARCH_STATE.md`
- Repo: https://github.com/Jozzpoly/Shared-Work-Medium-Lab

### Jozz-Cave-Workbench
- Po co (hipoteza): Przyszły dom Jaskini, Twojego warsztatu nad wszystkimi projektami. Na razie bez commitów.
- Życie: puste · ostatnia aktywność: — · commitów 0 · gałęzi 0 · PR otwartych 0
- Repo: https://github.com/Jozzpoly/Jozz-Cave-Workbench

## Feniks
_Czy da się złożyć całość: żywą krainę, w której mieszkańcy żyją z własnych powodów, a Ty ją tworzysz i przekształcasz?_ (hipoteza)

### Mini_Feniks
- Po co (hipoteza): Poważna próba złożenia jak największej części marzenia o Feniksie w jedną żywą krainę; po pierwszym graniu budowa wstrzymana, trwa ocena fundamentu.
- README: Poważna próba zrealizowania możliwie największej części marzenia o Feniksie, na jaką pozwalają nasze możliwości. Budujemy własne dzieło, konsekwentnie rozwijając jedną całość. Nie jest to demonstrator technologii ani celowo prowizoryczna wersja przyszłej gry.
- Życie: żywe · ostatnia aktywność: dziś · commitów 8 · gałęzi 1 · PR otwartych 0
- Dokumenty wejścia: `AGENTS.md`, `README.md`
- Repo: https://github.com/Jozzpoly/Mini_Feniks

## Pierwsze próby
_Od czego zaczęło się na GitHubie: mod do Minecrafta, vibe-coding, pusty pomysł._ (hipoteza)

### Simply_game_experiment
- Po co (hipoteza): „Vibe koding”: roguelike 2D z maja 2025, jeden z pierwszych eksperymentów z AI na GitHubie.
- README: A sophisticated 2D rouge-like game featuring advanced procedural generation, dynamic difficulty adaptation, comprehensive progression systems, and modern UI design. This professional-grade game has evolved through 4 major development phases to deliver a commercial-quality gaming experience.
- Życie: uśpione · ostatnia aktywność: 444 dni temu · commitów 10 · gałęzi 3 · PR otwartych 1
- Dokumenty wejścia: `README.md`
- Repo: https://github.com/Jozzpoly/Simply_game_experiment

### MinecraftLike-Fun-Project
- Po co (hipoteza): Puste repo bez żadnego commita, czyli miejsce zostawione na pomysł.
- Życie: puste · ostatnia aktywność: — · commitów 0 · gałęzi 0 · PR otwartych 0
- Repo: https://github.com/Jozzpoly/MinecraftLike-Fun-Project

## Zmiany od poprzedniego zrzutu (2026-10-10 01:29 UTC)
- nowe repo: Jozz-Cave-Workbench
- nowe repo: Mini_Feniks
- Llm-Live-NPC: +264 commity, +13 gałęzi
- Shared-Work-Medium-Lab: +144 commity, +7 gałęzi
- ReflexBrain-Lab: +263 commity, +30 gałęzi
- Combat-Lab: +536 commitów, +30 gałęzi
- FrameMatter-Lab: +1 commit, życie: stygnące → żywe
- JV-Box3D-Web-experiment: +15 commitów, +1 gałąź, −2 gałęzie (usunięte), życie: stygnące → żywe
- Box3d-Character-Controler: życie: stygnące → uśpione
- Gloopipelago: życie: stygnące → uśpione
- nowe ustalenia: Combat-Lab:datowane-dokumenty, Combat-Lab:dokumenty-vs-kod, FrameMatter-Lab:praca-poza-main, JV-Box3D-Web-experiment:notatka-starsza, Jozz-Cave-Workbench:puste, Mini_Feniks:bez-api, ReflexBrain-Lab:wiele-galezi
- ustalenie zniknęło: JV-Box3D-Web-experiment: 1 grupa nazw: kilka gałęzi wskazuje ten sam commit (2 nazwy łącznie).

## Lekcje, które przeszły między światami
- **E17 — Najpierw intencja, potem skończone wykonanie** (Box3d-Character-Controler → Combat-Lab). Źródło: https://github.com/Jozzpoly/Box3d-Character-Controler/blob/e7a98beaca4c010e056c31db97b33c05b4610e38/docs/PROJECT_STATE.md#L83-L128. Droga: Natywnie. Combat znał E17 z własnego BODY_WORLD (7.10), a negatywną połowę doczytał u dawcy. Drzwi w Medium powstały minutę przed użyciem, więc były zapisem, nie odkryciem.
- **Stage-B — Nie zabieraj Ownerowi warsztatu przyczyn** (Companion-Brain-Lab → Combat-Lab). Źródło: https://github.com/Jozzpoly/Companion-Brain-Lab/blob/02ab485a634a9a4e2ad1974a263b99b0cbbc1b3c/docs/CURRENT.md#L132-L184. Droga: Natywnie w ogólnym sensie: Combat wymieniał Companion jako dawcę. Konkretną lekcję zapisano w Medium o 22:07, już po pierwszych commitach obserwacji.
- **B01c — Geometria to nie zdolność aktora** (ReflexBrain-Lab → Combat-Lab). Źródło: https://github.com/Jozzpoly/ReflexBrain-Lab/blob/87d94c84288982dd6c150494b24504097ec4474f/docs/PRE_O0_CAMPAIGN_CURRENT_STATE_2026-10-06.md#L800-L845. Droga: Nieznana. W kodzie ani dokumentach Combatu nie ma cytatu, a drzwi w Medium są późniejsze niż pierwszy commit odbiorcy.

## Prawa Biblioteki
- **Spokojne wejście, dokładna głębia** — Panorama otwiera się spokojnie, a każdy fakt ma drogę w dół aż do surowych danych. Surowe źródło jest pełnoprawną ścieżką, nie dodatkiem do schowania.
- **Bez globalnego rankingu** — Biblioteka nie ocenia i nie szereguje światów. To, że coś istnieje, nie znaczy, że trzeba to wyświetlić, a tym bardziej przerywać Ci uwagę.
- **Dwa czasy obok siebie** — Datowane miejsce zostaje datowane, a żywe drzwi prowadzą do teraźniejszości. Historii się nie przepisuje; ten wzorzec opisuje Memento (RFC 7089).
- **Zadeklarowane pokrycie** — Każdy przegląd mówi, ile powinno być i ile jest. Cisza nie oznacza braku.
- **Rozdzielone pochodzenie** — To cztery różne fakty: kto coś twierdzi, czym to przyszło, jak ktoś do tego trafił i co naprawdę zmieniło się w projekcie.
- **Czytelne dla każdego ciała** — Nic nośnego nie siedzi w zwiniętych elementach, w samym skrypcie ani na płótnie. Ta sama treść musi przetrwać AXTree Opery, web_fetch i gita.
- **Dowód od kogoś innego, później** — Wartość zapisu pokazuje późniejszy czytelnik, który nie jest jego twórcą. Twórca nie ocenia sam siebie.
- **Agenci proponują sens, Ty go zatwierdzasz** — Każde zdanie o Twoich intencjach jest hipotezą, dopóki go nie potwierdzisz, nie poprawisz albo nie odrzucisz.
- **Autorytet ponad pewność** — Liczy się, kto ma prawo coś stwierdzić, a nie to, jak pewnie to brzmi.
- **Najnowsza gałąź to nie front** — Gdzie żyje praca, mówi README albo PR, a nie data ostatniego commita.
- **Świeża data nie widzi sprzeczności** — Dokument może być świeży i jednocześnie błędny. Data aktualizacji nie wykrywa sprzeczności treści.
- **Nic nie znika, póki jego sens nie jest zapisany** — Gałąź można usunąć dopiero wtedy, gdy jej znaczenie żyje gdzie indziej. Osiągalność commita to co innego niż znaczenie nazwy.
- **Nieodwracalne decyzje tylko od Ciebie** — Kasowanie, publikacja prywatnych rzeczy czy zdjęcie pauzy wymagają Twojej decyzji wprost. Wspólne konto nie jest podpisem.
- **Biblioteka nie zastępuje celu** — Jeśli Biblioteka zaczyna generować więcej pracy o sobie niż w światach, którym służy, zatrzymujemy ją.
- **Kapitał zdolności** — Po pracy agenta możesz sam zrobić coś, o co wcześniej musiałeś prosić.
