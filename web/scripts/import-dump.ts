/**
 * Ingest a community finish-order dump from the command line — the dumps run
 * 5-7MB, past Vercel's request cap, so they load locally against the same DB:
 *
 *   pnpm import:dump "../Tourney Data/pt27_tournaments_competitve_dump_20260824.csv" [capturedOn]
 *
 * Same computation as the /api/upload dump kind; writes one uploads row whose
 * report carries the standings that /ptcs renders.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { desc } from "drizzle-orm";
import { db } from "../src/db/client";
import { periods, uploads } from "../src/db/schema";
import { computeStandings, parseDump } from "../src/lib/analytics/dumps";

async function main() {
  const [file, capturedOn] = process.argv.slice(2);
  if (!file) { console.error("usage: pnpm import:dump <dump.csv> [YYYY-MM-DD]"); process.exit(1); }
  if (capturedOn && !/^\d{4}-\d{2}-\d{2}$/.test(capturedOn)) { console.error("capturedOn must be YYYY-MM-DD"); process.exit(1); }
  const parsed = parseDump(readFileSync(file, "utf8"));
  if (!parsed) { console.error("could not parse dump"); process.exit(1); }
  const [period] = await db.select().from(periods).orderBy(desc(periods.id)).limit(1);
  if (!period) { console.error("no period — run pnpm import:ptcs6 first"); process.exit(1); }
  const standings = computeStandings(parsed, { start: period.startsOn, end: period.endsOn });
  const report = {
    source: parsed.source, dateMin: parsed.dateMin, dateMax: parsed.dateMax,
    period: period.name, standings,
  } as unknown as Record<string, unknown>;
  const [row] = await db.insert(uploads).values({
    kind: "dump",
    filename: basename(file),
    rowCount: parsed.events.length,
    report,
    ...(capturedOn ? { uploadedAt: new Date(`${capturedOn}T12:00:00Z`) } : {}),
  }).returning();
  console.log(`dump ingested: upload ${row.id} · ${parsed.source} · ${parsed.events.length} events · through ${parsed.dateMax} · window ${period.startsOn}→${period.endsOn}`);
  for (const [cat, c] of Object.entries(standings.categories)) {
    console.log(`  ${cat.padEnd(10)} pts=${String(c.pts).padStart(4)} rank=${String(c.rank ?? "—").padStart(5)} line128=${c.lines.l128}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
