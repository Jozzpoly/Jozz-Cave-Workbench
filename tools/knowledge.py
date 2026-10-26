#!/usr/bin/env python3
"""Curated knowledge layer (Claude's condensation, from 2026-10-09).

Everything here is either (a) quoted/linked from a source at an exact revision, or (b) Claude's hypothesis
(status 'hypothesis'). The owner's private layer (private repositories and his own words) lives outside the
public repository, in private/knowledge_private.json, and is merged at the end when present.
Usage: python3 -I knowledge.py OUT.json        (BIB_PUBLIC=1 builds without the private layer)
"""
import json, os, sys

OUT = sys.argv[1]
GH = "https://github.com/Jozzpoly"
I7 = f"{GH}/Shared-Work-Medium-Lab/issues/7#issuecomment-"


def gh(repo, sha, path, l1=None, l2=None):
    u = f"{GH}/{repo}/blob/{sha}/{path}"
    if l1:
        u += f"#L{l1}" + (f"-L{l2}" if l2 else "")
    return u


S = {  # exact revisions used for quotes (collected 2026-10-09)
    "companion": "02ab485a634a9a4e2ad1974a263b99b0cbbc1b3c",
    "framematter": "3dbd232f034a665a19a8f82426cf26aa4243bcec",
    "combat": "2d86dc1822c5de9037920aa882c48e8525325aba",
    "b3cc": "e7a98beaca4c010e056c31db97b33c05b4610e38",
    "jozzue": "a5462817a732721396d30f1932a6d570354ca9f0",
    "anvil": "a87f33f6adcefddf9356d09301299591cb362568",
    "reflex": "87d94c84288982dd6c150494b24504097ec4474f",
    "jvweb": "663d73243a7e68229db7a6540caaeb96c679366a",
    "combat_exp": "b2a3984cdd26cabae71ed3a4afbb25ce1e3aa092",
    "combat_resident": "f960c5e1af2a0851cfd0fa0df326689a127a621c",
}

FAMILIES = [
    {"id": "zywe", "name": "Żywe istoty",
     "question": "Czy postać w grze może naprawdę żyć: czuć, pamiętać, działać sama i być partnerem?",
     "repos": ["ReflexBrain-Lab", "Companion-Brain-Lab", "Llm-Live-NPC", "Gloopipelago", "Cognitive-Ecology-Lab"]},
    {"id": "cialo", "name": "Ciało i ruch",
     "question": "Jak dać graczowi i aktorowi fizyczne ciało, które słucha intencji, zamiast przeszkadzać?",
     "repos": ["Combat-Lab", "Box3d-Character-Controler", "Jozz-Universal-Rig-Editor"]},
    {"id": "materia", "name": "Materia i świat",
     "question": "Z czego jest zrobiony świat: edytowalna materia, cała planeta, skan, który można dotknąć?",
     "repos": ["FrameMatter-Lab", "Jozz-Splat-Game-Lab", "Splot"]},
    {"id": "maszyny", "name": "Maszyny i pojazdy",
     "question": "Zbuduj, uruchom, obserwuj, popraw, wsiądź i jedź: warsztat maszyn od wokseli po natywny C.",
     "repos": ["voxel-aeronautics-workshop", "Box3d_FunProject", "JV-Box3D-Web-experiment", "JV-Box3D-Web-Public",
               "Jozzue_Vehicles_Sandbox",
               "PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory", "WebXR-Lab"]},
    {"id": "razem", "name": "Gry ze znajomymi",
     "question": "Grać razem: karty przy wspólnym stole, wspólny fizyczny świat, kooperacja w sieci lokalnej.",
     "repos": ["Tysi-c-The-Game", "cloudflare-multiplayer-lab"]},
    {"id": "medium", "name": "Medium",
     "question": "Jak Ty i agenci dzielicie rzeczywistość projektów, żebyś nie był kurierem między nimi?",
     "repos": ["Shared-Work-Medium-Lab", "Jozz-Cave-Workbench"]},
    {"id": "feniks", "name": "Feniks",
     "question": "Czy da się złożyć całość: żywą krainę, w której mieszkańcy żyją z własnych powodów, a Ty ją tworzysz i przekształcasz?",
     "repos": ["Mini_Feniks", "Feniks-Studio"]},
    {"id": "poczatki", "name": "Pierwsze próby",
     "question": "Od czego zaczęło się na GitHubie: mod do Minecrafta, vibe-coding, pusty pomysł.",
     "repos": ["Simply_game_experiment", "MinecraftLike-Fun-Project"]},
]

