# Versions of Jaskinia

The owner uses Jaskinia as a private claude.ai artifact, which keeps a history of versions. This table ties each version to what is visible on screen, so that a recording can be matched to the build it shows.

| version | published (UTC) | code | data | how to recognise it on screen |
|---|---|---|---|---|
| v1 (artifact version 1) | 11–13 Oct 2026 | Jaskinia v1 | snapshot of 10 Oct 2026 | top bar says "zrzut 10 paź"; no Settings window; the wall resizes small badges when you try to move them |
| v2 (artifact version 2) | 14 Oct 2026, 13:22:25 | Jaskinia v2 | snapshot of 14 Oct 2026, 08:21 (Warsaw), 29 repositories | top bar says "zrzut 14 paź, 08:21"; the MiniFeniks card shows 0 pull requests and the finding "Brak opisu repo na GitHubie" |
| v3 (artifact version 3) | 14 Oct 2026, 13:32:51 | same as v2 | same snapshot; the GitHub API gaps are marked as unknown | the MiniFeniks card shows "?" for pull requests and CI, with the finding "Ten zrzut nie ma danych z API GitHuba…"; the Cave Workbench card shows its description |
| this repository, first commit `8b14393` | 16 Oct 2026 | same as v3 | the 24 public repositories only, rebuilt with the public knowledge layer | the map and the wall have 24 projects; no owner quotes in the Library history view |
| v4 (artifact version 4) | 16 Oct 2026, 12:28:31 | Jaskinia v4: fixes from the recordings of 15–16 Oct, the feedback loop ([docs/feedback/2026-10-16-v4.md](feedback/2026-10-16-v4.md)) | same snapshot as v2/v3 | the top bar says **v4** next to the name and "zrzut · sprzed N dni"; a flag button "To mnie uwiera" before "Jak to działa"; the Pulse ends in a hatched strip after the snapshot day |

A recording that starts after 14 Oct 2026, 13:33 UTC (15:33 in Warsaw) and shows "zrzut 14 paź, 08:21" without a version number next to the name is v3, unless a browser tab had been open since before that time and was not reloaded.

From v4 on, every build shows its own number next to the name in the top bar (from `src/jaskinia/version.txt`) and its build time in Settings → O Jaskini, so recordings identify themselves. The owner often runs Jaskinia as a downloaded file (`file://` on a computer, `content://` on a phone), so the same version can live in several files such as `Jaskinia (1).html`; the number in the bar is what counts.
