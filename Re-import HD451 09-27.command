#!/bin/bash
# Re-import HD451 09-27 — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's session does not write to the app's database,
# so this does it from the Mac.
#
# HD451's three exports of 2026-09-27 came in OOTP's wider 338-column view.
# That view also has the hitters' Contact under CON, CON vL and CON vR, and the
# importer took it for pitcher Control: every HD451 pitcher that week is stored
# with Control around 9 instead of ~110. The importer now reads Control from the
# pitching block. Nothing already published used these rows (the arm fit reads
# the shop's Control), so there is nothing to rerun afterwards.
#
# 1. Checks the three files are the exports that were imported (same cards on
#    the same teams with the same PA and IP), and that this copy of the app
#    reads their Control right (it matches the shop for base-card arms).
# 2. Shows what the importer would write.
# 3. On a typed "y", re-imports them as the week of 2026-09-27. Each file
#    replaces its old snapshot, and only after its new rows are in.
# 4. Checks the week again: HD451 should match the shop like the other leagues.
#
# Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mRe-import HD451, week of 2026-09-27\033[0m\n\n'
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

WEEK=2026-09-27
DL="$HOME/Downloads"
FOLDER="../League Data/$WEEK"
# The names they were uploaded under (Downloads), else a week folder's names.
pick() { for f in "$@"; do [ -f "$f" ] && { printf '%s\n' "$f"; return 0; }; done; return 1; }
ALL=$(pick "$DL/hd451_all.csv" "$FOLDER/hd451_all.csv")
VL=$(pick "$DL/hd451_vl (1).csv" "$FOLDER/hd451_vL.csv")
VR=$(pick "$DL/hd451_vr (1).csv" "$FOLDER/hd451_vR.csv")
if [ -z "$ALL" ] || [ -z "$VL" ] || [ -z "$VR" ]; then
  echo "Could not find all three HD451 exports of $WEEK. Looked for:"
  echo "   Downloads:          hd451_all.csv, hd451_vl (1).csv, hd451_vr (1).csv"
  echo "   League Data/$WEEK: hd451_all.csv, hd451_vL.csv, hd451_vR.csv"
  close 1
fi
FILES=("$ALL" "$VL" "$VR")

echo "1. The week as stored, and the three files as this copy of the app reads them"
echo
if ! run scripts/league-control-check.ts --week "$WEEK" --files "${FILES[@]}"; then
  echo
  echo "Stopped; nothing written."
  echo "- Control not matching the shop: this copy of the app is older than the fix."
  echo "  Run Push to GitHub.command to pull it, then run this again."
  echo "- Rows not matching: these are not the files imported for $WEEK."
  echo "  Put the HD451 exports of $WEEK back under the names above."
  close 1
fi
echo
echo "2. What the importer would write"
run scripts/import-league.ts "${FILES[@]}" --on "$WEEK" --dry || { echo "The importer refused the files (see above)."; close 1; }
echo
if ! ask "Re-import these three files as HD451, week of $WEEK?"; then echo "Nothing written."; close 0; fi

echo
echo "3. Re-importing"
run scripts/import-league.ts "${FILES[@]}" --on "$WEEK" || {
  echo "The import stopped (see above). A file that failed was rolled back and"
  echo "its old snapshot kept, so running this again is safe."
  close 1
}
echo
echo "4. The week, checked again"
out=$(run scripts/league-control-check.ts --week "$WEEK" 2>&1)
printf '%s\n' "$out"
case "$out" in
  *"wrong"*) echo; echo "A snapshot still does not match the shop (marked above). Tell Claude."; close 1 ;;
esac

printf '\n\033[32mDone.\033[0m HD451 pitchers of %s now carry their real Control.\n' "$WEEK"
echo "You can delete this file now."
close 0
