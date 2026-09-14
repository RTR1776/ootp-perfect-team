/**
 * Does scoring a card in the EVENT'S run environment beat scoring it in 2010?
 *
 * The theme-week work rests on a claim nobody had tested: that re-solving the
 * environment changes what a card is worth in a way that shows up in play. The
 * data to test it was already here — every tournament series carries an env_year,
 * and observed_card_stats carries what the cards actually did in that series.
 *
 * So for each series: rank its cards by the model scored at the series' own
 * env_year, rank them again scored at 2010, and see which ranking agrees better
 * with observed wOBA (bats) or FIP (arms). If the environment term is real, the
 * era-correct scoring wins, and it should win most where the era is furthest
 * from 2010.
 *
 *   node --env-file=.env.local --import tsx scripts/env-validate.ts [--min-pa 40] [--band 1980-1999]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const MINPA = Number(val("min-pa", "40")), MINIP = Number(val("min-ip", "15"));
const MINCARDS = Number(val("min-cards", "12"));
const WL = 0.3;

const spearman = (a: number[], b: number[]): number => {
  const rank = (xs: number[]) => {
    const idx = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length).fill(0);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const p = ra[i] - ma, q = rb[i] - mb; num += p * q; da += p * p; dbb += q * q; }
  return da && dbb ? num / Math.sqrt(da * dbb) : 0;
};

async function main() {
  const series = asRows<any>(await db.execute(sql`
    select series, max(env_year) env_year, max(park_name) park, max(stadium) stadium
    from tournaments where series is not null and env_year is not null group by 1`));
  const byName = new Map(series.map((s) => [s.series, s]));

  const obs = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.is_pitcher, o.pa, o.ip, o.woba, o.fip,
           c.bats, c.ratings, c.pitcher_role, c.position, c.card_value
    from observed_card_stats o join cards c on c.card_id = o.card_id
    where o.series is not null
      and ((o.is_pitcher = false and o.pa >= ${MINPA} and o.woba is not null)
        or (o.is_pitcher = true and o.ip >= ${MINIP} and o.fip is not null))`));

  const groups = new Map<string, any[]>();
  for (const r of obs) {
    if (!byName.has(r.series)) continue;
    const g = groups.get(r.series) ?? []; g.push(r); groups.set(r.series, g);
  }

  type Out = { series: string; year: number; kind: "bats" | "arms"; n: number; era: number; base: number };
  const out: Out[] = [];

  for (const [name, rowsIn] of groups) {
    const meta = byName.get(name)!;
    const year = Number(meta.env_year);
    const era = eraTable[String(year)], base = eraTable["2010"];
    if (!era || !base) continue;
    const pr = meta.park ? parkRow(meta.park, null) : null;

    const pool = rowsIn.map((r) => ({
      cardId: r.card_id, isPitcher: r.is_pitcher, bats: r.bats ?? "R",
      ratings: r.ratings ?? {}, role: r.is_pitcher ? r.pitcher_role : r.position,
    }));
    if (pool.length < MINCARDS) continue;
    const fe = envFitMaps(pool as any, { era: era.rates, park: pr });
    const fb = envFitMaps(pool as any, { era: base.rates, park: pr });
    const mix = (f: any, id: number) => (1 - WL) * (f.runsR.get(id) ?? 0) + WL * (f.runsL.get(id) ?? 0);

    for (const kind of ["bats", "arms"] as const) {
      const sub = rowsIn.filter((r) => (kind === "bats" ? !r.is_pitcher : r.is_pitcher));
      if (sub.length < MINCARDS) continue;
      // observed: wOBA up is good; FIP down is good, so flip it
      const y = sub.map((r) => (kind === "bats" ? Number(r.woba) : -Number(r.fip)));
      const xe = sub.map((r) => mix(fe, r.card_id));
      const xb = sub.map((r) => mix(fb, r.card_id));
      out.push({ series: name, year, kind, n: sub.length, era: spearman(xe, y), base: spearman(xb, y) });
    }
  }

  const band = (y: number) => y >= 2005 ? "2005+" : y >= 1985 ? "1985-2004" : y >= 1960 ? "1960-1984" : y >= 1930 ? "1930-1959" : "pre-1930";
  console.log(`\nSpearman of model vs observed, WITHIN each series. "era" scores each card in the`);
  console.log(`series' own env_year; "base" scores every card at 2010. Higher is better.\n`);
  console.log(`  band          series  cards    era    2010    gain   era wins`);
  const bands = new Map<string, Out[]>();
  for (const o of out) { const b = band(o.year); bands.set(b, [...(bands.get(b) ?? []), o]); }
  for (const b of ["2005+", "1985-2004", "1960-1984", "1930-1959", "pre-1930"]) {
    const g = bands.get(b); if (!g) continue;
    const w = g.reduce((a, o) => a + o.n, 0);
    const e = g.reduce((a, o) => a + o.era * o.n, 0) / w, z = g.reduce((a, o) => a + o.base * o.n, 0) / w;
    const wins = g.filter((o) => o.era > o.base).length;
    console.log(`  ${b.padEnd(12)} ${String(g.length).padStart(6)} ${String(w).padStart(6)} ${e.toFixed(3).padStart(6)} ${z.toFixed(3).padStart(7)} ${(e - z >= 0 ? "+" : "") + (e - z).toFixed(3)}   ${wins}/${g.length}`);
  }
  const w = out.reduce((a, o) => a + o.n, 0);
  const e = out.reduce((a, o) => a + o.era * o.n, 0) / w, z = out.reduce((a, o) => a + o.base * o.n, 0) / w;
  console.log(`  ${"ALL".padEnd(12)} ${String(out.length).padStart(6)} ${String(w).padStart(6)} ${e.toFixed(3).padStart(6)} ${z.toFixed(3).padStart(7)} ${(e - z >= 0 ? "+" : "") + (e - z).toFixed(3)}   ${out.filter((o) => o.era > o.base).length}/${out.length}`);

  console.log(`\n  --- the 1980s/90s series specifically (closest thing on file to a 1989 week) ---`);
  console.log(`  series                      year  kind   cards     era    2010`);
  for (const o of out.filter((x) => x.year >= 1980 && x.year <= 1999).sort((a, b) => a.year - b.year)) {
    console.log(`  ${o.series.slice(0, 26).padEnd(27)} ${o.year}  ${o.kind}  ${String(o.n).padStart(6)}  ${o.era.toFixed(3).padStart(6)}  ${o.base.toFixed(3).padStart(6)}`);
  }
  process.exit(0);
}
main();
