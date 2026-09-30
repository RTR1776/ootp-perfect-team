#!/bin/bash
# Fix Deadball and Late 1900s — double-click after Push to GitHub.command has pulled it.
#
# 1. Wednesday Night of the Living Deadball (551) kept its format (1920 RE,
#    1919 Fenway, cards 1800-1920), but was marked "new format from 09-30", so
#    its own four exports were left out. This clears that date (shown first;
#    only a typed "y" writes).
# 2. Saves Claude's rebuilt rosters for Deadball and Daily Late 1900s. Both had
#    two cards of one player (Cy Young x2, Dave Stieb x2), which the game
#    doesn't allow; the optimiser now enforces one card per player.
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mFix Deadball and Late 1900s\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
SET=(--tournament 551 --format-since none --note "L.J. 2026-09-30: Deadball's format did not change (1920 RE, 1919 Fenway, cards 1800-1920); its runs 23-27 are the current format")

run scripts/catalogue-set.ts "${SET[@]}" || { read -r -p "Press return to close."; exit 1; }
echo
while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
read -r -p "Write this change? [y/N] " ok
case "$ok" in y|Y|yes|YES|Yes) run scripts/catalogue-set.ts "${SET[@]}" --commit || { read -r -p "Press return to close."; exit 1; } ;; *) echo "Left as it is." ;; esac
echo
exec "../Save Current Rosters.command" ../Inbox/rosters/current-2026-09-30-deadball.tsv
