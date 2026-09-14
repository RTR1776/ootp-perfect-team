#!/bin/bash
# Load Tourney Dumps — double-click this after saving the weekly community dump.
#
# You do not have to put the file anywhere special. Save it in Downloads, on the
# Desktop, or in the project's Inbox folder; this finds it, files it into
# Tourney Data/, imports anything it has not seen before, and then prints where
# you stand and what each berth line is.
#
# Safe to run twice — already-imported dumps are skipped by filename.
#
# Why it matters: tournaments retire on a rolling basis and their pages vanish,
# but the dump keeps the entire field in finish order for every event of the
# season. The dump on disk is the permanent record; the game's screen is not.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

printf '\033[1m Loading tournament dumps…\033[0m\n'
node --env-file=.env.local --import tsx scripts/load-dumps.ts --period "PTCS 7" "$@"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  printf '\n\033[31m Something went wrong (exit %s).\033[0m\n' "$STATUS"
  printf ' Copy the message above into the chat and I will fix it.\n'
fi

printf '\n Press return to close this window.\n'
read -r _
