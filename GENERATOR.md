# Biblioteka Jozzpoly: generator

Jedna komenda odtwarza całą Bibliotekę z samych repozytoriów:

```
python3 -I tools/regen.py
```

Lista repo → klonowanie brakujących i `fetch` wszystkich → zbieranie z gita i z API GitHuba → reguły ustaleń → strona → samokontrola. Około 30 sekund dla 27 repo. Generator tylko czyta: niczego nie pushuje, nie kasuje gałęzi ani repo.

## Co jest generowane, a co pisane

| Warstwa | Skąd się bierze | Kiedy się zmienia |
|---|---|---|
| Fakty: commity, gałęzie, PR-y, CI, pliki | git i API GitHuba | przy każdym uruchomieniu |
| Życie repo (żywe, stygnące, uśpione, wstrzymane, zakończone, puste) | data ostatniego commita + faza zapisana w notatce stanu repo | przy każdym uruchomieniu |
| Ustalenia z wagą (poważne, średnie, drobne, info) | reguły w `tools/findings.py` | przy każdym uruchomieniu |
| „Stan według repo” | cytat z własnego pliku repo (STATE, CURRENT, PROJECT_STATE…), bez parafrazy | gdy repo zmieni swoją notatkę |
| Zmiany od poprzedniego zrzutu | różnica względem `data/prev_library.json` | przy każdym uruchomieniu |
| Rodziny i zdania „po co to jest” | `tools/knowledge.py`: hipotezy Claude, oznaczone na stronie | ręcznie, rzadko |
| Prawa, lekcje, przypadki, dziennik | `tools/knowledge.py`: datowany zapis | ręcznie |
| Decyzje Ownera (sens, ustalenia) | baza artefaktu claude.ai, kolekcje `sens` i `decyzje` | tylko Owner, na stronie |

Zasada: fakty liczy maszyna, sens proponuje agent, rozstrzyga Owner. Jedyna warstwa pisana ręcznie to `knowledge.py`, i wszystko, co z niej pochodzi, strona podpisuje jako hipotezę albo datowany zapis.

## Wymagania

- Python 3.11+, git, `gh` (GitHub CLI, zalogowany), Node 18+.
- `npm install`: fonty wbudowywane w stronę. Playwright tylko dla `--shoot`.
- Klony w `../repos` obok tego folderu albo w `BIB_REPOS`.

## Przełączniki

| | |
|---|---|
| `--list gh` | lista repo z API GitHuba zamiast z `data/connector_repos.json` (token musi widzieć prywatne repo) |
| `--no-fetch` | przebuduj z klonów, które już są na dysku |
| `--since PLIK` | porównaj ze starszym `library.json` zamiast z poprzednim uruchomieniem |
| `--host web` | tylko strona do własnego hostingu (domyślnie powstają obie) |
| `--shoot` | otwórz stronę w Chromium i przerwij przy błędach w konsoli |

Zmienne: `BIB_REPOS` (gdzie są klony), `BIB_GIT_TOKEN` (token do klonowania prywatnych repo poza Claude), `GH_TOKEN` (dla `gh`).

Kody wyjścia: `0` pełne pokrycie, `2` jakieś repo z listy nie dało się odczytać (strona powstaje i mówi to wprost), `1` krok się nie udał.

## Wyjście

- `dist/biblioteka.html`: strona dla artefaktu claude.ai. Gry otwierają się w nowej karcie, bo claude.ai blokuje ramki innych stron.
- `dist/biblioteka-web.html`: ta sama strona do własnego hostingu. Gry uruchamiają się wewnątrz strony, w odtwarzaczu z pełnym ekranem.
- `dist/biblioteka-data.json`: pełne dane. `dist/biblioteka-dla-agentow.md`: brief tekstowy dla agentów.
- `data/history.json`: skrót każdego zrzutu (commity, gałęzie, życie, ustalenia), pod przyszłe „od wczoraj” i „od Twojej ostatniej wizyty”.

## Jaskinia: te same panele w oknach, które Owner układa sam

