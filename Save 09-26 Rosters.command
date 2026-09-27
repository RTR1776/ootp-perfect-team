#!/bin/bash
# Save 09-26 Rosters — double-click this once, after Push to GitHub.command has
# pulled it down. Claude's cloud session cannot write to the app's database, so
# this does it from the Mac:
#
# 1. Saturday Diamond Variety (541) gets this week's rules: 1952 RE, 1958 Tiger
#    Stadium, cards 1910-1959, no card-kind rule. It shows the change and asks
#    first. The old rules stay on the row (restrictions.previousFormat).
# 2. Both of Claude's 2026-09-26 rosters are saved to /build under "Claude pick
#    2026-09-26": Saturday Diamond Variety and Daily Low Bronze Only.
#
# Safe to run twice: a second run replaces the same two saved rosters.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the 2026-09-26 rosters to the app\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }

RULES=(--tournament 541 --year 1952 --stadium "1958 Tiger Stadium" --card-years 1910-1959
       --drop cardTypes,verified,pendingRefresh
       --text "Only cards rated DIAMOND or lower are allowed on the active roster. Cards 1910-1959."
       --note "2026-09-19 weekly post; in effect from the 2026-09-26 run")

echo "1. Saturday Diamond Variety rules"
run scripts/catalogue-set.ts "${RULES[@]}" || { echo "Could not read the event (see above)."; close 1; }
echo
read -r -p "Save these rules? [Y/n] " ok
case "$ok" in
  n|N|no|NO) echo "Rules left as they were; nothing saved."; close 0 ;;
esac
run scripts/catalogue-set.ts "${RULES[@]}" --commit || { echo "Could not save the rules (see above)."; close 1; }

echo
echo "2. Rosters"
run scripts/roster-save.ts --file ../Inbox/rosters/diamondvariety-claude-2026-09-26.txt --tournament 541 --name "Claude pick 2026-09-26" --replace || close 1
run scripts/roster-save.ts --file ../Inbox/rosters/lowbronzeonly-claude-2026-09-26.txt --tournament 519 --name "Claude pick 2026-09-26" --replace || close 1

printf '\n\033[32mDone.\033[0m On /build, pick the event, then Saved rosters → "Claude pick 2026-09-26".\n'
echo "You can delete this file now."
close 0
