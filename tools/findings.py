"""Generated findings: what anyone can see about a repo from the outside, as facts with a weight.

Rules, not opinions. Every sentence is built from measured facts and carries its evidence.
Two values of a ref are always kept apart: reachability (would a delete lose commits?) and
meaning (does the name carry knowledge?). Nothing here is a verdict; the Owner decides.

Severity: high (POWAŻNE) · mid (ŚREDNIE) · low (DROBNE) · info (INFO).
Dates are absolute (no "X days ago"), so a regenerated text never goes stale between runs.
"""
import re
from datetime import datetime, timezone, timedelta

DAY = 86400
MON = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
try:
    from zoneinfo import ZoneInfo
    PL = ZoneInfo("Europe/Warsaw")
except Exception:  # pragma: no cover
    PL = timezone(timedelta(hours=2))


def d(ts, year=False):
    if not ts:
        return "—"
    t = datetime.fromtimestamp(ts, tz=PL)
    return f"{t.day} {MON[t.month - 1]}" + (f" {t.year}" if year else "")


def iso_d(s):
    """'2026-10-09' -> '9 paź'"""
    if not s:
        return None
    y, m, dd = s.split("-")
    return f"{int(dd)} {MON[int(m) - 1]}"


SEV_W = {"high": 3, "mid": 2, "low": 1, "info": 0}


def pl(n, one, few, many):
    """Polish plural: 1 gałąź, 2–4 gałęzie (not 12–14), 5+ gałęzi."""
    a = abs(n)
    if a == 1:
        w = one
    elif 2 <= a % 10 <= 4 and not 12 <= a % 100 <= 14:
        w = few
    else:
        w = many
    return f"{n} {w}"



def life_of(age_days, empty, phase):
    if empty:
        return "puste"
    if phase == "zakończone":
        return "zakończone"
    if phase == "wstrzymane":
        return "wstrzymane"
    if age_days is None:
        return "puste"
    if age_days <= 7:
        return "żywe"
    if age_days <= 30:
        return "stygnące"
    return "uśpione"


def branch_mix(branches, now):
    mix = {"aktywne": 0, "swieze": 0, "stare": 0, "wchloniete": 0, "domyslna": 0}
    for b in branches:
        if "domyślna" in b["roles"]:
            mix["domyslna"] += 1
            continue
        age = (now - b["ts"]) / DAY
        if b.get("a") == 0:
            mix["wchloniete"] += 1
        elif age <= 7:
            mix["aktywne"] += 1
        elif age <= 21:
            mix["swieze"] += 1
        else:
            mix["stare"] += 1
    return mix


