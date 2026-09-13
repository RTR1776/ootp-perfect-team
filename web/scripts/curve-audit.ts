/**
 * Do the fitted rating->rate curves reproduce what the cards actually did?
 *
 * The curve multiplier exp(alpha)*(rating/50)^beta is environment-free: it says
 * "this card produces X times the league rate", whatever the league. So it can
 * be tested against observed tournament play without knowing any era.
 *
 * For every (series, card) row we compute the numerator the card would have
 * produced at its OWN series' rate, and compare it to what it actually
 * produced. Summed inside a rating bucket that gives a weighted observed
 * multiplier, directly comparable to the curve. Per-series expectation is what
 * makes 51 series in different run environments poolable.
 *
 *   pnpm curve:audit [--min-pa 200]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import CURVES from "@/data/curves.json";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN = num("min-pa", 200);
const curves = CURVES as any;

/** numerator / denominator for each curve, from a counters blob. */
type Row = { series: string; rating: number; num: number; den: number };
const f2 = (n: number) => n.toFixed(3);

/** hitters: K/BB per PA, HR & XBH per ball-in-play, BABIP per (BIP - HR) */
type Pick = (c: any) => [number, number];
const HIT: Record<string, Pick> = {
  k:     (c: any) => [c.K, c.PA],
  bb:    (c: any) => [c.BB, c.PA],
  hr:    (c: any) => [c.HR, c.PA - c.K - c.BB - c.HP],
  xbh:   (c: any) => [c.b2 + c.b3, c.PA - c.K - c.BB - c.HP],
  babip: (c: any) => [c.H - c.HR, c.PA - c.K - c.BB - c.HP - c.HR],
};
/** pitchers: no hits-allowed counter exists, so BABIP-against cannot be tested */
const PIT: Record<string, Pick> = {
  k:  (c: any) => [c.Ka, c.BF],
  bb: (c: any) => [c.BBa, c.BF],
  hr: (c: any) => [c.HRa, c.BF - c.Ka - c.BBa - c.HPa],
};

async function audit(kind: "hit" | "pit", key: string, ratingCol: string) {
  const c = curves[kind][key];
  const pick = (kind === "hit" ? HIT : PIT)[key];
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.counters, (cd.ratings->>${sql.raw(`'${ratingCol}'`)})::numeric rating
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = ${kind === "pit"} and cd.is_pitcher = ${kind === "pit"}
      and ${kind === "pit" ? sql`(o.counters->>'BF')::numeric` : sql`o.pa`} >= ${MIN}
      and cd.ratings ? ${ratingCol}`));
  const data: Row[] = [];
  for (const r of rows) {
    const [n, d] = pick(r.counters);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || r.rating == null) continue;
    data.push({ series: r.series, rating: Number(r.rating), num: n, den: d });
  }
  // each series' own rate, so different run environments pool
  const bySeries = new Map<string, { n: number; d: number }>();
  for (const x of data) {
    const s = bySeries.get(x.series) ?? { n: 0, d: 0 };
    s.n += x.num; s.d += x.den; bySeries.set(x.series, s);
  }
  const seriesRate = new Map([...bySeries].map(([s, v]) => [s, v.d > 0 ? v.n / v.d : 0]));

  const edges = [0, 60, 75, 90, 105, 120, 135, 150, 170, 200, 1e9];
  const buckets = edges.slice(0, -1).map(() => ({ n: 0, exp: 0, act: 0, den: 0, rsum: 0, rows: 0 }));
  for (const x of data) {
    let b = edges.findIndex((e, i) => x.rating >= e && x.rating < edges[i + 1]);
    if (b < 0) b = buckets.length - 1;
    const sr = seriesRate.get(x.series) ?? 0;
    const B = buckets[b];
    B.act += x.num; B.exp += x.den * sr; B.den += x.den; B.rsum += x.rating * x.den; B.rows++;
  }
  const mult = (r: number) => Math.exp(c.alpha) * Math.pow(r / 50, c.beta);
  console.log(`\n=== ${kind}.${key}  (${ratingCol})   beta ${c.beta.toFixed(3)}  fitted R² ${c.r2}  window ${JSON.stringify(c.rating_range ?? "-")}`);
  console.log(`  rating     rows    denom     observed  curve   obs/curve`);
  for (let i = 0; i < buckets.length; i++) {
    const B = buckets[i];
    if (B.rows < 5 || B.exp <= 0) continue;
    const meanR = B.rsum / B.den;
    const obs = B.act / B.exp, pred = mult(meanR);
    const lo = edges[i], hi = edges[i + 1];
    const flag = Math.abs(obs / pred - 1) > 0.12 ? "  <<<" : "";
    console.log(`  ${String(lo).padStart(3)}-${(hi > 1e8 ? "+" : String(hi)).padEnd(4)} ${String(B.rows).padStart(6)} ${String(Math.round(B.den)).padStart(9)}    ${f2(obs).padStart(6)} ${f2(pred).padStart(6)}   ${f2(obs / pred).padStart(6)}${flag}`);
  }
}

async function main() {
  console.log(`curve audit — observed tournament play vs the fitted curves (min ${MIN} PA per card-series)`);
  console.log(`curves fitted ${curves.generatedAt} on ${curves.frame}`);
  for (const [k, r] of Object.entries({ k: "Avoid Ks", bb: "Eye", hr: "Power", xbh: "Gap", babip: "BABIP" })) await audit("hit", k, r);
  for (const [k, r] of Object.entries({ k: "Stuff", bb: "Control", hr: "pHR" })) await audit("pit", k, r);
  console.log(`\nNOTE: pit.babip (pBABIP) cannot be audited — OOTP's export carries no hits-allowed counter.`);
  process.exit(0);
}
main();
