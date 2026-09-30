#!/bin/bash
# Save Current Rosters — double-click this after Push to GitHub.command has
# pulled down a batch Claude built with scripts/current-rosters.ts. Claude's
# session does not write to the app's database, so this does it from the Mac.
#
# It reads the newest manifest in Inbox/rosters (current-<tag>.tsv: event id,
# load file, event name) and saves each roster to /build as "Claude pick
# <tag>": current-2026-09-29-late.tsv saves as "Claude pick 2026-09-29 late".
# The earlier picks stay under their own names.
#
# It checks every roster against its event's rules first, then asks once.
# Only a typed "y" writes, and only the rosters that pass. Safe to run twice.
# Keep this file: the next batch uses it too.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSave the current-event rosters\033[0m\n\n'
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

# A manifest can be named (Set Up PTCS 7.command does); otherwise the newest.
MANIFEST=${1:-$(ls -t ../Inbox/rosters/current-*.tsv 2>/dev/null | head -1)}
[ -n "$MANIFEST" ] || { echo "No Inbox/rosters/current-*.tsv. Run Push to GitHub.command first."; close 1; }
DAY=$(basename "$MANIFEST" .tsv); DAY=${DAY#current-}
NAME="Claude pick $(printf '%s' "$DAY" | sed -E 's/-([a-z]+)$/ \1/')"
echo "Batch: $(basename "$MANIFEST") ($(grep -c . "$MANIFEST") rosters), saved as \"$NAME\""
echo

ready=()
while IFS=$'\t' read -r id file event; do
  [ -z "$id" ] && continue
  c=$(run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --dry 2>&1 < /dev/null)
  line=$(printf '%s\n' "$c" | grep -v "^dry run" | tail -1)
  case "$c" in
    *" · ready"*) echo "   ok   $line"; ready+=("$id	$file") ;;
    *) echo "   SKIP $line"; printf '%s\n' "$c" | grep -v "^dry run" | sed 's/^/        /' | head -4 ;;
  esac
done < "$MANIFEST"
echo
total=$(grep -c . "$MANIFEST")
[ ${#ready[@]} -eq "$total" ] || echo "Rosters marked SKIP will not be saved. Tell Claude."
[ ${#ready[@]} -gt 0 ] || { echo "Nothing to save."; close 1; }
if ! ask "Save ${#ready[@]} roster(s) as \"$NAME\"?"; then echo "Nothing saved."; close 0; fi

echo
failed=0
for r in "${ready[@]}"; do
  id=${r%%	*}; file=${r#*	}
  run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --replace >/dev/null 2>&1 \
    && echo "   saved $file" || { echo "   could not save $file"; failed=1; }
done

if [ $failed -eq 0 ]; then
  printf '\n\033[32mDone.\033[0m On /build, pick an event, then Saved rosters → "%s".\n' "$NAME"
else
  echo; echo "Something did not save (see above). Tell Claude."
fi
close $failed
