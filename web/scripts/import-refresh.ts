/**
 * Seed tournaments from the LOCAL refresh posts — no databotai crawl.
 *
 *   pnpm import:refresh [--dry]
 *
 * When PT refreshes a tier it renames slots, and the renamed event is a
 * DIFFERENT tournament sharing a number. The databotai catalog only learns the
 * new name whenever it is next crawled, so until then those events have no row
 * at all: nothing to attach a series slug to, nothing for /build to pick.
 * Everything needed is already in the repo:
 *
 *   Tourney Data/refresh-2026-09.json   name + rules blurb, keyed by slot
 *   web/scripts/slot-map.json           slot -> the filer's series slug
 *   Tourney Data/pt27_*_dump_*.csv      observed field size for the slot
 *
 * A slot whose current name already matches a tournament row UPDATES that row.
 * A slot with no matching row is INSERTED at id 9_100_000 + slot — deterministic,
 * idempotent, and well clear of the ids databotai issues. When a real crawl
 * later brings the event in under its own id, retire the seeded row.
 *
 * Perfect Drafts are skipped: their "new" field is a FORMAT ("Perfecto",
 * "Orderly"), not a name, and their pool is a per-round sequence rather than a
 * roster-wide window.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { parks, tournaments } from "../src/db/schema";
import { parseRestrictions, tierWindowFromName } from "../src/lib/ingest/restrictions";

const DRY = process.argv.includes("--dry");
const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const ID_BASE = 9_100_000;
const TIERS = ["silver", "iron", "bronze"] as const;

interface Entry { old: string; new: string | null; text: string }

/** Observed field size per slot, from the newest community dumps. */
function fieldSizes(): Map<number, number> {
  const out = new Map<number, number>();
  const dir = join(ROOT, "Tourney Data");
  for (const kind of ["tournaments", "drafts"]) {
    const files = readdirSync(dir).filter((f) => f.startsWith(`pt27_${kind}_`) && f.endsWith(".csv")).sort();
    const newest = files.pop();
    if (!newest) continue;
    const lines = readFileSync(join(dir, newest), "utf8").split(/\r?\n/).slice(2);
    for (const line of lines) {
      const cells = line.split(",");
      const n = Number(cells[0]);
      if (!Number.isFinite(n) || !cells[0]) continue;
      const slot = Math.floor(n / 10000);
      const field = cells.slice(3).filter((c) => c.trim()).length;
      if (field > (out.get(slot) ?? 0)) out.set(slot, field);
    }
  }
  return out;
}

