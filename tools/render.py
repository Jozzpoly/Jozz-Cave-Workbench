#!/usr/bin/env python3
"""Assemble dist/biblioteka.html from src/ + data/library.json + inlined variable fonts."""
import argparse, base64, json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(HERE, *a)
FS = P("node_modules", "@fontsource-variable")
LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"


def face(family, path, weight, rng, stretch=None):
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    st = f"font-stretch:{stretch};" if stretch else ""
    return (f'@font-face{{font-family:"{family}";src:url(data:font/woff2;base64,{b64}) format("woff2");'
            f"font-weight:{weight};{st}font-style:normal;font-display:swap;unicode-range:{rng};}}")


fonts = "\n".join([
    face("Anybody V", os.path.join(FS, "anybody/files/anybody-latin-standard-normal.woff2"), "100 900", LATIN, "50% 150%"),
    face("Anybody V", os.path.join(FS, "anybody/files/anybody-latin-ext-standard-normal.woff2"), "100 900", LATIN_EXT, "50% 150%"),
    face("Recursive V", os.path.join(FS, "recursive/files/recursive-latin-mono-normal.woff2"), "300 1000", LATIN),
    face("Recursive V", os.path.join(FS, "recursive/files/recursive-latin-ext-mono-normal.woff2"), "300 1000", LATIN_EXT),
])
ap = argparse.ArgumentParser()
ap.add_argument("--host", choices=["artifact", "web"], default="artifact",
                help="artifact: games open in a new tab (claude.ai blocks frames); web: games open inside the page")
ap.add_argument("--app", choices=["biblioteka", "jaskinia"], default="biblioteka",
                help="biblioteka: the Library pages; jaskinia: the same panels as windows Jozz arranges himself")
ap.add_argument("--out", default=None)
A = ap.parse_args()
css = open(P("src", "style.css"), encoding="utf-8").read()
app = open(P("src", "app.js"), encoding="utf-8").read()
data = json.load(open(P("data", "library.json"), encoding="utf-8"))
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
n = len(data["repos"])
if A.app == "jaskinia":
    J = P("src", "jaskinia")
    parts = sorted(f for f in os.listdir(J) if f.endswith(".js"))
    shell = "\n".join(open(os.path.join(J, f), encoding="utf-8").read() for f in parts)
    tpl = open(os.path.join(J, "index.html"), encoding="utf-8").read()
    jcss = open(os.path.join(J, "jaskinia.css"), encoding="utf-8").read()
    # the build says who it is, so a screen recording identifies its own version (docs/VERSIONS.md)
    import datetime
    ver = open(os.path.join(J, "version.txt"), encoding="utf-8").read().strip()
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    built = (datetime.datetime.fromtimestamp(int(epoch), datetime.timezone.utc) if epoch else datetime.datetime.now(datetime.timezone.utc)).strftime("%Y-%m-%dT%H:%MZ")
    build = json.dumps({"v": ver, "built": built, "host": A.host})
    # the demo lab that speaks the instrument contract (docs/przyrzad), carried inside, so the owner can try it offline
    demo_dir = P("docs", "przyrzad")
    demo = open(os.path.join(demo_dir, "demo.html"), encoding="utf-8").read().replace(
        '<script src="jaskinia-przyrzad.js"></script>',
        "<script>\n" + open(os.path.join(demo_dir, "jaskinia-przyrzad.js"), encoding="utf-8").read().replace("</script", "<\\/script") + "\n</script>")
    lab_demo = "const LAB_DEMO = " + json.dumps(demo, ensure_ascii=False) + ";\n"
    script = (f'const BIB_HOST = "{A.host}";\nconst BIB_MODE = "jaskinia";\nconst JASK_BUILD = {build};\n' + lab_demo + app + "\n(() => {\n'use strict';\n" + shell + "\n})();\n")
    # the 3D runtime (tools/swiat/build.mjs): three.js and a few addons; it only defines a factory, so a Jaskinia
    # without 3D windows pays the parse and nothing else (56-swiat.js starts it when a 3D window first asks)
    vend = P("src", "vendor", "swiat3d.js")
    if os.path.exists(vend):
        script = open(vend, encoding="utf-8").read().replace("<!--", "<\\!--") + "\n" + script
    out = (tpl.replace("/*N*/", str(n)).replace("/*FONTS*/", fonts).replace("/*CSS*/", css).replace("/*JCSS*/", jcss)
           .replace("/*DATA*/", payload).replace("/*APP*/", script.replace("</script", "<\\/script")))
    name = "jaskinia.html" if A.host == "artifact" else "jaskinia-web.html"
else:
    tpl = open(P("src", "index.html"), encoding="utf-8").read()
    out = (tpl.replace("/*N*/", str(n)).replace("/*FONTS*/", fonts).replace("/*CSS*/", css).replace("/*DATA*/", payload)
           .replace("/*APP*/", f'const BIB_HOST = "{A.host}";\n' + app.replace("</script", "<\\/script")))
    name = "biblioteka.html" if A.host == "artifact" else "biblioteka-web.html"
if A.host == "artifact":
    # Opened straight from a disk, the fragment has no HTTP header to name its encoding, and Chromium may then read the
    # UTF-8 as an 8-bit code page and break the script (GPT's real file:// check on PR #1). Inside claude.ai the page's
    # own head already says utf-8, so this line changes nothing there.
    out = '<meta charset="utf-8">\n' + out
if A.host == "web":
    # self-hosted: a complete document (the claude.ai artifact host adds this wrapper itself)
    import re
    head_bits = "".join(re.findall(r'<title>.*?</title>\n?|<meta name="description"[^>]*>\n?', out))
    out = re.sub(r'<title>.*?</title>\n?|<meta name="description"[^>]*>\n?', '', out, count=2)
    out = ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head_bits +
           '<style>[hidden]{display:none!important}body{margin:0}</style>\n</head>\n<body>\n' + out + '\n</body>\n</html>\n')
os.makedirs(P("dist"), exist_ok=True)
dest = A.out or P("dist", name)
open(dest, "w", encoding="utf-8").write(out)
print(f"{os.path.relpath(dest, HERE)} {len(out.encode()) / 1024:.0f} KB · host={A.host}")
