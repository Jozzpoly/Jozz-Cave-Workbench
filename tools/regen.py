#!/usr/bin/env python3
"""Biblioteka Jozzpoly: one command regenerates everything from the repos themselves.

    python3 -I tools/regen.py                 # list from data/connector_repos.json → fetch → collect → build → render → check
    python3 -I tools/regen.py --list gh       # list from the GitHub API instead (a token that can see private repos)
    python3 -I tools/regen.py --no-fetch      # rebuild from the clones already on disk
    python3 -I tools/regen.py --host web      # self-hosted page: games open inside the page (claude.ai blocks that)
    python3 -I tools/regen.py --shoot         # also render the page in Chromium and fail on console errors
    python3 -I tools/regen.py --since F.json  # compare with an older dataset instead of the previous run

Environment
    BIB_REPOS      where the clones live (default: ../repos next to this folder)
    BIB_GIT_TOKEN  token for cloning/fetching private repos outside Claude's sandbox (read-only is enough)
    GH_TOKEN       used by `gh` for the API side (collect_gh.py, --list gh)

What is generated and what is written
    facts      git + GitHub API, every run
    findings   rules in tools/findings.py, every run
    "stan"     quoted from each repo's own STATE/CURRENT/... note, never paraphrased
    changes    diff against the previous run (data/prev_library.json)
    written    tools/knowledge.py: families and "po co" sentences are Claude's hypotheses (marked as such),
               laws/lessons/cases are a dated record. The Owner's decisions live in the page's database, not here.

Read-only towards GitHub: never pushes, never deletes a branch or a repo. Clones are partial (blobs > 2 MB stay remote).
Exit 0 = full coverage, 2 = some listed repo could not be read (the page still builds and says so), 1 = a step failed.
"""
import argparse, base64, json, os, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
OWNER = "Jozzpoly"


def run(cmd, **kw):
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", **kw)
    return r, time.time() - t0


def step(name, cmd):
    print(f"· {name} …", flush=True)
    r, dt = run(cmd, cwd=ROOT)
    lines = (r.stdout or "").strip().splitlines()
    if r.returncode != 0:
        print(f"  ✗ {name}: błąd po {dt:.1f} s\n" + ((r.stderr or "") + (r.stdout or ""))[-2500:])
        sys.exit(1)
    print(f"  ✓ {lines[-1] if lines else 'ok'} ({dt:.1f} s)", flush=True)


def git_auth():
    tok = os.environ.get("BIB_GIT_TOKEN")
    if not tok:
        return []
    b = base64.b64encode(f"x-access-token:{tok}".encode()).decode()
    return ["-c", f"http.https://github.com/.extraheader=AUTHORIZATION: basic {b}"]


