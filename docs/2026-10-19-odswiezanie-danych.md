# Automatyczne odświeżanie danych: myśl, nie decyzja (19.10.2026)

Dziesiąta uwaga Jozza do v6 (w skrócie, jego słowa zostają prywatne): pora pomyśleć o automatycznym odświeżaniu commitów, ale jeszcze tego nie budować, tylko najpierw uzgodnić z pozostałymi agentami. Tu jest tylko materiał do tej rozmowy. Nic z tego nie jest zbudowane.

## Dziś

- Zrzut robi agent w swojej sesji jedną komendą: `python3 -I tools/regen.py` (19.10: 31 repo w około 40 s).
- Zrzut prywatny (z prywatnymi repo i słowami Jozza) trafia do artefaktu. Publiczny (24, a od 19.10 26 publicznych repo) trafia do repo i na Pages.
- Pages odświeża się tylko wtedy, gdy ktoś zbuduje i opublikuje nową wersję.
- Wejście do gry zgadnięte z nazwy repo bywa martwe (Tysiąc). Sprawdzone adresy są w `data/wejscia.json`.

## Drogi

| Droga | Co daje | Koszt i ryzyko |
|---|---|---|
| **A. Agent na prośbę** (tak jak dziś) | Zero infrastruktury. Prywatne dane zostają u Jozza. | Dane starzeją się między sesjami. Każdy agent musi pamiętać o regen przed publikacją; tej nocy inna linia poprawiała opublikowaną stronę ręcznie. |
| **B. GitHub Action raz dziennie, tylko publiczne repo** | Publiczny podgląd świeży bez nikogo. | Publiczny deploy bez człowieka, a na to dziś potrzebna jest zgoda Jozza. Prywatnych repo nie widzi. Działa w repo projektu, więc łatwo go zatrzymać. Harmonogram GitHuba uruchamia tylko workflow z gałęzi domyślnej, czyli z `main`, który jest Jozza, i bywa opóźniony (Medium, PR #4). |
| **C. Cloudflare Worker z cronem i tokenem** (linia GPT, „jeden dom”) | Świeże dane także prywatne, osobny origin dla Jaskini. | Token z dostępem do prywatnych repo trzymany w sekretach. Trzeba pilnować kosztów i dostępu. Właściwie to decyzja „jeden dom” (dług 10). |
| **D. Przycisk „Odśwież” w Jaskini** (przeglądarka pyta GitHuba) | Świeżość na żądanie, bez serwera. | Token w przeglądarce Jozza. Limity API. Liczenie historii commitów z samego API jest drogie (dziś robi to `git` na klonach). |

## Co wiem po tej nocy

- **Najwięcej szkody robi nie stary zrzut, tylko stary fakt** (wejście do gry, Pages). Dlatego wejścia są osobnym, ręcznie sprawdzanym plikiem (`data/wejscia.json`) z datą i źródłem. To zostaje przy każdej drodze.
- **Zrzut mówi, jak bardzo jest świeży.** Lista repo ma swoją datę (`data/connector_repos.json`, `checked_at`), dane z API swoją (`gh_collected_ts`), a pokrycie jest w `estate.coverage`. Medium (PR #4) słusznie zauważył, że pełne pokrycie wolno ogłosić dopiero po odświeżeniu samej listy: w pierwszym zrzucie v6.3 lista była jeszcze z 14.10, więc „wszystkie” znaczyło „wszystkie znane”. Odświeżanie danych nie może też przeładowywać otwartej Jaskini (stare karty).
- **Publiczny i prywatny zrzut potrzebują osobnych dróg.** B rozwiązuje publiczny podgląd, ale nie dotyka prywatnej Jaskini Jozza.
- **Najmniejszy uczciwy krok do rozmowy:** B dla publicznego podglądu, tylko na wyraźne „tak” Jozza, plus pasek „zrzut sprzed X dni” (już jest). Prywatny zrzut dalej A, dopóki „jeden dom” (C) nie zostanie postanowiony z linią GPT od infrastruktury.