SHORT = {  # display short names (the long ones break layouts)
    "PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory": "PROJECT ANVIL",
    "voxel-aeronautics-workshop": "Voxel Aeronautics Workshop",
    "cloudflare-multiplayer-lab": "MultiWorld",
    "Tysi-c-The-Game": "Tysiąc",
    "Jozz-Universal-Rig-Editor": "JURE",
    "Box3d-Character-Controler": "Box3D Character Controller",
    "Box3d_FunProject": "Box3D Native",
    "JV-Box3D-Web-experiment": "JV Web",
    "JV-Box3D-Web-Public": "JV Web Public",
    "Jozzue_Vehicles_Sandbox": "Jozzue Vehicles",
    "Shared-Work-Medium-Lab": "Medium",
    "Mini_Feniks": "MiniFeniks",
    "Jozz-Cave-Workbench": "Cave Workbench",
    "Jozz-Splat-Game-Lab": "Splat Game Lab",
    "Simply_game_experiment": "Simply Game",
    "MinecraftLike-Fun-Project": "MinecraftLike",
    "Companion-Brain-Lab": "Companion Brain",
    "ReflexBrain-Lab": "ReflexBrain",
    "Llm-Live-NPC": "LLM Live NPC",
    "FrameMatter-Lab": "FrameMatter",
    "WebXR-Lab": "Riftworks (WebXR)",
    "Combat-Lab": "Combat Lab",
    "Gloopipelago": "Gloopipelago",
    "Cognitive-Ecology-Lab": "Cognitive Ecology",
    "Feniks-Studio": "Feniks Studio",
    "Splot": "Splot",
}

IDENTITY = {  # Claude's one-line hypotheses (status: hypothesis until the Owner ratifies)
    "Mini_Feniks": "Poważna próba złożenia jak największej części marzenia o Feniksie w jedną żywą krainę; po pierwszym graniu budowa wstrzymana, trwa ocena fundamentu.",
    "Jozz-Cave-Workbench": "Dom Jaskini, Twojego okna na wszystkie projekty: kod, testy, kompas i publiczny podgląd. Twoja prywatna Jaskinia żyje jako artefakt.",
    "Feniks-Studio": "Warsztat do tworzenia miejsc, rzeczy i eksperymentów przyszłego Feniksa. Dziś badania i plan bez aplikacji: budowę wstrzymałeś, a Jaskinia jest jednym z kandydatów na jego dom.",
    "Splot": "Mały żywy świat 2.5D: materia, którą można przekształcać, kilka poziomów i zachowania, które reagują na zmiany. Grywalny punkt wyjścia, a geometria K3 jako osobny dawca.",
    "ReflexBrain-Lab": "Czy tani, lokalny mechanizm uczący się wyciągnie znaczenie z prywatnego doświadczenia żyjącego, ucieleśnionego aktora.",
    "Companion-Brain-Lab": "Towarzysz gracza z prawdziwym, lokalnym mózgiem: autonomia, współpraca taktyczna i szybkie polecenia.",
    "Llm-Live-NPC": "NPC napędzany małym LLM, który mieszka w świecie: widzi tylko swoje, pamięta i działa wyłącznie przez sprawdzone możliwości świata.",
    "Gloopipelago": "Obserwatorium żywej ewolucji: mały świat, w którym proste organizmy tworzą czytelne historie.",
    "Combat-Lab": "Odkrywanie ucieleśnionej walki i ruchu. Na main stoi neutralna próbka, a prawdziwe eksperymenty żyją na osobnych gałęziach.",
    "Box3d-Character-Controler": "Laboratorium ucieleśnionego gracza: fizyczne ciało, które nie odbiera kontroli ani frajdy. Tu powstała lekcja E17.",
    "Jozz-Universal-Rig-Editor": "Lokalny warsztat do riggowania intencji na prawdziwych assetach. Fundament przetestowałeś, potem świadomie go wstrzymałeś.",
    "FrameMatter-Lab": "Edytowalna materia świata, która bywa statyczna albo dynamiczna i nie traci przy tym tożsamości (Godot).",
    "Jozz-Splat-Game-Lab": "Prawdziwe skany Gaussian Splatting zamienione w światy gry, które można fizycznie testować.",
    "voxel-aeronautics-workshop": "Warsztat maszyn budowanych blok po bloku: budujesz, uruchamiasz w fizyce i rozumiesz, dlaczego lecą albo się rozpadają.",
    "Box3d_FunProject": "Natywny sandbox pojazdów w C17 na silniku Box3D Erina Catto. README na main to wciąż README samego silnika.",
    "JV-Box3D-Web-experiment": "JV Web: przeglądarkowa linia Jozz Vehicle, którą można prowadzić na komputerze i telefonie; demo dla znajomych.",
    "JV-Box3D-Web-Public": "Publiczne wdrożenie JV Web, zawierające wyłącznie gotowe artefakty.",
    "Jozzue_Vehicles_Sandbox": "Następna generacja Jozz Vehicle w pętli: buduj, uruchom, obserwuj, popraw, wsiądź i jedź.",
    "PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory": "Maszyny z materii zamiast katalogu części: malujesz w materii właściwości, a laboratorium kompiluje je do fizyki.",
    "WebXR-Lab": "Riftworks: inżynieryjny sandbox w przeglądarce i VR z krótką pętlą zbuduj, uruchom, obserwuj, popraw.",
    "Tysi-c-The-Game": "Tysiąc w przeglądarce dla znajomych: prywatne stoły, boty i fizyczny język kart.",
    "cloudflare-multiplayer-lab": "MultiWorld: wspólny fizyczny świat w przeglądarce. Serwer na Cloudflare liczy fizykę Box3D.",
    "Shared-Work-Medium-Lab": "Medium: wspólna praca Ciebie, ChatGPT, Codexa i Claude nad rzeczywistością projektów. Stąd wyrasta ta Biblioteka.",
    "Simply_game_experiment": "„Vibe koding”: roguelike 2D z maja 2025, jeden z pierwszych eksperymentów z AI na GitHubie.",
    "MinecraftLike-Fun-Project": "Puste repo bez żadnego commita, czyli miejsce zostawione na pomysł.",
    "Cognitive-Ecology-Lab": "Pytało, czy mechanizmy poznawcze, które współpracują albo rywalizują, dają przewagę, której żaden nie ma osobno. Zamknięte werdyktem Ownera 9 paź 2026 (FAIL); pytanie zostaje zapisane, laboratorium nie jest kontynuowane.",
}

