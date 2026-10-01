#!/bin/bash
# Split Weekly Formats — double-click after Push to GitHub.command has pulled it.
#
# Re-imports the exports of every weekly with a format date (Splendid Silver,
# Deadball, Diamond Variety, ...). A run before its event's current format now
# goes to "<slug>-preYYYYMMDD": it still counts as each card's play elsewhere,
# but no longer as the event's own, so /build and Claude can use the new-format
# runs (Splendid Silver's 09-24 run) instead of setting the whole series aside.
# It also records Kansas City Torrent's own lines from every export.
# Then run Push to GitHub.command (it commits field-construction.json).
# Safe to run twice.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSplit the weekly formats\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
# Splendid Silver's format first ran 09-24 (L.J., 10-01); set it before the split
# reads the dates, so run #27 lands on the current side. Writes nothing if already set.
node --env-file=.env.local --import tsx scripts/catalogue-set.ts --tournament 537 --format-since 2026-09-24 --note "L.J. 2026-10-01: the Splendid Silver Only format first ran 09-24 (run #27)" --commit
echo
node --env-file=.env.local --import tsx scripts/import-observed.ts --dated
echo
echo "Done. Now run Push to GitHub.command, then tell Claude."
read -r -p "Press return to close."
