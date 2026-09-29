#!/bin/bash
# Save New-Card Rosters — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's session does not write to the app's database,
# so this does it from the Mac.
#
# 1. Adds the base copies the 09-29 afternoon collection export left out.
#    The export listed all 201 of L.J.'s variants without their base copy;
#    the morning's listed both. L.J. has both for most variants, so every
#    variant implies its base, except a clubhouse card's. Future uploads do
#    this on their own.
# 2. Saves Claude's rosters rebuilt with the cards L.J. got on 09-29 (the
#    McDougal, Kluber, Julio Cruz and other variants, the Altrock and Green
#    LEs, Pat Patterson) as "Claude pick 2026-09-29 PM". The earlier picks
#    stay under their own names.
#    The why is in Docs/Rosters/New Cards 2026-09-29 (Claude).md.
#
# It checks everything first, then asks once. Only a typed "y" writes, and
# only the rosters that pass. Safe to run twice. Delete this file once it
# has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the base copies and the new-card rosters\033[0m\n\n'
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
# event id, then the load file in Inbox/rosters (every card pinned by id)
ROSTERS=(
  "9300001 liveplusbronze-claude-2026-09-29pm.txt"
  "773 bronzeptcs3-claude-2026-09-29pm.txt"
  "536 bronzeweekly-claude-2026-09-29pm.txt"
  "520 bronzeonlycap-claude-2026-09-29pm.txt"
  "524 latebronze-claude-2026-09-29pm.txt"
  "584 bronze1910to59-claude-2026-09-29pm.txt"
  "633 bronzeootp-claude-2026-09-29pm.txt"
  "519 lowbronzeonly-claude-2026-09-29pm.txt"
  "549 deadsilver-1920-claude-2026-09-29pm.txt"
)

echo "1. Base copies"
out=$(run scripts/collection-implied-base.ts 2>&1) || { echo "$out"; echo "Could not read the collection. If it cannot find collection-implied-base, run Push to GitHub.command first."; close 1; }
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$" | sed 's/^/   /'
echo
echo "2. Rosters, each checked against its event's rules:"
ready=()
for r in "${ROSTERS[@]}"; do
  id=${r%% *}; file=${r#* }
  check=$(run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --dry 2>&1)
  line=$(printf '%s\n' "$check" | grep -v "^dry run" | tail -1)
  case "$check" in
    *" · ready"*) echo "   ok   $line"; ready+=("$r") ;;
    *) echo "   SKIP $line"; printf '%s\n' "$check" | grep -v "^dry run" | sed 's/^/        /' ;;
  esac
done
echo
[ ${#ready[@]} -eq ${#ROSTERS[@]} ] || echo "Rosters marked SKIP will not be saved. Tell Claude."
if ! ask "Add the base copies and save ${#ready[@]} roster(s) as \"$NAME\"?"; then echo "Nothing saved."; close 0; fi

echo
out=$(run scripts/collection-implied-base.ts --commit 2>&1) || { echo "$out"; echo "Could not add the base copies."; close 1; }
printf '%s\n' "$out" | tail -1
failed=0
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
