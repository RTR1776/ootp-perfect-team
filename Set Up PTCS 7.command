#!/bin/bash
# Set Up PTCS 7 — double-click after Push to GitHub.command has pulled it down.
#
# 1. Adds the ten PTCS 7 Championship events (Sat 10-10) to the app as
#    9070001-9070010, from web/src/db/seed/ptcs7-championship.json: 1970 RE,
#    1971 Dodger Stadium, DH, best of 9, variant cap 11, and each event's cap
#    and value window. It shows the rows first; only a typed "y" writes.
# 2. Saves Claude's six rosters (Bronze, Silver, Gold, Diamond, Open, Cap;
#    L.J. is not qualifying in Iron or Live, and the PDs are drafts) from
#    Inbox/rosters/current-2026-09-30-ptcs7.tsv, through Save Current Rosters.
#
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSet up PTCS 7 Championship\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
SEED=src/db/seed/ptcs7-championship.json

run scripts/import-ptcs6-championship.ts --seed "$SEED" --id-base 9070000 --dry || { read -r -p "Press return to close."; exit 1; }
echo
while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
read -r -p "Add these ten events? [y/N] " ok
case "$ok" in y|Y|yes|YES|Yes) ;; *) echo "Nothing written."; read -r -p "Press return to close."; exit 0 ;; esac
run scripts/import-ptcs6-championship.ts --seed "$SEED" --id-base 9070000 || { read -r -p "Press return to close."; exit 1; }
echo
exec "../Save Current Rosters.command" ../Inbox/rosters/current-2026-09-30-ptcs7.tsv
