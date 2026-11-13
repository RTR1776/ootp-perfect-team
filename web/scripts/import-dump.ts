/**
 * Ingest a community finish-order dump from the command line — the dumps run
 * 5-7MB, past Vercel's request cap, so they load locally against the same DB:
 *
 *   pnpm import:dump "../Tourney Data/pt27_tournaments_competitve_dump_20260824.csv" [capturedOn] [periodName]
 *
 * With no period name the dump is scored in the period it reaches, and in a
 * period that closed in the week before it too: the first dump after a period
 * ends is that period's final board (lib/analytics/dump-files periodsForDump).
 * A name scores it in that period alone.
 *
 * Same computation as the /api/upload dump kind; writes one uploads row per
 * period, whose report carries the standings that /ptcs renders.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { asc } from "drizzle-orm";
import { db } from "../src/db/client";
import { periods, uploads } from "../src/db/schema";
import { computeStandings, parseDump } from "../src/lib/analytics/dumps";
import { periodsForDump } from "../src/lib/analytics/dump-files";

async function main() {
  const [file, capturedOn, periodName] = process.argv.slice(2);
  if (!file) { console.error("usage: pnpm import:dump <dump.csv> [YYYY-MM-DD] [periodName]"); process.exit(1); }
  if (capturedOn && !/^\d{4}-\d{2}-\d{2}$/.test(capturedOn)) { console.error("capturedOn must be YYYY-MM-DD"); process.exit(1); }
  const parsed = parseDump(readFileSync(file, "utf8"));
  if (!parsed) { console.error("could not parse dump"); process.exit(1); }
  const all = await db.select().from(periods).orderBy(asc(periods.startsOn));
  if (!all.length) { console.error("no period — run pnpm import:ptcs6 first"); process.exit(1); }
  let targets = periodName ? all.filter((p) => p.name === periodName) : periodsForDump(all, parsed.dateMax);
  if (periodName && !targets.length) throw new Error(`Unknown period: ${periodName}`);
  if (!targets.length) {
    // The dump reaches no period on file: the newest one that had opened by then, else the first.
    const opened = all.filter((p) => p.startsOn <= parsed.dateMax);
    targets = [opened.at(-1) ?? all[0]];
    console.log(`  no period holds ${parsed.dateMax}; scoring it in ${targets[0].name}`);
  }
  for (const period of targets) {
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
    console.log(`dump ingested: upload ${row.id} · ${parsed.source} · ${parsed.events.length} events · through ${parsed.dateMax} · ${period.name} ${period.startsOn}→${period.endsOn}`);
    for (const [cat, c] of Object.entries(standings.categories)) {
      console.log(`  ${cat.padEnd(10)} pts=${String(c.pts).padStart(4)} rank=${String(c.rank ?? "—").padStart(5)} line128=${c.lines.l128}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