def list_from_gh():
    r, _ = run(["gh", "api", "--paginate", "user/repos?per_page=100&affiliation=owner"])
    if r.returncode != 0:
        sys.exit("gh api user/repos: " + (r.stderr or r.stdout)[:400])
    txt = r.stdout.strip().replace("]\n[", ",").replace("][", ",")
    repos = [x for x in json.loads(txt or "[]") if (x.get("owner") or {}).get("login") == OWNER]
    data = {"source": "GitHub API · user/repos", "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "repos": [{"name": x["name"], "pushed_at": x.get("pushed_at"), "visibility": x.get("visibility")} for x in repos]}
    json.dump(data, open(P("data", "connector_repos.json"), "w"), ensure_ascii=False, indent=1)
    return data


def local_clones(repos_dir):
    """lower-case GitHub name -> clone path, read from each clone's remote URL (dir names may differ in case)"""
    out = {}
    for d in sorted(os.listdir(repos_dir)):
        full = os.path.join(repos_dir, d)
        if not os.path.isdir(full) or d.startswith("."):
            continue
        r, _ = run(["git", "-C", full, "config", "--get", "remote.origin.url"])
        url = r.stdout.strip().rstrip("/")
        name = url.split("/")[-1].removesuffix(".git") if url else d
        out[name.lower()] = full
    return out


def sync(name, repos_dir, have):
    full = have.get(name.lower())
    url = f"https://github.com/{OWNER}/{name}.git"
    if not full:
        full = os.path.join(repos_dir, name)
        r, dt = run(["git", *git_auth(), "clone", "--quiet", "--filter=blob:limit=2m", "--no-checkout", url, full])
        return name, "sklonowane" if r.returncode == 0 else "klon: " + (r.stderr or "").strip()[:200], dt
    r, dt = run(["git", *git_auth(), "-C", full, "fetch", "--quiet", "--prune", "origin", "+refs/heads/*:refs/remotes/origin/*"])
    if r.returncode != 0:
        return name, "fetch: " + (r.stderr or "").strip()[:200], dt
    run(["git", *git_auth(), "-C", full, "remote", "set-head", "origin", "--auto"])  # the default branch can change
    return name, "ok", dt


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--list", choices=["connector", "gh"], default="connector")
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("--host", choices=["artifact", "web"], default="artifact")
    ap.add_argument("--shoot", action="store_true")
    ap.add_argument("--since", help="older data/library.json to diff against (default: the previous run)")
    a = ap.parse_args()
    t0 = time.time()
    repos_dir = os.environ.get("BIB_REPOS") or os.path.join(os.path.dirname(ROOT), "repos")
    os.makedirs(repos_dir, exist_ok=True)

    # 1. what exists on the account right now (declared coverage, case C16)
    lst = list_from_gh() if a.list == "gh" else json.load(open(P("data", "connector_repos.json")))
    age_min = (time.time() - datetime.fromisoformat(lst["checked_at"].replace("Z", "+00:00")).timestamp()) / 60
    print(f"· lista: {len(lst['repos'])} repo · {lst['source']} · sprawdzona {age_min:.0f} min temu")
    if age_min > 60:
        print("  ! lista jest starsza niż godzina: repo założone po niej nie trafi do zrzutu (przypadek C16). Odśwież ją przed publikacją.")

    # 2. clone what is missing, fetch everything
    if not a.no_fetch:
        have = local_clones(repos_dir)
        with ThreadPoolExecutor(max_workers=6) as ex:
            res = list(ex.map(lambda x: sync(x["name"], repos_dir, have), lst["repos"]))
        bad = [x for x in res if x[1] not in ("ok", "sklonowane")]
        print(f"  ✓ git: {sum(1 for x in res if x[1] == 'ok')} odświeżonych, {sum(1 for x in res if x[1] == 'sklonowane')} sklonowanych, "
              f"{len(bad)} błędów ({max((x[2] for x in res), default=0):.1f} s najdłużej)")
        for n, msg, _ in bad:
            print(f"    ✗ {n}: {msg}")
        names = {x["name"].lower() for x in lst["repos"]}
        for n, path in local_clones(repos_dir).items():
            if n not in names:
                print(f"    · {os.path.basename(path)}: klon zostaje na dysku, ale repo nie ma już na liście, więc nie trafi na stronę")

    # 3. keep the previous dataset for the "what changed" diff
    base = a.since or (P("data", "library.json") if os.path.exists(P("data", "library.json")) else None)
    if base and os.path.abspath(base) != os.path.abspath(P("data", "prev_library.json")):
        shutil.copyfile(base, P("data", "prev_library.json"))

    # 4. collect, build, render
    py = [sys.executable, "-I"]
    lst_path = P("data", "connector_repos.json")
    step("git → data/git.json", py + [P("tools", "collect_git.py"), repos_dir, P("data", "git.json"), lst_path])
    step("GitHub API → data/gh.json", py + [P("tools", "collect_gh.py"), P("data", "gh.json"), lst_path])
    step("wiedza → data/knowledge.json", py + [P("tools", "knowledge.py"), P("data", "knowledge.json")])
    step("build → data/library.json", py + [P("tools", "build.py")])
    step("strona", py + [P("tools", "render.py"), "--host", a.host])
    if a.host == "artifact":
        step("strona do samodzielnego hostingu", py + [P("tools", "render.py"), "--host", "web"])
    # Jaskinia: the same panels as windows Jozz arranges himself (same data, same snapshot)
    step("Jaskinia", py + [P("tools", "render.py"), "--app", "jaskinia", "--host", a.host])
    if a.host == "artifact":
        step("Jaskinia do samodzielnego hostingu", py + [P("tools", "render.py"), "--app", "jaskinia", "--host", "web"])

    # 5. self-check: say plainly what the page will say
    lib = json.load(open(P("data", "library.json")))
    C, T = lib["estate"]["coverage"], lib["estate"]["totals"]
    fs = [f for r in lib["repos"] for f in r["findings"]]
    sev = {k: sum(1 for f in fs if f["sev"] == k) for k in ("high", "mid", "low", "info")}
    life = {}
    for r in lib["repos"]:
        life[r["life"]] = life.get(r["life"], 0) + 1
    print(f"\nPokrycie {C['collected']}/{C['expected']}" + (f" · brak: {', '.join(C['missing'])}" if C["missing"] else "") +
          f" · {T['commits']} commitów · {T['branches']} gałęzi · {T['prs']} PR")
    print("Życie: " + ", ".join(f"{k} {v}" for k, v in life.items()))
    print(f"Ustalenia: poważne {sev['high']}, średnie {sev['mid']}, drobne {sev['low']}, info {sev['info']}")
    ch = lib["estate"].get("changes")
    if ch:
        mv = [f"{m['repo']} {m['commits']:+d}" for m in ch["moved"] if m["commits"]]
        print(f"Od {ch['since']}: " + (", ".join(mv) if mv else "bez nowych commitów") +
              (f" · nowe repo: {', '.join(ch['repos_new'])}" if ch["repos_new"] else "") +
              (f" · zniknęły: {', '.join(ch['repos_gone'])}" if ch["repos_gone"] else "") +
              f" · ustalenia +{len(ch['findings_new'])} / −{len(ch['findings_gone'])}")
    unknown = [r["name"] for r in lib["repos"] if r["family"] == "nowe"]
    if unknown:
        print("Bez rodziny (dopisz w tools/knowledge.py albo zostaw jako „Bez rodziny”): " + ", ".join(unknown))

    if a.shoot:
        r, _ = run(["node", P("tools", "shoot.mjs"), P("shots"), "regen=#panorama@1440x1000", "regen-phone=#panorama@400x860"], cwd=ROOT)
        print(r.stdout.strip())
        if "pageerror" in r.stdout or "error:" in r.stdout or r.returncode:
            print("✗ strona ma błędy w konsoli")
            sys.exit(1)
    print(f"\nGotowe w {time.time() - t0:.0f} s.")
    sys.exit(2 if C["missing"] else 0)


if __name__ == "__main__":
    main()
