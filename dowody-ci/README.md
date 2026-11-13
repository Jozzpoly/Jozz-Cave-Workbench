# Dowody CI uratowane przed wygaśnięciem

Ta gałąź istnieje z jednego powodu: **artefakty CI wygasają, a git nie.**

GitHub usuwa artefakty przebiegów po ustawionym czasie (tu: od 7 do 30 dni, zależnie od
repozytorium). Dopóki jedyną kopią zrzutu, zbudowanej strony albo świadka JSON jest artefakt,
dowód ma datę śmierci — a jedyną drogą ratunku jest pobranie go na czyjś dysk. To jest złe
z dwóch powodów: wymaga, żeby ktoś w ogóle zauważył termin, i przenosi trwałość na komputer,
który nie jest magazynem.

Zasada, która z tego wynika i którą wpisujemy na przyszłość:

> **Dowód, który wymaga czyjegoś dysku, nie jest dowodem.**
> Jeśli workflow wypuszcza coś, co ma znaczyć, to musi to trafić do gita (albo dać się
> odtworzyć jednym udokumentowanym poleceniem). Artefakt CI jest wygodą na kilka dni,
> nie miejscem przechowywania.

## Co tu leży

Zawartość artefaktów pobranych 13 XI 2026, zanim wygasły, bez żadnej zmiany treści.
Każdy artefakt w osobnym katalogu, nazwy przebiegów zachowane, żeby dało się wrócić do
źródła przez `gh api repos/<repo>/actions/runs/<id>`.

Pliki `.html` w tych katalogach są samodzielne: zero zewnętrznych odwołań, `canvas`,
obsługa klawiatury, pętla animacji. **Otwierają się z dwukliku.**

## Czego tu nie ma

Nie ma tu dokumentów, które i tak były bezpieczne na gałęziach eksperymentów — git je trzyma
i nie trzeba ich dublować. Zagrożone były wyłącznie rzeczy generowane: zrzuty, zbudowane
strony i świadkowie JSON z katalogów `.build/`.

Czystszą formą długoterminową byłby wydany tag albo release z załącznikami, bo nie obciąża
historii repozytorium. To jest jednak publikacja, a publikacja należy do właściciela — dlatego
tutaj jest gałąź, którą da się usunąć jednym poleceniem, a nie release.
