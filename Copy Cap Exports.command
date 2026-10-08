#!/bin/bash
# Copy Cap Exports — double-click, then run Push to GitHub.command.
#
# Claude (10-08) is studying how cap rosters should spend their cap: how much
# into the rotation, the pen and the lineup, and whether "stars plus basement"
# beats "all middle". That needs every team's roster and record, which only the
# raw per-tournament exports in Archive/Completed hold (Archive/ is never
# pushed). This copies the cap events' files, and nothing else, into
# Tourney Data/Cap Exports/, which Push to GitHub sends up with the sync.
#
# Safe to run again: files already copied are skipped. Delete this file after.

cd "$(dirname "$0")" || exit 1
printf '\n\033[1mCopy the cap events'"'"' exports for Claude\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }

SRC="Archive/Completed"
DEST="Tourney Data/Cap Exports"
[ -d "$SRC" ] || { echo "No $SRC folder here ($(pwd))."; close 1; }
mkdir -p "$DEST"

# Every cap event's series (the start of its export file names).
SLUGS="bronzeonlycapdaily highsilverlowgoldcap goldcapdaily nightmarecap
highironfloorgoldceilingweekly silveronlycapdaily goldfloorcapweekly
bronzecapweekly earlyyearscap c4q1 c4q4 diamondcapdaily ironcapdaily"

copied=0; skipped=0
for s in $SLUGS; do
  n=0
  for f in "$SRC/${s}_"*.csv; do
    [ -e "$f" ] || continue
    n=$((n + 1))
    if [ -e "$DEST/$(basename "$f")" ]; then skipped=$((skipped + 1)); continue; fi
    cp "$f" "$DEST/" && copied=$((copied + 1))
  done
  printf '  %-34s %3d file(s)\n' "$s" "$n"
done
echo
echo "Copied $copied new file(s) ($skipped already there) into $DEST — $(du -sh "$DEST" | cut -f1) in all."
echo "Next: double-click Push to GitHub.command and say yes to committing Tourney Data."
close 0
