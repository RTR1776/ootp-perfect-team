/**
 * Which pitcher rating is the model actually mis-weighting — and does Movement
 * add anything the four modelled ratings do not already carry?
 *
 * A univariate screen cannot answer either question. Controlling for card value
 * makes the ratings trade off against each other (a 90-value arm with more Stuff
 * has less Control), so ONE mis-weighting shows up as signal on several ratings
 * at once, with opposite signs. Only a joint fit separates them.
 *
 * Model: residual (observed runs per 700 BF minus what the model predicted)
 * regressed on log(rating/50) for every candidate at once, weighted by batters
 * faced, with log(card value) carried as a control column.
 *
 * A coefficient is the runs per 700 BF the model gets wrong per e-fold of that
 * rating. Positive = the model is too kind to that rating.
 *
 *   pnpm residual:multi [--min 1500]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const MIN = Number((() => { const i = argv.indexOf("--min"); return i >= 0 ? argv[i + 1] : "1500"; })());

function wls(X: number[][], y: number[], w: number[]) {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) for (let j = 0; j < p; j++) {
    b[j] += w[i] * X[i][j] * y[i];
    for (let k = 0; k < p; k++) A[j][k] += w[i] * X[i][j] * X[i][k];
  }
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < p; r++) { if (r === c || M[c][c] === 0) continue; const f = M[r][c] / M[c][c];
      for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]; }
  }
  const co = M.map((r, i) => (M[i][i] === 0 ? 0 : r[p] / M[i][i]));
  const yh = X.map((r) => r.reduce((a, v, i) => a + v * co[i], 0));
  const WT = w.reduce((a, b2) => a + b2, 0), my = y.reduce((a, b2, i) => a + b2 * w[i], 0) / WT;
  let ss = 0, tot = 0;
  for (let i = 0; i < y.length; i++) { ss += w[i] * (y[i] - yh[i]) ** 2; tot += w[i] * (y[i] - my) ** 2; }
  return { co, r2: 1 - ss / tot };
}

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.counters, cd.name, cd.card_value, cd.ratings
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = true and cd.is_pitcher = true`));
  const per: any[] = [];
  for (const r of rows) {
    const bf = Number(r.counters.BF), er = Number(r.counters.ER);
    if (!(bf > 0) || !Number.isFinite(er)) continue;
    per.push({ series: r.series, card: r.card_id, raw: er / bf, w: bf, ratings: r.ratings ?? {}, val: r.card_value, name: r.name });
  }
  const sm = new Map<string, { n: number; d: number }>();
  for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
  const WT = per.reduce((a, b) => a + b.w, 0);
  const overall = per.reduce((a, b) => a + b.raw * b.w, 0) / WT;

  const byCard = new Map<number, any>();
  for (const p of per) {
    const m = sm.get(p.series)!; const mean = m.n / m.d; if (!(mean > 0)) continue;
    const e = byCard.get(p.card) ?? { name: p.name, val: p.val, ratings: p.ratings, w: 0, num: 0 };
    e.w += p.w; e.num += (p.raw / mean) * p.w; byCard.set(p.card, e);
  }
  const CAND = ["Stuff", "Control", "pHR", "pBABIP", "Movement", "GB", "Stamina", "Hold"];
  const pts: { x: number[]; y: number; w: number }[] = [];
  for (const [, c] of byCard) {
    if (c.w < MIN || !(c.val > 0)) continue;
    const rates = pitcherRates(c.ratings, era.rates); if (!rates) continue;
    if (!CAND.every((k) => typeof c.ratings[k] === "number" && c.ratings[k] > 0)) continue;
    const observed = (c.num / c.w - 1) * overall * 700;
    const resid = observed - cardRuns(rates, env);
    const model = cardRuns(rates, env);
    pts.push({ x: [1, model, Math.log(c.val), ...CAND.map((k) => Math.log(c.ratings[k] / 50))],
               y: observed, w: c.w, name: c.name,
               rt: Object.fromEntries(CAND.map((k) => [k, c.ratings[k]])) } as any);
  }
  const X = pts.map((p) => p.x), Y = pts.map((p) => p.y), W = pts.map((p) => p.w);
  const full = wls(X, Y, W);
  const base = wls(X.map((r) => [r[0], r[1]]), Y, W);
  console.log(`residual, jointly — ${pts.length} arms, ${Math.round(W.reduce((a, b) => a + b, 0)).toLocaleString()} BF`);
  console.log(`predicting OBSERVED runs/700 BF, with the model's own output as a term.`);
  console.log(`  model alone            R² ${base.r2.toFixed(3)}   slope on the model ${base.co[1].toFixed(3)}`);
  console.log(`  + every rating         R² ${full.r2.toFixed(3)}   slope on the model ${full.co[1].toFixed(3)}`);
  console.log(`\n  A slope of ${base.co[1].toFixed(2)} on the model's own number is the calibration error:`);
  console.log(`  the model's spread is about ${(1 / base.co[1]).toFixed(1)}x too wide. With that absorbed,`);
  console.log(`  a rating coefficient below is mis-weighting the model has left over.\n`);
  console.log(`  term             coef (runs/700 per e-fold)`);
  console.log(`  ${"log(card value)".padEnd(16)} ${full.co[2].toFixed(2).padStart(8)}`);
  CAND.forEach((k, i) => {
    const c = full.co[3 + i];
    const read = Math.abs(c) < 1.5 ? "" : c > 0 ? "   model is TOO KIND" : "   model UNDER-credits";
    console.log(`  ${k.padEnd(16)} ${c.toFixed(2).padStart(8)}${read}`);
  });

  // does Movement carry anything the four modelled ratings do not?
  const drop = (name: string) => {
    const j = 3 + CAND.indexOf(name);
    const Xr = X.map((r) => r.filter((_, i) => i !== j));
    return wls(Xr, Y, W).r2;
  };
  console.log(`\n  leave-one-out — how much joint R² each term is carrying on its own:`);
  for (const k of CAND) console.log(`    without ${k.padEnd(10)} R² ${drop(k).toFixed(3)}   (−${(full.r2 - drop(k)).toFixed(3)})`);
  // collinearity: how well each candidate is predicted by the four already modelled
  const MOD = ["Stuff", "Control", "pHR", "pBABIP"];
  console.log(`\n  is a candidate just a restatement of what the model already reads?`);
  for (const k of ["Movement", "GB", "Stamina"]) {
    const Xc = pts.map((p: any) => [1, ...MOD.map((m) => Math.log(p.rt[m] / 50))]);
    const Yc = pts.map((p: any) => Math.log(p.rt[k] / 50));
    console.log(`    ${k.padEnd(10)} predicted by Stuff/Control/pHR/pBABIP: R² ${wls(Xc, Yc, W).r2.toFixed(3)}`);
  }
  process.exit(0);
}
main();
