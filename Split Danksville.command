#!/bin/bash
# Split Danksville — double-click after Push to GitHub.command has pulled it.
#
# Friday Danksville's current format first ran 09-25 (run #27; L.J. 10-02, already set in
# the catalogue from the cloud). This re-imports every dated weekly's exports so
# run #26 is filed as "lowironweekly-pre20260925" and
# run #27 stands alone as Danksville's own play. Safe to run twice.
# Then run Push to GitHub.command and tell Claude. Delete this file after.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mSplit Danksville at 09-25\033[0m\n\n'
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; read -r -p "Press return to close."; exit 1; }
node --env-file=.env.local --import tsx scripts/import-observed.ts --dated
echo
echo "Done. Now run Push to GitHub.command, then tell Claude."
read -r -p "Press return to close."