STATED = {}  # the owner's own words, per repository: private layer

# The account itself: a public fact (api.github.com/users/Jozzpoly, read 14.10.2026). Jaskinia's statistics use it for the
# "od założenia konta" range; "od początku" starts where continuous work starts (Owner's correction, 14.10.2026).
ACCOUNT = {"login": "Jozzpoly", "created": "2022-02-21T01:52:35Z", "source": "api.github.com/users/Jozzpoly, odczyt 14.10.2026"}

ESTATE_STATED = []  # the owner's own words about his estate: private layer

PROLOG = [  # measured from git; the owner's own account of the years before is in the private layer
    {"when": "23.05.2025", "what": "Simply Game, czyli „Vibe koding”.", "kind": "measured"},
    {"when": "10.05.2026", "what": "Box3D Native otwiera falę 2026.", "kind": "measured"},
    {"when": "03.10.2026", "what": "Powstaje Medium (Shared-Work-Medium-Lab).", "kind": "measured"},
    {"when": "09.10.2026", "what": "Biblioteka v1, czyli ta strona.", "kind": "measured"},
]

LAWS = [
    {"id": "spokojne-wejscie", "title": "Spokojne wejście, dokładna głębia",
     "text": "Panorama otwiera się spokojnie, a każdy fakt ma drogę w dół aż do surowych danych. Surowe źródło jest pełnoprawną ścieżką, nie dodatkiem do schowania.",
     "origin": "Twoje zachowanie", "sources": [["Owner Walk 01 (commit 1ec19fa)", f"{GH}/Shared-Work-Medium-Lab/blob/1ec19fa/campaigns/open-substrate-2026-10-04/OWNER_WALK_01_BEHAVIOR.md"]]},
    {"id": "bez-rankingu", "title": "Bez globalnego rankingu",
     "text": "Biblioteka nie ocenia i nie szereguje światów. To, że coś istnieje, nie znaczy, że trzeba to wyświetlić, a tym bardziej przerywać Ci uwagę.",
     "origin": "Medium · Quiet Presence", "sources": [["Quiet Presence, PR #5", f"{GH}/Shared-Work-Medium-Lab/pull/5"]]},
    {"id": "dwa-czasy", "title": "Dwa czasy obok siebie",
     "text": "Datowane miejsce zostaje datowane, a żywe drzwi prowadzą do teraźniejszości. Historii się nie przepisuje; ten wzorzec opisuje Memento (RFC 7089).",
     "origin": "Rozmowa 9.10", "sources": [["C14, GPT", I7 + "6070022039"], ["RFC 7089", "https://www.rfc-editor.org/rfc/rfc7089.html"]]},
    {"id": "pokrycie", "title": "Zadeklarowane pokrycie",
     "text": "Każdy przegląd mówi, ile powinno być i ile jest. Cisza nie oznacza braku.",
     "origin": "Rozmowa 9.10", "sources": [["C10, GPT", I7 + "6069939840"], ["Pominięta wiadomość w Slacku", I7 + "6069975574"]]},
    {"id": "pochodzenie", "title": "Rozdzielone pochodzenie",
     "text": "To cztery różne fakty: kto coś twierdzi, czym to przyszło, jak ktoś do tego trafił i co naprawdę zmieniło się w projekcie.",
     "origin": "Rozmowa 9.10", "sources": [["Agent_Slack", I7 + "6069975574"], ["C15", I7 + "6070168610"]]},
    {"id": "czytelnosc", "title": "Czytelne dla każdego ciała",
     "text": "Nic nośnego nie siedzi w zwiniętych elementach, w samym skrypcie ani na płótnie. Ta sama treść musi przetrwać AXTree Opery, web_fetch i gita.",
     "origin": "Medium", "sources": [["PR #3", f"{GH}/Shared-Work-Medium-Lab/pull/3"], ["HTMLPreview, PR #5", f"{GH}/Shared-Work-Medium-Lab/pull/5#issuecomment-6070107764"]]},
    {"id": "inny-czytelnik", "title": "Dowód od kogoś innego, później",
     "text": "Wartość zapisu pokazuje późniejszy czytelnik, który nie jest jego twórcą. Twórca nie ocenia sam siebie.",
     "origin": "Rozmowa 9.10", "sources": [["Zamknięcie rundy", I7 + "6070395574"]]},
    {"id": "sens-hipoteza", "title": "Agenci proponują sens, Ty go zatwierdzasz",
     "text": "Każde zdanie o Twoich intencjach jest hipotezą, dopóki go nie potwierdzisz, nie poprawisz albo nie odrzucisz.",
     "origin": "Twoja odpowiedź 9.10", "sources": [["Poprawki GPT", I7 + "6070375988"]]},
    {"id": "autorytet", "title": "Autorytet ponad pewność",
     "text": "Liczy się, kto ma prawo coś stwierdzić, a nie to, jak pewnie to brzmi.",
     "origin": "Rozmowa o Feniksie", "sources": []},
    {"id": "front", "title": "Najnowsza gałąź to nie front",
     "text": "Gdzie żyje praca, mówi README albo PR, a nie data ostatniego commita.",
     "origin": "Medium", "sources": [["C6", I7 + "6069787741"], ["Sonda drzwi frontowych, PR #10", f"{GH}/Shared-Work-Medium-Lab/pull/10"]]},
    {"id": "data-slepa", "title": "Świeża data nie widzi sprzeczności",
     "text": "Dokument może być świeży i jednocześnie błędny. Data aktualizacji nie wykrywa sprzeczności treści.",
     "origin": "Medium", "sources": [["C3, PR #15", f"{GH}/Shared-Work-Medium-Lab/pull/15"]]},
    {"id": "sens-przed-usunieciem", "title": "Nic nie znika, póki jego sens nie jest zapisany",
     "text": "Gałąź można usunąć dopiero wtedy, gdy jej znaczenie żyje gdzie indziej. Osiągalność commita to co innego niż znaczenie nazwy.",
     "origin": "Twoja analiza z GPT (JURE)", "sources": []},
    {"id": "nieodwracalne", "title": "Nieodwracalne decyzje tylko od Ciebie",
     "text": "Kasowanie, publikacja prywatnych rzeczy czy zdjęcie pauzy wymagają Twojej decyzji wprost. Wspólne konto nie jest podpisem.",
     "origin": "Rozmowa 9.10", "sources": [["Agent_Slack", I7 + "6070401909"]]},
    {"id": "nie-zastepuje", "title": "Biblioteka nie zastępuje celu",
     "text": "Jeśli Biblioteka zaczyna generować więcej pracy o sobie niż w światach, którym służy, zatrzymujemy ją.",
     "origin": "Rozmowa 9.10", "sources": [["Runda 3", I7 + "6070316892"]]},
    {"id": "kapital", "title": "Kapitał zdolności",
     "text": "Po pracy agenta możesz sam zrobić coś, o co wcześniej musiałeś prosić.",
     "origin": "Rozmowa o Feniksie", "sources": [["Odpowiedź Claude", I7 + "6069900699"]]},
]

