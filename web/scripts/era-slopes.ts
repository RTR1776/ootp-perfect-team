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

const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const MIN_PA = Number(val("min-pa", "150"));
const OUT = join(process.cwd(), "..", "Archive", ".era-slopes.csv");
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);

async function main() {
  const r = asRows<any>(await db.execute(sql`
    select o.series, t.env_year, o.card_id, o.pa, o.woba,
           (c.ratings->>'Power')::float pow, (c.ratings->>'Eye')::float eye,
           (c.ratings->>'Avoid Ks')::float avk, (c.ratings->>'BABIP')::float bab,
           (c.ratings->>'Gap')::float gap, (c.ratings->>'Speed')::float spd,
           c.card_value val
    from observed_card_stats o
    join tournaments t on t.series = o.series
    join cards c on c.card_id = o.card_id
    where not o.is_pitcher and o.pa >= ${MIN_PA}
      and t.env_year is not null and o.woba is not null and c.ratings ? 'Power'`));
  const hdr = "series,env_year,card_id,pa,woba,pow,eye,avk,bab,gap,spd,val";
  writeFileSync(OUT, hdr + "\n" + r.map((x) =>
    [x.series, x.env_year, x.card_id, x.pa, x.woba, x.pow, x.eye, x.avk, x.bab, x.gap, x.spd, x.val].join(",")).join("\n"));
  console.log(`${r.length} card-series rows, ${new Set(r.map((x) => x.series)).size} series -> ${OUT}`);
  console.log(execFileSync("python3", [join(process.cwd(), "scripts", "era-slopes.py"), OUT], { encoding: "utf8" }));
  process.exit(0);
}
main();
