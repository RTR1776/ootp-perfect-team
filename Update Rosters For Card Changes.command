#!/bin/bash
# Update Rosters For Card Changes — double-click after selling or buying a few cards.
# Rebuilds only the current tournament events whose saved roster lost a card, or where a
# gained card would start, and saves them to /build ("Claude pick <today> changes").
# Card ids are on each card's page in the app (/cards) or in the collection export.
# Docs/New Cards Workflow.md, "Card changes, the quick path".
cd "$(dirname "$0")/web" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
[ -f .env.local ] || { echo "web/.env.local is missing; it holds the database address."; close 1; }
printf '\n\033[1mUpdate rosters for card changes\033[0m\n\n'
read -r -p "Card ids SOLD since your last collection upload (comma-separated, blank for none): " SOLD
read -r -p "Card ids BOUGHT since your last collection upload (comma-separated, blank for none): " BOUGHT
ARGS=(--changes)
[ -n "$SOLD" ] && ARGS+=(--sold "$SOLD")
[ -n "$BOUGHT" ] && ARGS+=(--bought "$BOUGHT")
TAG="$(date +%Y-%m-%d)-changes"
echo; echo "Events that need a rebuild:"
node --env-file=.env.local --import tsx scripts/current-rosters.ts "${ARGS[@]}" --list 2>&1 | grep -E "^  [0-9]+ |to build|left as saved"
echo
read -r -p "Build and save these? [y/N] " ok
case "$ok" in y|Y|yes|YES) ;; *) echo "Nothing saved."; close 0 ;; esac
OUT="$(mktemp -d)"
node --env-file=.env.local --import tsx scripts/current-rosters.ts "${ARGS[@]}" --out "$OUT" --tag "$TAG" --jobs 4 --save 2>&1 | grep -E "^\s*\[|built and legal|NOT BUILT|UNCHANGED|^saving|saved as|!!"
close 0
