#!/usr/bin/env python3
"""Merge git + GitHub + knowledge into the page dataset and the agent brief.

Usage: python3 -I build.py   (run from /home/claude/lib)
Writes data/library.json, dist/biblioteka-data.json, dist/biblioteka-dla-agentow.md
"""
import json, os, re, sys, time
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import findings as FND
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(HERE, p)))
G, H, K = J("data/git.json"), J("data/gh.json"), J("data/knowledge.json")
GH_BY = {r["name"]: r for r in H["repos"]}
VIS = {x["name"]: x.get("visibility") for x in J("data/connector_repos.json")["repos"]}  # when the API cannot see a repo, the list still knows if it is private
# play entries someone verified (address, window or tab only, who and when): data/wejscia.json
_WEJ = os.path.join(HERE, "data", "wejscia.json")
WEJ = {k: v for k, v in (json.load(open(_WEJ, encoding="utf-8")) if os.path.exists(_WEJ) else {}).items() if not k.startswith("_")}
NOW = G["generated_ts"]
DAY = 86400
GHB = "https://github.com/Jozzpoly"

FAMILY_OF = {r: f["id"] for f in K["families"] for r in f["repos"]}
LESSON_FROM = defaultdict(list)
LESSON_TO = defaultdict(list)
for l in K["lessons"]:
    LESSON_FROM[l["from"]].append(l["id"])
    for t in l["to"]:
        LESSON_TO[t].append(l["id"])


def heat_level(age_days):
    if age_days is None:
        return -1
    for lvl, lim in ((5, 1), (4, 3), (3, 7), (2, 14), (1, 30)):
        if age_days <= lim:
            return lvl
    return 0


def clean_lead(t):
    """README leads come from raw markdown: drop images/empty links, keep link text, drop setext underlines."""
    if not t:
        return t
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"(^|\s)[=\-]{3,}(?=\s|$)", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="minutes").replace("+00:00", "Z") if ts else None