DNA = [
    {"title": "Twoje doświadczenie wygrywa z PASS-em maszyny",
     "quotes": [
         ["Companion", "newer explicit Owner feedback / Owner-observed behavior > older Owner interpretation > participant-visible runtime evidence > controlled machine evidence > internal state / documentation / roadmap", gh("Companion-Brain-Lab", S["companion"], "docs/CURRENT.md", 8, 14)],
         ["FrameMatter", "C7 Owner Spark Gate: MATERIAL EXPERIENTIAL FAIL.", gh("FrameMatter-Lab", S["framematter"], "docs/convergence/CURRENT.md", 11)],
         ["Combat", "No new research specimen has been accepted by the Owner.", gh("Combat-Lab", S["combat"], "docs/RESEARCH_STATE.md", 6)],
     ]},
    {"title": "Żywy Git i CI są ważniejsze niż dokument",
     "quotes": [
         ["FrameMatter", "If live repository/CI evidence contradicts this file, live evidence wins.", gh("FrameMatter-Lab", S["framematter"], "docs/convergence/CURRENT.md", 7)],
         ["Box3D CC", "Before any future write, re-fetch live main, exact SHA and relevant CI/Pages.", gh("Box3d-Character-Controler", S["b3cc"], "docs/PROJECT_STATE.md", 5)],
     ]},
    {"title": "Eksperymenty to dowody, nie architektura",
     "quotes": [
         ["Jozzue", "Research repository for the next generation of Jozz Vehicle. Experiments are evidence, not architecture.", gh("Jozzue_Vehicles_Sandbox", S["jozzue"], "README.md", 3)],
         ["ReflexBrain", "Persistent Playground v1 is Owner evidence … Its architecture is not privileged.", gh("ReflexBrain-Lab", S["reflex"], "README.md", 26)],
         ["ANVIL", "Research vocabulary … is not a frozen ontology.", gh("PROJECT-ANVIL-Machine-Matter-Physical-Fabric-Laboratory", S["anvil"], "README.md", 11)],
     ]},
    {"title": "Dawcy dają ograniczone własności, nie całe architektury",
     "quotes": [
         ["Combat", "Character Controller and Companion provide bounded donor properties only; neither architecture is imported wholesale.", gh("Combat-Lab", S["combat"], "docs/RESEARCH_STATE.md", 156)],
         ["Box3D CC", "Preserve it as a gameplay/evidence donor, not the current architecture.", gh("Box3d-Character-Controler", S["b3cc"], "docs/PROJECT_STATE.md", 83, 128)],
     ]},
    {"title": "Historia zostaje jako dowód, nie jako władza",
     "quotes": [
         ["Companion", "Historical plans, deleted branch names, closed PRs and old handoffs remain evidence, but they do not outrank this file.", gh("Companion-Brain-Lab", S["companion"], "docs/CURRENT.md", 8)],
         ["ReflexBrain", "PR #5 is preserved as the 2026-10-05 hypothesis specimen. It is not current implementation authority.", gh("ReflexBrain-Lab", S["reflex"], "docs/PRE_O0_CAMPAIGN_CURRENT_STATE_2026-10-06.md", 13)],
         ["Combat", "archive/forensic-pre-cleanroom-2026-10-06 — forensic reachability only.", gh("Combat-Lab", S["combat"], "docs/RESEARCH_STATE.md", 21)],
     ]},
    {"title": "Nie zabieraj sobie wglądu w przyczyny",
     "quotes": [
         ["Companion", "Participant-first interpretation is a sequencing technique, not permission to remove Owner observability.", gh("Companion-Brain-Lab", S["companion"], "docs/CURRENT.md", 169)],
         ["Combat", "… weak Owner-facing causal access were presented after weeks of work as though l…", gh("Combat-Lab", S["combat"], "docs/FAILURE_SCAR_2026-10-06.md", 15)],
     ]},
]

