/**
 * Park and era factors against what the archive actually played (2026-10-25 model review).
 *
 * For every archived tournament export: batting totals split by the batter's hand
 * (switch hitters counted on the side they bat most — skipped here, too ambiguous),
 * with the series' run environment (catalogue env_year → eras.json) and park
 * (catalogue stadium → park-factors.json, hand-specific). Writes one row per
 * export and hand to $OUT (JSON); park-check.py regresses observed rates on the
 * era's rates and the park's factors.
 *
 *   node --env-file=.env.local --import tsx scripts/model-review/park-check.mts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { parseCsv } from "@/lib/ingest/eligible-pool";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIR = join(ROOT, "Archive/Completed");
const OUT = process.env.OUT ?? "/tmp/park-check.json";
const sql = neon(process.env.DATABASE_URL!);
const tours = (await sql.query(`select id, series, env_year, stadium, dh, ratings_max from tournaments where series is not null`)) as any[];
const bySeries = new Map<string, any>();
for (const t of tours) if (!bySeries.has(t.series)) bySeries.set(t.series, t);
const n = (v: string | undefined) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const rows: any[] = [];
let skipped = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".csv")).sort()) {
  const slug = f.replace(/_\d+\.csv$/, "");
  const t = bySeries.get(slug);
  if (!t) { skipped++; continue; }
  let recs: Record<string, string>[];
  try { recs = parseCsv(readFileSync(join(DIR, f), "utf8")); } catch { skipped++; continue; }
  if (!recs.length || !("2B_1" in recs[0]) || !("K" in recs[0])) { skipped++; continue; }
  const era = eraFor(t.env_year ?? 2010) ?? { row: eraTable["0"], label: "default" };
  const park = parkFor(t.stadium ?? null);
  const acc: Record<string, Record<string, number>> = { L: {}, R: {} };
  for (const r of recs) {
    const hand = (r.B ?? "").trim();
    if (hand !== "L" && hand !== "R") continue;
    const a = acc[hand];
    for (const [k, col] of [["PA", "PA"], ["AB", "AB"], ["H", "H"], ["D", "2B_1"], ["T", "3B_1"], ["HR", "HR"], ["BB", "BB"], ["HP", "HP"], ["SF", "SF"], ["K", "K"], ["R", "R"]] as const) a[k] = (a[k] ?? 0) + n(r[col]);
  }
  for (const hand of ["L", "R"] as const) {
    const a = acc[hand];
    if (!a.PA || a.PA < 500) continue;
    rows.push({
      file: f, series: slug, hand, envYear: t.env_year ?? 2010, eraKey: era.label, stadium: t.stadium, parkKey: park.label, valMax: t.ratings_max, dh: t.dh,
      era: era.row.rates, eraRG: era.row.rg,
      park: park.row ? { avg: hand === "L" ? park.row.avgL : park.row.avgR, hr: hand === "L" ? park.row.hrL : park.row.hrR, d2: park.row.d2, d3: park.row.d3 } : { avg: 1, hr: 1, d2: 1, d3: 1 },
      ...a,
    });
  }
}
writeFileSync(OUT, JSON.stringify(rows));
console.log(`${rows.length} export-hand rows from ${new Set(rows.map((r) => r.file)).size} exports in ${new Set(rows.map((r) => r.series)).size} series; ${skipped} files skipped`);
process.exit(0);
