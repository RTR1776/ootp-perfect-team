#!/bin/bash
# Save Dregs Roster — double-click this once, after Push to GitHub.command has
# pulled it down. Claude's session does not write to the app's database, so
# this does it from the Mac.
#
# Monday Now We're into the Dregs ran its new format on 09-28, but the
# catalogue still has the slot's old event, Monday Gold Floor Cap (cards
# 80-105, cap 2242, 2025 Standard Stadium), so /build finds every Dregs card
# illegal ("value is below 80").
#
# 1. Event 548 gets the new name and the rules from L.J.'s screenshot: cards
#    50-64, cap 1468, 1994 RE, DH, 1996 Dodger Stadium, new format from 09-28.
#    The old rules are kept under restrictions.previousFormat.
# 2. Claude's roster goes to /build as "Claude pick 2026-09-28", checked
#    against the new rules first and saved only if it passes.
#
# It shows the change first. Only a typed "y" writes. Safe to run twice.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the Dregs rules and roster\033[0m\n\n'
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

EVENT=548
RULES=(--tournament "$EVENT" --name "Monday Now We're into the Dregs" --year 1994 --stadium "1996 Dodger Stadium" --dh
       --value 50-64 --cap 1468 --drop notes
       --text "Only cards rated LOW BRONZE (64) or lower and HIGH IRON (50) or higher on the active roster. Card value cap 1468 (56 a player); unused roster spots count 50. 1994 RE, DH. 1996 Dodger Stadium (AVG .954/.958, HR .850/.925, 2B .896, 3B .774). Best of seven."
       --note "L.J.'s screenshot 2026-09-28: the 09-19 post's deferred format, first run #28"
       --format-since 2026-09-28)
ROSTER=(scripts/roster-save.ts --file "../Inbox/rosters/dregs-claude-2026-09-28.txt" --tournament "$EVENT" --name "Claude pick 2026-09-28" --replace)

echo "1. Event $EVENT, from the old Gold Floor Cap to the Dregs"
out=$(run scripts/catalogue-set.ts "${RULES[@]}" 2>&1) || {
  echo "$out"
  echo "Could not read event $EVENT. If it says \"unknown flags\", run Push to GitHub.command first."
  close 1
}
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$"
echo
echo "2. Claude's roster: 26 cards, value 1468, every card pinned by id"
echo "   (Inbox/rosters/dregs-claude-2026-09-28.txt). It is checked against the"
echo "   new rules once they are saved, and saved only if it passes. Claude checked"
echo "   it against them beforehand: ready."
echo
if ! ask "Save the new rules and the roster?"; then echo "Nothing saved."; close 0; fi

echo
out=$(run scripts/catalogue-set.ts "${RULES[@]}" --commit 2>&1) || { echo "$out"; echo "Could not save the new rules."; close 1; }
printf '%s\n' "$out" | tail -1
check=$(run "${ROSTER[@]}" --dry 2>&1) || { echo "$check"; echo "Could not check the roster."; close 1; }
printf '%s\n' "$check" | grep -v "^dry run"
case "$check" in
  *" · ready"*) ;;
  *) echo "The roster does not pass the new rules (see above), so it was not saved. The new rules are saved."; close 1 ;;
esac
run "${ROSTER[@]}" || { echo "Could not save the roster (see above)."; close 1; }

printf "\n\033[32mDone.\033[0m On /build, pick Monday Now We're into the Dregs, then Saved rosters → \"Claude pick 2026-09-28\".\n"
echo "You can delete this file now."
close 0