```
python3 tools/render.py --app jaskinia            # dist/jaskinia.html (artefakt claude.ai)
python3 tools/render.py --app jaskinia --host web # dist/jaskinia-web.html (własny hosting: gry w oknie)
node tools/jk_test.mjs                            # 52 sprawdzenia okien i gestów (Chromium 1918×1030)
node tools/jk2_test.mjs                           # 76 sprawdzeń v2: zapis, notatki, kosz, kopie, import, ściana, okresy statystyk, telefon
node tools/jk2_chaos.mjs 400 7                    # niszczenie: setki losowych kroków na biurku i telefonie, niezmienniki, reload = ten sam stan
node tools/jk2_smoke.mjs; node tools/jk2_look.mjs # zrzuty ekranu do obejrzenia (shots/jk2, shots/jk2look)
```

Źródła: `src/jaskinia/` w kolejności nazw plików, sklejane w jedną funkcję po `src/app.js`:

| plik | co |
|---|---|
| `00-base.js` | preferencje urządzenia (`jaskinia:prefs`), `t()` i `tn()` (język), ikony |
| `05-i18n.js` | angielski obok polskiego źródła (klucz = polskie zdanie; tablica = liczba pojedyncza/mnoga) |
| `10-model.js` | model układu (drzewo podziałów, pływające okna), czysty |
| `15-store.js` | zapis: `jaskinia:v2`, kopie `jaskinia:kopie`, schowek ratunkowy `jaskinia:ratunek`, migracja z `jaskinia:v1` (stary klucz zostaje nietknięty) |
| `20-stats.js` | statystyki ze zrzutu (dzień 0 = dzień zrzutu); wykres przechodzi na tygodnie/miesiące, gdy słupek ma < 3 px; „od początku” = od początku ciągłej pracy (`workStart`), „od konta” = od założenia konta (`ACCOUNT` w `tools/knowledge.py`) |
| `30-wall.js` | ściana: współrzędne świata, kamera w `store.views` (poza cofaniem), semantyczny zoom, ramki, notatki |
| `40-types.js` | typy okien |
| `45-settings.js` | motywy (`data-jk`, `data-life`, `data-density`), okno Ustawień, eksport/import |
| `50-shell.js` | powłoka: zakładki, okna, gesty, menu, telefon (jedno okno + dok), kosz, reset, toasty z „Cofnij” |

Zasady, których pilnuje kod (i testy):
- Nic nie znika po cichu. Zły układ trafia do kosza (`broken`), reszta działa; nieczytelny zapis idzie do schowka ratunkowego, Jaskinia wczytuje ostatnią kopię i mówi o tym banerem.
- Tekst notatek żyje w `store.notes`, nie w układzie: Ctrl+Z układu nigdy nie cofa pisania. Okno notatek trzyma tylko `st.note` (id).
- Usuwanie idzie do kosza; „Usuń na zawsze” tylko z kosza, za czerwonym przyciskiem i po kopii automatycznej.
- Reset, import, wczytanie całości i usuwanie na zawsze robią kopię najpierw (`makeBackup`), toast daje „Cofnij”.
- Ściana nigdy sama nie przestawia kart. Układanie jest tylko na żądanie (Ułóż…) i jest jednym krokiem cofania.
- Kolory życia liczone względem chwili zrzutu (`heatOf` w trybie Jaskini): stary zrzut nie udaje, że projekty umarły. Czerwień tylko dla tego, co wymaga uwagi.
- „Od początku” nie zaczyna się od pierwszego lepszego commita: cienki wstęp (mniej niż 10% commitów przed ciszą dłuższą niż 60 dni) jest pomijany i nazwany na krawędzi wykresu; pełna historia to zakres „od konta” (Owner, 14.10).

Biblioteka (`src/app.js`) działa w Jaskini po fladze `BIB_MODE = "jaskinia"`: wtedy nie rysuje własnych stron, tylko oddaje panele przez `window.__BIB`, a linki do repo zaznaczają projekt zamiast przechodzić. Jej panele są po polsku także wtedy, gdy interfejs Jaskini jest po angielsku.

## Prywatność: twarde reguły

Projekt jest publiczny, instancja prywatna (decyzja z 16.10.2026, repo `Jozzpoly/Jozz-Cave-Workbench`).

