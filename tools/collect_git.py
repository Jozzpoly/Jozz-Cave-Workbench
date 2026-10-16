#!/usr/bin/env python3
"""Library v1 — git-side collector.

Reads every clone under REPOS_DIR (full history, partial blobs) and writes one JSON
with facts only: refs and their roles-as-facts, aliases, empty tips, fork points,
commit rhythm, authorship, default-tree shape, entry docs and what they point at.
Never prints file contents beyond short README leads and doc titles.

Usage: python3 -I collect_git.py REPOS_DIR OUT.json [REPO_LIST.json]
With REPO_LIST.json (data/connector_repos.json) only the listed repos are read; a clone of a repo that
left the account is skipped, not shown.
"""
import json, os, re, subprocess, sys, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

REPOS_DIR, OUT = sys.argv[1], sys.argv[2]
LIST = sys.argv[3] if len(sys.argv) > 3 else None
NOW = time.time()

CANON = {}  # local dir -> GitHub name when no list is given; with a list, names come from it (case-insensitive)

ENTRY_RE = re.compile(r"^(README|AGENTS|CLAUDE|START_HERE|CONTINUE_HERE|CURRENT[^/]*|PROJECT_STATE[^/]*|RESEARCH_STATE[^/]*|EXECUTION_STATE[^/]*|STATE|HANDOFF[^/]*|AI_PROJECT_MEMORY[^/]*|STATUS[^/]*|NORTH_STAR[^/]*)\.md$", re.I)
DATED_RE = re.compile(r"20\d\d-\d\d-\d\d")
EXT_LANG = {
    "js": "JavaScript", "mjs": "JavaScript", "cjs": "JavaScript", "jsx": "JavaScript",
    "ts": "TypeScript", "tsx": "TypeScript", "c": "C", "h": "C/C++ header", "cpp": "C++", "hpp": "C++",
    "cc": "C++", "py": "Python", "rs": "Rust", "go": "Go", "cs": "C#", "lua": "Lua", "glsl": "GLSL",
    "wgsl": "WGSL", "frag": "GLSL", "vert": "GLSL", "java": "Java", "gradle": "Gradle", "html": "HTML",
    "css": "CSS", "ps1": "PowerShell", "sh": "Shell", "json": "JSON", "md": "Markdown",
    "gd": "GDScript", "gdshader": "GDShader", "shader": "Shader", "hlsl": "HLSL", "zig": "Zig", "kt": "Kotlin", "swift": "Swift",
}
CODE_LANGS = {"JavaScript", "TypeScript", "C", "C/C++ header", "C++", "Python", "Rust", "Go", "C#", "Lua",
              "GLSL", "WGSL", "Java", "HTML", "CSS", "Shell", "PowerShell", "GDScript", "GDShader", "Shader", "HLSL",
              "Zig", "Kotlin", "Swift"}
VENDOR_RE = re.compile(r"(^|/)(node_modules|vendor|third_party|extern|external|dist|build|libs?/three|\.git)/", re.I)
STACK_HINTS = [  # (regex on dependency names or file paths, label)
    (r"^three$|three\.module|three\.min", "Three.js"), (r"rapier", "Rapier"), (r"cannon", "Cannon"),
    (r"^vite$", "Vite"), (r"playwright", "Playwright"), (r"^vitest$", "Vitest"), (r"typescript", "TypeScript"),
    (r"wrangler|cloudflare", "Cloudflare"), (r"^react$", "React"), (r"pixi", "PixiJS"), (r"babylon", "Babylon.js"),
    (r"gaussian|splat", "Gaussian splats"), (r"webxr|@webxr", "WebXR"), (r"sokol", "sokol"), (r"imgui", "Dear ImGui"),
    (r"box3d|box2d", "Box3D/Box2D"), (r"ollama|openai|llama|onnx|transformers", "LLM / ML"),
    (r"socket\.io|^ws$|websocket", "WebSockets"), (r"jest", "Jest"), (r"esbuild", "esbuild"), (r"electron", "Electron"),
]


def git(repo, *args, check=False):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout if r.returncode == 0 else ""


def show(repo, ref, path, limit=60000):
    out = git(repo, "show", f"{ref}:{path}")
    return out[:limit]


