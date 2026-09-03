/**
 * Dry-run the restrictions parser over every rules blurb we have.
 *
 *   pnpm parse:restrictions
 *
 * Prints what each tournament's text resolves to so the parse can be eyeballed
 * before anything is written to the database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRestrictions } from "../src/lib/ingest/restrictions";

const ROOT = join(process.cwd(), "..");
const R = JSON.parse(readFileSync(join(ROOT, "Tourney Data/refresh-2026-09.json"), "utf8"));

const fmt = (r: ReturnType<typeof parseRestrictions>) => {
  const bits: string[] = [];
  if (r.valueMin != null || r.valueMax != null) bits.push(`val ${r.valueMin ?? ""}..${r.valueMax ?? ""}`);
  if (r.yearMin != null || r.yearMax != null) bits.push(`yr ${r.yearMin ?? ""}..${r.yearMax ?? ""}`);
  if (r.slots) bits.push(`slots ${Object.entries(r.slots).map(([k, v]) => k + v).join(" ")}`);
  if (r.teamCap) bits.push(`cap ${r.teamCap}`);
  if (r.variantCap) bits.push(`var<=${r.variantCap}`);
  if (r.variantsAllowed === false) bits.push("no variants");
  if (r.teams) bits.push(`${r.teams}T`);
  if (r.cards) bits.push(`${r.cards} cards`);
  if (r.clockMinutes) bits.push(`${r.clockMinutes}min`);
  if (r.reYear) bits.push(`RE ${r.reYear}`);
  if (r.reRandom) bits.push(`RE ${r.reRandom[0]}-${r.reRandom[1]}`);
  if (r.dh != null) bits.push(r.dh ? "DH" : "noDH");
  if (r.park) bits.push(r.park);
  if (r.cardTypes) bits.push(`only ${r.cardTypes.join("/")}`);
  if (r.notes.length) bits.push(`(${r.notes.join(", ")})`);
  return bits.join(" · ") || "—";
};

let n = 0, blank = 0;
for (const tier of ["silver", "iron", "bronze", "perfectDraft"] as const) {
  console.log(`\n=== ${tier} ===`);
  for (const [slot, entry] of Object.entries<any>(R[tier])) {
    const v = entry as any;
    const name = v.new ?? v.old;
    const parsed = parseRestrictions(v.text);
    const out = fmt(parsed);
    if (out === "—") blank++;
    n++;
    console.log(`  ${slot} ${String(name).slice(0, 30).padEnd(32)} ${out}`);
  }
}
console.log(`\n${n} parsed, ${blank} produced nothing`);
