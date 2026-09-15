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
 *                                       (silver / iron / bronze / gold / diamond sections)
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
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const ID_BASE = 9_100_000;
const TIERS = ["silver", "iron", "bronze", "gold", "diamond", "open"] as const;
/** Ceiling implied by the SECTION of the post an event sits in, for names with no tier word. */
/** Open events have no ceiling by design - the section sets none. */
const SECTION_MAX: Record<(typeof TIERS)[number], number | null> = { iron: 59, bronze: 69, silver: 79, gold: 89, diamond: 99, open: null };

interface Entry { old: string; new: string | null; text: string; note?: string; removed?: boolean }

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

  const existing = await db.select({ id: tournaments.id, name: tournaments.name, series: tournaments.series, slot: tournaments.slot }).from(tournaments);
  const byName = new Map(existing.map((r) => [r.name.toLowerCase().trim(), r]));
  /**
   * tournaments.slot (catalogue-sync fills it from the dumps) is the join
   * that survives spelling: the dump titles "Daily PTCS 2 Iron Replay", the
   * post writes "PTCS 2 Iron Replay", and without the slot the two scripts
   * rename the same row back and forth. A restated slot updates its row;
   * a RENAMED slot updates its row only once the row already carries the new
   * name, otherwise it is a new tournament and is seeded.
   */
  const bySlot = new Map(existing.filter((r) => r.slot != null).map((r) => [r.slot!, r]));

  const inserts: (typeof tournaments.$inferInsert)[] = [];
  const updates: { id: number; name: string; set: Record<string, unknown> }[] = [];
  const retireIds: { id: number; name: string; replacedBy: string }[] = [];

  for (const tier of TIERS) {
    for (const [slotStr, e] of Object.entries(refresh[tier] as Record<string, Entry>)) {
      const slot = Number(slotStr);
      // "192 Daily Diamond & Friends Slots is removed": nothing to seed or
      // update - pnpm retire flags the row.
      if (e.removed) continue;
      // A slot restated again by a later section: the older entry is history.
      if ((e as { superseded?: string }).superseded) continue;
      const name = (e.new ?? e.old).trim();
      const slug = slotSlug.get(slot) ?? null;
      const r = parseRestrictions(e.text);
      // The name carries the tier when the blurb does not restate it.
      const win = tierWindowFromName(name);
      const ratingsMin = r.valueMin ?? win?.min ?? null;
      let ratingsMax = r.valueMax ?? win?.max ?? null;
      const derived = r.valueMin == null && r.valueMax == null && win != null;
      // "Daily Golden Age", "Daily Goldfather II": no tier WORD in the name, but
      // the post lists them under Gold. Take the section's ceiling and say so -
      // an "Open" or "& Friends" event is deliberately unwindowed and is left alone.
      let sectionCeiling = false;
      if (ratingsMax == null && win == null && SECTION_MAX[tier] != null && !/\bopen\b|&\s*friends/i.test(name)) {
        ratingsMax = SECTION_MAX[tier];
        sectionCeiling = true;
      }

      const extra: Record<string, unknown> = { slot, slug, refreshText: e.text, refreshedName: name };
      for (const k of ["slots", "teamCap", "variantCap", "variantsAllowed", "teams", "bestOf",
                       "cardTypes", "reRandom"] as const) if (r[k] != null) extra[k] = r[k];
      if (r.notes.length) extra.notes = r.notes;
      if (derived) extra.valueWindowFrom = `name: ${win!.basis}`;
      if (sectionCeiling) extra.valueWindowFrom = `refresh post section: ${tier} (name has no tier word - confirm on screen)`;
      if (e.note) extra.refreshNote = e.note;

      // Exact name first; then a UNIQUE containment either way, because the
      // refresh post and the databotai catalog spell some events differently
      // ("Daily Dank" vs "Daily Dank Iron"). Without this a naming difference
      // reads as a rename and seeds a duplicate row.
      const key = name.toLowerCase();
      const slotRow = bySlot.get(slot);
      // "Daily PTCS 2 Iron Replay" (dump) is "PTCS 2 Iron Replay" (post): the
      // new name is carried when one squashed spelling contains the other.
      const carries = (a: string, b: string) => { const x = squash(a), y = squash(b); return (x.includes(y) || y.includes(x)) && Math.min(x.length, y.length) / Math.max(x.length, y.length) >= 0.6; };
      let hit = slotRow && (!e.new || carries(slotRow.name, name)) ? slotRow : byName.get(key);
      // Punctuation-blind equality next: the catalog's "PTCS 2 Iron Replay."
      // (trailing period) is the post's "PTCS 2 Iron Replay".
      if (!hit) hit = existing.find((r) => squash(r.name) === squash(name));
      // A RENAME is a different tournament on a reused slot: only a match on
      // the new name itself (the catalog already caught up) may update a row.
      // Containment would fold "Daily Low Diamond Only" into the old "Daily
      // Low Diamond" - and retire would then flag the row it just refreshed.
      if (!hit && !e.new) {
        const near = existing.filter((r) => {
          const n = r.name.toLowerCase().trim();
          if (!(n.includes(key) || key.includes(n))) return false;
          // The shorter name must be most of the longer one. Without this the
          // stray catalog row named just "low gold" swallows "Daily Low Gold
          // Only" AND "Daily High Silver-Low Gold Cap" as if both were it.
          return Math.min(n.length, key.length) / Math.max(n.length, key.length) >= 0.6;
        });
        if (near.length === 1) hit = near[0];
      }
      if (hit) {
        if (e.new) for (const other of existing) {
          if (other.slot === slot && other.id !== hit.id && !carries(other.name, name)) retireIds.push({ id: other.id, name: other.name, replacedBy: name });
        }
        const set: Record<string, unknown> = { restrictions: extra, slot };
        if (ratingsMin != null) set.ratingsMin = ratingsMin;
        if (ratingsMax != null) set.ratingsMax = ratingsMax;
        if (r.yearMin != null) set.cardYearMin = r.yearMin;
        if (r.yearMax != null) set.cardYearMax = r.yearMax;
        if (r.reYear != null) set.envYear = r.reYear;
        // "Default RE" is a change too: the old fixed year must not survive it.
        else if (r.notes.includes("default RE")) set.envYear = null;
        if (r.park != null) { set.stadium = r.park; set.parkName = resolvePark(r.park); }
        if (r.dh != null) set.dh = r.dh;
        if (r.teams != null) set.entrants = r.teams;
        if (r.bestOf != null) set.mode = `BO${r.bestOf}`;
        if (slug && !hit.series) set.series = slug;
        set.retired = false;   // it is the CURRENT name, so it is a live event
        updates.push({ id: hit.id, name, set });
        continue;
      }
      // A rename on a slot that still carries a live row under the OLD name:
      // that row is the retired tournament, not a second live one.
      if (e.new) for (const other of existing) {
        if (other.slot === slot && !carries(other.name, name)) retireIds.push({ id: other.id, name: other.name, replacedBy: name });
      }
      inserts.push({
        id: ID_BASE + slot,
        slot,
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

  console.log(`${updates.length} existing rows refreshed, ${inserts.length} seeded, ${retireIds.length} replaced rows retired${DRY ? " (dry run)" : ""}\n`);
  for (const r of retireIds) {
    console.log(`  retire ${String(r.id).padStart(8)}  ${r.name.slice(0, 36).padEnd(38)} -> replaced by ${r.replacedBy}`);
    if (!DRY) await db.execute(sql`update tournaments set retired = true, restrictions = coalesce(restrictions, '{}'::jsonb) || ${JSON.stringify({ replacedBy: r.replacedBy })}::jsonb, updated_at = now() where id = ${r.id}`);
  }
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
          series: sql`excluded.series`, restrictions: sql`excluded.restrictions`, slot: sql`excluded.slot`,
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
