#!/bin/bash
# Save Pop-up Roster — double-click this once, after Push to GitHub.command
# has pulled it down, before the pop-up starts (Tue 09-29, 18:59). Claude's
# session does not write to the app's database, so this does it from the Mac.
#
# 1. Adds the Live-Plus Bronze Pop-up to the catalogue as event 9300001, so
#    /build can pick it: Bronze or lower, 2026 cards only, default RE, DH,
#    2026 Yankee Stadium, 1,000 PP entry, quadruple round robin in 16-team
#    pools, then a best-of-9 bracket.
# 2. Saves Claude's roster for it to /build as "Claude pick 2026-09-29".
# 3. Saves four more rosters as "Claude pick 2026-09-29", replacing today's
#    copies where there are any:
#    - Early Bronze, held until L.J. confirmed he owns the base copies of
#      McDonald, Cimber and Buckner;
#    - Late Bronze, Curiosities and Live Bronze, rebuilt on the PT default
#      rates (they had been scored on MLB's 2010 instead).
#
# The why is in Docs/Rosters/Live-Plus Bronze Pop-up Roster 2026-09-29 (Claude).md.
# It shows everything first. Only a typed "y" writes. Safe to run twice.
# Delete this file once it has run.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\n\033[1mAdd the Live-Plus Bronze Pop-up and save five rosters\033[0m\n\n'
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

EVENT=9300001
NAME="Claude pick 2026-09-29"
ADD=(scripts/catalogue-add.ts --id "$EVENT" --name "Live-Plus Bronze Pop-up" --series liveplusbronzepopup
     --year 2010 --stadium "2026 Yankee Stadium" --dh --value 40-69 --card-years 2026-2026 --fee "1,000 PP"
     --mode "Quadruple round robin, 16-team pools, top 8 to a best-of-9 bracket"
     --text "Entry fee 1,000 PP. Only cards rated BRONZE or lower on the active roster. Only cards from 2026. Default strategy and stats settings, DH. 2026 Yankee Stadium (AVG .967/.975, HR 1.068/1.035, 2B .955, 3B .854). Quadruple round robin in 16-team pools, 8 advance to a best-of-9 bracket. Starts Tue 09-29 18:59."
     --note "L.J.'s screenshot 2026-09-29")
POPUP=(scripts/roster-save.ts --file "../Inbox/rosters/liveplusbronze-claude-2026-09-29.txt" --tournament "$EVENT" --name "$NAME" --replace)
# event id, then the load file in Inbox/rosters (every card pinned by id)
MORE=(
  "525 earlybronze-claude-2026-09-29.txt"
  "524 latebronze-claude-2026-09-29-ptdefault.txt"
  "527 bronzecuriosity-claude-2026-09-29-ptdefault.txt"
  "561 livebronze-claude-2026-09-29-ptdefault.txt"
)

echo "1. The event"
out=$(run "${ADD[@]}" 2>&1) || { echo "$out"; echo "Could not prepare the event. If it says \"unknown flags\" or cannot find catalogue-add, run Push to GitHub.command first."; close 1; }
printf '%s\n' "$out" | grep -v -e "^Dry run" -e "^$" | sed 's/^/   /'
echo
echo "2. Claude's pop-up roster: 26 cards, every one pinned by id. It is checked"
echo "   against the event once the event is saved; Claude checked it against"
echo "   the same rules beforehand: ready."
echo
echo "3. Four more rosters, each checked against its event's rules:"
ready=()
for r in "${MORE[@]}"; do
  id=${r%% *}; file=${r#* }
  check=$(run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --dry 2>&1)
  line=$(printf '%s\n' "$check" | grep -v "^dry run" | tail -1)
  case "$check" in
    *" · ready"*) echo "   ok   $line"; ready+=("$r") ;;
    *) echo "   SKIP $line"; printf '%s\n' "$check" | grep -v "^dry run" | sed 's/^/        /' ;;
  esac
done
echo
[ ${#ready[@]} -eq ${#MORE[@]} ] || echo "Rosters marked SKIP will not be saved. Tell Claude."
if ! ask "Add the event and save the pop-up roster and ${#ready[@]} more?"; then echo "Nothing saved."; close 0; fi

echo
out=$(run "${ADD[@]}" --commit 2>&1) || { echo "$out"; echo "Could not add the event."; close 1; }
printf '%s\n' "$out" | tail -1
check=$(run "${POPUP[@]}" --dry 2>&1) || { echo "$check"; echo "Could not check the pop-up roster."; close 1; }
printf '%s\n' "$check" | grep -v "^dry run"
case "$check" in
  *" · ready"*) run "${POPUP[@]}" || { echo "Could not save the pop-up roster (see above)."; close 1; } ;;
  *) echo "The pop-up roster does not pass the event's rules (see above), so it was not saved. The event is saved. Tell Claude."; close 1 ;;
esac
failed=0
for r in "${ready[@]}"; do
  id=${r%% *}; file=${r#* }
  run scripts/roster-save.ts --file "../Inbox/rosters/$file" --tournament "$id" --name "$NAME" --replace || { echo "Could not save $file (see above)."; failed=1; }
done
[ $failed -eq 0 ] || { echo "Something did not save (see above). Tell Claude."; close 1; }

printf '\n\033[32mDone.\033[0m On /build, pick Live-Plus Bronze Pop-up (it is under Specials), then Saved rosters → "%s".\n' "$NAME"
echo "The batting order shows under each lineup there. You can delete this file now."
close 0
