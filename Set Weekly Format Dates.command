#!/bin/bash
# Set Weekly Format Dates — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's cloud session cannot write to the app's database,
# so this does it from the Mac.
#
# PT's 09-19 post changed 13 weekly formats, but each one first ran a week later:
# the next run of every weekly was already scheduled under the old rules (Monday
# Bronze: Rio Grande 1995 on 09-21, Olympic Stadium 1979 from 09-28). The
# catalogue dated every change 09-20, which counts last week's old-format
# exports as the new format.
#
# 1. Saturday Diamond Variety (541) gets the rules it has played since 09-26:
#    1952 RE, 1958 Tiger Stadium, cards 1910-1959, no card-kind rule. Its row
#    still had the old format, so /build read the new 09-26 export together
#    with the old ones.
# 2. Each changed weekly gets the day its new format first ran (or runs). While
#    any export on file predates that day, /build leaves the series out as the
#    event's own play, so old and new never mix.
# 3. Claude's Monday Bronze roster is saved to /build as "Claude pick 2026-09-28".
#
# It shows every change first and asks once. Safe to run twice.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSet the weekly format dates\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }

DV=(--tournament 541 --year 1952 --stadium "1958 Tiger Stadium" --card-years 1910-1959
    --drop cardTypes,verified,pendingRefresh
    --text "Only cards rated DIAMOND or lower are allowed on the active roster. Cards 1910-1959."
    --note "2026-09-19 weekly post; in effect from the 2026-09-26 run"
    --format-since 2026-09-26)
NOTE="L.J. 2026-09-28: the 09-19 post's formats first ran a week later"
# tournament, then the Chicago day its new format first ran or runs
DATES=(
  "779 2026-09-26"   # Saturday Negro Leagues Slots
  "538 2026-09-27"   # Sunday High Iron Floor and Gold Ceiling
  "546 2026-09-27"   # Sunday Open Slots
  "547 2026-09-27"   # Sunday Open Main Event
  "536 2026-09-28"   # Monday Up And At Them Bronze
  "550 2026-09-30"   # Wednesday 1950 to Now
  "542 2026-09-30"   # Wednesday Ice to See You
  "551 2026-09-30"   # Wednesday Night of the Living Deadball
  "537 2026-10-01"   # Thursday Silver Spectacular
  "540 2026-10-01"   # Thursday Night Gold Rush
  "569 2026-10-02"   # Friday Nightmare Cap
  "570 2026-10-02"   # Friday Danksville
)

echo "1. Saturday Diamond Variety rules"
run scripts/catalogue-set.ts "${DV[@]}" || { echo "Could not read the event (see above)."; close 1; }
echo
echo "2. The day each weekly's new format first ran"
for d in "${DATES[@]}"; do
  set -- $d
  out=$(run scripts/catalogue-set.ts --tournament "$1" --format-since "$2" --note "$NOTE" 2>&1) || { echo "$out"; echo "Could not read tournament $1 (see above)."; close 1; }
  printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$"
done
echo
read -r -p "Save all of this? [Y/n] " ok
case "$ok" in
  n|N|no|NO) echo "Nothing saved."; close 0 ;;
esac
run scripts/catalogue-set.ts "${DV[@]}" --commit > /dev/null || { echo "Could not save Saturday Diamond Variety (see above)."; close 1; }
for d in "${DATES[@]}"; do
  set -- $d
  run scripts/catalogue-set.ts --tournament "$1" --format-since "$2" --note "$NOTE" --commit > /dev/null || { echo "Could not save tournament $1 (see above)."; close 1; }
done
echo "Saved."

echo
echo "3. Claude's Monday Bronze roster"
run scripts/roster-save.ts --file ../Inbox/rosters/bronzeweekly-claude-2026-09-28.txt --tournament 536 --name "Claude pick 2026-09-28" --replace || close 1

printf '\n\033[32mDone.\033[0m On /build, pick Monday Up And At Them Bronze, then Saved rosters → "Claude pick 2026-09-28".\n'
echo "You can delete this file now."
close 0
