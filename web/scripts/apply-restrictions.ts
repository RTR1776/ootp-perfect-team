/**
 * Parse every rules blurb we hold and write the result onto `tournaments`.
 *
 *   pnpm apply:restrictions [--dry]
 *
 * Sources, in order of trust:
 *   1. Tourney Data/refresh-2026-09.json  - the community refresh posts
 *   2. RESTRICTION_OVERRIDES              - read off OOTP's RESTRICTIONS column
 *
 * Value and year windows go into the dedicated columns /build already filters
 * on; everything else (slots, caps, card types) lands in `restrictions` jsonb.
 * A parsed value never overwrites a non-null column with null.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { tournaments } from "../src/db/schema";
import { parseRestrictions } from "../src/lib/ingest/restrictions";

const DRY = process.argv.includes("--dry");
const ROOT = join(process.cwd(), "..");
const R = JSON.parse(readFileSync(join(ROOT, "Tourney Data/refresh-2026-09.json"), "utf8"));

async function main() {
  const rows = await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments);
  const byName = new Map(rows.map((r) => [r.name.toLowerCase().trim(), r.id]));

  // OOTP's name and the refresh post's name do not always match exactly.
  const find = (name: string): number | undefined => {
    const k = name.toLowerCase().trim();
    if (byName.has(k)) return byName.get(k);
    const hits = [...byName.entries()].filter(([n]) => n.includes(k) || k.includes(n));
    return hits.length === 1 ? hits[0][1] : undefined;
  };

  let applied = 0, unmatched: string[] = [];
  for (const tier of ["silver", "iron", "bronze", "perfectDraft"] as const) {
    for (const entry of Object.values<any>(R[tier])) {
      // The databotai catalog has not caught up with the renames, so its rows
      // still carry the OLD name. For Perfect Drafts the "new" string is a
      // FORMAT ("Orderly", "Perfecto"), never a tournament name - matching on
      // it fuzzily would attach one event's rules to another.
      const name: string = entry.new ?? entry.old;
      const id = tier === "perfectDraft" ? find(entry.old) : (find(name) ?? find(entry.old));
      if (id == null) { unmatched.push(name); continue; }

      const p = parseRestrictions(entry.text);
      const extra: Record<string, unknown> = {};
      for (const k of ["slots", "teamCap", "variantCap", "variantsAllowed", "teams",
                       "bestOf", "cards", "clockMinutes", "cardTypes", "reRandom"] as const) {
        if (p[k] != null) extra[k] = p[k];
      }
      if (p.notes.length) extra.notes = p.notes;

      const set: Record<string, unknown> = { restrictions: Object.keys(extra).length ? extra : null };
      if (p.valueMin != null) set.ratingsMin = p.valueMin;
      if (p.valueMax != null) set.ratingsMax = p.valueMax;
      if (p.yearMin != null) set.cardYearMin = p.yearMin;
      if (p.yearMax != null) set.cardYearMax = p.yearMax;
      if (p.reYear != null) set.envYear = p.reYear;
      if (p.park != null) set.stadium = p.park;
      if (p.dh != null) set.dh = p.dh;

      if (!DRY) await db.update(tournaments).set(set).where(eq(tournaments.id, id));
      applied++;
      const bits = Object.keys(set).filter((k) => set[k] != null);
      const target = rows.find((r) => r.id === id)!.name;
      console.log(`  ${String(target).slice(0, 34).padEnd(36)} ${bits.join(", ") || "(nothing parsed)"}`);
    }
  }
  console.log(`\n${applied} tournaments updated${DRY ? " (dry run)" : ""}`);
  if (unmatched.length) {
    console.log(`\nno catalog row matched (${unmatched.length}) — these are renames the`);
    console.log(`databotai CSV has not caught up with yet:`);
    for (const n of unmatched) console.log(`  ${n}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
