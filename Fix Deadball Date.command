#!/bin/bash
# Fix Deadball Date — double-click after Push to GitHub.command has pulled it.
#
# Wednesday Night of the Living Deadball (551): the current format (1920 RE,
# 1919 Fenway, cards 1800-1920) first ran 09-23 (run #27, L.J.); runs before
# that were a different format. This sets that date, so the older exports are
# kept out of this event's own play (shown first; only a typed "y" writes).
# Then it saves Claude's rebuilt roster (one card per player, built without
# the old-format exports) as "Claude pick 2026-09-30 deadball2".
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mFix the Deadball format date\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
SET=(--tournament 551 --format-since 2026-09-23 --note "L.J. 2026-09-30: the current format first ran 09-23 (run #27); earlier runs were different")

run scripts/catalogue-set.ts "${SET[@]}" || { read -r -p "Press return to close."; exit 1; }
echo
while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
read -r -p "Write this change? [y/N] " ok
case "$ok" in y|Y|yes|YES|Yes) run scripts/catalogue-set.ts "${SET[@]}" --commit || { read -r -p "Press return to close."; exit 1; } ;; *) echo "Left as it is." ;; esac
echo
exec "../Save Current Rosters.command" ../Inbox/rosters/current-2026-09-30-deadball2.tsv
