# Studio R1 — izolowany eksperyment natywnej integracji Jaskini (10 XI 2026)

Status: **eksperyment, NIE gotowy fundament Studio, NIE produkcja, NIE Owner UX PASS**.

## Hipoteza
Dwa odmienne natywne okna Jaskini mogą pracować na jednym dokumentcie, podczas gdy zamknięcie widoku nie powoduje utraty dokumentu.

W tej gałęzi są dwa nowe skrypty:
- src/jaskinia/59a-studio-r1-model.js — minimalny model autorskiego dokumentu 24×24, transakcyjne pociągnięcie, undo/redo, walidacja.
- src/jaskinia/59b-studio-r1-host.js — rejestracja dwóch typów okien, edycja i podgląd; publiczne API window.Jaskinia.ext.type oraz kontekst ctx.openType / ctx.onDispose.

Istniejący tools/render.py zbiera wszystkie skrypty src/jaskinia/*.js w kolejności nazw. Rejestracja następuje po 58-api.js i przed 90-start.js.

## Próba natywnego uruchomienia
W klonie tej gałęzi z dostępnymi danymi i zależnościami zbuduj istniejącą Jaskinię przez:
    python3 tools/render.py --app jaskinia --host web
Następnie w menu typów okien w grupie Inne wybierz „Studio R1 — obraz”. Przycisk „Otwórz obserwator” powinien otworzyć drugi, rzeczywisty panel Jaskini, który otrzymuje te same rewizje dokumentu. Użyj natywnych gestów Jaskini do dokowania, zmiany proporcji, przeniesienia do innej przestrzeni, zamykania i przywrócenia okien.

## Testy wykonane podczas utworzenia gałęzi
- Lokalny Node: PASS walidacji, niemutowalności, undo/redo, no-op i granic płótna.
- Chromium/Playwright: PASS rejestracji, edycji/obserwacji, zamknięcia i ponownego otwarcia widoku, eksportu/importu, symulowanego recovery, resize i ekranu 390 px. **To był zastępczy host odwzorowujący dokładnie używane publiczne API, nie pełna Jaskinia**.
- Oba pliki JS: node --check PASS.
- Zawartość dwóch skryptów w GitHub porównano z lokalnym egzemplarzem przez liczbę znaków i FNV-1a 32-bit.

## Nieudowodnione / ryzyka
- Brak pełnego uruchomienia skompilowanej Jaskini i jej pełnej regresji jk*; w tej sesji Chromium blokuje nawigację do localhost/file://.
- Brak realnego testu Opery, multi-tab i odzyskania przez zmiany hostingu.
- Osobny zapis lokalny jest tylko technicznym ułatwieniem próby, NIE profesjonalnym magazynem.
- Format 24×24 nie jest formatem Uniwersalnego Studio. Wszystkie dane są syntetyczne; NIE kopiowano prac użytkownika.
- Nie ma wiele dokumentów, osi animacji, assetów, sim ani integracji z grą. To umyślny eksperyment jednego krytycznego szwu.

## Co pozostaje dla Opusa/Astry
Rozróżnić życie dokumentu, widoku i symulacji. Ocenić, czy natywne API Jaskini wystarcza do wielowidokowego autorstwa bez korzystania z prywatnych globali. Nie merge'ować i nie hardkodować kontraktu nowej Jaskini na podstawie R1.

**Kontynuuj** od następnej wartościowej kontrpróby, nie od przeprojektowania wszystkiego ponownie. Wysoki priorytet: skompilować realny host na tej gałęzi, uruchomić e2e na prawdziwej powłoce, odczytać uwagi Opusa, przetestować focus/resize/hidden i dopiero potem rozważać R2.
