#!/bin/bash
# Save Bronze Rosters — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's session does not write to the app's database,
# so this does it from the Mac.
#
# Saves Claude's rosters for nine Bronze tournaments to /build, each as
# "Claude pick 2026-09-28". The why is in
# Docs/Rosters/Bronze Rosters 2026-09-28 (Claude).md. (PTCS 3 Replay, Monday
# Bronze and the Dregs are already saved.)
#
# It checks every roster against its event's rules first, then asks once.
# Only a typed "y" saves, and only the rosters that passed. Safe to run twice
# (each save replaces its own earlier copy).
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the Bronze rosters\033[0m\n\n'
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

NAME="Claude pick 2026-09-28"
# event id, then the load file in Inbox/rosters (every card pinned by id)
ROSTERS=(
  "519 lowbronzeonly-claude-2026-09-28.txt"
  "520 bronzeonlycap-claude-2026-09-28.txt"
  "524 latebronze-claude-2026-09-28.txt"
  "525 earlybronze-claude-2026-09-28.txt"
  "527 bronzecuriosity-claude-2026-09-28.txt"
  "535 bronzecap-claude-2026-10-03.txt"
  "561 livebronze-claude-2026-09-28.txt"
  "584 bronze1910to59-claude-2026-09-28.txt"
  "633 bronzeootp-claude-2026-09-28.txt"
)

echo "Checking each roster against its event's rules:"
ready=()
for r in "${ROSTERS[@]}"; do
  id=${r%% *}; file=${r#* }
  check=$(run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --dry 2>&1)
  line=$(printf '%s\n' "$check" | grep -v "^dry run" | tail -1)
  case "$check" in
    *" · ready"*) echo "  ok   $line"; ready+=("$r") ;;
    *) echo "  SKIP $line"; printf '%s\n' "$check" | grep -v "^dry run" | sed 's/^/       /' ;;
  esac
done
echo
[ ${#ready[@]} -gt 0 ] || { echo "No roster passed its event's rules, so nothing was saved. Tell Claude."; close 1; }
[ ${#ready[@]} -eq ${#ROSTERS[@]} ] || echo "Rosters marked SKIP will not be saved. Tell Claude."
if ! ask "Save ${#ready[@]} roster(s) to /build as \"$NAME\"?"; then echo "Nothing saved."; close 0; fi

failed=0
for r in "${ready[@]}"; do
  id=${r%% *}; file=${r#* }
  run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --replace || { echo "Could not save $file (see above)."; failed=1; }
done

if [ $failed -eq 0 ]; then
  printf '\n\033[32mDone.\033[0m On /build, pick an event, then Saved rosters → "%s".\n' "$NAME"
  echo "You can delete this file now."
else
  echo; echo "Some rosters did not save (see above). Tell Claude."
fi
close $failed
