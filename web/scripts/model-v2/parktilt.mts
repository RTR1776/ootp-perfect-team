/** Per series: the park's run offset for a LEFT and a RIGHT batter against the field's mixed park —
 * what env-fit's same-side baseline cancels. runs/700 PA. → REV_DIR/tilt.json */
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { blendPark, applyPark, linearWeights } from "@/lib/analytics/run-env";
const sql = neon(process.env.DATABASE_URL!);
const D = process.env.REV_DIR ?? "/tmp/ptcs7rev";
const tours = (await sql.query(`select id, series, env_year, stadium from tournaments where not is_draft`)) as any[];
const champ: Record<string, number> = { ptcs7champbronze: 9070002, ptcs7champsilver: 9070003, ptcs7champgold: 9070004, ptcs7champdiamond: 9070005, ptcs7champopen: 9070006, ptcs7champcap: 9070008 };
const by = new Map<string, any>(); for (const t of tours) if (!by.has(t.series)) by.set(t.series, t);
for (const [s, id] of Object.entries(champ)) by.set(s, tours.find((t: any) => t.id === id));
import { runsPerPa } from "@/lib/analytics/run-env";
// One set of run weights (the field's mixed park) for both sides, so the park's hand split is not rescaled away.
const side = (era: any, park: any, share: number, w: any) => runsPerPa(applyPark(era, blendPark(park, share)), w);
const out: Record<string, { L: number; R: number }> = {};
for (const [s, t] of by) {
  const era = eraFor(t.env_year); if (!era) continue; const park = parkFor(t.stadium).row; if (!park) continue;
  const w = linearWeights(applyPark(era.row.rates, blendPark(park, 0.35)));
  const mix = side(era.row.rates, park, 0.35, w);
  out[s] = { L: (side(era.row.rates, park, 1, w) - mix) * 700, R: (side(era.row.rates, park, 0, w) - mix) * 700 };
}
writeFileSync(`${D}/tilt.json`, JSON.stringify(out));
const e = Object.entries(out).sort((a, b) => (a[1].L - a[1].R) - (b[1].L - b[1].R));
console.log(Object.keys(out).length, "series; most lefty-hostile:", e.slice(0, 3).map(([k, v]) => `${k} L ${v.L.toFixed(1)} R ${v.R.toFixed(1)}`).join(" | "), "; most lefty-friendly:", e.slice(-3).map(([k, v]) => `${k} L ${v.L.toFixed(1)} R ${v.R.toFixed(1)}`).join(" | "));
process.exit(0);
