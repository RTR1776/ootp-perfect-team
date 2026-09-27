#!/bin/bash
# Log PTCS Results and Live Plus Rule — double-click once, after
# Push to GitHub.command has pulled it down. Claude's cloud session cannot
# write to the app's database, so this runs from the Mac.
#
# 1. The 22 PTCS 7 results from L.J.'s 09-25 / 09-26 screenshot
#    (Inbox/results/ptcs7 results 2026-09-25 and 26.txt), the same way the
#    Log results box on /ptcs does. Event ids already logged are skipped, so
#    running it twice is harmless.
# 2. Daily Live Plus (9100186): 2026 cards only. L.J.: "Live plus Future
#    Legend, basically a 2026 card". Every card the field has played there is
#    a 2026 card, including 2026 Historical All-Star and Snapshot cards
#    (Bellinger, Walker, Maikel Garcia, Palencia), so the rule is the card
#    year, not the card set.
#
# Each step shows what it will write and asks first. Delete this file once
# it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
node() { command node --env-file=.env.local --import tsx "$@"; }

FILE="../Inbox/results/ptcs7 results 2026-09-25 and 26.txt"
printf '\n\033[1m1. PTCS 7 results, 09-25 and 09-26\033[0m\n\n'
node scripts/log-results.ts --dry "$FILE" || { echo "Could not read the results (see above)."; close 1; }
echo
read -r -p "Log these? [Y/n] " ok
case "$ok" in
  n|N|no|NO) echo "Results not logged." ;;
  *) out=$(node scripts/log-results.ts "$FILE") || { echo "$out"; echo "Could not log the results."; close 1; }
     echo "$out" | tail -1 ;;
esac

NOTE="L.J. 2026-09-27: Live + Future Legend, i.e. 2026 cards; the field also plays 2026 HAS and Snapshot cards"
printf '\n\033[1m2. Daily Live Plus: 2026 cards only\033[0m\n\n'
node scripts/catalogue-set.ts --tournament 9100186 --card-years 2026-2026 --note "$NOTE" | grep -v "Dry run" || { echo "Could not read Daily Live Plus."; close 1; }
echo
read -r -p "Save this rule? [Y/n] " ok
case "$ok" in
  n|N|no|NO) echo "Rule not saved." ;;
  *) node scripts/catalogue-set.ts --tournament 9100186 --card-years 2026-2026 --note "$NOTE" --commit >/dev/null \
       && echo "saved: Daily Live Plus takes 2026 cards only" || { echo "Could not save the rule."; close 1; } ;;
esac

printf '\n\033[32mDone.\033[0m You can delete this file.\n'
close 0
