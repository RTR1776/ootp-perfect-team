#!/bin/bash
# Watch Tourney Stats — leave this running while you grab stats out of OOTP.
#
# You export however you like (Examine → Tournament → Statistics → Sortable
# Stats → Report → Write report to csv). The moment the file lands this
#   1. snapshots it out of the way, so your NEXT export cannot overwrite it
#      (OOTP reuses one filename for every export — that is the whole problem),
#   2. fingerprints it and files it into Archive/Completed under the right name,
#      asking you only when it genuinely cannot tell,
#   3. imports everything into the app when you quit with Ctrl-C.
#
# No clicking, no coordinates, no row numbers. Ctrl-C when you are done.

ROOT="$HOME/Desktop/OOTP Perfect Team"
LAND="$HOME/Application Support/Out of the Park Developments/OOTP Baseball 27/online_data/statistics_player_statistics_-_sortable_stats_cwhit_view.csv"
INBOX="$ROOT/Inbox/Tourney Stats"
LOG="$ROOT/Archive/grab-log.txt"
cd "$ROOT/web" || { echo "cannot find the web/ folder"; exit 1; }
[ -s .env.local ] && export $(grep -E '^DATABASE_URL=' .env.local | xargs)
TSX=./node_modules/.bin/tsx
[ -x "$TSX" ] || { echo "tsx missing — run pnpm install in web/ first"; exit 1; }
mkdir -p "$INBOX"

filed=0
finish() {
  echo
  if [ "$filed" -gt 0 ]; then
    echo "── filed $filed file(s). Importing into the app…"
    "$TSX" scripts/import-observed.ts 2>&1 | tail -5
    echo "── checking nothing got wiped (see the 8/31 failure):"
    "$TSX" -e 'import{db}from"./src/db/client";import{sql}from"drizzle-orm";const r:any=await db.execute(sql`select count(distinct series)::int n, count(*)::int rows from observed_card_stats`);console.log("  ",JSON.stringify((Array.isArray(r)?r:r.rows)[0]));process.exit(0)' 2>&1 | tail -2
    "$TSX" scripts/fit-projection.ts 2>&1 | tail -3
    echo "── done. Tell Claude and it will run the inventory + commit."
  else
    echo "── nothing new was exported."
  fi
  exit 0
}
trap finish INT TERM

echo "watching for OOTP stat exports…  (Ctrl-C when you're finished)"
echo "  landing file: ${LAND##*/}"
echo
prev=$(stat -f '%m %z' "$LAND" 2>/dev/null || echo none)
while true; do
  cur=$(stat -f '%m %z' "$LAND" 2>/dev/null || echo none)
  if [ "$cur" != "$prev" ] && [ "$cur" != "none" ]; then
    sleep 2                                   # let OOTP finish writing
    cur=$(stat -f '%m %z' "$LAND" 2>/dev/null || echo none)
    snap="$INBOX/grab_$(date '+%H%M%S').csv"
    mv "$LAND" "$snap" 2>/dev/null || cp "$LAND" "$snap"
    echo "→ new export caught $(date '+%H:%M:%S')"
    if "$TSX" scripts/claim-export.ts "$snap" </dev/tty; then filed=$((filed+1)); fi
    echo
    prev=$(stat -f '%m %z' "$LAND" 2>/dev/null || echo none)
  else
    prev="$cur"
  fi
  sleep 2
done
