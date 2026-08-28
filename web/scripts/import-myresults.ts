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

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db/client";
import { myResults } from "../src/db/schema";
import { sql } from "drizzle-orm";
import { parseDump, categoriesOf, pointsFor } from "../src/lib/analytics/dumps";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const USER = "rtr1776";

async function main() {
  let files = process.argv.slice(2);
  if (files.length === 0) {
    const dir = join(ROOT, "Tourney Data");
    const all = readdirSync(dir).filter((f) => f.includes("dump") && f.endsWith(".csv"));
    for (const kind of ["tournaments", "drafts"]) {
      const newest = all.filter((f) => f.includes(kind)).sort().pop();
      if (newest) files.push(join(dir, newest));
    }
  }
  if (files.length === 0) throw new Error("no dump files found or given");

  let total = 0;
  for (const file of files) {
    const dump = parseDump(readFileSync(file, "utf8"));
    if (!dump) { console.error(`not a dump: ${file}`); continue; }
    const rows = [];
    for (const e of dump.events) {
      const idx = e.finishers.findIndex((u) => u.toLowerCase() === USER);
      if (idx < 0) continue;
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
    console.log(`${file}: ${dump.events.length} events, ${rows.length} with ${USER}`);
    total += rows.length;
  }
  console.log(`my_results upserted: ${total}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
