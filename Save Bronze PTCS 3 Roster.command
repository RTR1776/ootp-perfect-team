#!/bin/bash
# Save Bronze PTCS 3 Roster — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's session does not write to the app's database,
# so this does it from the Mac.
#
# Saves Claude's roster for Daily Bronze PTCS 3 Replay Slots (event 773: 1999
# RE, 2000 Coors Field, DH, cards 40-69, 18 Bronze / 8 Iron, variant cap 13)
# to /build as "Claude pick 2026-09-28". The why is in
# Docs/Rosters/Daily Bronze PTCS 3 Replay Slots Roster 2026-09-28 (Claude).md.
#
# It checks the roster against the event's rules first. Only a typed "y"
# saves. Safe to run twice (it replaces its own earlier copy).
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the Bronze PTCS 3 Replay roster\033[0m\n\n'
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

ROSTER=(scripts/roster-save.ts --file "../Inbox/rosters/bronzeptcs3-claude-2026-09-28.txt" --tournament 773 --name "Claude pick 2026-09-28" --replace)

echo "Claude's roster: 26 cards, every one pinned by id, checked against event 773's rules"
check=$(run "${ROSTER[@]}" --dry 2>&1) || { echo "$check"; echo "Could not check the roster."; close 1; }
printf '%s\n' "$check" | grep -v "^dry run"
case "$check" in
  *" · ready"*) ;;
  *) echo "The roster does not pass the event's rules (see above), so nothing was saved. Tell Claude."; close 1 ;;
esac
echo
if ! ask "Save it to /build?"; then echo "Nothing saved."; close 0; fi
run "${ROSTER[@]}" || { echo "Could not save the roster (see above)."; close 1; }

printf '\n\033[32mDone.\033[0m On /build, pick Daily Bronze PTCS 3 Replay Slots, then Saved rosters → "Claude pick 2026-09-28".\n'
echo "You can delete this file now."
close 0
