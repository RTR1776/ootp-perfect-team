#!/bin/bash
# Set Weekly Format Dates — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's cloud session cannot write to the app's database,
# so this does it from the Mac.
#
# PT's 09-19 post (live by about 18:00 Chicago time) changed 17 weekly formats,
# but the run of each weekly that was already scheduled when it went up kept the
# old rules. So each new format first ran a week after that run: Monday Bronze
# was Rio Grande 1995 on 09-21 and is Olympic Stadium 1979 from 09-28. The
# catalogue dated 12 of them 09-20 and left 5 undated, so old-format exports
# could be read as the new format.
#
# 1. Saturday Diamond Variety (541) gets the rules it has played since 09-26:
#    1952 RE, 1958 Tiger Stadium, cards 1910-1959, no card-kind rule.
# 2. Each of the 17 changed weeklies gets the day its new format first ran (or
#    runs). While any export on file predates that day, /build leaves the series
#    out as the event's own play.
# 3. Claude's Monday Bronze roster is saved to /build as "Claude pick 2026-09-28".
#
# It shows every change first. Only a typed "y" writes. Safe to run twice.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSet the weekly format dates\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
# Keys pressed while the previews print are thrown away, so only a y typed
# at the prompt itself writes anything.
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}

DV=(--tournament 541 --year 1952 --stadium "1958 Tiger Stadium" --card-years 1910-1959
    --drop cardTypes,verified,pendingRefresh
    --text "Only cards rated DIAMOND or lower are allowed on the active roster. Cards 1910-1959."
    --note "2026-09-19 weekly post; in effect from the 2026-09-26 run"
    --format-since 2026-09-26)
NOTE="L.J. 2026-09-28: the 09-19 post's formats first ran a week later"
# tournament, then the Chicago day its new format first ran or runs
DATES=(
  "779 2026-10-03"   # Saturday Negro Leagues Slots (06:01; 09-26 was already scheduled)
  "534 2026-10-03"   # Saturday Iron Warriors (08:05)
  "535 2026-10-03"   # Saturday Bronze Cap (12:02)
  "538 2026-09-27"   # Sunday High Iron Floor and Gold Ceiling
  "546 2026-09-27"   # Sunday Open Slots
  "547 2026-09-27"   # Sunday Open Main Event
  "536 2026-09-28"   # Monday Up And At Them Bronze
  "545 2026-09-29"   # Tuesday Live
  "550 2026-09-30"   # Wednesday 1950 to Now
  "542 2026-09-30"   # Wednesday Ice to See You
  "551 2026-09-30"   # Wednesday Night of the Living Deadball
  "537 2026-10-01"   # Thursday Silver Spectacular
  "540 2026-10-01"   # Thursday Night Gold Rush
  "569 2026-10-02"   # Friday Nightmare Cap
  "570 2026-10-02"   # Friday Danksville
  "543 2026-10-02"   # Friday Night Live Slots
)
ROSTER=(scripts/roster-save.ts --file ../Inbox/rosters/bronzeweekly-claude-2026-09-28.txt --tournament 536 --name "Claude pick 2026-09-28" --replace)

echo "1. Saturday Diamond Variety rules"
out=$(run scripts/catalogue-set.ts "${DV[@]}" 2>&1) || { echo "$out"; echo "Could not read Saturday Diamond Variety."; close 1; }
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$"
echo
echo "2. The day each weekly's new format first ran"
for d in "${DATES[@]}"; do
  set -- $d
  out=$(run scripts/catalogue-set.ts --tournament "$1" --format-since "$2" --note "$NOTE" 2>&1) || { echo "$out"; echo "Could not read tournament $1."; close 1; }
  printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$"
done
echo
echo "3. Claude's Monday Bronze roster (checked, not saved yet)"
run "${ROSTER[@]}" --dry || { echo "The roster does not check out (see above)."; close 1; }
echo
if ! ask "Save all of this?"; then echo "Nothing saved."; close 0; fi

saved=0
commit() { local out; out=$("$@" --commit 2>&1) || { echo "$out"; return 1; }; case "$out" in *"no change"*) ;; *) saved=$((saved + 1)) ;; esac; }
commit run scripts/catalogue-set.ts "${DV[@]}" || { echo "Could not save Saturday Diamond Variety."; close 1; }
for d in "${DATES[@]}"; do
  set -- $d
  commit run scripts/catalogue-set.ts --tournament "$1" --format-since "$2" --note "$NOTE" || { echo "Could not save tournament $1."; close 1; }
done
echo "Saved $saved event(s); the rest were already set."
run "${ROSTER[@]}" || { echo "Could not save the roster (see above)."; close 1; }

printf '\n\033[32mDone.\033[0m On /build, pick Monday Up And At Them Bronze, then Saved rosters → "Claude pick 2026-09-28".\n'
echo "You can delete this file now."
close 0
