#!/bin/bash
# Upload Card Art — double-click after new cards come out.
#
# Copies art for cards the app has not seen yet from OOTP's own card cache
# (~/Application Support/…/OOTP Baseball 27/online_data/cache/cards) to the
# app's image store. /cards and the card peek on /build then show it.
# Only new cards are sent, so it is quick and safe to run any time.
# File OOTP Exports.command also runs it when it finishes.
#
# The first run asks for the Blob store's read-write token and saves it to
# web/.env.blob (never committed). Find the token in Vercel: project
# ootp-command-center > Storage > the Blob store > the .env.local tab,
# BLOB_READ_WRITE_TOKEN.
#
# A card with no art after this is not in OOTP's cache. Open it once in
# the game (card shop or collection) and run this again. The last lines of
# the output list those cards.

cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

has_token() {
  [ -n "$BLOB_READ_WRITE_TOKEN" ] && return 0
  grep -qs '^[[:space:]]*BLOB_READ_WRITE_TOKEN[[:space:]]*=' .env.blob .env.local
}

if ! has_token; then
  TOKEN=$(osascript -e 'text returned of (display dialog "Paste the Vercel Blob read-write token (BLOB_READ_WRITE_TOKEN).\n\nVercel: ootp-command-center > Storage > the Blob store > .env.local tab.\n\nIt is saved to web/.env.blob on this Mac only." default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save" with title "Upload Card Art")' 2>/dev/null)
  if [ -z "$TOKEN" ]; then
    printf '\n No token given, nothing uploaded.\n\n Press return to close this window.\n'
    read -r _
    exit 1
  fi
  TOKEN=${TOKEN#BLOB_READ_WRITE_TOKEN=}
  TOKEN=${TOKEN//\"/}
  ( umask 077; printf 'BLOB_READ_WRITE_TOKEN="%s"\n' "$TOKEN" > .env.blob )
  printf ' Saved the token to web/.env.blob.\n\n'
fi

printf '\033[1m Uploading new card art…\033[0m\n'
node scripts/upload-card-art.mjs "$@"
STATUS=$?

if [ $STATUS -eq 2 ]; then
  printf '\n\033[31m The token was not accepted or not found.\033[0m Delete web/.env.blob and run this again to re-enter it.\n'
elif [ $STATUS -ne 0 ]; then
  printf '\n\033[31m Something went wrong (exit %s).\033[0m\n' "$STATUS"
  printf ' Copy the message above into the chat and I will fix it.\n'
fi

printf '\n Press return to close this window.\n'
read -r _