def findings_for(r, now, gh_url):
    """r: the built repo record (branches with roles, state, tree, readme, prs, ci, desc...)."""
    F = []
    name, default = r["name"], r.get("default") or "main"
    url = f"{gh_url}/{name}"

    def add(rule, sev, title, detail=None, links=None, who=None, facts=None):
        F.append({"id": f"{name}:{rule}", "repo": name, "rule": rule, "sev": sev, "title": title,
                  "detail": detail, "links": links or [], "who": who, "facts": facts or {}})

    if r.get("empty"):
        add("puste", "info", "Repo nie ma ani jednego commita.", "Miejsce zostawione na pomysł albo do usunięcia — to Twoja decyzja.",
            [["repo", url]], who="ty")
        return F

    st = r.get("state") or {}
    st_link = f"{url}/blob/{st.get('sha') or default}/{st.get('path')}" if st.get("path") else None
    if st.get("phase") == "zakończone":
        rm = bool(re.search(r"REMOVAL REQUESTED|usunięci|delete", st.get("status") or "", re.I))
        add("stan-zakonczone", "high" if rm else "mid",
            f"Repo samo o sobie mówi: „{st.get('phase_words')}”" + (f" ({iso_d(st.get('date'))})." if st.get("date") else "."),
            ("Notatka stanu prosi o usunięcie repozytorium. Usunąć je może tylko właściciel konta; do tego czasu kod jest widoczny w historii gita."
             if rm else "Projekt jest zamknięty według jego własnej notatki."),
            [["notatka stanu", f"{st_link}#L{st.get('phase_line')}" if st_link and st.get("phase_line") else st_link]] if st_link else [],
            who="ty", facts={"phase": st.get("phase_words"), "date": st.get("date")})
    elif st.get("phase") == "wstrzymane":
        add("stan-wstrzymane", "info", f"Repo mówi, że jest wstrzymane („{st.get('phase_words')}”).",
            None, [["notatka stanu", st_link]] if st_link else [], facts={"phase": st.get("phase_words")})

    brs = r["branches"]
    dflt = next((b for b in brs if "domyślna" in b["roles"]), None)
    others = [b for b in brs if "domyślna" not in b["roles"]]
    fresh = max(others, key=lambda b: b["ts"]) if others else None
    declared = [b for b in brs if "wskazana" in b["roles"]]
    if dflt and fresh and st.get("phase") != "zakończone":
        d_age, f_age = (now - dflt["ts"]) / DAY, (now - fresh["ts"]) / DAY
        if d_age - f_age > 7 and f_age <= 21:
            sev = "high" if d_age > 30 else "mid"
            if declared:
                sev = {"high": "mid", "mid": "low"}[sev]
            decl_txt = ("Dokumenty na `{}` wskazują: {}.".format(default, ", ".join(f"`{b['n']}`" for b in declared[:3]))
                        if declared else f"Żaden dokument wejścia na `{default}` nie wskazuje gałęzi, więc gość z zewnątrz zobaczy stan z {d(dflt['ts'])}.")
            add("praca-poza-main", sev,
                f"`{default}` stoi od {d(dflt['ts'])}, a najświeższy commit jest na `{fresh['n']}` ({d(fresh['ts'])}).",
                "To nie znaczy, że `{}` jest frontem: najświeższa gałąź nie musi nim być. {}".format(fresh["n"], decl_txt),
                [[f"`{fresh['n']}`", f"{url}/tree/{fresh['n']}"]] + ([[f"`{declared[0]['n']}`", f"{url}/tree/{declared[0]['n']}"]] if declared else []),
                who="ty+agent", facts={"default_ts": dflt["ts"]})

    tree = r.get("tree") or {}
    if tree.get("code_kb") == 0 and (tree.get("files") or 0) > 0 and st.get("phase") != "zakończone":
        lead = (r.get("readme") or {}).get("lead") or ""
        explained = bool(re.search(r"\bbranch|gałę|baseline", lead, re.I))
        add("main-bez-kodu", "info" if explained else "mid",
            f"Na `{default}` nie ma kodu: {pl(tree.get('files'), 'plik', 'pliki', 'plików')}, same dokumenty i konfiguracja.",
            ("README mówi to w pierwszym akapicie, więc gość nie zostaje bez drogi." if explained else
             "Kto otworzy repo, zobaczy opisy zamiast projektu. Jeśli to świadoma decyzja (kod żyje na gałęziach), warto, żeby README to mówiło w pierwszym zdaniu."),
            [["drzewo", f"{url}/tree/{default}"]], who=None if explained else "ty+agent", facts={"files": tree.get("files")})

    n = len(brs)
    mix = r.get("mix") or {}
    stale = mix.get("stare", 0)
    if n >= 12 and stale >= 6:
        sev = "high" if stale >= 30 else "mid" if stale >= 12 else "low"
        add("wiele-galezi", sev, f"{pl(n, 'gałąź', 'gałęzie', 'gałęzi')} na remote; {stale} z nich nie ruszało się od ponad 3 tygodni i nie mieści się w `{default}`.",
            f"Każda ma commity, których nie ma w `{default}`, więc usunięcie bez sprawdzenia może coś stracić. Zanim któraś zniknie, jej sens powinien zostać zapisany (PR, notatka).",
            [["wszystkie gałęzie", f"{url}/branches/all"]], who="ty+agent", facts={"stale": stale})

    absorbed = [b for b in others if b.get("a") == 0]
    if len(absorbed) >= 3:
        with_pr = sum(1 for b in absorbed if b.get("pr"))
        add("wchloniete", "mid" if len(absorbed) >= 10 else "low",
            f"{pl(len(absorbed), 'gałąź mieści', 'gałęzie mieszczą', 'gałęzi mieści')} się w całości w `{default}`: ich usunięcie nie straci żadnego commita.",
            f"Osiągalność to jedno, znaczenie nazwy to drugie: {with_pr} z nich ma PR, który przechowuje opis. Usunięcie to Twoja decyzja.",
            [["gałęzie", f"{url}/branches/all"]], who="ty+agent", facts={"n": len(absorbed), "with_pr": with_pr})

    if r.get("alias_groups"):
        names = sum(len(g) for g in r["alias_groups"])
        add("aliasy", "low", f"{pl(len(r['alias_groups']), 'grupa', 'grupy', 'grup')} nazw: kilka gałęzi wskazuje ten sam commit ({pl(names, 'nazwa', 'nazwy', 'nazw')} łącznie).",
            "Kilka nazw na jednym commicie to zwykle punkty kontrolne albo wskaźniki wdrożeń.",
            [["gałęzie", f"{url}/branches/all"]], facts={"groups": len(r["alias_groups"])})

    empty_tips = [b for b in brs if b.get("empty")]
    if len(empty_tips) >= 3:
        add("puste-czubki", "low", f"{pl(len(empty_tips), 'gałąź kończy', 'gałęzie kończą', 'gałęzi kończy')} się pustym commitem (bez zmian w plikach).",
            "Często to świadkowie uruchomienia CI.", facts={"n": len(empty_tips)})

    prs = r.get("prs") or {}
    drafts = [p for p in prs.get("open_list") or [] if p.get("draft")]
    if prs.get("draft"):
        oldest = min((p.get("upd") or "") for p in drafts) if drafts else None
        old_days = (now - datetime.fromisoformat(oldest.replace("Z", "+00:00")).timestamp()) / DAY if oldest else 0
        add("szkice-pr", "low" if old_days > 30 else "info",
            pl(prs["draft"], "szkic PR", "szkice PR", "szkiców PR")
            + (f"; najdawniej ruszany {d(datetime.fromisoformat(oldest.replace('Z', '+00:00')).timestamp())}." if oldest else "."),
            "Szkic bywa kapsułą wiedzy, a nie porzuconą pracą. Które zostają otwarte, decydujesz Ty.",
            [["pull requesty", f"{url}/pulls"]], who="ty", facts={"drafts": prs["draft"]})

    docs = r.get("docs") or []
    if len(docs) >= 4:
        add("wiele-wejsc", "mid", f"{pl(len(docs), 'dokument', 'dokumenty', 'dokumentów')} wejścia na `{default}`: " + ", ".join(f"`{x['p']}`" for x in docs[:4]) + (" i inne" if len(docs) > 4 else "") + ".",
            "Nowy agent nie wie, od którego zacząć i który jest prawdą. Jeden dokument powinien wskazywać pozostałe.",
            [["drzewo", f"{url}/tree/{default}"]], who="agent", facts={"n": len(docs)})

    md_kb, code_kb = tree.get("md_kb") or 0, tree.get("code_kb") or 0
    if md_kb > max(200, 0.5 * max(code_kb, 1)) and code_kb > 0:
        add("dokumenty-vs-kod", "low", f"Na `{default}` jest {md_kb} KB dokumentów i {code_kb} KB kodu.",
            "Warstwa opisów rośnie szybciej niż projekt.", facts={"md_kb": md_kb, "code_kb": code_kb})
    if (tree.get("dated_md") or 0) >= 15:
        add("datowane-dokumenty", "low", f"{pl(tree['dated_md'], 'dokument', 'dokumenty', 'dokumentów')} z datą w nazwie na `{default}`.",
            "Narastająca warstwa historyczna: przydatna jako dowód, myląca jako drzwi wejściowe.", facts={"n": tree["dated_md"]})

    rd = r.get("readme") or {}
    if rd.get("upstream_box3d"):
        add("readme-obce", "high", f"README na `{default}` to README silnika Box3D, a nie Twojego projektu.",
            "Z zewnątrz repo wygląda jak nieruszony fork.", [["README", f"{url}/blob/{default}/README.md"]], who="ty+agent")
    elif not rd.get("path"):
        add("brak-readme", "mid", f"Na `{default}` nie ma README.md.", None, [["repo", url]], who="agent")

    if r.get("api") is False:
        add("bez-api", "info", "Ten zrzut nie ma danych z API GitHuba dla tego repo: opis, pull requesty i przebiegi CI są nieznane, nie zerowe.",
            "Git (gałęzie, commity, README) jest pełny. Przy następnym odświeżeniu z dostępem do tego repo luka zniknie.", [["repo", url]])
    elif not r.get("desc"):
        add("brak-opisu", "low", "Brak opisu repo na GitHubie: na liście repozytoriów widać samą nazwę.",
            "Jedno zdanie w ustawieniach repo (About).", [["ustawienia", f"{url}"]], who="ty")

    ci = (r.get("ci") or {}).get("def")
    if ci and ci.get("c") == "failure":
        t = datetime.fromisoformat(ci["t"].replace("Z", "+00:00")).timestamp() if ci.get("t") else None
        add("ci-czerwone", "mid", f"Ostatni przebieg CI na `{default}` jest czerwony ({d(t)}).",
            ci.get("name"), [["przebieg", ci.get("url")]] if ci.get("url") else [], who="agent")

    if tree.get("big_files"):
        bf = tree["big_files"]
        add("duze-pliki", "mid", f"{pl(len(bf), 'plik większy', 'pliki większe', 'plików większych')} niż 5 MB na `{default}` (największy: `{bf[0][0]}`, {bf[0][1]} MB).", "Ciężkie pliki spowalniają klonowanie każdemu agentowi.",
            [["plik", f"{url}/blob/{default}/{bf[0][0]}"]], who="ty+agent")
    if tree.get("junk"):
        add("smieci", "low", "Przypadkowe pliki w repo: " + ", ".join(f"`{j}`" for j in tree["junk"][:3]) + ".", None, who="agent")

    if re.search(r"Tysi-c|Controler", name):
        add("nazwa", "low", f"Nazwa repo jest zniekształcona: `{name}`.", "GitHub zamienia polskie znaki na myślniki; literówki są widoczne publicznie.", who="ty")

    if st.get("date") and dflt and st.get("phase") != "zakończone":
        try:
            sd = datetime.fromisoformat(st["date"]).replace(tzinfo=timezone.utc).timestamp()
            if dflt["ts"] - sd > 14 * DAY:
                add("notatka-starsza", "low", f"Notatka stanu (`{st['path'].split('/')[-1]}`) ma datę {iso_d(st['date'])}, a `{default}` ma commity z {d(dflt['ts'])}.",
                    "Świeża data nie wykrywa sprzeczności, a stara nie musi być błędna. Warto ją przeczytać przed pracą.",
                    [["notatka", st_link]] if st_link else [], who="agent", facts={"date": st["date"]})
        except Exception:
            pass

    F.sort(key=lambda f: -SEV_W[f["sev"]])
    return F
