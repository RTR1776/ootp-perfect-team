#!/bin/bash
# Thursday Rosters — double-click after Push to GitHub.command has pulled it.
#
# 1. Thursday Splendid Silver Only Spectacular (537): its current format first
#    ran 09-24 (run #27, L.J.), not 10-01. This sets that date (shown first;
#    only a typed "y" writes). File run #27's export too, so the event's own
#    play counts.
# 2. Saves Claude's rosters for Splendid Silver and CWhit's Cap Challenge 5.
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mThursday rosters\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
SET=(--tournament 537 --format-since 2026-09-24 --note "L.J. 2026-10-01: the Splendid Silver Only format first ran 09-24 (run #27)")

run scripts/catalogue-set.ts "${SET[@]}" || { read -r -p "Press return to close."; exit 1; }
echo
while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
read -r -p "Write this change? [y/N] " ok
case "$ok" in y|Y|yes|YES|Yes) run scripts/catalogue-set.ts "${SET[@]}" --commit || { read -r -p "Press return to close."; exit 1; } ;; *) echo "Left as it is." ;; esac
echo
"../Save Current Rosters.command" ../Inbox/rosters/current-2026-10-01-silver2.tsv < /dev/tty
exec "../Save Current Rosters.command" ../Inbox/rosters/current-2026-10-01-cc5.tsv
