/**
 * Extract rtr1776's per-event results from community finish-order dumps
 * into my_results — the raw material for team-results tracking.
 *
 * Run: pnpm import:myresults [dumpfile ...]
 * With no args it takes the newest tournaments + drafts dump from
 * "Tourney Data/". Idempotent: upserts by event id, so re-running with a
 * newer dump refreshes/extends history (dumps list in-progress weeklies —
 * a later dump's final order overwrites the provisional one).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db/client";
import { myResults } from "../src/db/schema";
import { sql } from "drizzle-orm";
import { parseDump, categoriesOf, pointsFor } from "../src/lib/analytics/dumps";
import { isQuickEvent, newestDumpFile } from "../src/lib/analytics/dump-files";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const USER = "rtr1776";

async function main() {
  let files = process.argv.slice(2);
  if (files.length === 0) {
    // The newest COMPETITIVE dump of each kind. A plain sort over every dump
    // name picked the Quick dump from 10-19 on ("quick" sorts after
    // "competitve"), so this table stopped at 10-12 and took in 262 Quick and
    // EF events with points they never scored (found 2026-11-12).
    const dir = join(ROOT, "Tourney Data");
    for (const kind of ["tournaments", "drafts"] as const) {
      const newest = newestDumpFile(dir, kind);
      if (newest) files.push(join(dir, newest));
    }
  }
  if (files.length === 0) throw new Error("no dump files found or given");

  let total = 0;
  for (const file of files) {
    const dump = parseDump(readFileSync(file, "utf8"));
    if (!dump) { console.error(`not a dump: ${file}`); continue; }
    const rows = [];
    let quick = 0;
    for (const e of dump.events) {
      const idx = e.finishers.findIndex((u) => u.toLowerCase() === USER);
      if (idx < 0) continue;
      // Quick and EF events score in no PTCS category; they never belong here.
      if (isQuickEvent(e.name)) { quick++; continue; }
      rows.push({
        eventId: e.id,
        source: dump.source,
        name: e.name,
        startAt: new Date(e.start * 1000),
        finish: idx + 1,
        fieldSize: e.finishers.length,
        points: pointsFor(idx + 1, e.finishers.length),
        categories: categoriesOf(e.name, dump.source).join(","),
      });
    }
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(myResults).values(rows.slice(i, i + 500)).onConflictDoUpdate({
        target: myResults.eventId,
        set: {
          name: sql`excluded.name`, startAt: sql`excluded.start_at`,
          finish: sql`excluded.finish`, fieldSize: sql`excluded.field_size`,
          points: sql`excluded.points`, categories: sql`excluded.categories`,
        },
      });
    }
    console.log(`${file}: ${dump.events.length} events, ${rows.length} with ${USER}${quick ? ` (${quick} Quick/EF left out)` : ""}`);
    total += rows.length;
  }
  console.log(`my_results upserted: ${total}`);
  // The table is derived from the dumps, so Quick rows an earlier run put in
  // are removed here. Same pattern as isQuickEvent.
  const gone = await db.delete(myResults).where(sql`${myResults.name} ~* '^(PD-)?(EF|Q)-'`).returning({ id: myResults.eventId });
  if (gone.length) console.log(`my_results: removed ${gone.length} Quick/EF rows from an earlier load`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