LESSONS = [
    {"id": "E17", "title": "Najpierw intencja, potem skończone wykonanie",
     "from": "Box3d-Character-Controler", "to": ["Combat-Lab"],
     "positive": "Jedna zdolność („chwyć i spróbuj”) dała całą rodzinę czasowników: podnieś, przeciągnij, rzuć, podważ, ułóż.",
     "negative": "Oscylacje, przestrzały, słaba precyzja; chwyt poza środkiem kręci obiektem.",
     "source": gh("Box3d-Character-Controler", S["b3cc"], "docs/PROJECT_STATE.md", 83, 128),
     "effect": "Combat zmierzył chwyt na Rapierze i odkrył, że domyślne hamowanie prawie ukrywało reakcję ciała. W efekcie hamowanie zwykłe i hamowanie przy chwycie stały się osobnymi ustawieniami.",
     "effect_links": [["kod Combat, L269–271", gh("Combat-Lab", S["combat_exp"], "src/pressure-probe.js", 269, 271)], ["workpiece", I7 + "6070058142"]],
     "route": "Natywnie. Combat znał E17 z własnego BODY_WORLD (7.10), a negatywną połowę doczytał u dawcy. Drzwi w Medium powstały minutę przed użyciem, więc były zapisem, nie odkryciem.",
     "route_links": [["BODY_WORLD L59", gh("Combat-Lab", S["combat"], "docs/BODY_WORLD_SUBSTRATE_AND_SPECIMEN_2026-10-07.md", 59)], ["C15", I7 + "6070168610"]]},
    {"id": "Stage-B", "title": "Nie zabieraj Ownerowi warsztatu przyczyn",
     "from": "Companion-Brain-Lab", "to": ["Combat-Lab"],
     "positive": "Mechanizm Stage B działa wąsko: zmienia tożsamość akcji, a świat zapisuje fakty o skutkach.",
     "negative": "Ocena Ownera: regres. Czerwone i zielone kółka, brak sterowania i ukryty warsztat debugowania.",
     "source": gh("Companion-Brain-Lab", S["companion"], "docs/CURRENT.md", 132, 184),
     "effect": "Combat utrzymuje łańcuch obserwacji (intencja → impuls → przemieszczenie → kontakt) widoczny dla Ciebie.",
     "effect_links": [["workpiece", I7 + "6070058142"]],
     "route": "Natywnie w ogólnym sensie: Combat wymieniał Companion jako dawcę. Konkretną lekcję zapisano w Medium o 22:07, już po pierwszych commitach obserwacji.",
     "route_links": [["RESEARCH_STATE L156", gh("Combat-Lab", S["combat"], "docs/RESEARCH_STATE.md", 156)], ["C15", I7 + "6070168610"]]},
    {"id": "B01c", "title": "Geometria to nie zdolność aktora",
     "from": "ReflexBrain-Lab", "to": ["Combat-Lab"],
     "positive": "Ruchoma przeszkoda w drzwiach to fakt świata. To, co ciało potrafi z nią zrobić, to osobna prawda.",
     "negative": "Fałszywe było twierdzenie, że geometryczne „zablokowane” oznacza „aktor nie przejdzie”. Aktor przeszedł oba warianty.",
     "source": gh("ReflexBrain-Lab", S["reflex"], "docs/PRE_O0_CAMPAIGN_CURRENT_STATE_2026-10-06.md", 800, 845),
     "effect": "Mieszkaniec w Combat wraca po dotyku, a nie po wyroczni świata. Wyłączenie lokalnego dotyku usuwa odwrót bez zmiany kolizji.",
     "effect_links": [["gałąź eksperymentu", f"{GH}/Combat-Lab/tree/{S['combat_resident']}"], ["odpowiedź Combat", I7 + "6070286029"]],
     "route": "Nieznana. W kodzie ani dokumentach Combatu nie ma cytatu, a drzwi w Medium są późniejsze niż pierwszy commit odbiorcy.",
     "route_links": [["runda 3", I7 + "6070316892"]]},
]

