/**
 * The end-to-end test the curve audit cannot do: does the model's per-card
 * value actually rank cards the way tournament play ranked them?
 *
 * The audit checks one rating -> one rate at a time. That is not the question
 * the roster builder asks. The builder scores a card from ALL of its ratings at
 * once, so the right test is its single output — runs per 700 PA — against what
 * the card actually produced, pooled across 51 series by normalising each
 * card's observed line to its own series' average.
 *
 * This distinction matters: a MARGINAL relationship (bucket cards by one rating
 * and look at runs) is confounded, because ratings correlate on real cards —
 * high-Control arms have low Stuff. A model that conditions on all four ratings
 * does not inherit that confound, so a flat marginal curve is NOT evidence the
 * model is wrong. This script is what settles it.
 *
 *   pnpm model:validate [--min-pa 300]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable } from "@/lib/analytics/runenv-view";
import { hitterRates, pitcherRates, cardRuns, envFor, __setCurves } from "@/lib/analytics/card-value";
import { readFileSync } from "node:fs";
import { linearWeights, solveEnv, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN = num("min-pa", 300);

/** Spearman rank correlation, weighted equally per card. */
function spearman(xs: number[], ys: number[]): number {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length).fill(0);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb2 = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb2 += db * db; }
  return sab / Math.sqrt(sa * sb2);
}
const pearson = (xs: number[], ys: number[]) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sx += dx * dx; sy += dy * dy; }
  return sxy / Math.sqrt(sx * sy);
};

async function main() {
  const cf = argv.indexOf("--curves");
  if (cf >= 0) {
    const path = argv[cf + 1];
    __setCurves(JSON.parse(readFileSync(path, "utf8")));
    console.log(`USING CURVES: ${path}`);
  }
  // A neutral scoring frame: the PT default environment, neutral park.
  const era = eraTable["0"] ?? eraTable["2010"];
  const solved = solveEnv(era.rates, era.rg, null);
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  console.log(`model validation — scoring frame: PT default env, neutral park (R/G ${solved.RG.toFixed(2)})`);
  console.log(`min ${MIN} PA / BF per card-series row\n`);

  for (const kind of ["hit", "pit"] as const) {
    const rows = asRows<any>(await db.execute(sql`
      select o.series, o.card_id, o.pa, o.woba, o.counters, cd.name, cd.card_value, cd.ratings
      from observed_card_stats o join cards cd on cd.card_id = o.card_id
      where o.is_pitcher = ${kind === "pit"} and cd.is_pitcher = ${kind === "pit"}
        and ${kind === "pit" ? sql`(o.counters->>'BF')::numeric` : sql`o.pa`} >= ${MIN}`));

    /** observed quality, normalised to the row's own series */
    type Obs = { cardId: number; name: string; val: number; w: number; obs: number; pred: number };
    const per: { series: string; cardId: number; name: string; val: number; w: number; raw: number; ratings: any }[] = [];
    for (const r of rows) {
      const c = r.counters;
      let raw: number, w: number;
      if (kind === "hit") {
        if (r.woba == null || !(r.pa > 0)) continue;
        raw = Number(r.woba); w = Number(r.pa);
      } else {
        const bf = Number(c.BF); if (!(bf > 0)) continue;
        raw = Number(c.ER) / bf; w = bf;            // earned runs allowed per batter faced
      }
      if (!Number.isFinite(raw)) continue;
      per.push({ series: r.series, cardId: r.card_id, name: r.name, val: r.card_value, w, raw, ratings: r.ratings });
    }
    // series means, weighted
    const sm = new Map<string, { n: number; d: number }>();
    for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
    const seriesMean = new Map([...sm].map(([s, v]) => [s, v.n / v.d]));

    // pool each card across series, as a weighted ratio to its series mean
    const byCard = new Map<number, { name: string; val: number; w: number; num: number; ratings: any }>();
    for (const p of per) {
      const m = seriesMean.get(p.series)!; if (!(m > 0)) continue;
      const e = byCard.get(p.cardId) ?? { name: p.name, val: p.val, w: 0, num: 0, ratings: p.ratings };
      e.w += p.w; e.num += (p.raw / m) * p.w; byCard.set(p.cardId, e);
    }

    const pts: Obs[] = [];
    for (const [cardId, e] of byCard) {
      if (e.w < MIN * 2) continue;
      const rates = kind === "hit" ? hitterRates(e.ratings ?? {}, era.rates) : pitcherRates(e.ratings ?? {}, era.rates);
      if (!rates) continue;
      const runs = cardRuns(rates, env);
      pts.push({ cardId, name: e.name, val: e.val ?? 0, w: e.w, obs: e.num / e.w, pred: runs });
    }
    // for pitchers a LOWER observed index is better, and cardRuns is runs allowed
    const xs = pts.map((p) => p.pred), ys = pts.map((p) => p.obs);
    const lbl = kind === "hit" ? "observed wOBA index (1.00 = series average)" : "observed ER/BF index (lower is better)";
    console.log(`=== ${kind === "hit" ? "HITTERS" : "PITCHERS"} — ${pts.length} cards, ${Math.round(pts.reduce((a, b) => a + b.w, 0)).toLocaleString()} ${kind === "hit" ? "PA" : "BF"}`);
    console.log(`    model runs/700 PA  vs  ${lbl}`);
    console.log(`    Spearman ${spearman(xs, ys).toFixed(3)}   Pearson ${pearson(xs, ys).toFixed(3)}`);

    // decile table
    const sorted = [...pts].sort((a, b) => a.pred - b.pred);
    const per10 = Math.ceil(sorted.length / 10);
    console.log(`    decile by MODEL   n    model runs   observed index`);
    for (let i = 0; i < 10; i++) {
      const g = sorted.slice(i * per10, (i + 1) * per10); if (!g.length) continue;
      const mr = g.reduce((a, b) => a + b.pred, 0) / g.length;
      const oi = g.reduce((a, b) => a + b.obs * b.w, 0) / g.reduce((a, b) => a + b.w, 0);
      console.log(`      ${String(i + 1).padStart(2)}          ${String(g.length).padStart(4)}   ${mr.toFixed(1).padStart(8)}       ${oi.toFixed(4)}`);
    }
    // worst misses
    const mx = pts.map((p) => p.pred), my = pts.map((p) => p.obs);
    const mmx = mx.reduce((a, b) => a + b, 0) / mx.length, mmy = my.reduce((a, b) => a + b, 0) / my.length;
    const sdx = Math.sqrt(mx.reduce((a, b) => a + (b - mmx) ** 2, 0) / mx.length);
    const sdy = Math.sqrt(my.reduce((a, b) => a + (b - mmy) ** 2, 0) / my.length);
    const resid = pts.map((p) => ({ p, e: ((p.obs - mmy) / sdy) - ((p.pred - mmx) / sdx) }));
    resid.sort((a, b) => a.e - b.e);
    const show = (t: string, arr: typeof resid) => {
      console.log(`    ${t}`);
      for (const { p, e } of arr) console.log(`      ${p.name.slice(0, 26).padEnd(27)} val ${String(p.val).padStart(3)}  model ${p.pred.toFixed(1).padStart(7)}  obs ${p.obs.toFixed(3)}  z ${e.toFixed(2)}`);
    };
    show("model most OVER-rates:", resid.slice(0, 6));
    show("model most UNDER-rates:", resid.slice(-6).reverse());
    console.log();
  }
  process.exit(0);
}
main();
