#!/bin/bash
# Save Remaining Rosters — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's session does not write to the app's database,
# so this does it from the Mac.
#
# 1. Gives Friday Nightmare Cap (569) the rules PT's 09-19 post set for its
#    new format, which first runs Friday 10-02: High Bronze floor to Silver
#    ceiling (65-79), no LE, 1805 cap, variant cap 6 (1971 RE, 1970 County
#    Stadium and no DH stay). The old rules are kept under previousFormat.
# 2. Saves the ten current-event rosters that weren't on the 09-29 afternoon
#    collection yet as "Claude pick 2026-09-29 PM": Iron Warriors, Danksville,
#    Negro Leagues Slots, Diamond Variety, Bronze Cap, Nightmare Cap, Early
#    Bronze, Dregs, and Live Bronze and Curiosities (unchanged, re-checked, so
#    Build stops flagging them). The earlier picks stay under their own names.
#    The why is in Docs/Rosters/Roster Refresh 2026-09-29 PM (Claude).md.
#
# It checks everything first, then asks once. Only a typed "y" writes, and
# only the rosters that pass. Nightmare Cap's roster is checked against its
# new rules right after they are saved. Safe to run twice. Delete this file
# once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mNightmare Cap rules and the remaining rosters\033[0m\n\n'
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

NAME="Claude pick 2026-09-29 PM"
RULES=(--tournament 569 --value 65-79 --cap 1805 --variant-cap 6 --no-le --drop notes
  --text "High Bronze Floor-Silver Ceiling, No LE, 1805 cap, 1971 RE, DH off, Variant Cap 6, 1970 Milwaukee County Stadium"
  --note "PT's 2026-09-19 weekly post; the new format first runs 2026-10-02")
NIGHTMARE="569 nightmarecap-claude-2026-10-02.txt"
# event id, then the load file in Inbox/rosters (every card pinned by id)
ROSTERS=(
  "534 ironwarriors-claude-2026-09-29pm.txt"
  "570 danksville-claude-2026-09-29pm.txt"
  "779 nelslots-claude-2026-09-29pm.txt"
  "541 diamondvariety-claude-2026-09-29pm.txt"
  "535 bronzecap-claude-2026-09-29pm.txt"
  "525 earlybronze-claude-2026-09-29pm.txt"
  "548 dregs-claude-2026-09-29pm.txt"
  "561 livebronze-claude-2026-09-29pm.txt"
  "527 bronzecuriosity-claude-2026-09-29pm.txt"
)

echo "1. Friday Nightmare Cap's rules from 10-02:"
out=$(run scripts/catalogue-set.ts "${RULES[@]}" 2>&1) || { echo "$out"; echo "Could not read the catalogue. If catalogue-set does not know --variant-cap, run Push to GitHub.command first."; close 1; }
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$" | sed 's/^/   /'
echo
echo "2. Rosters, each checked against its event's rules:"
check() { run scripts/roster-save.ts --file "../Inbox/rosters/$2" --tournament "$1" --name "$NAME" --dry 2>&1; }
ready=()
for r in "${ROSTERS[@]}"; do
  id=${r%% *}; file=${r#* }
  c=$(check "$id" "$file")
  line=$(printf '%s\n' "$c" | grep -v "^dry run" | tail -1)
  case "$c" in
    *" · ready"*) echo "   ok   $line"; ready+=("$r") ;;
    *) echo "   SKIP $line"; printf '%s\n' "$c" | grep -v "^dry run" | sed 's/^/        /' ;;
  esac
done
echo "   next Friday Nightmare Cap: checked against its new rules once they are saved"
echo
[ ${#ready[@]} -eq ${#ROSTERS[@]} ] || echo "Rosters marked SKIP will not be saved. Tell Claude."
if ! ask "Set Nightmare Cap's new rules and save up to $(( ${#ready[@]} + 1 )) roster(s) as \"$NAME\"?"; then echo "Nothing saved."; close 0; fi

echo
failed=0
out=$(run scripts/catalogue-set.ts "${RULES[@]}" --commit 2>&1) || { echo "$out"; echo "Could not save Nightmare Cap's rules; its roster is left alone."; failed=1; }
if [ $failed -eq 0 ]; then
  printf '%s\n' "$out" | tail -1
  id=${NIGHTMARE%% *}; file=${NIGHTMARE#* }
  c=$(check "$id" "$file")
  case "$c" in
    *" · ready"*) ready+=("$NIGHTMARE") ;;
    *) echo "Nightmare Cap's roster does not pass its new rules, so it is not saved:"; printf '%s\n' "$c" | grep -v "^dry run" | sed 's/^/   /'; failed=1 ;;
  esac
fi
for r in "${ready[@]}"; do
  id=${r%% *}; file=${r#* }
  run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --replace || { echo "Could not save $file (see above)."; failed=1; }
done

if [ $failed -eq 0 ]; then
  printf '\n\033[32mDone.\033[0m On /build, pick an event, then Saved rosters → "%s".\n' "$NAME"
  echo "You can delete this file now."
else
  echo; echo "Something did not save (see above). Tell Claude."
fi
close $failed