- Prywatna warstwa to prywatne repo i Twoje słowa z rozmów (prolog, cytaty, „Twoje słowa” przy projektach, wpisy „Ty” w dzienniku). Leży w `private/knowledge_private.json`. `tools/knowledge.py` dokleja ją, kiedy plik istnieje. `BIB_PUBLIC=1` buduje bez niej.
- Pełny zrzut (wszystkie 29 repo) i strony z niego zbudowane są tylko lokalnie i w prywatnym artefakcie. Do publicznego repo trafia wyłącznie kopia z `python3 -I tools/public_copy.py DEST`: kod, narzędzia, testy, dokumenty i dane publicznych repo. Kopia jest przebudowana od zera i przeszukana pod kątem nazw prywatnych repo i zdań z prywatnej warstwy; każdy ślad zatrzymuje publikację.
- Nagrania ekranu i klatki z nich nie trafiają do publicznego repo (widać na nich cały ekran: karty, czaty, powiadomienia).
- Na Cloudflare pełna wersja tylko za Cloudflare Access (logowanie, e-mail Ownera). Publiczna strona (np. GitHub Pages) może pokazywać tylko kopię publiczną.
- Token tylko do odczytu (fine-grained: Contents, Metadata, Pull requests, Actions), trzymany w sekretach, nigdy w kodzie.

## Szkic pod Cloudflare (na później, z GPT)

1. Kod: publiczne `Jozzpoly/Jozz-Cave-Workbench`. Instancja (prywatna warstwa i pełny zrzut): osobne prywatne repo, np. `Jozzpoly/Jozz-Cave-Private`.
2. GitHub Actions co godzinę: `python3 -I tools/regen.py --list gh --host web` z sekretami `GH_TOKEN` i `BIB_GIT_TOKEN`.
3. Wdrożenie: `npx wrangler pages deploy` z `dist/biblioteka-web.html` jako `index.html` (sekret `CLOUDFLARE_API_TOKEN`).
4. Cloudflare Access na całą domenę, polityka: e-mail Ownera.
5. Gry w ramce: działa, jeśli strona gry nie zabrania osadzania (GitHub Pages domyślnie nie zabrania). Ramka dostaje `allow` dla pełnego ekranu, WebXR, gamepada i dźwięku.
6. Decyzje Ownera żyją dziś w bazie artefaktu claude.ai. Wersja na Cloudflare potrzebuje własnego magazynu (Workers KV albo D1 i mały Worker) albo eksportu z artefaktu. Do rozstrzygnięcia.
7. Artefakt claude.ai może zostać widokiem z Claude (pytania, decyzje). Odświeża go sesja Claude uruchamiająca ten sam generator.

## Reguły ustaleń (`tools/findings.py`)

| Reguła | Waga | Kiedy |
|---|---|---|
| `stan-zakonczone` | poważne, gdy repo prosi o usunięcie | notatka stanu mówi TERMINATED, ABANDONED, ZAKOŃCZONE… |
| `praca-poza-main` | poważne lub średnie (niżej, gdy dokumenty wskazują gałąź) | gałąź domyślna stoi ponad 7 dni dłużej niż najświeższa gałąź; najświeższa nie musi być frontem |
| `readme-obce` | poważne | README na gałęzi domyślnej to README cudzego silnika |
| `wiele-galezi` | poważne / średnie / drobne | ≥12 gałęzi, z czego ≥6 starych i niewchłoniętych |
| `wiele-wejsc` | średnie | ≥4 dokumenty wejścia na gałęzi domyślnej |
| `main-bez-kodu` | średnie albo info, gdy README to wyjaśnia | brak kodu na gałęzi domyślnej |
| `wchloniete` | średnie / drobne | ≥3 gałęzie w całości w gałęzi domyślnej: usunięcie nie straci commitów, ale nazwa może nieść znaczenie |
| `ci-czerwone`, `duze-pliki`, `brak-readme` | średnie | jak w nazwie |
| `aliasy`, `puste-czubki`, `szkice-pr`, `dokumenty-vs-kod`, `datowane-dokumenty`, `brak-opisu`, `smieci`, `nazwa`, `notatka-starsza` | drobne | jak w nazwie |
| `stan-wstrzymane`, `puste` | info | jak w nazwie |

Ustalenie ma stały identyfikator `repo:reguła`. Decyzja Ownera zapamiętuje liczby z chwili decyzji; gdy się zmienią, strona pokazuje co i o ile.

## Nowe repo

Repo, którego nie ma w `FAMILIES` w `tools/knowledge.py`, trafia do generowanej rodziny „Bez rodziny” i nie ma zdania „po co”. Strona pokazuje je od razu; przypisanie to propozycja do decyzji Ownera.
