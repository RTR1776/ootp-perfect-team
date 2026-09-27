#!/bin/bash
# Set Card-Set Rules — double-click once, after Push to GitHub.command has
# pulled it down. Claude's cloud session cannot write to the app's database,
# so this runs from the Mac.
#
# Five catalogue events were missing their card-set rule, so /build could
# suggest cards the game won't allow. The field's own exports show the rule
# (2026-09-27):
#   Daily All-Star Hardware Slots (9100139)  Historical All-Star + Hardware Heroes only
#   Daily Live Diamond (532), Daily Live Open (529), Daily Live Silver (566),
#   Dr. Dynastic's Daily Time Travelers Slots (9100193)  Live cards only
#     (100% of every card played in their exports)
#
# It shows each change first and asks once. The old rules stay on each row
# (restrictions.previousFormat). Safe to run twice. Delete it once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mAdd the missing card-set rules to the catalogue\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx scripts/catalogue-set.ts "$@"; }

NOTE="card sets read off the field's exports, 2026-09-27"
EVENTS=(
  "9100139|Historical All-Star+Hardware Heroes"
  "532|Live"
  "529|Live"
  "566|Live"
  "9100193|Live"
)

for e in "${EVENTS[@]}"; do
  run --tournament "${e%%|*}" --card-types "${e#*|}" --note "$NOTE" | grep -v "Dry run" || { echo "Could not read event ${e%%|*} (see above)."; close 1; }
  echo
done
read -r -p "Save all five? [Y/n] " ok
case "$ok" in
  n|N|no|NO) echo "Nothing saved."; close 0 ;;
esac
for e in "${EVENTS[@]}"; do
  run --tournament "${e%%|*}" --card-types "${e#*|}" --note "$NOTE" --commit >/dev/null || { echo "Could not save event ${e%%|*}."; close 1; }
  echo "saved ${e%%|*}: ${e#*|}"
done
printf '\n\033[32mDone.\033[0m /build now keeps these events to their card sets. You can delete this file.\n'
close 0
