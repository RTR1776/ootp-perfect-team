/**
 * Recover the pBABIP curve by inversion.
 *
 * OOTP's export has no hits-allowed counter, so BABIP-against cannot be
 * measured directly and curve:refit has to leave pit.babip on the July
 * projection fit. That is worse than it sounds: with k, bb and hr refitted on
 * observed play and babip left alone, the four curves no longer sit on a
 * common level, and the pitcher model actually got WORSE after the refit
 * (Spearman 0.458 -> 0.445).
 *
 * What IS observed is earned runs allowed per batter faced. So: hold the three
 * refitted curves fixed, and for each card solve for the BABIP multiplier that
 * makes the run model reproduce that card's observed ER index. Then fit a curve
 * through those solved multipliers.
 *
 * HONEST LIMIT: this term is not a measurement of pBABIP. It is whatever the
 * other three curves do not explain — so it also absorbs the defence behind the
 * pitcher, sequencing luck, and any level error in k/bb/hr. It is named for
 * pBABIP because pBABIP is what it is regressed on, and it earns its place only
 * by making the pitcher model rank cards better. Nothing more is claimed.
 *
 *   pnpm pbabip:invert [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { __setCurves, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, runsPerPa, type EraRates } from "@/lib/analytics/run-env";
import CURVES_V2 from "@/data/curves.json";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN_BF = num("min-bf", 1500);
const WRITE = argv.includes("--write");
/** Default output. Point at src/data/curves.json only when you mean to ship it. */
const OUT = (() => { const i = argv.indexOf("--out"); return i >= 0 ? argv[i + 1] : "src/data/curves.next.json"; })();
const V2 = JSON.parse(JSON.stringify(CURVES_V2)) as any;
__setCurves(V2);

const cmult = (c: any, r: number) => { const x = Math.log(r / 50); return Math.exp(c.alpha + c.beta * x + (c.gamma ?? 0) * x * x); };

function wls(X: number[][], y: number[], w: number[]): number[] {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) for (let j = 0; j < p; j++) {
    b[j] += w[i] * X[i][j] * y[i];
    for (let k = 0; k < p; k++) A[j][k] += w[i] * X[i][j] * X[i][k];
  }
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < p; r++) { if (r === c || A[c][c] === 0) continue; const f = A[r][c] / A[c][c];
      for (let k = c; k < p; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  return b.map((v, i) => (A[i][i] === 0 ? 0 : v / A[i][i]));
}

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, null, linearWeights(era.rates));
  const w = env.weights, lg = env.leagueRunsPerPa;

  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.counters, cd.name, cd.ratings
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = true and cd.is_pitcher = true`));

  type P = { series: string; card: number; er: number; bf: number; ratings: any; name: string };
  const per: P[] = [];
  for (const r of rows) {
    const bf = Number(r.counters.BF), er = Number(r.counters.ER);
    if (!(bf > 0) || !Number.isFinite(er)) continue;
    per.push({ series: r.series, card: r.card_id, er, bf, ratings: r.ratings ?? {}, name: r.name });
  }
  const sm = new Map<string, { er: number; bf: number }>();
  for (const p of per) { const s = sm.get(p.series) ?? { er: 0, bf: 0 }; s.er += p.er; s.bf += p.bf; sm.set(p.series, s); }

  const byCard = new Map<number, { name: string; ratings: any; act: number; exp: number; bf: number }>();
  for (const p of per) {
    const s = sm.get(p.series)!; const rate = s.bf > 0 ? s.er / s.bf : 0; if (!(rate > 0)) continue;
    const e = byCard.get(p.card) ?? { name: p.name, ratings: p.ratings, act: 0, exp: 0, bf: 0 };
    e.act += p.er; e.exp += p.bf * rate; e.bf += p.bf; byCard.set(p.card, e);
  }

  const X: number[][] = [], Y: number[] = [], W: number[] = [];
  let solved = 0, clipped = 0;
  for (const [, c] of byCard) {
    if (c.bf < MIN_BF || c.exp <= 0) continue;
    const stu = c.ratings["Stuff"], con = c.ratings["Control"], hra = c.ratings["pHR"], pba = c.ratings["pBABIP"];
    if (![stu, con, hra, pba].every((v) => typeof v === "number" && v > 0)) continue;
    const base: EraRates = {
      K: era.rates.K * cmult(V2.pit.k, stu),
      BB: era.rates.BB * cmult(V2.pit.bb, con),
      HBP: era.rates.HBP,
      HR: era.rates.HR * cmult(V2.pit.hr, hra),
      B2: era.rates.B2, B3: era.rates.B3, BABIP: era.rates.BABIP,
    };
    const target = (c.act / c.exp) * lg;              // observed runs per PA for this card
    const f = (m: number) => runsPerPa({ ...base, BABIP: era.rates.BABIP * m }, w) - target;
    let lo = 0.40, hi = 2.20;
    if (f(lo) > 0 || f(hi) < 0) { clipped++; continue; }
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    const m = (lo + hi) / 2;
    const x = Math.log(pba / 50);
    X.push([1, x, x * x]); Y.push(Math.log(m)); W.push(c.bf); solved++;
  }
  const c2 = wls(X, Y, W);
  const c1 = wls(X.map((r) => [r[0], r[1]]), Y, W);
  const r2of = (co: number[]) => {
    const yh = X.map((r) => co.reduce((a, v, i) => a + v * r[i], 0));
    const WT = W.reduce((a, b) => a + b, 0), my = Y.reduce((a, b, i) => a + b * W[i], 0) / WT;
    let ss = 0, tot = 0;
    for (let i = 0; i < Y.length; i++) { ss += W[i] * (Y[i] - yh[i]) ** 2; tot += W[i] * (Y[i] - my) ** 2; }
    return 1 - ss / tot;
  };
  const old = V2.pit.babip;
  console.log(`pBABIP by inversion — ${solved} cards solved, ${clipped} outside the [0.40, 2.20] bracket (dropped)`);
  console.log(`  shipped (July projections): beta ${old.beta}  (R² ${old.r2})`);
  console.log(`  inverted, power law:        beta ${c1[1].toFixed(3)}                 weighted R² ${r2of(c1).toFixed(3)}`);
  console.log(`  inverted, +curvature:       beta ${c2[1].toFixed(3)}  gamma ${c2[2].toFixed(3)}   weighted R² ${r2of(c2).toFixed(3)}`);
  const oldM = (r: number) => Math.exp(old.alpha) * Math.pow(r / 50, old.beta);
  const newM = (r: number) => { const x = Math.log(r / 50); return Math.exp(c2[0] + c2[1] * x + c2[2] * x * x); };
  console.log(`  multiplier:`);
  for (const r of [60, 85, 110, 140, 165]) console.log(`     pBABIP ${String(r).padStart(3)}   shipped ${oldM(r).toFixed(3)}   inverted ${newM(r).toFixed(3)}`);
  if (WRITE) {
    V2.pit.babip = { ...old, alpha: c2[0], beta: c2[1], gamma: c2[2], r2: Number(r2of(c2).toFixed(3)), n: solved,
      note: "Recovered by inversion, not measured: OOTP's export has no hits-allowed counter, so this term is whatever Stuff/Control/pHR do not explain about observed ER per batter faced. It therefore also carries team defence and sequencing. Judge it only by whether the pitcher model ranks cards better with it." };
    writeFileSync(OUT, JSON.stringify(V2, null, 2));
    console.log(`\nwrote ${OUT}`);
  } else console.log(`\n(dry run — pass --write)`);
  process.exit(0);
}
main();