async function main() {
  const refresh = JSON.parse(readFileSync(join(ROOT, "Tourney Data/refresh-2026-09.json"), "utf8"));
  const slotMapRaw = JSON.parse(readFileSync(join(process.cwd(), "scripts/slot-map.json"), "utf8"));
  const slotSlug = new Map<number, string>(
    Object.entries(slotMapRaw).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [Number(k), v as string]),
  );
  const fields = fieldSizes();

  const parkNames = (await db.select({ name: parks.name }).from(parks)).map((p) => p.name);
  const resolvePark = (stadium: string | null) => {
    if (!stadium) return null;
    const bare = stadium.replace(/^\d{4}\s+/, "").trim();
    if (parkNames.includes(bare)) return bare;
    const hits = parkNames.filter((p) => p.includes(bare) || bare.includes(p));
    return hits.length === 1 ? hits[0] : null;
  };

  const existing = await db.select({ id: tournaments.id, name: tournaments.name, series: tournaments.series }).from(tournaments);
  const byName = new Map(existing.map((r) => [r.name.toLowerCase().trim(), r]));

  const inserts: (typeof tournaments.$inferInsert)[] = [];
  const updates: { id: number; name: string; set: Record<string, unknown> }[] = [];

  for (const tier of TIERS) {
    for (const [slotStr, e] of Object.entries(refresh[tier] as Record<string, Entry>)) {
      const slot = Number(slotStr);
      const name = (e.new ?? e.old).trim();
      const slug = slotSlug.get(slot) ?? null;
      const r = parseRestrictions(e.text);
      // The name carries the tier when the blurb does not restate it.
      const win = tierWindowFromName(name);
      const ratingsMin = r.valueMin ?? win?.min ?? null;
      const ratingsMax = r.valueMax ?? win?.max ?? null;
      const derived = r.valueMin == null && r.valueMax == null && win != null;

      const extra: Record<string, unknown> = { slot, slug, refreshText: e.text, refreshedName: name };
      for (const k of ["slots", "teamCap", "variantCap", "variantsAllowed", "teams", "bestOf",
                       "cardTypes", "reRandom"] as const) if (r[k] != null) extra[k] = r[k];
      if (r.notes.length) extra.notes = r.notes;
      if (derived) extra.valueWindowFrom = `name: ${win!.basis}`;

      // Exact name first; then a UNIQUE containment either way, because the
      // refresh post and the databotai catalog spell some events differently
      // ("Daily Dank" vs "Daily Dank Iron"). Without this a naming difference
      // reads as a rename and seeds a duplicate row.
      const key = name.toLowerCase();
      let hit = byName.get(key);
      if (!hit) {
        const near = existing.filter((r) => {
          const n = r.name.toLowerCase().trim();
          return n.includes(key) || key.includes(n);
        });
        if (near.length === 1) hit = near[0];
      }
      if (hit) {
        const set: Record<string, unknown> = { restrictions: extra };
        if (ratingsMin != null) set.ratingsMin = ratingsMin;
        if (ratingsMax != null) set.ratingsMax = ratingsMax;
        if (r.yearMin != null) set.cardYearMin = r.yearMin;
        if (r.yearMax != null) set.cardYearMax = r.yearMax;
        if (r.reYear != null) set.envYear = r.reYear;
        if (r.park != null) { set.stadium = r.park; set.parkName = resolvePark(r.park); }
        if (r.dh != null) set.dh = r.dh;
        if (slug && !hit.series) set.series = slug;
        set.retired = false;   // it is the CURRENT name, so it is a live event
        updates.push({ id: hit.id, name, set });
        continue;
      }
      inserts.push({
        id: ID_BASE + slot,
        name,
        envYear: r.reYear,
        mode: r.bestOf ? `BO${r.bestOf}` : null,
        stadium: r.park,
        parkName: resolvePark(r.park),
        dh: r.dh,
        entrants: r.teams ?? fields.get(slot) ?? null,
        ratingsMin, ratingsMax,
        cardYearMin: r.yearMin, cardYearMax: r.yearMax,
        series: slug,
        isDraft: false,
        restrictions: { ...extra, seededFrom: "refresh-2026-09.json" },
      });
    }
  }

  console.log(`${updates.length} existing rows refreshed, ${inserts.length} seeded${DRY ? " (dry run)" : ""}\n`);
  const show = (id: number, name: string, min: unknown, max: unknown, extra: Record<string, unknown>) =>
    console.log(`  ${String(id).padStart(8)}  ${name.slice(0, 36).padEnd(38)} ` +
      `val ${String(min ?? 40)}-${String(max ?? "none")}`.padEnd(16) +
      `${extra.valueWindowFrom ? "(from name) " : ""}series=${extra.slug ?? "—"}`);

  if (inserts.length) {
    console.log("SEEDED — no catalog row carried this name:");
    for (const row of inserts) show(row.id!, row.name, row.ratingsMin, row.ratingsMax, row.restrictions as Record<string, unknown>);
    if (!DRY) {
      await db.insert(tournaments).values(inserts).onConflictDoUpdate({
        target: tournaments.id,
        set: {
          name: sql`excluded.name`, envYear: sql`excluded.env_year`, mode: sql`excluded.mode`,
          stadium: sql`excluded.stadium`, parkName: sql`excluded.park_name`, dh: sql`excluded.dh`,
          entrants: sql`excluded.entrants`,
          ratingsMin: sql`excluded.ratings_min`, ratingsMax: sql`excluded.ratings_max`,
          cardYearMin: sql`excluded.card_year_min`, cardYearMax: sql`excluded.card_year_max`,
          series: sql`excluded.series`, restrictions: sql`excluded.restrictions`,
          retired: sql`false`, updatedAt: sql`now()`,
        },
      });
    }
  }
  if (updates.length) {
    console.log("\nUPDATED from the refresh post:");
    for (const u of updates) show(u.id, u.name, u.set.ratingsMin, u.set.ratingsMax, u.set.restrictions as Record<string, unknown>);
    if (!DRY) for (const u of updates) {
      await db.update(tournaments).set({ ...u.set, updatedAt: sql`now()` }).where(sql`${tournaments.id} = ${u.id}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