METHODS = [
    {"title": "Cztery klasy szumu w gałęziach",
     "text": "Aliasy (kilka nazw na jednym commicie), świadkowie CI (pusty commit tylko dla uruchomienia CI), zastąpione dowody pośrednie i prawdziwe rozgałęzienia. Tylko ostatnich nie wolno spłaszczać.",
     "origin": "Twoja analiza z GPT (JURE), na razie nieruszana"},
    {"title": "Każdy ref ma dwie wartości",
     "text": "Pierwsza to osiągalność commita, druga to znaczenie nazwy. PR-y często przechowują to znaczenie lepiej niż sama nazwa gałęzi.",
     "origin": "tamże"},
]

CASES = [
    ["C1", "Drzwi frontowe nieaktualne, a żywy autorytet siedzi na gałęzi", "front", f"{GH}/Shared-Work-Medium-Lab/pull/10"],
    ["C2", "Run #34 jest na gałęzi, a kanon kończy się na #33", "front", f"{GH}/Shared-Work-Medium-Lab/blob/main/docs/RESEARCH_STATE.md"],
    ["C3", "„Dwa aktywne pasy” kontra „MP-1 uśpione”: data nie widzi sprzeczności", "czas", f"{GH}/Shared-Work-Medium-Lab/pull/15"],
    ["C4", "Combat: README mówi „brak frontu”, choć front wybrano", "czas", I7 + "6069338127"],
    ["C5", "Zielone CI przy naukowym FAIL", "dowód", f"{GH}/Shared-Work-Medium-Lab/pull/12"],
    ["C6", "Najnowsza gałąź myli drogę (LLM Live NPC, Medium)", "front", I7 + "6069787741"],
    ["C7", "Świat widać, ale płótno nie jest celem akcji dla agenta", "ciała", f"{GH}/Shared-Work-Medium-Lab/pull/13"],
    ["C8", "JURE: cztery refy checkpoint na jednym SHA 7b385e8", "gałęzie", f"{GH}/Jozzpoly/Jozz-Universal-Rig-Editor/branches".replace(f"{GH}/Jozzpoly", GH)],
    ["C9", "Drzwi Feniksa przypięte do epizodu i czytane jak teraźniejszość", "czas", I7 + "6068870252"],
    ["C10", "Pokrycie to nie brak: Kataster widział 24 z 26 repo", "pokrycie", I7 + "6069939840"],
    ["C11", "Ta sama treść, inna relacja: nadpisane deklaracje", "pochodzenie", f"{GH}/Shared-Work-Medium-Lab/pull/14"],
    ["C12", "Każde ciało ma inne uprawnienia, nawet przy tych samych linkach", "ciała", I7 + "6069939840"],
    ["C13", "Ograniczona pozytywna praca między projektami", "pochodzenie", I7 + "6069338127"],
    ["C14", "Dwa czasy wejścia: historyczny świat kontra żywe drzwi", "czas", I7 + "6070022039"],
    ["C15", "Dawcy w Combacie: efekt prawdziwy, droga natywna", "pochodzenie", I7 + "6070168610"],
    ["C16", "Zrzut Biblioteki liczył 26 z 26, a od 10:40 było już 27. repo: lista pochodziła z 01:00", "pokrycie",
     f"{GH}/Cognitive-Ecology-Lab/commit/7ea11e0fd7976b0bc378e6386ece172cde241349"],
]

