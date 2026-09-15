/**
 * READ THE RULES OFF THE FIELD.
 *
 * 20 of the 52 tournament slots L.J. enters have no restrictions on file -
 * no cap, no slot split, no variant limit - and the catalogue's value window
 * is a tier label, not what the event enforces. But every archived export
 * IS the enforced rule set, applied to 64-128 rosters: nobody exceeds the
 * cap, nobody carries a 27th card, nobody has a 14th Gold in a 13-slot
 * event. So the ceilings are readable, and this reads them.
 *
 * For each series with an export (the newest file, checked against the one
 * before it), per team: cards, total value, cards per tier, variants, card
 * years. A ceiling counts as a rule only when it is SHARED - at least 15%
 * of teams sit exactly on it and none is above - which is how a hard limit
 * looks and how a coincidence does not.
 *
 * Writes into tournaments.restrictions only the keys that are null there,
 * tagged in `notes` with the file it came from, so a rule L.J. typed always
 * wins over one inferred here. --dry prints without writing.
 *
 *   pnpm rules:infer [--dry] [--series slug,slug]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parseLeagueExport, looksLikeLeagueExport } from "@/lib/ingest/league";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIR = join(ROOT, "Archive/Completed");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const ONLY = (() => { const i = argv.indexOf("--series"); return i >= 0 ? new Set(argv[i + 1].split(",")) : null; })();
const SHARE = 0.15;
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const TIER_OF = (v: number) => v >= 100 ? "P" : v >= 90 ? "D" : v >= 80 ? "G" : v >= 70 ? "S" : v >= 60 ? "B" : "I";
const TIER_LO: Record<string, number> = { I: 40, B: 60, S: 70, G: 80, D: 90, P: 100 };
const TIER_HI: Record<string, number> = { I: 59, B: 69, S: 79, G: 89, D: 99, P: 110 };

interface Inferred {
  cards: number | null; valueMin: number | null; valueMax: number | null;
  teamCap: number | null; slots: Record<string, number> | null; variantCap: number | null; variantsAllowed: boolean | null;
  yearMin: number | null; yearMax: number | null; teams: number; file: string;
}

function inferFrom(file: string): Inferred | null {
  const text = readFileSync(join(DIR, file), "utf8");
  if (!looksLikeLeagueExport(text.slice(0, text.indexOf("\n")))) return null;
  const { stints } = parseLeagueExport(text, file);
  const teams = new Map<string, typeof stints>();
  for (const s of stints) { if (!s.org) continue; (teams.get(s.org) ?? teams.set(s.org, []).get(s.org)!).push(s); }
  const T = [...teams.values()].filter((t) => t.length >= 10);
  if (T.length < 16) return null;
  const n = T.length;
  /** The largest value, and whether enough teams sit exactly on it. */
  const ceiling = (vals: number[], minShare = SHARE): number | null => {
    const max = Math.max(...vals);
    return vals.filter((v) => v === max).length / n >= minShare ? max : null;
  };
  const sizes = T.map((t) => t.length);
  const cards = ceiling(sizes);
  const values = T.map((t) => t.reduce((a, s) => a + (s.val ?? 0), 0));
  const teamCap = ceiling(values, 0.10);
  const allVals = stints.map((s) => s.val).filter((v): v is number => v != null);
  const vmin = Math.min(...allVals), vmax = Math.max(...allVals);
  const valueMin = TIER_LO[TIER_OF(vmin)], valueMax = vmax >= 100 ? null : TIER_HI[TIER_OF(vmax)];
  // slots: only when the window spans 2+ tiers
  let slots: Record<string, number> | null = null;
  const tiersSeen = new Set(allVals.map(TIER_OF));
  if (tiersSeen.size >= 2 && cards) {
    slots = {};
    for (const tier of ["P", "D", "G", "S", "B", "I"]) {
      const per = T.map((t) => t.filter((s) => s.val != null && TIER_OF(s.val) === tier).length);
      const c = ceiling(per);
      if (c != null && c > 0 && c < cards) slots[tier] = c;
    }
    if (!Object.keys(slots).length) slots = null;
  }
  const variantsPer = T.map((t) => t.filter((s) => s.isVariant).length);
  const vc = ceiling(variantsPer);
  // every team at zero variants is "variants off", not a cap of 0
  const variantsAllowed = vc === 0 ? false : null;
  const variantCap = vc != null && vc > 0 && cards != null && vc < cards ? vc : null;
  const years = stints.map((s) => s.cardYear).filter((y): y is number => y != null && y > 1800);
  const ymin = Math.min(...years), ymax = Math.max(...years);
  // a year bound is a rule when it is round and the field stops there
  const yearMax = ymax < 2020 && (ymax % 10 === 9 || ymax % 10 === 0 || ymax % 5 === 0) ? ymax : null;
  const yearMin = ymin > 1900 && (ymin % 10 === 0 || ymin % 10 === 1 || ymin % 5 === 0) ? ymin : null;
  return { cards, valueMin, valueMax, teamCap, slots, variantCap, variantsAllowed, yearMin, yearMax, teams: n, file };
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".csv"));
  const bySeries = new Map<string, string[]>();
  for (const f of files) {
    const s = f.replace(/_\d+\.csv$/, "");
    if (ONLY && !ONLY.has(s)) continue;
    (bySeries.get(s) ?? bySeries.set(s, []).get(s)!).push(f);
  }
  const rows = asRows<any>(await db.execute(sql`select id, name, series, restrictions, ratings_min, ratings_max from tournaments where series is not null`));
  /**
   * A slot restated by a refresh has archived files that predate the new
   * rules, so nothing is inferred for it - the refresh JSON is the source.
   */
  const slotMap = JSON.parse(readFileSync(join(__dirname, "slot-map.json"), "utf8"));
  const restated = new Set<string>();
  for (const r of Object.values(slotMap?._cutover?.renames ?? {}) as any[]) { if (r.old) restated.add(r.old); if (r.new) restated.add(r.new); }
  try {
    const refresh = JSON.parse(readFileSync(join(ROOT, "Tourney Data/refresh-2026-09.json"), "utf8"));
    for (const tier of ["silver", "iron", "bronze", "gold", "diamond"]) for (const [slot, e] of Object.entries(refresh[tier] ?? {}) as any[]) {
      if (e.new || e.envChanged) { const slug = slotMap[slot]; if (typeof slug === "string") restated.add(slug); }
    }
  } catch { /* no refresh file */ }
  const cat = new Map(rows.map((r) => [r.series, r]));
  let written = 0;
  console.log(`${"series".padEnd(30)} ${"teams".padStart(5)} ${"cards".padStart(5)} ${"value".padStart(8)} ${"cap".padStart(5)} ${"var".padStart(4)}  slots / years                 -> catalogue`);
  for (const [series, fs] of [...bySeries].sort()) {
    const sorted = fs.sort((a, b) => Number(b.match(/_(\d+)\.csv$/)?.[1]) - Number(a.match(/_(\d+)\.csv$/)?.[1]));
    const latest = inferFrom(sorted[0]);
    if (!latest) { console.log(`${series.padEnd(30)} (too few teams)`); continue; }
    const prior = sorted[1] ? inferFrom(sorted[1]) : null;
    const agree = !prior || (prior.teamCap === latest.teamCap && JSON.stringify(prior.slots) === JSON.stringify(latest.slots) && prior.cards === latest.cards);
    const row = cat.get(series);
    const cur = (row?.restrictions ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = {};
    for (const k of ["cards", "teamCap", "slots", "variantCap", "variantsAllowed", "yearMin", "yearMax"] as const) {
      if (latest[k] != null && (cur[k] == null)) set[k] = latest[k];
    }
    // The value window is reported, not written: ratings_min/max own it.
    const desc = `${String(latest.teams).padStart(5)} ${String(latest.cards ?? "-").padStart(5)} ${`${latest.valueMin ?? "?"}-${latest.valueMax ?? "102"}`.padStart(8)} ${String(latest.teamCap ?? "-").padStart(5)} ${String(latest.variantCap ?? "-").padStart(4)}  ${latest.slots ? Object.entries(latest.slots).map(([k, v]) => `${k}${v}`).join(" ") : "-"}${latest.yearMin || latest.yearMax ? ` yrs ${latest.yearMin ?? ""}-${latest.yearMax ?? ""}` : ""}`;
    const skip = restated.has(series);
    const tail = !row ? "NO CATALOGUE ROW" : skip ? "restated by a refresh - not written" : Object.keys(set).length ? `set ${Object.keys(set).join(",")}` : "nothing new";
    console.log(`${series.padEnd(30)} ${desc.padEnd(52)} -> ${tail}${agree ? "" : "  (prior file DISAGREES - check a refresh)"}`);
    if (!row || skip || !Object.keys(set).length || DRY || !agree) continue;
    const notes = Array.isArray(cur.notes) ? [...(cur.notes as string[])] : [];
    notes.push(`inferred from field: ${latest.file} (${latest.teams} teams)`);
    const next = { ...cur, ...set, notes };
    await db.execute(sql`update tournaments set restrictions = ${JSON.stringify(next)}::jsonb, updated_at = now() where id = ${row.id}`);
    written++;
  }
  console.log(`\n${DRY ? "dry run - " : ""}${written} catalogue rows updated`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
