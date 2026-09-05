/**
 * Load the ten PTCS 6 championship events (Sat Sep 12) as tournaments.
 *
 *   pnpm import:ptcs6:championship
 *
 * Source is `src/db/seed/ptcs6-championship.json` — the format announcement
 * kept as the verbatim rules blurb per event, so `parseRestrictions` does the
 * structuring here exactly as it does for the daily refresh posts. Nothing is
 * hand-transcribed into columns.
 *
 * These events have no databotai id yet (they have not been played), so they
 * take a reserved id block, 9060001-9060010, well clear of the ~1.3M-1.9M
 * range databotai issues. When the real ids appear after the 12th, the rows
 * import normally and these can be retired.
 *
 * Idempotent — upsert on tournaments.id, so re-running after an announcement
 * correction overwrites rather than duplicating.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { parks, tournaments } from "../src/db/schema";
import { parseRestrictions, tierWindowFromName } from "../src/lib/ingest/restrictions";
import { CATEGORIES } from "../src/lib/ingest/constants";

const ID_BASE = 9_060_000;

interface SeedEvent {
  category: string;
  name: string;
  firstSimEt: string;
  text: string;
  isDraft?: boolean;
  draftFormat?: string;
}
interface Seed {
  series: string;
  playedOn: string;
  note: string;
  events: SeedEvent[];
}

async function main() {
  const path = join(process.cwd(), "src/db/seed/ptcs6-championship.json");
  const seed = JSON.parse(readFileSync(path, "utf8")) as Seed;

  const unknown = seed.events
    .map((e) => e.category)
    .filter((c) => !(CATEGORIES as readonly string[]).includes(c));
  if (unknown.length) throw new Error(`Unknown categories: ${unknown.join(", ")}`);

  /* Park names, matched the same way import:tournaments matches them: strip a
     leading year, exact hit first, then a unique containment either way. */
  const parkNames = (await db.select({ name: parks.name }).from(parks)).map((p) => p.name);
  const resolvePark = (stadium: string | null) => {
    if (!stadium) return null;
    const bare = stadium.replace(/^\d{4}\s+/, "").trim();
    if (parkNames.includes(bare)) return bare;
    const hits = parkNames.filter((p) => p.includes(bare) || bare.includes(p));
    return hits.length === 1 ? hits[0] : null;
  };

  const rows = seed.events.map((e, i) => {
    const r = parseRestrictions(e.text);
    const parkName = resolvePark(r.park);
    // The announcement never restates the tier for a category event - "PTCS 6
    // Championship - Bronze" says it in the name - so parseRestrictions finds
    // no value clause and the event would import with NO ceiling, which is
    // what once had /build recommending Perfects for the Bronze championship.
    // A stated clause (Live's "MIN 50, Cards <= 84") always wins.
    const nameWin = tierWindowFromName(e.name, { isDraft: e.isDraft === true });
    const ratingsMin = r.valueMin ?? nameWin?.min ?? null;
    const ratingsMax = r.valueMax ?? nameWin?.max ?? null;
    const derived = r.valueMin == null && r.valueMax == null && nameWin != null;
    return {
      id: ID_BASE + i + 1,
      name: e.name,
      envYear: r.reYear,
      mode: r.bestOf ? `BO${r.bestOf}` : null,
      stadium: r.park,
      parkName,
      fee: null,
      dh: r.dh,
      entrants: null,
      ratingsMin,
      ratingsMax,
      cardYearMin: r.yearMin,
      cardYearMax: r.yearMax,
      simRuns: null,
      series: seed.series,
      isDraft: e.isDraft === true,
      restrictions: {
        ...r,
        category: e.category,
        ...(derived ? { valueWindowFrom: `name: ${nameWin!.basis}` } : {}),
        firstSimEt: e.firstSimEt,
        playedOn: seed.playedOn,
        ...(e.draftFormat ? { draftFormat: e.draftFormat } : {}),
        announcedText: e.text,
      } as Record<string, unknown>,
    };
  });

  await db.insert(tournaments).values(rows).onConflictDoUpdate({
    target: tournaments.id,
    set: {
      name: sql`excluded.name`, envYear: sql`excluded.env_year`, mode: sql`excluded.mode`,
      stadium: sql`excluded.stadium`, parkName: sql`excluded.park_name`,
      dh: sql`excluded.dh`,
      ratingsMin: sql`excluded.ratings_min`, ratingsMax: sql`excluded.ratings_max`,
      cardYearMin: sql`excluded.card_year_min`, cardYearMax: sql`excluded.card_year_max`,
      series: sql`excluded.series`, isDraft: sql`excluded.is_draft`,
      restrictions: sql`excluded.restrictions`,
      updatedAt: sql`now()`,
    },
  });

  console.log(`ptcs6 championship: ${rows.length} events upserted as "${seed.series}"`);
  for (const row of rows) {
    const r = row.restrictions as Record<string, unknown>;
    const band = row.ratingsMin != null || row.ratingsMax != null
      ? ` val ${row.ratingsMin ?? ""}..${row.ratingsMax ?? ""}${r.valueWindowFrom ? "*" : ""}` : "";
    const slots = r.slots ? ` slots ${Object.entries(r.slots as Record<string, number>).map(([k, v]) => k + v).join(" ")}` : "";
    const cap = r.teamCap ? ` cap ${r.teamCap}` : "";
    console.log(
      `  ${String(r.category).padEnd(10)} ${row.id}  ${r.firstSimEt} ET  ` +
      `RE ${row.envYear ?? "default"}  ${row.dh ? "DH" : "noDH"}  ` +
      `${row.parkName ?? `NO PARK MATCH (${row.stadium})`}${band}${cap}${slots}`,
    );
  }
  const unparked = rows.filter((r) => r.stadium && !r.parkName);
  if (unparked.length) {
    console.log("  stadiums with no park-factor match:", unparked.map((r) => r.stadium).join(" | "));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
