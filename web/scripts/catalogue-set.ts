/**
 * Change one catalogue event's rules by hand: for weekly "variety" formats
 * that rotate, and any event whose rules the game changes under the same id.
 *
 * Dry by default: prints what would change. --commit writes it. The previous
 * rules are kept under restrictions.previousFormat (lib/catalogue-edit.ts).
 *
 *   pnpm catalogue:set --tournament 541 --year 1952 --stadium "1958 Tiger Stadium" \
 *     --card-years 1910-1959 --drop cardTypes,pendingRefresh --text "…" --note "…" [--commit]
 *
 * Flags: --year N · --stadium "YYYY Name" · --dh | --no-dh · --value A-B ·
 * --card-years A-B | none · --drop key[,key] · --text "…" · --note "…" ·
 * --card-types "Historical All-Star+Hardware Heroes" (the card-set rule, as roster-rules reads it)
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { editCatalogueRules, type CatalogueEdit, type CatalogueRules } from "@/lib/catalogue-edit";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const range = (k: string): [number, number] | undefined => {
  const v = val(k); if (v == null) return undefined;
  const m = /^(\d+)-(\d+)$/.exec(v); if (!m) throw new Error(`--${k} takes A-B, got "${v}"`);
  return [Number(m[1]), Number(m[2])];
};

async function main() {
  const id = Number(val("tournament"));
  if (!id) throw new Error("usage: pnpm catalogue:set --tournament ID [--year N] [--stadium \"YYYY Name\"] … [--commit]");
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!t) throw new Error(`no tournament ${id} in the catalogue`);

  const edit: CatalogueEdit = { at: new Date().toISOString().slice(0, 10) };
  if (val("year")) edit.envYear = Number(val("year"));
  if (val("stadium")) edit.stadium = val("stadium");
  if (flag("dh")) edit.dh = true;
  if (flag("no-dh")) edit.dh = false;
  if (val("value")) edit.value = range("value");
  if (val("card-years")) edit.cardYears = val("card-years") === "none" ? null : range("card-years");
  if (val("card-types")) edit.cardTypes = [val("card-types")!];
  if (val("drop")) edit.drop = val("drop")!.split(",").map((s) => s.trim()).filter(Boolean);
  if (val("text")) edit.text = val("text");
  if (val("note")) edit.note = val("note");

  const before: CatalogueRules = {
    envYear: t.envYear, stadium: t.stadium, parkName: t.parkName, dh: t.dh, ratingsMin: t.ratingsMin, ratingsMax: t.ratingsMax,
    cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, restrictions: t.restrictions ?? null,
  };
  const after = editCatalogueRules(before, edit);

  console.log(`${t.name} (${id})`);
  for (const k of Object.keys(before) as (keyof CatalogueRules)[]) {
    if (k === "restrictions") continue;
    if (before[k] !== after[k]) console.log(`  ${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
  }
  const rb = before.restrictions ?? {}, ra = after.restrictions ?? {};
  for (const k of new Set([...Object.keys(rb), ...Object.keys(ra)])) {
    if (k === "previousFormat") continue;
    if (JSON.stringify(rb[k]) !== JSON.stringify(ra[k])) console.log(`  restrictions.${k}: ${JSON.stringify(rb[k]) ?? "—"} → ${JSON.stringify(ra[k]) ?? "(removed)"}`);
  }

  if (!flag("commit")) { console.log("\nDry run: nothing written yet (--commit saves it)."); process.exit(0); }
  await db.update(tournaments).set({ ...after, updatedAt: new Date() }).where(eq(tournaments.id, id));
  console.log("\nSaved. /build reads the new rules on its next load; the old ones are under restrictions.previousFormat.");
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
