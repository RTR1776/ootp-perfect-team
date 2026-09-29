#!/bin/bash
# Save Dead Silver Roster — double-click this once, after Push to GitHub.command
# has pulled it down, before Tuesday's 07:59 start. Claude's session does not
# write to the app's database, so this does it from the Mac.
#
# 1. Event 549 becomes Tuesday Dead Silver Walking (it was Tuesday Up To 1969):
#    Silver or lower, Deadball cards only, 1919 RE, no DH, 1911 Washington
#    Park, 128 teams, best of seven, format since 09-29.
# 2. Claude's roster goes to /build as "Claude pick 2026-09-28", checked
#    against the new rules first and saved only if it passes.
#
# One question first: the rules say "Deadball (pre-1920)", but the game's own
# card data files 1920 cards as Deadball (1871-1920). Check in the game whether
# a 1920 card (Jack Tobin, Joe Judge or Joe Dugan) can go on this event's
# roster. Yes saves the roster with them (about 19 runs better on the model);
# anything else saves the one with 1919 and earlier only.
#
# It shows the change first. Only a typed "y" writes. Safe to run twice.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the Dead Silver Walking rules and roster\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
# Keys pressed while the previews print are thrown away, so only a y typed
# at the prompt itself counts.
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}

EVENT=549
echo "First, in the game: can a 1920 card (Jack Tobin, Joe Judge or Joe Dugan)"
echo "go on this event's roster? The rules say pre-1920; the game's card data"
echo "calls 1920 Deadball. If you're not sure, answer n."
if ask "Does the game take 1920 cards here?"; then
  YEARS=1871-1920; FILE=deadsilver-1920-claude-2026-09-29.txt
  NOTE="L.J.'s screenshot 2026-09-28: the 09-19 post's deferred format, first run 09-29 07:59; 1920 cards count (L.J. checked in game)"
else
  YEARS=1871-1919; FILE=deadsilver-claude-2026-09-29.txt
  NOTE="L.J.'s screenshot 2026-09-28: the 09-19 post's deferred format, first run 09-29 07:59; cards to 1919 (the text says pre-1920)"
fi
echo

RULES=(--tournament "$EVENT" --name "Tuesday Dead Silver Walking" --year 1919 --stadium "1911 Washington Park" --no-dh
       --value 40-79 --card-years "$YEARS" --drop notes,yearMax
       --text "Only cards rated SILVER or lower on the active roster. Only Deadball (pre-1920) era cards. 1919 strategy and stats settings, no DH. 1911 Washington Park (AVG 1.005/.953, HR .919/.831, 2B 1.029, 3B .979). 128 teams, best of seven."
       --note "$NOTE"
       --format-since 2026-09-29)
ROSTER=(scripts/roster-save.ts --file "../Inbox/rosters/$FILE" --tournament "$EVENT" --name "Claude pick 2026-09-28" --replace)

echo "1. Event $EVENT, from Tuesday Up To 1969 to Tuesday Dead Silver Walking (cards $YEARS)"
out=$(run scripts/catalogue-set.ts "${RULES[@]}" 2>&1) || {
  echo "$out"
  echo "Could not read event $EVENT. If it says \"unknown flags\", run Push to GitHub.command first."
  close 1
}
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$"
echo
echo "2. Claude's roster: 26 cards, 4 SP / 5 RP / 17 bats, every card pinned by id"
echo "   (Inbox/rosters/$FILE). It is checked against the new rules once they"
echo "   are saved, and saved only if it passes. Claude checked it against them"
echo "   beforehand: ready."
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

printf '\n\033[32mDone.\033[0m On /build, pick Tuesday Dead Silver Walking, then Saved rosters → "Claude pick 2026-09-28".\n'
echo "The batting order shows under each lineup there."
echo "You can delete this file now."
close 0
