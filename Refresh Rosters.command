#!/bin/bash
# Refresh Rosters — double-click this once, after Push to GitHub.command has
# pulled it down. Claude's session does not write to the app's database, so
# this does it from the Mac.
#
# 1. Puts two event names back. Loading the 09-29 dump renamed them to their
#    old formats' titles (the dump hadn't seen the new formats yet; that is
#    fixed now): 548 is Monday Now We're into the Dregs, 549 is Tuesday Dead
#    Silver Walking. Only the names change; their rules were not touched.
# 2. Saves Claude's rosters rebuilt on the 09-29 collection (the Pearce and
#    Dugan variants, and the other cards bought since 09-27) to /build as
#    "Claude pick 2026-09-29". The older picks stay under their own names.
#    The why is in Docs/Rosters/Roster Refresh 2026-09-29 (Claude).md.
#
# It checks everything first, then asks once. Only a typed "y" writes, and
# only the rosters that pass. Safe to run twice. Delete this file once it
# has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mRefresh the rosters and two event names\033[0m\n\n'
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

NAME="Claude pick 2026-09-29"
RENAMES=(
  "548|Monday Now We're into the Dregs"
  "549|Tuesday Dead Silver Walking"
)
# event id, then the load file in Inbox/rosters (every card pinned by id)
ROSTERS=(
  "773 bronzeptcs3-claude-2026-09-29.txt"
  "536 bronzeweekly-claude-2026-09-29.txt"
  "520 bronzeonlycap-claude-2026-09-29.txt"
  "524 latebronze-claude-2026-09-29.txt"
  "527 bronzecuriosity-claude-2026-09-29.txt"
  "535 bronzecap-claude-2026-09-29.txt"
  "584 bronze1910to59-claude-2026-09-29.txt"
  "633 bronzeootp-claude-2026-09-29.txt"
  "549 deadsilver-1920-claude-2026-10-06.txt"
  "519 lowbronzeonly-claude-2026-09-29.txt"
)

echo "1. Event names"
for r in "${RENAMES[@]}"; do
  id=${r%%|*}; name=${r#*|}
  out=$(run scripts/catalogue-set.ts --tournament "$id" --name "$name" 2>&1) || { echo "$out"; echo "Could not read event $id. If it says \"unknown flags\", run Push to GitHub.command first."; close 1; }
  printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$" | sed 's/^/   /'
done
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
if ! ask "Put the two names back and save ${#ready[@]} roster(s) as \"$NAME\"?"; then echo "Nothing saved."; close 0; fi

echo
failed=0
for r in "${RENAMES[@]}"; do
  id=${r%%|*}; name=${r#*|}
  out=$(run scripts/catalogue-set.ts --tournament "$id" --name "$name" --commit 2>&1) || { echo "$out"; echo "Could not rename event $id."; failed=1; continue; }
  printf '%s\n' "$out" | tail -1
done
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
