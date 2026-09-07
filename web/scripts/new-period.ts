/**
 * Create or re-date a PTCS qualifying period.
 *
 *   pnpm period:new "PTCS 7" 2026-09-07 2026-10-11 [--targets-from "PTCS 6"] [--targets '{"Gold":114,...}']
 *
 * Matched on name, so re-running with corrected dates updates the row rather
 * than adding a second period. Targets copied from an earlier period are
 * ESTIMATES (targetsAreOfficial = false) until real standings replace them;
 * without either flag the period is created with no targets and the PTCS page
 * shows the categories as "tracking".
 */

import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { periods } from "../src/db/schema";
import { CATEGORIES } from "../src/lib/ingest/constants";

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const [name, startsOn, endsOn] = process.argv.slice(2).filter((a) => !a.startsWith("--") && a !== flag("--targets-from") && a !== flag("--targets"));
  const isDate = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));
  if (!name || !isDate(startsOn) || !isDate(endsOn) || startsOn > endsOn) {
    console.error('usage: pnpm period:new "<name>" <starts YYYY-MM-DD> <ends YYYY-MM-DD> [--targets-from "<period>"] [--targets <json>]');
    process.exit(1);
  }
  const days = Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000) + 1;

  let targets: Record<string, number> | null = null;
  const from = flag("--targets-from");
  const json = flag("--targets");
  if (json) {
    targets = JSON.parse(json) as Record<string, number>;
  } else if (from) {
    const [src] = await db.select().from(periods).where(eq(periods.name, from));
    if (!src?.targets) throw new Error(`No period named "${from}" with targets to copy.`);
    targets = src.targets;
  }
  if (targets) {
    const unknown = Object.keys(targets).filter((c) => !(CATEGORIES as readonly string[]).includes(c));
    if (unknown.length) throw new Error(`Unknown categories in targets: ${unknown.join(", ")}`);
  }

  const [existing] = await db.select({ id: periods.id }).from(periods).where(eq(periods.name, name));
  if (existing) {
    await db.update(periods).set({ startsOn, endsOn, ...(targets ? { targets, targetsAreOfficial: false } : {}) }).where(eq(periods.id, existing.id));
    console.log(`updated ${name} (#${existing.id}): ${startsOn} -> ${endsOn}, ${days} days${targets ? ", targets replaced (estimates)" : ""}`);
  } else {
    const [row] = await db.insert(periods).values({ name, startsOn, endsOn, targets, targetsAreOfficial: false }).returning({ id: periods.id });
    console.log(`created ${name} (#${row.id}): ${startsOn} -> ${endsOn}, ${days} days${targets ? `, targets copied from ${from ?? "--targets"} (estimates)` : ", no targets"}`);
  }
  if (targets) console.log("  " + Object.entries(targets).map(([c, v]) => `${c} ${v}`).join(" · "));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