LEDGER = [  # UTC ISO
    ["2026-10-08T20:47:35Z", "GPT ↔ Codex", "Codzienne tarcie w Medium i jeden mały przepływ Owner ↔ agent", I7 + "6068758020"],
    ["2026-10-08T20:59:57Z", "Codex", "PR #15 scalony: jedno źródło stanu, historia przeniesiona do archiwum", f"{GH}/Shared-Work-Medium-Lab/pull/15"],
    ["2026-10-08T21:24:36Z", "Combat", "Combat Lab → Medium: odzyskanie źródeł między projektami", I7 + "6069338127"],
    ["2026-10-08T21:55:12Z", "GPT", "Korekta Katastru: najnowsza gałąź myli, 24 z 26, nadużyte „do usunięcia”", I7 + "6069787741"],
    ["2026-10-08T22:02:39Z", "Claude", "Co przyjmuję i gdzie się spieram: korpus przypadków, metoda bez budowania", I7 + "6069900699"],
    ["2026-10-08T22:05:01Z", "GPT", "Druga runda: nie generator E0, liczy się tworzenie nowych możliwości", I7 + "6069939840"],
    ["2026-10-08T22:07:23Z", "Agent_Slack", "Wspólna tożsamość nadawcy i ryzyko edycji cudzych wiadomości", I7 + "6069975574"],
    ["2026-10-08T22:10:08Z", "GPT", "C14: historyczny świat kontra żywe drzwi", I7 + "6070022039"],
    ["2026-10-08T22:12:16Z", "Combat", "Dawcy E17 i Companion zmienili prawdziwy eksperyment", I7 + "6070058142"],
    ["2026-10-08T22:18:54Z", "GPT", "C15: chronologia commitów i brak dowodu wkładu Medium", I7 + "6070168610"],
    ["2026-10-08T22:26:23Z", "Combat", "Przyjęcie C15 i nowy dawca: ReflexBrain B01c", I7 + "6070286029"],
    ["2026-10-08T22:28:12Z", "Claude", "Runda 3: zapis i późniejszy odczyt, Memento, propozycja zbieżności", I7 + "6070316892"],
    ["2026-10-08T22:32:03Z", "GPT", "Cztery poprawki: QP jako punkt startu, trzy pytania, sens jako hipoteza, liczenie potwierdzeń", I7 + "6070375988"],
    ["2026-10-08T22:33:33Z", "Claude", "Zamknięcie fazy projektowej i decyzje dla Ciebie", I7 + "6070395574"],
    ["2026-10-08T22:34:02Z", "Agent_Slack", "Reguła zaufania: nieodwracalne decyzje tylko bezpośrednio od Ciebie", I7 + "6070401909"],
    ["2026-10-09T15:13:00Z", "Claude", "Sprawdzenie na żywo po pierwszej publikacji: na koncie jest 27. repo (Cognitive Ecology Lab), którego zrzut nie znał. Zrzut odświeżony, przypadek zapisany jako C16.",
     f"{GH}/Cognitive-Ecology-Lab"],
    ["2026-10-09T19:53:10Z", "Cognitive Ecology", "Werdykt Ownera FAIL zapisany w samym repo: laboratorium zakończone, strona wycofana z Pages, prośba o usunięcie repozytorium. Usunąć może tylko Owner.",
     f"{GH}/Cognitive-Ecology-Lab/commit/37eee3e2659d5d9940b00aec7c05fca55769febb"],
    ["2026-10-10T01:30:00Z", "Claude", "Biblioteka v2: Kataster wewnątrz, ustalenia liczone regułami przy każdym zrzucie, stan cytowany z samych repo, zmiany od poprzedniego zrzutu. Twoje decyzje to jedyna pisana warstwa. Generator: jedna komenda, gotowy do przeniesienia na Cloudflare.", None],
]