def week_key(ts):
    d = datetime.fromtimestamp(ts, tz=timezone.utc).date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def clean_md_lead(md):
    """First heading + first real paragraph of a README, markdown stripped, max ~520 chars."""
    lines = md.splitlines()
    title, para, buf, in_code, end_idx = None, None, [], False, len(lines)
    for i, raw in enumerate(lines):
        l = raw.rstrip()
        if l.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not title and re.match(r"^\s*#{1,3}\s+\S", l):
            title = re.sub(r"^\s*#+\s*", "", l).strip()
            continue
        s = l.strip()
        if not s:
            if buf:
                para = " ".join(buf)
                end_idx = i
                break
            continue
        if s.startswith(("<", "![", "[![", "|", "---", "===", "#")) and not buf:
            continue
        if s.startswith(("- ", "* ", "1. ")) and not buf:
            continue
        buf.append(s.lstrip("> ").strip())
    if para is None and buf:
        para = " ".join(buf)
    # continuation: if the paragraph ends with ':' or is very short, append what directly follows it
    # (repeated: "Lab X. / Core question: / > the question" needs two steps)
    for _ in range(3):
        if not (para and (para.rstrip().endswith(":") or len(para) < 70)):
            break
        joined, stop = [], len(lines)
        for j in range(end_idx + 1, len(lines)):
            s2 = lines[j].strip()
            if not s2:
                if joined:
                    stop = j
                    break
                continue
            if s2.startswith(("```", "#", "|", "<")):
                stop = j
                break
            joined.append(re.sub(r"^([-*>]|\d+\.)\s*", "", s2))
            if len(" ".join(joined)) > 260:
                stop = j
                break
        if not joined:
            break
        para = para.rstrip() + " " + " · ".join(joined)
        end_idx = stop
    def strip(t):
        if not t:
            return t
        t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
        t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
        t = re.sub(r"[*_`]{1,3}", "", t)
        t = re.sub(r"<[^>]+>", "", t)
        return re.sub(r"\s+", " ", t).strip()
    para = strip(para)
    if para and len(para) > 520:
        para = para[:517].rsplit(" ", 1)[0] + "…"
    return strip(title), para


STATE_PRIORITY = ["STATE", "CURRENT", "PROJECT_STATE", "RESEARCH_STATE", "EXECUTION_STATE", "STATUS", "START_HERE",
                  "CONTINUE_HERE", "AI_PROJECT_MEMORY", "HANDOFF", "NORTH_STAR"]
DATE_IN_TEXT = re.compile(r"(20\d\d-\d\d-\d\d)")


