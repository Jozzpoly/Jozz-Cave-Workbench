# Nagrania z 16.10.2026: jak je przyjmuję

Dla Jozza i GPT. Runda pięciu nagrań (16 min 24 s, ok. 500 MB) z Jaskinią v2 (artefakt z 14.10, „zrzut 14 paź, 08:21”).

## Protokół, który przyjmuję

Ustaliliście go z GPT 16.10 i zgadzam się z nim w całości:

1. **Dwie niezależne recenzje:** GPT (Browser) i Claude (Opus). Każda ma swoje krytyczne zdanie: mocne i słabe strony, hipotezy, rzeczy niewiadome.
2. **Porównanie:** gdzie się zgadzamy, gdzie się różnimy, czego każdy nie zauważył. Spory rozstrzygamy na wideo i w kodzie, nie siłą przekonania.
3. **Feedback Ownera na końcu,** jako ostatni, niezależny recenzent. Nie zanieczyszcza wcześniejszych analiz.

## Co do mnie wysłać

- **Pięć oryginalnych MP4, jako załączniki w tej rozmowie z Claude'em.** Ostatnio cztery pliki, razem 414 MB, przeszły bez problemu. Gdyby któryś się nie zmieścił, skompresuj go tak, żeby tekst interfejsu został czytelny:
  `ffmpeg -i 03_PC.mp4 -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 96k 03_PC-maly.mp4`
- **Neutralny zestaw źródeł od GPT** (indeks klatek z czasem źródłowym PTS, SHA-256, przeglądarka). Narzędzie do wycinania klipów też się przyda.
- **Same fakty o każdym nagraniu,** jeśli je masz: urządzenie, przeglądarka, rozmiar okna i zoom, czy Jaskinia startowała świeżo, czy z Twoimi układami. Wersję rozpoznam sam z ekranu i z czasu nagrania ([VERSIONS.md](../VERSIONS.md)).
- **Na razie nie wysyłajcie:** recenzji GPT (D1, D2) ani Twojej oceny. Najpierw oddam swoją.

Wspólne odniesienia: nagrania nazywam tak jak GPT (`01_PC` … `05_MOBILE`). Czas liczę od początku filmu według znaczników klatek (PTS), w formacie mm:ss.ss. Tego samego używa mój skrypt `tools/feedback/keyframes.py`: klatka `03_PC_01m08.47s.jpg` to dokładnie ta chwila filmu, a jej metadane (źródło, SHA-256, czas żądany i rzeczywisty) siedzą w samym pliku JPEG.

Nagrania i klatki nie trafiają do publicznego repo. Widać na nich cały ekran.

## Co zrobię

1. **Obejrzę wszystko sam.** Klatki tam, gdzie obraz się zmienia, jedna co kilka sekund dla ciągłości i gęsto (co 0,1 s) wokół gestów, które trzeba zobaczyć klatka po klatce.
2. **Napiszę recenzję C1:** chronologię każdego nagrania, obserwacje z czasem, mocne i słabe strony, hipotezy o przyczynach (sprawdzone w kodzie i testem tam, gdzie się da) oraz to, czego z nagrania nie da się ustalić. Osobno spostrzeżenia o produkcie: czym Jaskinia jest, a czym jeszcze nie.
3. **Zaznaczę możliwe zakotwiczenie.** Zanim powstał ten protokół, w Waszej rozmowie w Operze widziałem kilka wstępnych spostrzeżeń GPT: niejednoznaczna czerwień w palecie „Żar”, pusta siatka Ściany na telefonie, gęste układy małych okien, dane wyglądające na bardziej aktualne, niż są. Przy każdej mojej uwadze w tych miejscach napiszę, że mogłem je znać.
4. **Dopiero po oddaniu C1 przeczytam D1 i D2** i napiszę porównanie: zgodne, sprzeczne, przeoczone. Rozbieżności sprawdzę ponownie na wideo.
5. **Po Twoim feedbacku:** plan i poprawki z dowodem (test, zrzut przed i po, numer wersji). Najpierw to, co niszczy zaufanie i gesty, potem braki, na końcu polerka.

## Na następną rundę (od v4)

Jaskinia v4 ma to już w sobie:
- **Numer wersji** stoi obok nazwy w górnym pasku.
- **Uwaga przypięta do chwili:** chorągiewka u góry albo Ctrl+. (na telefonie: menu pod logo). Zapisuje godzinę co do sekundy, układ, okno, projekt i ekran.
- **„Paczka dla Claude'a”** (Ustawienia → Uwagi i paczka) to wersja, urządzenie, ustawienia, układy, uwagi i dziennik ostatnich ruchów z godzinami. Jest jako plik albo jako tekst do wklejenia w rozmowę.

Najtańsza runda wygląda tak:
1. Nagraj ekran.
2. W trakcie wciśnij chorągiewkę, kiedy coś uwiera albo cieszy.
3. Na końcu wyślij nagranie i paczkę.

Czas z dziennika i czas nagrania zestawia się sekunda po sekundzie, bez godzin cięcia klatek.

Runda 15–16.10: moja recenzja C1 jest prywatna (opisuje Twój ekran). Co z niej wynikło dla produktu, opisuje [2026-10-16-v4.md](2026-10-16-v4.md).
