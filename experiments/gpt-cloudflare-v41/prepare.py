#!/usr/bin/env python3
"""GPT TEMP: prepare a public-only, pinned v4.1 Cloudflare Workers static assets candidate.
No credentials, deployments, mutations to Claude's branch, or private layer.
This script does not certify semantic privacy or cross-device behavior.
"""
from __future__ import annotations
import argparse, hashlib, json, pathlib, re, subprocess, sys

BASE = "efbc980658e05decbee683930dedb1102214bc4b"
EXPECTED_FILES = {"index.html", "estate.json", "status.json"}
DATA_PATTERN = re.compile(r'<script\s+id=["\']lib-data["\']\s+type=["\']application/json["\']\s*>(.*?)</script\s*>', re.S)

def err(message):
    raise ValueError(message)

def git(root, *args):
    return subprocess.check_output(["git","-C",str(root),*args],text=True).strip()

def verify(root, output):
    root=root.resolve();output=output.resolve()
    if root == output or root in output.parents: err("Output must be outside source checkout")
    if output.exists() and any(output.iterdir()): err("Output must be empty")
    if (root/"private").exists(): err("Private overlay detected: refuse")
    if git(root,"merge-base",BASE,"HEAD") != BASE: err("Source did not descend from the qualified v4.1")
    # Prevent experimental branch from silently inheriting modified data, code, templates or release artifacts.
    if git(root,"diff","--name-only",BASE,"HEAD","--","src","data","dist","tools","package.json","package-lock.json"):
        err("Jaskinia source/data/build differ from pinned PR v4.1")
    data=json.loads((root/"data/library.json").read_text(encoding="utf-8"))
    repos=data.get("repos",[])
    cov=data.get("estate",{}).get("coverage",{})
    if len(repos)!=24 or len({r.get("name") for r in repos})!=24: err("Unexpected repository count or duplicate names")
    if any(r.get("private") is not False for r in repos): err("Private/unclassified project in dataset")
    if any(cov.get(k)!=24 for k in ("expected","collected","public")): err("Incomplete public coverage")
    if cov.get("private") != 0 or cov.get("missing") or cov.get("unlisted"): err("Missing/nonpublic coverage")
    html=(root/"dist/jaskinia-web.html").read_bytes()
    try: text=html.decode("utf-8")
    except UnicodeDecodeError: err("Non UTF-8 output")
    if "<!doctype html>" not in text.lower() or 'const BIB_HOST = "web";' not in text or '"v": "4.1"' not in text:
        err("Expected full v4.1 web build not found")
    match=DATA_PATTERN.search(text)
    if not match or json.loads(match.group(1))!=data: err("Compiled HTML data does not equal public source snapshot")
    if (root/"src/jaskinia/version.txt").read_text().strip()!="4.1": err("Source version mismatch")
    site=output/"site";site.mkdir(parents=True)
    (site/"index.html").write_bytes(html)
    compact=json.dumps(data,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    (site/"estate.json").write_bytes(compact)
    digest=lambda b:hashlib.sha256(b).hexdigest()
    status={
      "schema":"jaskinia-stage-provenance-v1",
      "environment":"PUBLIC_RESEARCH_STAGE_NOT_OWNER_INSTANCE",
      "source":{"repo":"Jozzpoly/Jozz-Cave-Workbench","qualified_pr":1,
                "exact_pr_commit":BASE,"staging_commit":git(root,"rev-parse","HEAD")},
      "jaskinia":{"version":"4.1","url":"/","sha256":digest(html)},
      "data":{"url":"/estate.json","sha256":digest(compact),"repos":24,
              "snapshot_ts":data.get("estate",{}).get("generated_ts"),
              "coverage":{k:cov[k] for k in ("expected","collected","public")}},
      "limitations":{"snapshot_not_live":True,"no_private_layer":True,"no_owner_notes":True,
                     "no_cross_device_sync":True,"no_authenticated_instruments":True,
                     "not_v4_1_owner_approval":True},
      "provenance":{"prepared_by":"ChatGPT GPT-6 (self-declared)",
                    "repo_write_via":"Jozzpoly GitHub connector","owner_approval":False},
    }
    (site/"status.json").write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    cfg={"name":"jaskinia-gpt-public-research-stage","compatibility_date":"2026-10-16",
         "workers_dev":True,
         "assets":{"directory":"./site","html_handling":"none","not_found_handling":"none"}}
    (output/"wrangler.jsonc").write_text(json.dumps(cfg,indent=2)+"\n",encoding="utf-8")
    actual={p.name for p in site.iterdir()}
    if actual!=EXPECTED_FILES:err("Unexpected published asset")
    print(json.dumps({"result":"STAGE_ONLY_PASS","exact_pr_commit":BASE,
                      "staging_commit":status["source"]["staging_commit"],
                      "published_assets":sorted(actual),"files_sha256":{p.name:digest(p.read_bytes()) for p in site.iterdir()}},
                     ensure_ascii=False))
    return status

if __name__=="__main__":
    args=argparse.ArgumentParser()
    args.add_argument("--root",type=pathlib.Path,default=pathlib.Path("."))
    args.add_argument("--output",type=pathlib.Path,required=True)
    z=args.parse_args()
    try: verify(z.root,z.output)
    except Exception as e:print("FAIL_CLOSED:",repr(e),file=sys.stderr);sys.exit(1)