def md_plain(t, limit=220):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*`]{1,3}", "", t)
    t = re.sub(r"(?<![\w])_([^_\n]+)_(?![\w])", r"\1", t)  # _emphasis_ only; SNAKE_CASE identifiers survive
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"^(Status|Stan)\s*:\s*", "", t.strip(), flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -·:")
    return t if len(t) <= limit else t[:limit - 1].rsplit(" ", 1)[0] + "…"


PHASES = [  # (phase, pattern) — what the repo itself declares; first match in the header region wins
    ("zakończone", re.compile(r"\b(TERMINATED|ABANDON(?:ED)?|REMOVAL REQUESTED|STATUS:\s*END\b|DEPRECATED|ZAKOŃCZON\w*|PORZUCON\w*)", re.I)),
    ("wstrzymane", re.compile(r"\b(PAUSED|ON HOLD|INTENTIONALLY PAUSED|WSTRZYMAN\w*)", re.I)),
    ("domknięty etap", re.compile(r"\b(SEALED|EPOCH \w+ CLOSED|FINALI[SZ]ATION MODE|FINALIZACJ\w*)", re.I)),
    ("odbudowa", re.compile(r"\b(RECOVERY QUARANTINE|STRATEGIC RECOVERY|QUARANTINE)", re.I)),
]


def state_of(txt):
    """The repo's own words about its state: title, date, status line, declared phase, next steps
    (with 1-based line numbers). Purely extractive: nothing is paraphrased."""
    lines = txt.splitlines()
    out = {"title": None, "date": None, "status": None, "status_line": None, "phase": None, "phase_words": None,
           "phase_line": None, "next": [], "next_kind": None, "next_head": None, "lead": None, "lead_line": None}
    in_code, next_mode, next_level, seen = False, False, 0, 0
    for i, raw in enumerate(lines, 1):
        l = raw.rstrip()
        if l.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        s = l.strip()
        if s:
            seen += 1
        header = seen <= 14  # the opening block of the note
        if header and s:
            if not out["date"]:
                dm = DATE_IN_TEXT.search(s)
                if dm:
                    out["date"] = dm.group(1)
            if not out["phase"]:
                for ph, rx in PHASES:
                    pm = rx.search(s)
                    if pm:
                        out["phase"], out["phase_words"], out["phase_line"] = ph, pm.group(1).strip(), i
                        if out["status"] is None:
                            bold = re.findall(r"\*\*([^*]{6,})\*\*", s)
                            pick = next((b for b in bold if rx.search(b)), None) or s
                            out["status"], out["status_line"] = md_plain(pick, 220), i
                        break
        hm = re.match(r"^(#{1,4})\s+(.*)$", l)
        if hm:
            level, text = len(hm.group(1)), hm.group(2).strip()
            if out["title"] is None and level == 1:
                out["title"] = md_plain(text, 160)
                continue
            if next_mode and level <= next_level:
                next_mode = False
            if not out["next"] and re.search(r"\bnext\b|następn|nastepn|current question|open question|what now|do zrobienia|\btodo\b", text, re.I):
                next_mode, next_level = True, level
                out["next_kind"] = "pytanie" if re.search(r"question|pytani", text, re.I) else "dalej"
                out["next_head"] = md_plain(text, 80)
                continue
            if out["status"] is None and level >= 2 and re.search(r"current stage|\bstatus\b|\bstan\b|current state|current snapshot", text, re.I):
                for j in range(i, min(i + 6, len(lines))):
                    s2 = lines[j].strip()
                    if s2 and not s2.startswith("#"):
                        out["status"], out["status_line"] = md_plain(re.sub(r"^(?:[-*+]|\d+[.)])\s+", "", s2), 220), j + 1
                        break
            continue
        if not s:
            continue
        km = re.match(r"^\**\s*(Date|Data|Updated|Last updated|Aktualizacja)\b\s*:\**\s*:?\s*(.+)$", s, re.I)
        if km:
            dm = DATE_IN_TEXT.search(km.group(2))
            if dm and not out["date"]:
                out["date"] = dm.group(1)
            continue
        sm = re.match(r"^\**\s*(Status|Stan|Stage|Etap|Milestone)\b\s*:\**\s*:?\s*(.+)$", s, re.I)
        if sm and out["status"] is None:
            out["status"], out["status_line"] = md_plain(sm.group(2), 220), i
            continue
        if next_mode and len(out["next"]) < 4:
            im = re.match(r"^(?:[-*+]|\d+[.)])\s+(.+)$", s)
            if im:
                out["next"].append({"t": md_plain(im.group(1), 170), "line": i})
            elif not out["next"] and not s.startswith(("|", ">")):
                out["next"].append({"t": md_plain(s, 170), "line": i})
            continue
        if out["lead"] is None and not s.startswith(("|", ">", "<", "-", "*", "!", "[", "#")) and len(s) > 40:
            out["lead"], out["lead_line"] = md_plain(s, 260), i
    if (not out["status"] or len(out["status"]) < 12) and out["lead"]:
        out["status"], out["status_line"] = out["lead"], out["lead_line"]
    return out


def stem_of(branch):
    """Mechanical naming stem: prefix + first topical tokens, dates/versions stripped."""
    parts = branch.split("/")
    prefix = parts[0] if len(parts) > 1 else "(bez prefiksu)"
    rest = "/".join(parts[1:]) if len(parts) > 1 else parts[0]
    rest = DATED_RE.sub("", rest)
    rest = re.sub(r"[-_.](v|r|rev|try|attempt|pass|round|part|step|m|p|e|q)\d+[a-z]?\b", "", rest, flags=re.I)
    rest = re.sub(r"\b[0-9a-f]{7,40}\b", "", rest)
    rest = re.sub(r"\d+", "", rest)
    toks = [t for t in re.split(r"[-_/.]+", rest.lower()) if t and t not in {"qualified", "source", "final", "fix", "wip", "new", "the", "and", "of", "to"}]
    return prefix, " ".join(toks[:2]) if toks else "—"


def analyze(dirname):
    repo = os.path.join(REPOS_DIR, dirname)
    name = repo_name(dirname)
    out = {"name": name, "dir": dirname}
    head = git(repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD").strip()
    if not head:
        refs_any = git(repo, "for-each-ref", "refs/remotes/origin", "--format=%(refname:short)").split()
        if not refs_any:
            out.update(empty=True, branches=[], commits={"total": 0})
            return out
        head = "origin/main" if "origin/main" in refs_any else refs_any[0]
    default = head.replace("origin/", "", 1)
    out["default"] = default

    # ---- refs ----
    fmt = "%(refname:short)\x1f%(objectname)\x1f%(committerdate:unix)\x1f%(authordate:unix)\x1f%(authorname)\x1f%(subject)"
    branches = []
    for line in git(repo, "for-each-ref", "refs/remotes/origin", f"--format={fmt}").splitlines():
        ref, sha, cts, ats, an, subj = line.split("\x1f")
        if ref.endswith("/HEAD") or ref == "origin":
            continue
        bname = ref.replace("origin/", "", 1)
        is_def = bname == default
        if is_def:
            ahead = behind = 0
            mb_ts = None
        else:
            lr = git(repo, "rev-list", "--left-right", "--count", f"{head}...{ref}").split()
            behind, ahead = (int(lr[0]), int(lr[1])) if len(lr) == 2 else (None, None)
            mb = git(repo, "merge-base", head, ref).strip()
            mb_ts = int(git(repo, "show", "-s", "--format=%ct", mb).strip() or 0) if mb else None
        tree = git(repo, "rev-parse", f"{sha}^{{tree}}").strip()
        ptree = git(repo, "rev-parse", f"{sha}^^{{tree}}").strip()
        nparents = len(git(repo, "show", "-s", "--format=%P", sha).split())
        empty_tip = bool(ptree) and tree == ptree and nparents == 1
        branches.append({"name": bname, "sha": sha, "ts": int(cts), "author_ts": int(ats), "author": an,
                         "subject": subj[:160], "ahead": ahead, "behind": behind, "fork_ts": mb_ts,
                         "default": is_def, "empty_tip": empty_tip})
    branches.sort(key=lambda b: b["ts"], reverse=True)
    by_sha = defaultdict(list)
    for b in branches:
        by_sha[b["sha"]].append(b["name"])
    aliases = [sorted(v) for v in by_sha.values() if len(v) > 1]
    for b in branches:
        grp = by_sha[b["sha"]]
        b["alias_of"] = [n for n in grp if n != b["name"]]
        b["prefix"], b["stem"] = stem_of(b["name"])
    out["branches"] = branches
    out["alias_groups"] = aliases

    # ---- commits (all refs) ----
    sep = "\x1e"
    raw = git(repo, "log", "--all", "--date-order",
              f"--format=%H\x1f%P\x1f%at\x1f%ct\x1f%an\x1f%ae\x1f%ai\x1f%s\x1f%(trailers:key=Co-authored-by,valueonly,separator=;){sep}")
    commits = [c.strip("\n") for c in raw.split(sep) if c.strip()]
    weeks, months, days, hours, wdays = Counter(), Counter(), Counter(), Counter(), Counter()
    authors, coauth, merges = Counter(), Counter(), 0
    first = last = None
    tool_marks = Counter()
    for c in commits:
        f = c.split("\x1f")
        if len(f) < 9:
            continue
        h, parents, at, ct, an, ae, ai, subj, trailers = f[:9]
        at = int(at)
        if len(parents.split()) > 1:
            merges += 1
        weeks[week_key(at)] += 1
        dt = datetime.fromtimestamp(at, tz=timezone.utc)
        months[dt.strftime("%Y-%m")] += 1
        days[dt.strftime("%Y-%m-%d")] += 1
        m = re.match(r"\d{4}-\d\d-\d\d (\d\d):\d\d:\d\d ([+-]\d{4})", ai)
        if m:
            hours[int(m.group(1))] += 1
        wdays[dt.weekday()] += 1
        authors[an] += 1
        for t in [x.strip() for x in trailers.split(";") if x.strip()]:
            coauth[re.sub(r"\s*<[^>]*>", "", t).strip()] += 1
        low = (an + " " + ae + " " + trailers).lower()
        for key, label in (("claude", "Claude"), ("anthropic", "Claude"), ("codex", "Codex"), ("openai", "Codex/OpenAI"),
                           ("chatgpt", "ChatGPT"), ("copilot", "Copilot"), ("github-actions", "GitHub Actions"), ("[bot]", "bot")):
            if key in low:
                tool_marks[label] += 1
        first = at if first is None or at < first else first
        last = at if last is None or at > last else last
    out["commits"] = {
        "total": len(commits), "merges": merges,
        "first": first, "last": last, "active_days": len(days),
        "weeks": dict(sorted(weeks.items())), "months": dict(sorted(months.items())),
        "days": dict(sorted(days.items())),
        "hours": [hours.get(i, 0) for i in range(24)], "weekdays": [wdays.get(i, 0) for i in range(7)],
        "authors": authors.most_common(8), "coauthors": coauth.most_common(8), "tool_marks": dict(tool_marks),
        "max_day": max(days.items(), key=lambda kv: kv[1]) if days else None,
    }

    # ---- default tree ----
    rows = []
    for line in git(repo, "ls-tree", "-r", "-l", head).splitlines():
        meta, path = line.split("\t", 1)
        parts = meta.split()
        size = int(parts[3]) if parts[3] != "-" else 0
        rows.append((path, size))
    files = [p for p, _ in rows]
    lang_bytes, lang_files = Counter(), Counter()
    for p, s in rows:
        if VENDOR_RE.search(p):
            continue
        ext = p.rsplit(".", 1)[-1].lower() if "." in os.path.basename(p) else ""
        lang = EXT_LANG.get(ext)
        if lang:
            lang_bytes[lang] += s
            lang_files[lang] += 1
    code_bytes = sum(v for k, v in lang_bytes.items() if k in CODE_LANGS)
    md_files = [p for p in files if p.lower().endswith(".md")]
    entry = [p for p in md_files if ENTRY_RE.match(os.path.basename(p)) and p.count("/") <= 2]
    out["tree"] = {
        "files": len(files), "md": len(md_files), "dated_md": len([p for p in md_files if DATED_RE.search(p)]),
        "code_kb": round(code_bytes / 1024), "md_kb": round(sum(s for p, s in rows if p.lower().endswith('.md')) / 1024),
        "lang_bytes": dict(lang_bytes.most_common(8)), "workflows": len([p for p in files if p.startswith(".github/workflows/")]),
        "root_index_html": "index.html" in files, "docs_index_html": "docs/index.html" in files,
        "has_license": any(re.match(r"^(LICENSE|LICENCE|COPYING)", p, re.I) for p in files),
        "top_dirs": [d for d, _ in Counter(p.split('/')[0] for p in files if '/' in p).most_common(8)],
    }

    # ---- README lead + entry docs + declared pointers ----
    readme = next((p for p in files if p.lower() == "readme.md"), None)
    rtxt = show(repo, head, readme) if readme else ""
    title, lead = clean_md_lead(rtxt) if rtxt else (None, None)
    out["readme"] = {"path": readme, "title": title, "lead": lead,
                     "upstream_box3d": ("erincatto" in rtxt.lower() and "box3d" in rtxt.lower() and "physics engine" in rtxt.lower())}
    bnames = sorted({b["name"] for b in branches if not b["default"]}, key=len, reverse=True)
    docs = []
    pointer_hits = defaultdict(set)
    pr_refs = Counter()
    for p in sorted(entry, key=lambda x: (x.count('/'), x))[:14]:
        txt = show(repo, head, p, limit=200000)
        h1 = next((re.sub(r"^#+\s*", "", l).strip() for l in txt.splitlines() if re.match(r"^#\s+\S", l)), None)
        lastc = git(repo, "log", "-1", "--format=%ct", head, "--", p).strip()
        docs.append({"path": p, "title": h1, "chars": len(txt), "last_ts": int(lastc) if lastc else None})
        for bn in bnames:
            if len(bn) >= 6 and bn in txt:
                pointer_hits[bn].add(p)
        for m in re.finditer(r"(?:pull/|PR\s*#|#)(\d{1,4})\b", txt):
            pr_refs[int(m.group(1))] += 1
    out["entry_docs"] = docs
    for b in branches:
        b["declared_in"] = sorted(pointer_hits.get(b["name"], []))
    out["doc_pr_refs"] = [n for n, _ in pr_refs.most_common(30)]

    # ---- the repo's own state note (extractive) ----
    def prio(p):
        base = os.path.splitext(os.path.basename(p))[0].upper()
        for k, key in enumerate(STATE_PRIORITY):
            if base == key or base.startswith(key):
                return (k, p.count("/"))
        return (99, 9)
    cands = sorted((p for p in entry if prio(p)[0] < 99), key=prio)
    if cands:
        sp = cands[0]
        st = state_of(show(repo, head, sp, limit=200000))
        lastc = git(repo, "log", "-1", "--format=%ct", head, "--", sp).strip()
        st.update(path=sp, last_ts=int(lastc) if lastc else None, sha=git(repo, "rev-parse", head).strip())
        out["state"] = st
    else:
        out["state"] = None
    big = sorted(((p, s) for p, s in rows if s > 5 * 1024 * 1024), key=lambda x: -x[1])
    out["tree"]["big_files"] = [[p, round(s / 1048576, 1)] for p, s in big[:5]]
    out["tree"]["junk"] = [p for p in files if re.search(r"(^|/)(\.DS_Store|Thumbs\.db|desktop\.ini|npm-debug\.log)$|(^|/)node_modules/", p)][:5]
    out["head_sha"] = git(repo, "rev-parse", head).strip()

    # ---- package.json / stack hints ----
    stack = set()
    pkg_txt = show(repo, head, "package.json", limit=200000) if "package.json" in files else ""
    deps = []
    pkg = {}
    if pkg_txt:
        try:
            pkg = json.loads(pkg_txt)
            for k in ("dependencies", "devDependencies"):
                deps += list((pkg.get(k) or {}).keys())
        except Exception:
            pass
    # also the freshest non-default branch (real work often lives there)
    fresh = next((b for b in branches if not b["default"]), None)
    if fresh:
        fpkg = git(repo, "show", f"{fresh['sha']}:package.json")[:200000]
        try:
            fp = json.loads(fpkg) if fpkg else {}
            for k in ("dependencies", "devDependencies"):
                deps += list((fp.get(k) or {}).keys())
        except Exception:
            pass
    probe = deps + files[:4000]
    for rx, label in STACK_HINTS:
        r = re.compile(rx, re.I)
        if any(r.search(x) for x in probe):
            stack.add(label)
    if any(p.endswith((".c", ".h")) for p in files) and not deps:
        stack.add("C17 native")
    if "build.gradle" in files:
        stack.add("Gradle")
        if any(re.search(r"(mods\.toml|fabric\.mod\.json|net/minecraft|minecraftforge)", x, re.I) for x in files) or "minecraft" in show(repo, head, "build.gradle", 20000).lower():
            stack.add("Minecraft mod")
    out["stack"] = sorted(stack)
    out["package"] = {"name": pkg.get("name"), "description": pkg.get("description"),
                      "scripts": sorted((pkg.get("scripts") or {}).keys())[:12]} if pkg else None
    return out


LISTED = {x["name"].lower(): x["name"] for x in json.load(open(LIST))["repos"]} if LIST else {}


def repo_name(dirname):
    """Canonical GitHub name. Clone URLs and dir names can differ in case from the real name
    (private repos were cloned as lower-case URLs), so the account's own list decides the spelling."""
    url = git(os.path.join(REPOS_DIR, dirname), "config", "--get", "remote.origin.url").strip()
    m = re.search(r"github\.com[:/][^/]+/([^/]+?)(?:\.git)?/?$", url)
    raw = m.group(1) if m else dirname
    return LISTED.get(raw.lower()) or CANON.get(dirname) or raw


def main():
    dirs = sorted(d for d in os.listdir(REPOS_DIR) if os.path.isdir(os.path.join(REPOS_DIR, d, ".git")) or
                  os.path.isfile(os.path.join(REPOS_DIR, d, "HEAD")))
    if LIST:
        dirs = [d for d in dirs if repo_name(d).lower() in LISTED]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(analyze, dirs))
    data = {"generated_ts": int(NOW), "generated": datetime.fromtimestamp(NOW, tz=timezone.utc).isoformat(timespec="minutes"),
            "repos_dir_count": len(dirs), "repos": res, "seconds": round(time.time() - t0, 1)}
    json.dump(data, open(OUT, "w"), ensure_ascii=False)
    print(f"{len(res)} repos in {data['seconds']} s -> {OUT}")


if __name__ == "__main__":
    main()