repos = []
all_days = Counter()
for g in G["repos"]:
    name = g["name"]
    h = GH_BY.get(name, {})
    meta = h.get("meta", {})
    api_ok = bool(h) and "_error" not in h  # False: description, PRs and CI are unknown, not zero
    c = g.get("commits") or {}
    last_ts = max([b["ts"] for b in g.get("branches", [])] + ([c.get("last")] if c.get("last") else []), default=None)
    age = round((NOW - last_ts) / DAY, 2) if last_ts else None
    for d, n in (c.get("days") or {}).items():
        all_days[d] += n

    # PR index by head ref
    prs = h.get("prs") or []
    by_head = {}
    for p in sorted(prs, key=lambda p: p["created_at"]):
        by_head[p["head"]] = p  # latest PR for that head wins
    def pr_state(p):
        if p["state"] == "open":
            return "szkic" if p.get("draft") else "otwarty"
        return "scalony" if p.get("merged_at") else "zamknięty"

    branches = []
    default = g.get("default")
    for b in g.get("branches", []):
        roles = []
        if b["default"]:
            roles.append("domyślna")
        if b.get("declared_in"):
            roles.append("wskazana")
        p = by_head.get(b["name"])
        if p:
            roles.append("pr-" + pr_state(p))
        if b.get("alias_of"):
            roles.append("alias")
        if b.get("empty_tip"):
            roles.append("pusty-czubek")
        if not b["default"] and b.get("ahead") == 0:
            roles.append("wchłonięta")
        a = (NOW - b["ts"]) / DAY
        roles.append("świeża" if a <= 7 else "ciepła" if a <= 21 else "chłodna")
        branches.append({
            "n": b["name"], "sha": b["sha"][:10], "ts": b["ts"], "fork": b.get("fork_ts"), "a": b.get("ahead"),
            "b": b.get("behind"), "s": b["subject"], "au": b.get("author"), "decl": b.get("declared_in") or [],
            "alias": b.get("alias_of") or [], "pr": ({"n": p["n"], "st": pr_state(p), "t": p["title"]} if p else None),
            "pre": b.get("prefix"), "stem": b.get("stem"), "roles": roles, "empty": b.get("empty_tip", False),
        })

    open_prs = [p for p in prs if p["state"] == "open"]
    runs = h.get("runs_latest") or []
    def latest(rs):
        rs = sorted(rs, key=lambda r: r.get("created_at") or "", reverse=True)
        return rs[0] if rs else None
    ci_def = latest([r for r in runs if r.get("branch") == default])
    ci_any = latest(runs)
    has_pages = bool(meta.get("has_pages"))
    tree = g.get("tree") or {}
    langs = h.get("languages") or {}
    tot = sum(langs.values()) or 1
    stems = Counter((b["pre"], b["stem"]) for b in branches if not "domyślna" in b["roles"])
    repos.append({
        "name": name, "short": K["short"].get(name, name), "family": FAMILY_OF.get(name),
        "private": bool(meta.get("private")) if meta else VIS.get(name) == "private", "desc": meta.get("description"), "api": api_ok,
        "identity": K["identity"].get(name), "stated": K["stated"].get(name, []),
        "readme": {**(g.get("readme") or {}), "lead": clean_lead((g.get("readme") or {}).get("lead"))}, "url": f"{GHB}/{name}",
        "pages": (WEJ[name]["url"] if name in WEJ else f"https://jozzpoly.github.io/{name}/" if has_pages else None),
        "tab": bool(name in WEJ and WEJ[name].get("okno") is False),
        "wejscie": ({k: WEJ[name].get(k) for k in ("dlaczego", "sprawdzil", "kiedy")} if name in WEJ else None),
        "created": meta.get("created_at"), "pushed": meta.get("pushed_at"),
        "default": default, "empty": bool(g.get("empty")),
        "last_ts": last_ts, "age": age, "heat": heat_level(age), "feniks": age is not None and age <= 14,
        "commits": c.get("total", 0), "merges": c.get("merges", 0), "first_ts": c.get("first"),
        "active_days": c.get("active_days", 0), "days": c.get("days") or {}, "hours": c.get("hours"),
        "weekdays": c.get("weekdays"), "authors": c.get("authors"), "coauthors": c.get("coauthors"),
        "max_day": c.get("max_day"),
        "branches": branches, "alias_groups": g.get("alias_groups") or [],
        "stems": [{"pre": k[0], "stem": k[1], "n": v} for k, v in stems.most_common() if v >= 2][:14],
        "prs": {"total": len(prs), "open": len(open_prs), "draft": sum(1 for p in open_prs if p.get("draft")),
                "merged": sum(1 for p in prs if p.get("merged_at")),
                "closed": sum(1 for p in prs if p["state"] == "closed" and not p.get("merged_at")),
                "first": min((p["created_at"] for p in prs), default=None),
                "open_list": [{"n": p["n"], "t": p["title"], "draft": p.get("draft"), "head": p["head"],
                               "upd": p.get("updated_at"), "body": (p.get("body") or "")[:420]} for p in
                              sorted(open_prs, key=lambda p: p.get("updated_at") or "", reverse=True)][:12]},
        "ci": {"runs": h.get("runs_total") or 0,
               "def": ({"c": ci_def.get("conclusion") or ci_def.get("status"), "t": ci_def.get("created_at"),
                        "name": ci_def.get("name"), "url": ci_def.get("url")} if ci_def else None),
               "any": ({"c": ci_any.get("conclusion") or ci_any.get("status"), "t": ci_any.get("created_at"),
                        "br": ci_any.get("branch"), "name": ci_any.get("name"), "url": ci_any.get("url")} if ci_any else None)},
        "issues": [{"n": i["n"], "t": i["title"]} for i in h.get("issues_open") or []],
        "tree": {k: tree.get(k) for k in ("files", "md", "dated_md", "code_kb", "md_kb", "workflows", "root_index_html", "big_files", "junk", "has_license")},
        "state": g.get("state"), "head_sha": g.get("head_sha"),
        "stack": g.get("stack") or [], "langs": [[k, round(v / tot, 3)] for k, v in sorted(langs.items(), key=lambda kv: -kv[1])[:6]],
        "docs": [{"p": d["path"], "t": d["title"], "ts": d["last_ts"]} for d in g.get("entry_docs") or []],
        "pkg": g.get("package"),
        "lessons_out": LESSON_FROM.get(name, []), "lessons_in": LESSON_TO.get(name, []),
    })

# declared coverage: what the connector says exists right now vs what this snapshot holds (C16)
CONN = J("data/connector_repos.json")
expected_names = {x["name"] for x in CONN["repos"]}
gone_local = sorted(r["name"] for r in repos if r["name"] not in expected_names)
repos = [r for r in repos if r["name"] in expected_names]   # a clone of a repo that left the account is not shown
found_names = {r["name"] for r in repos}

