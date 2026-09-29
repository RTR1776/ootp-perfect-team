#!/bin/bash
# Tag Theme Week 08-23 — double-click this once, after Push to GitHub.command
# has pulled it down. Claude's sessions don't write to the app's database, so
# this does it from the Mac.
#
# league_snapshots.env_year says which run environment a league week was
# played in: 2010 for an ordinary week, the theme's year for a theme week.
# Every reader that pools weeks (League's all weeks, Meta, Market, split:check,
# card:decline) now leaves theme weeks out by that tag. 09-20 is tagged 1989.
# 08-23 (HD450 only) went in before the tag existed, so it reads 2010, but its
# play fits 1959 (K% 13.3 against about 19-20 in a 2010 week), so it is pooled
# with the 2010 weeks.
#
# 1. Every league week: its tag and the era its play fits (read-only).
# 2. What tagging 08-23 as 1959 changes (its 3 snapshots).
#
# Only a typed "y" writes. Safe to run twice. Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mTag the week of 08-23 as a 1959 theme week\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
[ -f scripts/league-env.ts ] || { echo "scripts/league-env.ts is missing: run Push to GitHub.command first."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
# Keys pressed while the previews print are thrown away, so only a y typed
# at the prompt itself writes anything.
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}

echo "1. Every league week: its run environment tag, and the era its play fits"
run scripts/league-env.ts || { echo "Could not read the league weeks."; close 1; }
echo
echo "2. The week of 08-23"
out=$(run scripts/league-env.ts --week 2026-08-23 --env 1959 2>&1) || { echo "$out"; close 1; }
echo "$out"
case "$out" in *"no change"*) echo; echo "Already tagged; nothing to do. You can delete this file now."; close 0 ;; esac
echo
echo "If the game ran a year other than 1959 that week, answer n and tell Claude the year."
if ! ask "Tag the week of 08-23 as 1959?"; then echo "Nothing saved."; close 0; fi
run scripts/league-env.ts --week 2026-08-23 --env 1959 --commit || { echo "Could not save (see above)."; close 1; }

printf '\n\033[32mDone.\033[0m League'"'"'s "All 2010 weeks pooled" now leaves 08-23 out, as it does 09-20.\n'
echo "You can delete this file now."
close 0
