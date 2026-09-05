/**
 * Fill the card-value window on tournaments that never got one.
 *
 *   pnpm backfill:tierbands [--dry]
 *
 * Why this exists: a tier-named event states its restriction in the TITLE, not
 * in the rules blurb, and databotai only fills `ratings_cap` when the limit is
 * a plain NNN - NNN range. Between the two, ~20 events - the five PTCS 6
 * category championships among them - sat in the database with no ceiling at
 * all, and /build's `isLegal` calls every card legal when the column is null.
 * That is how the Bronze championship came to recommend Perfects.
 *
 * Only NULL columns are written. A window that came from the rules text or the
 * databotai crawl is never touched, and re-running changes nothing. Provenance
 * goes into `restrictions.valueWindowFrom` so a derived band is always visible
 * as derived.
 */
import { isNull, and, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { tournaments } from "../src/db/schema";
import { tierWindowFromName } from "../src/lib/ingest/restrictions";

const DRY = process.argv.includes("--dry");

async function main() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      ratingsMin: tournaments.ratingsMin,
      ratingsMax: tournaments.ratingsMax,
      isDraft: tournaments.isDraft,
      retired: tournaments.retired,
      restrictions: tournaments.restrictions,
    })
    .from(tournaments)
    .where(and(isNull(tournaments.ratingsMax), eq(tournaments.isDraft, false)))
    .orderBy(tournaments.name);

  let wrote = 0;
  const skipped: string[] = [];

  for (const t of rows) {
    // A slots spec is a richer statement of the same thing - per-tier counts
    // beat a single ceiling, and /build already filters on it.
    const rx = (t.restrictions ?? null) as { slots?: Record<string, number> } | null;
    if (rx?.slots && Object.keys(rx.slots).length) { skipped.push(`${t.name} (has slots)`); continue; }

    const w = tierWindowFromName(t.name, { isDraft: t.isDraft });
    if (!w || (w.min == null && w.max == null)) { skipped.push(`${t.name} (name gives no window)`); continue; }

    const set: Record<string, unknown> = {
      restrictions: { ...(rx ?? {}), valueWindowFrom: `name: ${w.basis}` },
    };
    if (t.ratingsMax == null && w.max != null) set.ratingsMax = w.max;
    if (t.ratingsMin == null && w.min != null) set.ratingsMin = w.min;
    if (set.ratingsMax == null && set.ratingsMin == null) { skipped.push(`${t.name} (nothing to fill)`); continue; }

    if (!DRY) await db.update(tournaments).set({ ...set, updatedAt: sql`now()` }).where(eq(tournaments.id, t.id));
    wrote++;
    console.log(
      `  ${String(t.id).padStart(8)}  ${t.name.slice(0, 40).padEnd(42)} ` +
      `${w.min ?? 40}-${w.max ?? "none"}  (${w.basis})${t.retired ? "  [retired]" : ""}`,
    );
  }

  console.log(`\n${wrote} of ${rows.length} uncapped events given a window${DRY ? " (dry run)" : ""}`);
  if (skipped.length) {
    console.log(`\nleft alone (${skipped.length}) — the name yields no window, or a slots spec already governs:`);
    for (const s of skipped) console.log(`  ${s}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
