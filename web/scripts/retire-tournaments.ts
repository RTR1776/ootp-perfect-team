/**
 * Flag catalog rows the game has replaced.
 *
 *   pnpm retire [--dry]
 *
 * OOTP reuses a slot when it renames an event, and the importer never deletes,
 * so every renamed tournament leaves its old name behind in the catalog for
 * ever. The refresh posts name both sides of each rename, which is enough to
 * retire the old one without guessing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { tournaments } from "../src/db/schema";

const DRY = process.argv.includes("--dry");
const R = JSON.parse(readFileSync(join(process.cwd(), "..", "Tourney Data/refresh-2026-09.json"), "utf8"));
const SLOTS = JSON.parse(readFileSync(join(process.cwd(), "scripts/slot-map.json"), "utf8"));
/** Slots where a NEW NAME was actually seen on a results screen. */
const CONFIRMED = new Set(Object.keys(SLOTS._cutover?.renames ?? {}));

async function main() {
  const rows = await db.select({ id: tournaments.id, name: tournaments.name, retired: tournaments.retired })
    .from(tournaments);
  const byName = new Map(rows.map((r) => [r.name.toLowerCase().trim(), r]));

  const retire: { id: number; name: string; replacedBy: string }[] = [];
  for (const tier of ["silver", "iron", "bronze", "perfectDraft"] as const) {
    for (const [slot, e] of Object.entries<any>(R[tier])) {
      if (!e.new) continue;                       // rules changed, name did not
      // For Perfect Drafts the post's "is now X" is usually a FORMAT, not a
      // rename - Doc Rock Derby is still called Doc Rock Derby, it just plays
      // as High Heat now. Only retire a PD whose new NAME we have actually
      // seen on a results screen.
      if (tier === "perfectDraft" && !CONFIRMED.has(slot)) continue;
      const old = byName.get(String(e.old).toLowerCase().trim());
      if (!old || old.retired) continue;
      // Do not retire a row whose name is also the NEW name (the catalog has
      // already caught up, so this row is the live event).
      if (String(e.new).toLowerCase().trim() === old.name.toLowerCase().trim()) continue;
      retire.push({ id: old.id, name: old.name, replacedBy: e.new });
    }
  }

  for (const r of retire) {
    if (!DRY) await db.update(tournaments).set({ retired: true }).where(eq(tournaments.id, r.id));
    console.log(`  ${r.name.slice(0, 40).padEnd(42)} -> ${r.replacedBy}`);
  }
  const live = rows.length - retire.length - rows.filter((r) => r.retired).length;
  console.log(`\nretired ${retire.length}${DRY ? " (dry run)" : ""}; ${live} still live of ${rows.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
