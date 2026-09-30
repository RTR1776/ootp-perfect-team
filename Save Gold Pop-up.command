#!/bin/bash
# Save Gold Pop-up — double-click after Push to GitHub.command has pulled it.
#
# Adds "Live-Plus Gold Pop-up" (Sat 10-03 18:59) to the app as event 9300002:
# Gold or lower (40-89), 2026 cards only, default RE, DH, 2026 Wrigley Field,
# from L.J.'s screenshot 09-30. It shows the row first; only a typed "y"
# writes. Then it saves Claude's roster from
# Inbox/rosters/current-2026-09-30-popgold.tsv through Save Current Rosters.
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSet up the Live-Plus Gold Pop-up\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
ADD=(--id 9300002 --name "Live-Plus Gold Pop-up" --series liveplusgoldpopup --year 2010 --stadium "2026 Wrigley Field" --dh
  --value 40-89 --card-years 2026-2026 --fee "1,000 PP"
  --text "Entry fee 1,000 PP. Only cards rated GOLD or lower on the active roster. Only cards from 2026. Default strategy and stats settings, DH. 2026 Wrigley Field (AVG 1.019/.995, HR .973/1.006, 2B .944, 3B 1.089). Quadruple round robin in 16-team pools, 8 advance to a best-of-9 bracket. Starts Sat 10-03 18:59."
  --note "L.J.'s screenshot 2026-09-30")

run scripts/catalogue-add.ts "${ADD[@]}" || { read -r -p "Press return to close."; exit 1; }
echo
while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
read -r -p "Add this event? [y/N] " ok
case "$ok" in y|Y|yes|YES|Yes) ;; *) echo "Nothing written."; read -r -p "Press return to close."; exit 0 ;; esac
run scripts/catalogue-add.ts "${ADD[@]}" --commit || { read -r -p "Press return to close."; exit 1; }
echo
exec "../Save Current Rosters.command" ../Inbox/rosters/current-2026-09-30-popgold.tsv
