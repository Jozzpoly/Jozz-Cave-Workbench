#!/usr/bin/env bash
# Put the gh-pages checkout back to the page from before the newest refresh, and pause the automat (10 Nov 2026).
#   tools/cofnij_pages.sh GH_PAGES_DIR "WHY" [RUN_URL]
# Takes the tree of the parent of the newest "dom(odświeżenie)" commit exactly (files that refresh added go away),
# marks status.json paused (tools/publikuj_pages.py --wstrzymaj) and commits. It does not push; the workflow does.
# Prints fp=<fingerprint of the restored page>. Status: tymczasowe, with .github/workflows/dom-odswiezanie.yml.
set -euo pipefail
dir=$1; why=$2; run=${3:-}
here=$(cd "$(dirname "$0")/.." && pwd)
cd "$dir"
last=$(git log --format=%H --grep '^dom(odświeżenie)' -n 1)
if [ -z "$last" ]; then echo "nothing to roll back: no refresh by the automat on this branch" >&2; exit 3; fi
git read-tree -u --reset "$last~1"
python3 -I "$here/tools/publikuj_pages.py" . . --run "$run" --wstrzymaj "$why" >/dev/null
git add -A
git commit -q -m "dom(cofnięcie): strona sprzed ${last::7}, automat wstrzymany" -m "$why. ${run}"
echo "fp=$(python3 -I -c "import json; print((json.load(open('status.json')).get('data') or {}).get('fingerprint') or '')")"
