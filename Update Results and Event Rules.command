#!/bin/bash
# Update Results and Event Rules — double-click once, after Push to GitHub.command
# has pulled it down. Claude's cloud session cannot write to the app's
# database, so this runs from the Mac. Each step shows what it will write and
# asks first; only a typed "y" writes. Anything already done is skipped, so
# running it twice is harmless.
#
# 1. The 22 PTCS 7 results from L.J.'s 09-25 / 09-26 screenshot
#    (Inbox/results/ptcs7 results 2026-09-25 and 26.txt), the same way the
#    Log results box on /ptcs does.
# 2. Card rules L.J. confirmed on 2026-09-27:
#    - Daily Live Plus: 2026 cards only ("Live plus Future Legend, basically a
#      2026 card"; older-year Future Legends are not allowed). The field also
#      plays 2026 Historical All-Star and Snapshot cards there, so the rule is
#      the card year, not the set.
#    - Twelve events with "Live" in the name: Live cards only.
#    - Seven events whose fields never played a Live card: every set but Live
#      (L.J.: "no Live cards in those 7").
#    - Daily Iron & Friends OOTP Era: cards 1999-2026 ("OOTP Era is 1999+").
#    - Daily Late 1900s: cards 1980-1999 (was 1989-1999 on file).
# 3. Hide old events from the picker (L.J.: "hide all old tourneys and PTCS
#    events"): the finished PTCS 6 Championship, PTMS 2, "low gold",
#    "My Custom Tournament", and old rows the game has since renamed. They
#    are marked retired: their history stays and old links keep working.
#
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
set -o pipefail  # a failed step fails its check, even through grep
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
run() { node --env-file=.env.local --import tsx "$@"; }
# Only "y" or "yes" writes. Keys pressed while the previews were printing are
# thrown away first, so a stray Return can't answer the question in advance.
ask() {
  while read -r -t 1 -n 1 _ 2>/dev/null; do :; done
  read -r -p "$1 [y/N] " ok || return 1
  case "$ok" in y|Y|yes|YES|Yes) return 0 ;; esac
  return 1
}
# Commit each item; count the ones that changed ("no change" lines don't).
saved=0
commit() { local out; out=$("$@" --commit 2>&1) || { echo "$out"; return 1; }; case "$out" in *"no change"*) ;; *) saved=$((saved + 1)) ;; esac; }

# ---------------------------------------------------------------- 1. results
FILE="../Inbox/results/ptcs7 results 2026-09-25 and 26.txt"
printf '\n\033[1m1. PTCS 7 results, 09-25 and 09-26\033[0m\n\n'
run scripts/log-results.ts --dry "$FILE" || { echo "Could not read the results (see above)."; close 1; }
echo
if ask "Log these?"; then
  out=$(run scripts/log-results.ts "$FILE") || { echo "$out"; echo "Could not log the results."; close 1; }
  echo "$out" | tail -1
else
  echo "Results not logged."
fi

# ------------------------------------------------------------- 2. card rules
NOTE="L.J. 2026-09-27"
NO_LIVE="Negro League Star+Rookie Sensation+All-Time Legend+Historical All-Star+Future Legend+Snapshot+Unsung Heroes+Hardware Heroes+Veteran Presence"
RULES=(
  "9100186|--card-years|2026-2026"
  "518|--card-types|Live"      # Daily Live Iron
  "561|--card-types|Live"      # Daily Live Bronze
  "528|--card-types|Live"      # Daily Live Gold
  "545|--card-types|Live"      # Tuesday Live
  "543|--card-types|Live"      # Friday Night Live Slots
  "509|--card-types|Live"      # Live Quick
  "514|--card-types|Live"      # Live Slot Quick
  "9100213|--card-types|Live"  # Daily Don't Forget to Pick up the Kids - Live
  "9100226|--card-types|Live"  # Daily Live All Night
  "9100205|--card-types|Live"  # Daily Live Breakfast
  "9100241|--card-types|Live"  # Friday Night Live PD
  "9100231|--card-types|Live"  # Tuesday Live Lampooning
  "536|--card-types|$NO_LIVE"      # Monday Up And At Them Bronze
  "523|--card-types|$NO_LIVE"      # Daily Late Silver
  "540|--card-types|$NO_LIVE"      # Thursday Night Gold Rush
  "588|--card-types|$NO_LIVE"      # Daily Bagels and Schmear with EVCinNYC
  "9100229|--card-types|$NO_LIVE"  # Monday Night History Lesson
  "554|--card-types|$NO_LIVE"      # Laptophound's Daily 5L Deadball
  "555|--card-types|$NO_LIVE"      # Laptophound's Daily 6L Power Play
  "772|--card-years|1999-2026"     # Daily Iron & Friends OOTP Era
  "9100194|--card-years|1980-1999" # Daily Late 1900s
)
rule() { local e="$1"; local id="${e%%|*}"; local rest="${e#*|}"; run scripts/catalogue-set.ts --tournament "$id" "${rest%%|*}" "${rest#*|}" --note "$NOTE" "${@:2}"; }
printf '\n\033[1m2. Card rules: Live Plus 2026 cards; 12 Live events Live only; 7 events no Live; OOTP Era 1999+; Late 1900s 1980-99\033[0m\n\n'
for e in "${RULES[@]}"; do rule "$e" | grep -v "Dry run" || { echo "Could not read event ${e%%|*}."; close 1; }; done
echo
if ask "Save these rules?"; then
  saved=0
  for e in "${RULES[@]}"; do commit rule "$e" || { echo "Could not save event ${e%%|*}."; close 1; }; done
  echo "Saved $saved event rule(s); the rest were already set."
else
  echo "Rules not saved."
fi

# ------------------------------------------------------ 3. hide old events
OLD=(
  9060001 9060002 9060003 9060004 9060005 9060006 9060007 9060008 9060009 9060010  # PTCS 6 Championship
  892 893 894   # PTMS 2 Tourney 1-3
  812           # low gold
  897           # My Custom Tournament
  637           # Daily Open 1930-89 (no longer in the game's list)
  777           # Daily Time Travelers Slots (now Dr. Dynastic's, 9100193)
  857           # Daily Just Order Pizza PD (now "... for Dinner - D&G", 9100217)
  858           # Daliy Trying To Look Busy PD (last run 08-29)
  735           # Dr. Dynastic's Doc Rock Derby (now "- HH", 9100216)
  873           # Laptop 6L Powerplay (now Laptophound's Daily 6L Power Play, 555)
)
printf '\n\033[1m3. Hide old events from the picker\033[0m\n\n'
for id in "${OLD[@]}"; do run scripts/catalogue-set.ts --tournament "$id" --retire | grep -v -e "Dry run" -e "^$" || { echo "Could not read event $id."; close 1; }; done
echo
if ask "Hide these ${#OLD[@]} events?"; then
  saved=0
  for id in "${OLD[@]}"; do commit run scripts/catalogue-set.ts --tournament "$id" --retire || { echo "Could not hide event $id."; close 1; }; done
  echo "Hid $saved event(s); the rest were already hidden."
else
  echo "Nothing hidden."
fi

printf '\n\033[32mDone.\033[0m You can delete this file.\n'
close 0
