#!/bin/bash
# Run Win Tests — double-click this. Optional; about 15 to 30 minutes, and the Mac can be used meanwhile.
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

TMP="$(mktemp -d)"
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
echo "The two lines that decide it (whole team score, every export):"
awk '/^=== /{print "  " $0} /^whole score/{w=1; next} w && /^ +ALL /{print "  " $0; w=0}' "$OUT"
echo
echo "Full result: Tourney Data/Win Tests/$(basename "$OUT")"
echo "Next: double-click Push to GitHub.command and say yes to committing Tourney Data, so Claude can read it."
[ -z "$OOTP_NO_PAUSE" ] && open -e "$OUT" 2>/dev/null
close 0
