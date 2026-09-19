/**
 * Dump the observed-vs-ratings panel, then fit it per era (scripts/era-slopes.py).
 *
 *   pnpm era:slopes [--min-pa 150]
 *
 * One row per card per series: what the card DID there (wOBA, PA) beside the
 * ratings on its face and the series' run environment. The fit is in Python
 * because it is a weighted least squares with standard errors and numpy is
 * already how park-pick.py earns its keep.
 */
import { writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { marginalRatings } from "@/lib/analytics/card-value";
import { eraFor } from "@/lib/analytics/tournament-env";
import { calibrationSlope } from "@/lib/analytics/calibration";

const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const MIN_PA = Number(val("min-pa", "150"));
const OUT = join(process.cwd(), "..", "Archive", ".era-slopes.csv");
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);

async function main() {
  const r = asRows<any>(await db.execute(sql`
    select o.series, coalesce(t.env_year, case when t.restrictions->'notes' @> '["default RE"]' then 2010 end) env_year, o.card_id, o.pa, o.woba,
           (c.ratings->>'Power')::float pow, (c.ratings->>'Eye')::float eye,
           (c.ratings->>'Avoid Ks')::float avk, (c.ratings->>'BABIP')::float bab,
           (c.ratings->>'Gap')::float gap, (c.ratings->>'Speed')::float spd,
           c.card_value val
    from observed_card_stats o
    join tournaments t on t.series = o.series
    join cards c on c.card_id = o.card_id
    where not o.is_pitcher and o.pa >= ${MIN_PA}
      and coalesce(t.env_year, case when t.restrictions->'notes' @> '["default RE"]' then 2010 end) is not null
      and o.woba is not null and c.ratings ? 'Power'`));
  const hdr = "series,env_year,card_id,pa,woba,pow,eye,avk,bab,gap,spd,val";
  writeFileSync(OUT, hdr + "\n" + r.map((x) =>
    [x.series, x.env_year, x.card_id, x.pa, x.woba, x.pow, x.eye, x.avk, x.bab, x.gap, x.spd, x.val].join(",")).join("\n"));
  console.log(`${r.length} card-series rows, ${new Set(r.map((x) => x.series)).size} series -> ${OUT}`);
  console.log(execFileSync("python3", [join(process.cwd(), "scripts", "era-slopes.py"), OUT], { encoding: "utf8" }));

  // The model's own line per band, PA-weighted over the band's series
  // environments (neutral park, RHB board), after calibration — what the
  // roster tools actually pay per +10 today, beside what play returned.
  const k = calibrationSlope("hit");
  const bands: [string, number, number][] = [["Deadball <=1920", 0, 1920], ["Live Ball 1921-45", 1921, 1945], ["Integration 1946-60", 1946, 1960],
    ["Expansion 1961-76", 1961, 1976], ["Free Agency 1977-93", 1977, 1993], ["Steroid 1994-2009", 1994, 2009], ["Modern 2010+", 2010, 3000], ["ALL ERAS", 0, 3000]];
  const cols = ["Power", "Eye", "Avoid Ks", "BABIP", "Gap"];
  console.log(`model, calibrated (x${k.toFixed(3)}): runs/700 PA per +10 rating, PA-weighted over each band's series environments`);
  console.log(`${"era".padEnd(21)}` + cols.map((c) => c.padStart(11)).join(""));
  for (const [name, lo, hi] of bands) {
    const rs = r.filter((x) => Number(x.env_year) >= lo && Number(x.env_year) <= hi);
    if (!rs.length) continue;
    const byYear = new Map<number, number>();
    for (const x of rs) byYear.set(Number(x.env_year), (byYear.get(Number(x.env_year)) ?? 0) + Number(x.pa));
    const acc = new Map(cols.map((c) => [c, 0])); let W = 0;
    for (const [y, pa] of byYear) {
      const era = eraFor(y); if (!era) continue;
      const m = marginalRatings(envFitMaps([], { era: era.row.rates, park: null }).envRight, "hit");
      for (const c of cols) acc.set(c, acc.get(c)! + pa * (m.find((v) => v.rating === c)?.runs ?? 0));
      W += pa;
    }
    console.log(name.padEnd(21) + cols.map((c) => ((acc.get(c)! / W) * k).toFixed(2).padStart(11)).join(""));
  }
  console.log(`\nRead the two tables together: a rating whose observed runs sit well above the model's calibrated line is under-priced by the roster tools (BABIP everywhere, Power before 1960).`);
  process.exit(0);
}
main();
