#!/bin/bash
# Apply Format Changes — double-click after Push to GitHub.command has pulled it.
#
# PT's schedule post (L.J.'s screenshot, 09-30):
#   191 Daily High Silver-Low Gold Cap -> Daily Low Gold Cap: 40-84, 1610 cap,
#       from 10-01; otherwise as before (2007 RE, 2008 Shea Stadium, DH).
#   187 Thursday CWhit's Cap Challenge -> Thursday CWhit's Say My Name Cap:
#       cards up to 100, 1775 cap, default RE, DH, variant cap 10, Heinsohn
#       Ballpark. Not this Thursday: it first runs 10-08 (L.J.).
#
# 191 is set now and Claude's roster saved as "Claude pick 2026-09-30 formats".
# 187 waits until Thursday 10-01's Cap Challenge has run: before Friday 10-02
# this script leaves it alone, so run it again any day from Friday. It then
# sets 187 and saves "Claude pick 2026-10-08 saymyname".
# Each change is shown first (dry run); only a typed "y" writes. Safe to run
# twice. Delete this file once 187 is done too.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mApply the 191 and 187 format changes\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}

S191=(--tournament 9100191 --name "Daily Low Gold Cap" --value 40-84 --cap 1610 --format-since 2026-10-01
  --text "Daily Low Gold Cap: Low Gold (40-84), 1610 cap; otherwise as before (Best of 7, 2007 RE, DH on, Variants on, 2008 Shea Stadium)"
  --note "PT schedule post, L.J.'s screenshot 2026-09-30")
S187=(--tournament 9100187 --name "Thursday CWhit's Say My Name Cap" --year 2010 --stadium "2026 Heinsohn Ballpark" --dh
  --value 40-100 --cap 1775 --variant-cap 10 --format-since 2026-10-08 --drop valueMin,valueMax,reYear,park,notes
  --text "Thursday CWhit's Say My Name Cap: cards up to 100, 1775 cap, Default RE, DH on, Variant Cap 10, Heinsohn Park"
  --note "PT schedule post, L.J.'s screenshot 2026-09-30; first runs Thursday 10-08 (L.J.)")

step() { # name, manifest, catalogue:set args...
  local label=$1 manifest=$2; shift 2
  echo "── $label"
  run scripts/catalogue-set.ts "$@" || close 1
  echo
  if ask "Write this change?"; then
    run scripts/catalogue-set.ts "$@" --commit || close 1
    echo
    "../Save Current Rosters.command" "$manifest" < /dev/tty
  else
    echo "Left as it is."
  fi
  echo
}

step "191 Daily Low Gold Cap" ../Inbox/rosters/current-2026-09-30-formats.tsv "${S191[@]}"
today=$(TZ=America/Chicago date +%F)
if [[ "$today" < "2026-10-02" ]]; then
  echo "── 187 Say My Name Cap: not yet. Thursday 10-01's Cap Challenge still runs the old format."
  echo "   Run this script again any day from Friday 10-02."
else
  step "187 Thursday CWhit's Say My Name Cap" ../Inbox/rosters/current-2026-10-08-saymyname.tsv "${S187[@]}"
fi
close 0
