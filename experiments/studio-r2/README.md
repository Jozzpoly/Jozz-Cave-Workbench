# Studio R2 — autorskie źródło i żywy świat (eksperyment, 10 XI 2026)

**Status:** oddzielna gałąź badawcza; **NIE łączyć z produkcją**. R2 jest *stacked* na R1 i korzysta z już udowodnionej integracji dwóch natywnych okien starej Jaskini. Nie jest nowym Studio, zamiennikiem Aseprite ani projektem docelowego formatu wszystkich assetów.

## Intencja Ownera

Po nagraniu ręcznego tworzenia animacji ognia Owner wyjaśnił, że **przeglądanie klatek ręcznie, we własnym tempie jest częścią myślenia twórczego**. Chce jednocześnie dodać własnym grafiką i animacjom żywego zachowania w świecie: ogień może pozostać po poruszającym się statku, być wzmacniany i morfowany, a jego źródło nadal można ręcznie rysować. Nie wolno zastępować tych decyzji przymusowym generowaniem.

W R2 sprawdzamy jeden wycinek: **zmiana piksela w klatce źródła zmienia obraz istniejących instancji płomienia, bez resetowania czasu symulacji, ruchu statku, liczby emisji i pozycji cząstek.**

## Co zostało zaimplementowane

- `src/jaskinia/59c-studio-r2-model.js`: czysty, syntetyczny dokument 24×32 (4 klatki, przezroczystość, kolory, osobne czasy), transakcyjne edycje, historia, walidacja; osobny deterministyczny model świata z ruchem statku i emitowanymi instancjami
- `src/jaskinia/59d-studio-r2-host.js`: dwa natywne typy okien `studio-r2-source` i `studio-r2-world`, przez istniejące `window.Jaskinia.ext.type`; nie implementuje własnej powłoki ani nie sięga do prywatnego stanu Jaskini
- **Źródło:** bezpośrednie malowanie, gumka, pipeta (także RMB), szybki wybór klatki, ręczny czas klatki, podgląd żywy albo wybranej klatki, undo/redo, eksport/import JSON; podgląd nie jest zatrzymywany przy zmianie klatki roboczej
- **Świat:** osobna symulacja, automatyczny tor i ręczne przeciąganie statku, pauza/wznowienie, jawne czyszczenie śladu; istniejące cząstki używają bieżących obrazów źródła bez kasowania historii ruchu
- Model dokumentu i symulacja żyją **poza** instancjami widoków. Zamknięcie natywnego okna nie usuwa dokumentu ani symulacji. `sized:false` chroni płótno przed ponownym tworzeniem na zmianie rozmiaru okna
- Izolowany lokalny zapis `jaskinia-studio-r2:source:1`; wykrycie obcego zapisu z drugiej karty blokuje dalsze nadpisywanie (eksport pozostaje dostępny). To nie jest ostateczny magazyn wielokartowy ani mechanizm migracji
- Syntetyczny płomień jest autorskim **fixture testowym agenta**. Żadna prywatna grafika Ownera nie jest w repo.

## Dowody

- `node experiments/studio-r2/tests/model.test.cjs`: walidacja, niezmienność danych, czas klatek, historia, niezależność symulacji od źródła
- `node experiments/studio-r2/tests/native_jaskinia.mjs`: rzeczywista Jaskinia w Chromium, dwa natywne okna, zdarzenia myszy, pauza czasu świata, zmiana źródła, porównanie PNG żywych instancji, kontynuacja świata po przeładowaniu widoku, eksport JSON i odzyskanie zapisanych klatek po reloadzie
- `.github/workflows/studio-r2-native.yml`: odizolowane CI gałęzi, token tylko do odczytu, bez wdrożenia, dowody jako krótkotrwałe artefakty. Bieżący wynik testów należy sprawdzić w Actions — obecność testu nie jest potwierdzeniem PASS.

## Co może obalić hipotezę

- Zmiana źródła przestawia czas świata, resetuje licznik emisji lub usuwa starsze cząstki
- Zmiana układu natywnych okien odtwarza płótno i przerywa gest
- Próba edycji wybranej klatki automatycznie przestawia zegar świata lub zatrzymuje żywy podgląd
- Po zamknięciu okna świata ponowne jego otwarcie tworzy inną symulację
- Eksportowane pliki odtwarzają bitmapy, ale tracą klatki, przezroczystość albo czas
- W pełnej Jaskini skróty klawiaturowe z powłoki kradną autorowi undo albo inne działania
- Drugi, naprawdę odmienny konsument (Coopege / 3D) wymagałby przepisywania modułu grafiki lub hosta

## Co nie jest jeszcze gotowe

- Brak rzeczywistego importu i autoryzowanego odtworzenia starszych prywatnych assetów Ownera, warstw, interaktywnego ustalania pivotów, transformacji, retimingu wielu różnych warstw, efektów warunkowych, pełnego pixel-art editor UX, własnych emitterów per obiekt i rozbudowanych systemów save/recovery
- Edycja klatki i podgląd mają różne zegary, a **globalnego timelinu wielu warstw** jeszcze nie ma
- Styl wizualny to wyłącznie fixture; działanie techniczne **nie oznacza Owner UX PASS**
- `Ctrl+Z` powłoki i niezależne ładowanie organów są nadal otwartymi szwami; nie łatać ich w tym PR modyfikacją produkcyjnego shell
- Rysowanie cząstek korzysta z aktualnej wersji źródła także dla starych instancji. Jest to **świadoma hipoteza R2**, nie jedyna poprawna semantyka: w niektórych grach particle mogą wymagać utrwalenia wariantu *z chwili emisji*
- Nie włączać R2 do głównego Jaskinia i nie udawać, że zalicza uniwersalność (potrzebne domeny Coopege i 3D)

## Następny sensowny ruch

Najpierw ukończyć red/green full-host CI. Następnie przetestować **dwa różne sposoby życia źródła** (źródło aktualne vs snapshot na emisji) z autorskim gestem przełączania, zamiast dodawać kolejne suwaki. Wspólną architekturę z Opusem i Astrą uzgadniać przez ich wymagania hosta i zapisów; eksperyment jest dawcą dowodów, nie nowym standardem.

— Browser GPT / linia Studio, 10 XI 2026