# families: drop names that no longer exist, give orphans a generated family instead of hiding them
present = {r["name"] for r in repos}
orphans = [r["name"] for r in repos if not r["family"]]
for r in repos:
    if not r["family"]:
        r["family"] = "nowe"

# generated layer: life, branch mix, findings (rules in tools/findings.py)
for r in repos:
    st = r.get("state") or {}
    r["life"] = FND.life_of(r["age"], r["empty"], st.get("phase"))
    r["mix"] = FND.branch_mix(r["branches"], NOW)
    r["findings"] = FND.findings_for(r, NOW, GHB)
    r["score"] = sum(FND.SEV_W[f["sev"]] for f in r["findings"])
repos.sort(key=lambda r: (r["last_ts"] or 0), reverse=True)
fam_order = [f["id"] for f in K["families"]]
families = []
fam_src = [dict(f, repos=[n for n in f["repos"] if n in present]) for f in K["families"]]
if orphans:
    fam_src.append({"id": "nowe", "name": "Bez rodziny", "generated": True, "repos": orphans,
                    "question": "Repo nowsze niż ostatni przegląd Claude. Przypisanie do rodziny to propozycja do Twojej decyzji."})
for f in fam_src:
    rs = [r for r in repos if r["family"] == f["id"]]
    if not rs:
        continue
    families.append({**f, "commits": sum(r["commits"] for r in rs), "last_ts": max((r["last_ts"] or 0) for r in rs) or None,
                     "branches": sum(len(r["branches"]) for r in rs)})

busiest = max(all_days.items(), key=lambda kv: kv[1]) if all_days else None
tot_branches = sum(len(r["branches"]) for r in repos)
try:
    from zoneinfo import ZoneInfo
    _pl = ZoneInfo("Europe/Warsaw")
except Exception:
    _pl = timezone(timedelta(hours=2))
conn_local = datetime.fromisoformat(CONN["checked_at"].replace("Z", "+00:00")).astimezone(_pl).strftime("%d.%m, %H:%M")
ACC = K.get("account") or None
if ACC:
    ACC = dict(ACC, created_ts=int(datetime.fromisoformat(ACC["created"].replace("Z", "+00:00")).timestamp()))
estate = {
    "generated": G["generated"], "generated_ts": NOW, "gh_collected_ts": H["collected_ts"],
    "account": ACC,
    "coverage": {"expected": len(expected_names), "collected": len(repos), "public": sum(1 for r in repos if not r["private"]),
                 "private": sum(1 for r in repos if r["private"]), "empty": [r["name"] for r in repos if r["empty"]],
                 "missing": sorted(expected_names - found_names), "unlisted": gone_local,
                 "checked_at": CONN["checked_at"],
                 "method": f"Lista repo: {CONN.get('source', 'konektor')} ({len(expected_names)}, sprawdzona {conn_local}). Pełne klony gita: wszystkie gałęzie i cała historia. API GitHuba: metadane, języki, wszystkie PR-y, ostatnie przebiegi CI, otwarte issues.",
                 "limits": ["Repo założone po chwili zrzutu pokaże dopiero przycisk „Sprawdź na żywo” (tak wyszedł przypadek C16).",
                            "Kod nie był czytany ani uruchamiany; README i dokumenty wejścia tylko na gałęzi domyślnej (oraz wskazanej, gdzie to zaznaczono).",
                            "Strony GitHub Pages nie były otwierane z tego środowiska (brak dostępu sieciowego); link składam z nazwy repo.",
                            "Wszystkie commity z konta Jozzpoly wyglądają tak samo, niezależnie od tego, czy pisałeś Ty, czy agent. Liczby to liczby commitów, nie ludzi.",
                            "Rodziny i zdania „po co” to hipotezy Claude do Twojej decyzji."]},
    "totals": {"repos": len(repos), "commits": sum(r["commits"] for r in repos), "branches": tot_branches,
               "prs": sum(r["prs"]["total"] for r in repos), "prs_open": sum(r["prs"]["open"] for r in repos),
               "prs_merged": sum(r["prs"]["merged"] for r in repos), "ci_runs": sum(r["ci"]["runs"] for r in repos),
               "pages": sum(1 for r in repos if r["pages"]), "active_days": len(all_days),
               "first_ts": min((r["first_ts"] for r in repos if r["first_ts"]), default=None),
               "busiest_day": busiest, "feniks": sum(1 for r in repos if r["feniks"])},
    "estate_days": dict(sorted(all_days.items())),
}
def changes_since(prev_path):
    try:
        P = json.load(open(prev_path))
    except Exception:
        return None
    if P.get("estate", {}).get("generated_ts") == NOW:
        return None
    PR = {r["name"]: r for r in P.get("repos", [])}
    CR = {r["name"]: r for r in repos}
    moved = []
    for n, r in CR.items():
        p = PR.get(n)
        if not p:
            continue
        pb, cb = {b["n"] for b in p.get("branches", [])}, {b["n"] for b in r["branches"]}
        dc = r["commits"] - p.get("commits", 0)
        tips = sum(1 for b in r["branches"] if any(pb2["n"] == b["n"] and pb2["sha"] != b["sha"] for pb2 in p.get("branches", [])))
        if dc or (cb - pb) or (pb - cb) or tips or p.get("life") != r["life"]:
            moved.append({"repo": n, "commits": dc, "new_branches": sorted(cb - pb)[:12], "n_new_branches": len(cb - pb),
                          "gone_branches": sorted(pb - cb)[:12], "n_gone_branches": len(pb - cb), "moved_tips": tips,
                          "life_from": p.get("life"), "life_to": r["life"], "last_ts": r["last_ts"]})
    moved.sort(key=lambda m: -(m["last_ts"] or 0))
    pf = {f["id"]: f for p in P.get("repos", []) for f in p.get("findings", [])}
    cf = {f["id"]: f for r in repos for f in r["findings"]}
    return {"since": P["estate"].get("generated"), "since_ts": P["estate"].get("generated_ts"),
            "repos_new": sorted(set(CR) - set(PR)), "repos_gone": sorted(set(PR) - set(CR)), "moved": moved,
            "findings_new": sorted(set(cf) - set(pf)),
            "findings_gone": [{"id": i, "repo": pf[i]["repo"], "sev": pf[i]["sev"], "title": pf[i]["title"]} for i in sorted(set(pf) - set(cf))],
            "findings_sev": [{"id": i, "from": pf[i]["sev"], "to": cf[i]["sev"]} for i in sorted(set(pf) & set(cf)) if pf[i]["sev"] != cf[i]["sev"]]}


