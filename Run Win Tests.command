#!/bin/bash
# Run Win Tests — double-click this. Optional; the three builds take several minutes each, the comparison under a minute.
#
# Claude's cloud sessions can only test a pricing change against the 42 exports
# that are in git. This Mac has the whole archive. This reruns the two tests of
# 2026-11-13 on every archived export:
#   1. arms priced by the hand they throw with (adopted: 37 of 40 on the 42)
#   2. the curved bat calibration (left off: 24 of 40; it needs 37)
# Nothing in the database or the app changes. The result is a text file in
# Tourney Data/Win Tests/, which Push to GitHub.command sends up for Claude to read.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mWin tests on the whole export archive\033[0m\n\n'
close() { [ -n "$OOTP_NO_PAUSE" ] && exit "${1:-0}"; echo; read -r -p "Press return to close."; exit "${1:-0}"; }

[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
[ -d ../Archive/Completed ] || { echo "No Archive/Completed folder here; the tests need the archived exports."; close 1; }
if ! python3 -c "import numpy" 2>/dev/null; then
  echo "The comparison needs Python's numpy, which this Mac does not have yet."
  read -r -p "Install it now (python3 -m pip install --user numpy)? [y/N] " ok
  case "$ok" in
    y|Y|yes|YES) python3 -m pip install --user numpy || { echo "The install failed. Copy the message above to Claude."; close 1; } ;;
    *) echo "Not run."; close 0 ;;
  esac
fi

# The three builds are kept in the Mac's temporary folder, so a run that was stopped (or a second
# look the same evening) does not have to make them again. Builds from an earlier run of this
# command, including the first version's (it used a folder named tmp.XXXX), are offered for reuse.
CACHE="${TMPDIR:-/tmp}"; CACHE="${CACHE%/}"
has_builds() { [ -f "$1/flat/teams.json" ] && [ -f "$1/now/teams.json" ] && [ -f "$1/bend/teams.json" ]; }
PREV=""
for d in "$CACHE/ootp-win-tests" "$CACHE"/tmp.*; do
  has_builds "$d" || continue
  if [ -z "$PREV" ] || [ "$d/bend/teams.json" -nt "$PREV/bend/teams.json" ]; then PREV="$d"; fi
done
TMP=""
if [ -n "$PREV" ] && [ -n "$(find "$PREV/bend/teams.json" -mmin -720 2>/dev/null)" ]; then
  WHEN="$(date -r "$PREV/bend/teams.json" '+%H:%M' 2>/dev/null)" || WHEN="$(stat -f '%Sm' -t '%H:%M' "$PREV/bend/teams.json" 2>/dev/null)"
  echo "The three builds from an earlier run are still here (finished ${WHEN:-earlier today})."
  echo "Reuse them unless exports were filed or the pricing changed since."
  read -r -p "Reuse them? [Y/n] " ok
  case "$ok" in n|N|no|NO) ;; *) TMP="$PREV" ;; esac
  echo
fi
if [ -z "$TMP" ]; then
  TMP="$CACHE/ootp-win-tests"
  rm -rf "$TMP"; mkdir -p "$TMP" || { echo "Could not create $TMP"; close 1; }
  build() { # build <name> <what it is>; extra settings come in through the environment
    printf '%s… ' "$2"
    if MV2_TOURDIR="Archive/Completed" MV2_NO_LEAGUE=1 MV2_DIR="$TMP/$1" node --env-file=.env.local --import tsx scripts/model-v2/teams.mts > "$TMP/$1.log" 2>&1; then
      echo "done ($(grep -c . "$TMP/$1.log") lines of log)."
    else
      echo "FAILED. The end of its log:"; tail -15 "$TMP/$1.log"; echo; echo "Copy that to Claude."; close 1
    fi
  }
  echo "Three builds of the team harness, several minutes each."
  MV2_PITCH_LHB=flat build flat "1 of 3: arms on one share of left-handed bats (the pricing before 11-13)"
  build now "2 of 3: as priced now"
  MV2_BEND=1 build bend "3 of 3: with the curved bat calibration"
fi
echo "Comparing them on wins (under a minute)…"

mkdir -p "../Tourney Data/Win Tests"
OUT="../Tourney Data/Win Tests/win-tests-$(date +%Y-%m-%d).txt"
{
  echo "Win tests on the whole archive (Run Win Tests.command), $(date '+%Y-%m-%d %H:%M')"
  echo "\"off\" is the first build named, \"on\" the second. The bar is better in 37 of 40 on the whole score, ALL row."
  echo
  echo "=== 1. Arms by throwing hand: off = one share (0.45), on = by hand (LHP 0.35, RHP 0.50). In use since 11-13."
  python3 scripts/model-review/wins-ab.py "$TMP/flat" "$TMP/now"
  echo
  echo "=== 2. Curved bat calibration: off = the straight slope (in use), on = the bend."
  python3 scripts/model-review/wins-ab.py "$TMP/now" "$TMP/bend"
} > "$OUT" 2>&1

echo
echo "What decides it: the whole team score on every export (ALL), then by how the event rations cards:"
awk '/^=== /{print "  " $0} /^whole score/{w=1; next} /^the offence term/{w=0} w && /^ +(ALL|cap events|slots events|no cap, no slots) /{print "  " $0}' "$OUT"
echo
echo "Full result: Tourney Data/Win Tests/$(basename "$OUT")"
echo "Next: double-click Push to GitHub.command and say yes to committing Tourney Data, so Claude can read it."
[ -z "$OOTP_NO_PAUSE" ] && open -e "$OUT" 2>/dev/null
close 0
