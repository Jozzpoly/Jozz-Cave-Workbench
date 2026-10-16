#!/usr/bin/env python3
"""Make the public copy of the project: everything needed to build, test and study Jaskinia, without the
owner's private reality (private repositories and his own words).

    python3 -I tools/public_copy.py DEST

The project is public; the instance is private. DEST receives the code, tools, tests and docs as they are, and a
data snapshot reduced to the public repositories, rebuilt from scratch with the public knowledge layer
(BIB_PUBLIC=1), with the pages rendered from it. Then every file in DEST is scanned for the private names and for
the sentences of the private layer, and every hit is printed. Exit 1 when a hit sits anywhere but the raw text of a
public repository (which is already public on GitHub).
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.abspath(sys.argv[1])
P = lambda *a: os.path.join(ROOT, *a)
D = lambda *a: os.path.join(DEST, *a)

COPY = ["src", "tools", "docs", "README.md", "AGENTS.md", "GENERATOR.md", "package.json", "package-lock.json", ".gitignore"]
SKIP = re.compile(r"(__pycache__|\.pyc$|^tools/_|/_[^/]*\.mjs$)")

conn = json.load(open(P("data", "connector_repos.json"), encoding="utf-8"))
private = sorted(r["name"] for r in conn["repos"] if r.get("visibility") == "private")
public = {r["name"] for r in conn["repos"] if r.get("visibility") != "private"}
print(f"public copy: {len(public)} public repositories, {len(private)} private left out")

# 1. code, tools, tests, docs
os.makedirs(DEST, exist_ok=True)
for item in COPY:
    src = P(item)
    if os.path.isdir(src):
        for base, dirs, files in os.walk(src):
            for f in files:
                rel = os.path.relpath(os.path.join(base, f), ROOT)
                if SKIP.search(rel):
                    continue
                os.makedirs(os.path.dirname(D(rel)), exist_ok=True)
                shutil.copy2(os.path.join(base, f), D(rel))
    elif os.path.exists(src):
        shutil.copy2(src, D(item))

# 2. the snapshot, reduced to the public repositories
os.makedirs(D("data"), exist_ok=True)
os.makedirs(D("dist"), exist_ok=True)
J = lambda *a: json.load(open(P("data", *a), encoding="utf-8"))
w = lambda name, obj: json.dump(obj, open(D("data", name), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
w("connector_repos.json", dict(conn, repos=[r for r in conn["repos"] if r["name"] in public]))
g = J("git.json")
w("git.json", dict(g, repos=[r for r in g["repos"] if r["name"] in public], repos_dir_count=sum(1 for r in g["repos"] if r["name"] in public)))
h = J("gh.json")
w("gh.json", dict(h, repos=[r for r in h["repos"] if r["name"] in public]))
prev = J("prev_library.json")  # only what the "since the previous snapshot" diff reads
w("prev_library.json", {"estate": {k: prev["estate"].get(k) for k in ("generated", "generated_ts")},
                        "repos": [{k: r.get(k) for k in ("name", "branches", "commits", "life", "findings")}
                                  for r in prev["repos"] if r["name"] in public]})
hist = J("history.json")
w("history.json", [dict(e, repos={n: v for n, v in e["repos"].items() if n in public}) for e in hist])

# 3. rebuild everything from the public data (fonts come from node_modules, linked, never copied)
if not os.path.exists(D("node_modules")):
    os.symlink(P("node_modules"), D("node_modules"))
env = dict(os.environ, BIB_PUBLIC="1")
for cmd in (["tools/knowledge.py", "data/knowledge.json"], ["tools/build.py"],
            ["tools/render.py", "--app", "jaskinia"], ["tools/render.py", "--app", "jaskinia", "--host", "web"],
            ["tools/render.py"], ["tools/render.py", "--host", "web"]):
    r = subprocess.run([sys.executable, "-I"] + cmd, cwd=DEST, env=env, capture_output=True, text=True)
    print("  " + (r.stdout.strip().splitlines() or [""])[-1])
    if r.returncode:
        sys.exit(r.stderr)

# 4. look for anything private
lay = json.load(open(P("private", "knowledge_private.json"), encoding="utf-8")) if os.path.exists(P("private", "knowledge_private.json")) else {}
short = {r["name"]: r["short"] for r in J("library.json")["repos"]}
needles = set()
for n in private:
    needles |= {n.lower(), short.get(n, n).lower()}
sentences = []
for v in list(lay.get("stated", {}).values()):
    sentences += v
sentences += lay.get("estate_stated", []) + [p["what"] for p in lay.get("prolog", []) if p.get("kind") == "stated"]
sentences += [l["what"] for l in lay.get("ledger", [])] + [x["quote"][1] for x in lay.get("dna_insert", [])]
needles |= {s.lower() for s in sentences if len(s) > 24}
raw_public = {os.path.join("data", "git.json"), os.path.join("data", "gh.json")}
bad = 0
for base, dirs, files in os.walk(DEST):
    dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
    for f in files:
        path = os.path.join(base, f)
        rel = os.path.relpath(path, DEST)
        try:
            text = open(path, encoding="utf-8").read().lower()
        except (UnicodeDecodeError, IsADirectoryError):
            continue
        for n in needles:
            i = text.find(n)
            if i >= 0:
                where = text[max(0, i - 60):i + len(n) + 40].replace("\n", " ")
                ok = rel in raw_public
                bad += 0 if ok else 1
                print(f"  {'(public source text) ' if ok else 'LEAK '}{rel}: …{where}…")
print("clean" if not bad else f"{bad} private traces outside public sources")
sys.exit(1 if bad else 0)
