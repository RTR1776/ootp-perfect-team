#!/bin/bash
# After The 11-12 Review — double-click this once. It does what Claude asked of this Mac, in order,
# and asks before each step. Delete this file when it has run.
#
#   1. Docs/Handoff 2026-11-07.md: it was written on this Mac and never committed. If it is
#      here, it is committed so the sync can send it up. If it is not, that is the answer.
#   2. Back up the export archive (Back Up Export Archive.command; it asks where, the first time).
#   3. Optional: rerun the two win tests on the whole archive (Run Win Tests.command, 15 to 30 minutes).
#   4. Sync with GitHub (Push to GitHub.command), which sends up whatever the steps above made.
#
# The cloud side is done: pull requests 181 to 186 are merged, and all 74 current events have a
# "Claude pick 2026-11-12 review" on /build. Docs/Handoff 2026-11-12.md has the whole account.

cd "$(dirname "$0")" || exit 1
printf '\n\033[1mAfter the 11-12 review\033[0m\n'
ask() { local ok; read -r -p "$1 [Y/n] " ok; case "$ok" in n|N|no|NO) return 1 ;; *) return 0 ;; esac; }

printf '\n\033[1m1. The 11-07 handoff\033[0m\n'
H="Docs/Handoff 2026-11-07.md"
if [ ! -f "$H" ]; then
  echo "Not on this Mac, so there is nothing to send. (Tell Claude: \"no 11-07 handoff here\".)"
elif [ -z "$(git status --porcelain -- "$H")" ]; then
  echo "Already committed."
elif ask "It is here and GitHub does not have it. Commit it?"; then
  if git add -- "$H" && git commit -q -m "Handoff 2026-11-07, from the Mac" -- "$H"; then echo "Committed. Step 4 sends it up."
  else echo "Could not commit it (see above). Carrying on."; fi
fi

printf '\n\033[1m2. Back up the export archive\033[0m\n'
if ask "Back it up now?"; then OOTP_NO_PAUSE=1 "./Back Up Export Archive.command"; else echo "Skipped. Back Up Export Archive.command does it any time."; fi

printf '\n\033[1m3. Win tests on the whole archive (optional)\033[0m\n'
echo "Claude tested two pricing changes on the 42 exports in git. This reruns them on everything here."
read -r -p "Run them now? It takes 15 to 30 minutes. [y/N] " ok
case "$ok" in
  y|Y|yes|YES) OOTP_NO_PAUSE=1 "./Run Win Tests.command" ;;
  *) echo "Skipped. Run Win Tests.command does it any time." ;;
esac

printf '\n\033[1m4. Sync with GitHub\033[0m\n'
exec "./Push to GitHub.command"
