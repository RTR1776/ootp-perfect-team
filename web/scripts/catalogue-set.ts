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
 * --card-types "Historical All-Star+Hardware Heroes" (the card-set rule, as roster-rules reads it) ·
 * --slots "P6, D4, G4, S4, B4" (the game's slot line; the spots it leaves go to the next tier down) ·
 * --retire | --unretire (a retired event leaves /build's picker; its history stays)
 *
 * An edit that changes nothing writes nothing, so a batch can be rerun safely.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { editCatalogueRules, parseSlots, type CatalogueEdit, type CatalogueRules } from "@/lib/catalogue-edit";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const range = (k: string): [number, number] | undefined => {
  const v = val(k); if (v == null) return undefined;
  const m = /^(\d+)-(\d+)$/.exec(v); if (!m) throw new Error(`--${k} takes A-B, got "${v}"`);
  return [Number(m[1]), Number(m[2])];
};

/** Every flag this script reads; anything else is a typo and stops the run. */
const KNOWN = new Set(["tournament", "year", "stadium", "dh", "no-dh", "value", "card-years", "card-types", "slots", "drop", "text", "note", "retire", "unretire", "commit"]);

async function main() {
  const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.has(a.slice(2)));
  if (unknown.length) throw new Error(`unknown flag${unknown.length > 1 ? "s" : ""}: ${unknown.join(" ")} (see the header of scripts/catalogue-set.ts)`);
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
  if (val("slots")) edit.slots = parseSlots(val("slots")!, (t.restrictions as { cards?: number } | null)?.cards ?? 26);
  if (val("drop")) edit.drop = val("drop")!.split(",").map((s) => s.trim()).filter(Boolean);
  if (val("text")) edit.text = val("text");
  if (val("note")) edit.note = val("note");
  const retired = flag("retire") ? true : flag("unretire") ? false : t.retired;
  // Rule flags other than the note: without one, only the retired flag can change.
  const ruleEdit = ["year", "stadium", "dh", "no-dh", "value", "card-years", "card-types", "slots", "drop", "text"].some(flag);

  const before: CatalogueRules = {
    envYear: t.envYear, stadium: t.stadium, parkName: t.parkName, dh: t.dh, ratingsMin: t.ratingsMin, ratingsMax: t.ratingsMax,
    cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, restrictions: t.restrictions ?? null,
  };
  const after = ruleEdit ? editCatalogueRules(before, edit) : before;

  console.log(`${t.name} (${id})`);
  if (!ruleEdit && retired === t.retired && !flag("retire") && !flag("unretire")) {
    console.log("  nothing to change: no rule flag given (see the header of scripts/catalogue-set.ts).");
    process.exit(0);
  }
  const retiring = retired !== t.retired;
  if (retiring) console.log(`  retired: ${t.retired} → ${retired}${retired ? " (leaves the picker)" : ""}`);
  let ruleChanges = 0;
  for (const k of Object.keys(before) as (keyof CatalogueRules)[]) {
    if (k === "restrictions") continue;
    if (before[k] !== after[k]) { ruleChanges++; console.log(`  ${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`); }
  }
  const rb = before.restrictions ?? {}, ra = after.restrictions ?? {};
  for (const k of new Set([...Object.keys(rb), ...Object.keys(ra)])) {
    // The note and the kept format only ride along with a real change.
    if (k === "previousFormat" || k === "textFrom") continue;
    if (JSON.stringify(rb[k]) !== JSON.stringify(ra[k])) { ruleChanges++; console.log(`  restrictions.${k}: ${JSON.stringify(rb[k]) ?? "—"} → ${JSON.stringify(ra[k]) ?? "(removed)"}`); }
  }
  if (!ruleChanges && !retiring) { console.log("  no change: already set."); process.exit(0); }
  if (ruleChanges && JSON.stringify(rb.textFrom) !== JSON.stringify(ra.textFrom)) console.log(`  restrictions.textFrom: ${JSON.stringify(rb.textFrom) ?? "—"} → ${JSON.stringify(ra.textFrom)}`);

  if (!flag("commit")) { console.log("\nDry run: nothing written yet (--commit saves it)."); process.exit(0); }
  // The rules (and their kept previous format) are written only when they
  // changed: a rerun must not overwrite previousFormat with the current rules.
  await db.update(tournaments).set({ ...(ruleChanges ? after : {}), retired, updatedAt: new Date() }).where(eq(tournaments.id, id));
  console.log(ruleChanges ? "\nSaved. /build reads the new rules on its next load; the old ones are under restrictions.previousFormat." : "\nSaved.");
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