OPEN = [
    "Feniks jako całość nie ma jednego repo. Studio ma swoje (Feniks-Studio: badania i plan, bez aplikacji), a reszta dokumentacji i biblioteka donorów leżą lokalnie, poza zasięgiem tej Biblioteki: widzi ona tylko GitHub.",
    "Mapy JURE z Twojej rozmowy z GPT nie ruszamy na razie.",
    "Wspólne konto we wszystkich kanałach: dowodem jest diff i odczyt źródła, nie podpis wiadomości.",
    "Wkład Medium w odkrycie nie jest jeszcze wykazany. Do sprawdzenia: późniejszy czytelnik i ramię bez biblioteki.",
]

# The owner's private layer: private repositories and his own words. Kept out of public repositories.
PRIVATE = os.environ.get("BIB_PRIVATE") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "private", "knowledge_private.json")
if os.environ.get("BIB_PUBLIC") != "1" and os.path.exists(PRIVATE):
    P = json.load(open(PRIVATE, encoding="utf-8"))
    for f in FAMILIES:
        f["repos"] = P["family_repos"].get(f["id"], f["repos"])
    SHORT.update(P["short"])
    IDENTITY.update(P["identity"])
    STATED.update(P["stated"])
    ESTATE_STATED = P["estate_stated"] + ESTATE_STATED
    PROLOG = P["prolog"]
    for x in P["dna_insert"]:
        next(d for d in DNA if d["title"] == x["title"])["quotes"].insert(x["index"], x["quote"])
    LEDGER = sorted(LEDGER + [[l["t"], l["who"], l["what"], l["url"]] for l in P["ledger"]], key=lambda l: l[0])
    print("knowledge: private layer merged from", os.path.relpath(PRIVATE))
else:
    print("knowledge: public layer only")

json.dump({"families": FAMILIES, "short": SHORT, "identity": IDENTITY, "stated": STATED, "estate_stated": ESTATE_STATED,
           "prolog": PROLOG, "laws": LAWS, "dna": DNA, "lessons": LESSONS, "methods": METHODS,
           "cases": [{"id": c[0], "title": c[1], "kind": c[2], "url": c[3]} for c in CASES],
           "ledger": [{"t": l[0], "who": l[1], "what": l[2], "url": l[3]} for l in LEDGER],
           "open": OPEN, "account": ACCOUNT}, open(OUT, "w"), ensure_ascii=False, indent=1)
print("knowledge ->", OUT)
