#!/bin/bash
# Set Event Rules — double-click this once, after Push to GitHub.command has
# pulled it down. Claude's session does not write to the app's database, so
# this does it from the Mac.
#
# 1. Sets the rules L.J. confirmed on 2026-09-29 for 18 current events:
#    - DH on: Iron Lunch (also no variants), Live Iron, Live Plus, Iron &
#      Friends OOTP Era Slots. DH off: Iron Dreamland, Gold Standard.
#    - Monday Wonky Historical Slots and Tuesday Sporer's Sandlot: the new
#      formats from PT's 09-19 post, which L.J. says are live.
#    - Value windows: Daily Dank is cards 49 or lower with 13 variants; Silver
#      and Gold Cap is 70-89; Goldfather II, Golden Heart, Golden Age and Ice
#      to See You are confirmed as they were; Early Years Cap, Late 1900s,
#      Living Deadball, 1950 to Now and Live Plus take any card value.
#    Each event's old rules are kept under restrictions.previousFormat.
# 2. Then runs Save Current Rosters.command, which saves the rosters Claude
#    rebuilt for every current event (it checks each and asks again).
#
# It shows every change first, then asks. Only a typed "y" writes. Safe to
# run twice. Delete this file once it has run; keep Save Current Rosters.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSet the confirmed event rules\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}

EDITS=(
  --tournament\ 562\ --dh\ --variant-cap\ 0\ --note\ \'L.J.\ 2026-09-29:\ DH\ on,\ no\ variants,\ no\ park\ listed\ \(neutral\)\'\ --format-since\ keep
  --tournament\ 583\ --no-dh\ --note\ \'L.J.\ 2026-09-29:\ no\ DH\'\ --format-since\ keep
  --tournament\ 9100198\ --no-dh\ --note\ \'L.J.\ 2026-09-29:\ no\ DH\'\ --format-since\ keep
  --tournament\ 518\ --dh\ --note\ \'L.J.\ 2026-09-29:\ DH\ on\'\ --format-since\ keep
  --tournament\ 9100186\ --dh\ --value\ 40-105\ --note\ \'L.J.\ 2026-09-29:\ DH\ on,\ any\ card\ value\'\ --format-since\ keep
  --tournament\ 772\ --dh\ --note\ \'L.J.\ 2026-09-29:\ DH\ on\'\ --format-since\ keep
  --tournament\ 544\ --year\ 2009\ --stadium\ \'2026\ Coors\ Field\'\ --no-dh\ --value\ 40-99\ --card-years\ 1800-1949\ --slots\ \'D13,\ S7,\ B6\'\ --drop\ notes,rulesText,yearMin\ --text\ \'13\ Diamond,\ 7\ Silver,\ 6\ Bronze,\ cards\ up\ to\ 1949,\ 2009\ RE,\ DH\ off,\ 2026\ Coors\ Field\'\ --note\ \'PT\'\"\'\"\'s\ 2026-09-19\ post\;\ L.J.\ 2026-09-29:\ the\ new\ format\ is\ live\'\ --format-since\ 2026-09-28
  --tournament\ 539\ --year\ 1992\ --stadium\ \'1992\ SkyDome\'\ --dh\ --value\ 40-89\ --card-years\ 1980-2026\ --cap\ none\ --variant-cap\ 12\ --drop\ notes\ --text\ \'1980-2026\ Gold\ and\ below\ cards,\ 1992\ RE,\ DH\ on,\ Variant\ Cap\ 12,\ 1992\ Skydome\'\ --note\ \'PT\'\"\'\"\'s\ 2026-09-19\ post\;\ L.J.\ 2026-09-29:\ the\ new\ format\ is\ live\'\ --format-since\ 2026-09-29
  --tournament\ 515\ --value\ 40-49\ --variant-cap\ 13\ --note\ \'L.J.\ 2026-09-29:\ cards\ 49\ or\ lower,\ 13\ variants,\ 1945\ RE,\ no\ DH,\ 1945\ Comiskey\'
  --tournament\ 567\ --value\ 40-89\ --note\ \'L.J.\ 2026-09-29:\ confirmed\ on\ screen\'
  --tournament\ 635\ --value\ 40-89\ --note\ \'L.J.\ 2026-09-29:\ confirmed\ on\ screen\'
  --tournament\ 9100166\ --value\ 40-89\ --note\ \'L.J.\ 2026-09-29:\ confirmed\ on\ screen\'
  --tournament\ 538\ --value\ 70-89\ --note\ \'L.J.\ 2026-09-29:\ 70-89,\ cap\ 2026,\ variant\ cap\ 13\'
  --tournament\ 542\ --value\ 90-99\ --note\ \'L.J.\ 2026-09-29:\ confirmed\ on\ screen\'
  --tournament\ 9100138\ --value\ 40-105\ --note\ \'L.J.\ 2026-09-29:\ any\ card\ value\'
  --tournament\ 9100194\ --value\ 40-105\ --note\ \'L.J.\ 2026-09-29:\ any\ card\ value\'
  --tournament\ 551\ --value\ 40-105\ --note\ \'L.J.\ 2026-09-29:\ any\ card\ value\'
  --tournament\ 550\ --value\ 40-105\ --note\ \'L.J.\ 2026-09-29:\ any\ card\ value\'
)

for e in "${EDITS[@]}"; do
  eval "set -- $e"
  out=$(run scripts/catalogue-set.ts "$@" 2>&1) || { echo "$out"; echo "Could not read the catalogue. If catalogue-set does not know a flag, run Push to GitHub.command first."; close 1; }
  printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$" | sed 's/^/   /'
done
echo
if ask "Set these rules for ${#EDITS[@]} events?"; then
  failed=0
  for e in "${EDITS[@]}"; do
    eval "set -- $e"
    run scripts/catalogue-set.ts "$@" --commit >/dev/null 2>&1 || { echo "   could not set the rules for event $2"; failed=1; }
  done
  [ $failed -eq 0 ] && printf '\033[32mRules set.\033[0m\n' || { echo "Some rules did not save (see above). Tell Claude."; close 1; }
else
  echo "Rules left as they were. The rosters for these events will show SKIP below."
fi

echo
exec bash "../Save Current Rosters.command"