estate["changes"] = changes_since(os.path.join(HERE, "data/prev_library.json"))

# compact history of snapshots (for "since yesterday / since your last visit" once refresh is automatic)
HIST = os.path.join(HERE, "data/history.json")
try:
    hist = json.load(open(HIST))
except Exception:
    hist = []
hist = [x for x in hist if x.get("ts") != NOW]
hist.append({"ts": NOW, "repos": {r["name"]: {"c": r["commits"], "l": r["last_ts"], "b": len(r["branches"]), "life": r["life"],
                                              "f": [f["rule"] + ":" + f["sev"][0] for f in r["findings"]]} for r in repos}})
hist = sorted(hist, key=lambda x: x["ts"])[-120:]
json.dump(hist, open(HIST, "w"), ensure_ascii=False, separators=(",", ":"))
lib = {"estate": estate, "families": families, "repos": repos,
       **{k: K[k] for k in ("estate_stated", "prolog", "laws", "dna", "lessons", "methods", "cases", "ledger", "open")}}
os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
json.dump(lib, open(os.path.join(HERE, "data/library.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(lib, open(os.path.join(HERE, "dist/biblioteka-data.json"), "w"), ensure_ascii=False, indent=1)

# ---- agent brief (markdown) ----
def ago(ts):
    if not ts:
        return "—"
    d = (NOW - ts) / DAY
    return "dziś" if d < 1 else f"{int(d)} dni temu"
L = []
L.append("# Biblioteka Jozzpoly — brief dla agentów")
L.append("")
L.append(f"Zrzut: {estate['generated'].replace('+00:00', '').replace('T', ' ')} UTC. Pokrycie: {estate['coverage']['collected']}/{estate['coverage']['expected']} repo "
         f"({estate['coverage']['public']} publicznych, {estate['coverage']['private']} prywatnych). To migawka, nie żywa prawda: "
         "przed działaniem sprawdź żywy branch, PR i CI.")
L.append("")
L.append("## Zasady pracy")
L.append("- Zdania „po co jest to repo” i przypisanie do rodzin to hipotezy Claude; Owner je zatwierdza, poprawia albo odrzuca w Bibliotece.")
L.append("- Najnowsza gałąź to nie front. Gdzie żyje praca, mówią README/dokumenty wejścia i PR-y (pole `wskazana`).")
L.append("- Nieodwracalne decyzje (kasowanie gałęzi, publikacja prywatnych rzeczy) tylko bezpośrednio od Ownera; wspólne konto nie jest podpisem.")
L.append("- Nic nie znika, dopóki jego sens nie jest zapisany gdzie indziej.")
L.append("")
for f in families:
    L.append(f"## {f['name']}")
    L.append(f"_{f['question']}_ (hipoteza)")
    L.append("")
    for r in [x for x in repos if x["family"] == f["id"]]:
        decl = sorted({b["n"] for b in r["branches"] if "wskazana" in b["roles"]})
        L.append(f"### {r['name']}{' (prywatne)' if r['private'] else ''}")
        L.append(f"- Po co (hipoteza): {r['identity']}")
        if r["readme"].get("lead"):
            L.append(f"- README: {r['readme']['lead'][:300]}")
        prs = "PR otwartych: nieznane (API nie widziało tego repo)" if r.get("api") is False else f"PR otwartych {r['prs']['open']}"
        L.append(f"- Życie: {r['life']} · ostatnia aktywność: {ago(r['last_ts'])} · commitów {r['commits']} · gałęzi {len(r['branches'])} · {prs}")
        st = r.get("state") or {}
        if st.get("status"):
            L.append(f"- Stan według repo (`{st['path']}`{', ' + st['date'] if st.get('date') else ''}): „{st['status']}”")
            for nx in (st.get("next") or [])[:3]:
                L.append(f"  - dalej według notatki: {nx['t']}")
        for f0 in [x for x in r["findings"] if x["sev"] in ("high", "mid")]:
            L.append(f"- [{ {'high': 'poważne', 'mid': 'średnie'}[f0['sev']] }] {f0['title'].replace('`', '')}")
        if decl:
            L.append(f"- Dokumenty wejścia wskazują gałęzie: {', '.join('`'+d+'`' for d in decl)}")
        if r["docs"]:
            L.append(f"- Dokumenty wejścia: {', '.join('`'+d['p']+'`' for d in r['docs'][:6])}")
        if r["pages"] and r["life"] != "zakończone":
            L.append(f"- Pages: {r['pages']}")
        L.append(f"- Repo: {r['url']}")
        L.append("")
ch = estate.get("changes")
if ch:
    L.append(f"## Zmiany od poprzedniego zrzutu ({(ch['since'] or '').replace('+00:00', '').replace('T', ' ')} UTC)")
    for n in ch["repos_new"]:
        L.append(f"- nowe repo: {n}")
    for n in ch["repos_gone"]:
        L.append(f"- repo zniknęło z konta: {n}")
    for m in ch["moved"]:
        bits = []
        if m["commits"]:
            bits.append(("+" if m["commits"] > 0 else "−") + FND.pl(abs(m["commits"]), "commit", "commity", "commitów"))
        if m["n_new_branches"]:
            bits.append("+" + FND.pl(m["n_new_branches"], "gałąź", "gałęzie", "gałęzi"))
        if m["n_gone_branches"]:
            bits.append("−" + FND.pl(m["n_gone_branches"], "gałąź", "gałęzie", "gałęzi") + " (usunięte)")
        if m["life_from"] != m["life_to"]:
            bits.append(f"życie: {m['life_from']} → {m['life_to']}")
        L.append(f"- {m['repo']}: " + (", ".join(bits) or "przesunięte czubki gałęzi"))
    if ch["findings_new"]:
        L.append(f"- nowe ustalenia: {', '.join(ch['findings_new'])}")
    for f0 in ch["findings_gone"]:
        L.append(f"- ustalenie zniknęło: {f0['repo']}: {f0['title'].replace('`', '')}")
    L.append("")
L.append("## Lekcje, które przeszły między światami")
for l in K["lessons"]:
    L.append(f"- **{l['id']} — {l['title']}** ({l['from']} → {', '.join(l['to'])}). Źródło: {l['source']}. Droga: {l['route']}")
L.append("")
L.append("## Prawa Biblioteki")
for l in K["laws"]:
    L.append(f"- **{l['title']}** — {l['text']}")
open(os.path.join(HERE, "dist/biblioteka-dla-agentow.md"), "w").write("\n".join(L) + "\n")
print(f"library.json: {os.path.getsize(os.path.join(HERE, 'data/library.json'))//1024} KB · repos {len(repos)} · branches {tot_branches} · busiest {busiest}")
