/**
 * Refit the rating->rate curves on observed tournament play.
 *
 * The shipped curves were fitted in July on the modern PT league: one league,
 * one run environment, projected rates. We now have 51 tournament series and
 * ~21M plate appearances of what the cards ACTUALLY did, across many
 * environments — which is the thing the roster builder is trying to predict.
 *
 * Two changes:
 *
 *  1. The fit target is a card's observed multiplier — its rate divided by the
 *     rate of its own series. That is environment-free, so 51 series in 51 run
 *     environments pool into one fit instead of one league's worth of data.
 *
 *  2. The functional form gains a curvature term. The old form was a pure power
 *     law, log(m) = a + b*log(r/50), which is unbounded; observed play saturates
 *     (Power 170 earns a 1.63x HR multiplier, the power law says 1.92x). The new
 *     form is log(m) = a + b*log(r/50) + g*log(r/50)^2, which nests the old one
 *     at g = 0, so a rating that really is log-linear is unharmed.
 *
 * Weighted least squares, weights = the card's denominator (PA, balls in play
 * or batters faced), so a card with 40,000 PA counts for more than one with 400.
 *
 *   pnpm curve:refit [--min-den 400] [--write]
 */
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import CURVES from "@/data/curves.json";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN_DEN = num("min-den", 400);
const WRITE = argv.includes("--write");
/** Default output. Point at src/data/curves.json only when you mean to ship it. */
const OUT = (() => { const i = argv.indexOf("--out"); return i >= 0 ? argv[i + 1] : "src/data/curves.next.json"; })();
const old = JSON.parse(JSON.stringify(CURVES)) as any;

const HIT: Record<string, (c: any) => [number, number]> = {
  k:     (c) => [c.K, c.PA],
  bb:    (c) => [c.BB, c.PA],
  hr:    (c) => [c.HR, c.PA - c.K - c.BB - c.HP],
  xbh:   (c) => [c.b2 + c.b3, c.PA - c.K - c.BB - c.HP],
  babip: (c) => [c.H - c.HR, c.PA - c.K - c.BB - c.HP - c.HR],
};
const PIT: Record<string, (c: any) => [number, number]> = {
  k:  (c) => [c.Ka, c.BF],
  bb: (c) => [c.BBa, c.BF],
  hr: (c) => [c.HRa, c.BF - c.Ka - c.BBa - c.HPa],
};
const RATING: Record<string, Record<string, string>> = {
  hit: { k: "Avoid Ks", bb: "Eye", hr: "Power", xbh: "Gap", babip: "BABIP" },
  pit: { k: "Stuff", bb: "Control", hr: "pHR" },
};

/** Weighted least squares on the given design columns. Returns coefficients. */
function wls(X: number[][], y: number[], w: number[]): number[] {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < p; j++) {
      b[j] += w[i] * X[i][j] * y[i];
      for (let k = 0; k < p; k++) A[j][k] += w[i] * X[i][j] * X[i][k];
    }
  }
  // gaussian elimination with partial pivoting
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < p; r++) {
      if (r === c || A[c][c] === 0) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < p; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => (A[i][i] === 0 ? 0 : v / A[i][i]));
}
const wr2 = (y: number[], yh: number[], w: number[]) => {
  const W = w.reduce((a, b) => a + b, 0);
  const my = y.reduce((a, b, i) => a + b * w[i], 0) / W;
  let ss = 0, tot = 0;
  for (let i = 0; i < y.length; i++) { ss += w[i] * (y[i] - yh[i]) ** 2; tot += w[i] * (y[i] - my) ** 2; }
  return 1 - ss / tot;
};

async function fit(kind: "hit" | "pit", key: string) {
  const ratingCol = RATING[kind][key];
  const pick = (kind === "hit" ? HIT : PIT)[key];
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.counters, (cd.ratings->>${sql.raw(`'${ratingCol}'`)})::numeric rating
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = ${kind === "pit"} and cd.is_pitcher = ${kind === "pit"}
      and cd.ratings ? ${ratingCol}`));

  type P = { series: string; card: number; r: number; n: number; d: number };
  const data: P[] = [];
  for (const r of rows) {
    const [n, d] = pick(r.counters);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || r.rating == null || Number(r.rating) <= 0) continue;
    data.push({ series: r.series, card: r.card_id, r: Number(r.rating), n, d });
  }
  const sm = new Map<string, { n: number; d: number }>();
  for (const x of data) { const s = sm.get(x.series) ?? { n: 0, d: 0 }; s.n += x.n; s.d += x.d; sm.set(x.series, s); }

  // pool each card across series: expected numerator at its own series' rate
  const byCard = new Map<number, { r: number; act: number; exp: number; den: number }>();
  for (const x of data) {
    const s = sm.get(x.series)!; const rate = s.d > 0 ? s.n / s.d : 0;
    if (!(rate > 0)) continue;
    const e = byCard.get(x.card) ?? { r: x.r, act: 0, exp: 0, den: 0 };
    e.act += x.n; e.exp += x.d * rate; e.den += x.d; byCard.set(x.card, e);
  }
  const pts = [...byCard.values()].filter((p) => p.den >= MIN_DEN && p.act > 0 && p.exp > 0);

  const X1: number[][] = [], X2: number[][] = [], Y: number[] = [], W: number[] = [];
  for (const p of pts) {
    const x = Math.log(p.r / 50);
    X1.push([1, x]); X2.push([1, x, x * x]);
    Y.push(Math.log(p.act / p.exp)); W.push(p.den);
  }
  const c1 = wls(X1, Y, W), c2 = wls(X2, Y, W);
  const p1 = X1.map((r) => r[0] * c1[0] + r[1] * c1[1]);
  const p2 = X2.map((r) => r[0] * c2[0] + r[1] * c2[1] + r[2] * c2[2]);
  const r2a = wr2(Y, p1, W), r2b = wr2(Y, p2, W);
  const o = old[kind][key];
  const oldM = (r: number) => Math.exp(o.alpha) * Math.pow(r / 50, o.beta);
  const newM = (r: number) => { const x = Math.log(r / 50); return Math.exp(c2[0] + c2[1] * x + c2[2] * x * x); };

  const ratings = pts.map((p) => p.r).sort((a, b) => a - b);
  const q = (f: number) => ratings[Math.min(ratings.length - 1, Math.floor(f * ratings.length))];
  console.log(`\n=== ${kind}.${key}  (${ratingCol})   ${pts.length} cards, ${Math.round(pts.reduce((a, b) => a + b.den, 0)).toLocaleString()} denom`);
  console.log(`  shipped   beta ${o.beta.toFixed(3)}                      (fitted R² ${o.r2} on projections)`);
  console.log(`  power law beta ${c1[1].toFixed(3)}              weighted R² ${r2a.toFixed(3)}  <- same form, observed data`);
  console.log(`  +curvature beta ${c2[1].toFixed(3)} gamma ${c2[2].toFixed(3)}  weighted R² ${r2b.toFixed(3)}  ${r2b - r2a > 0.005 ? "<- curvature earns its place" : "(curvature adds little)"}`);
  console.log(`  multiplier at the 5th / 50th / 95th percentile rating of played cards:`);
  for (const f of [0.05, 0.5, 0.95]) {
    const r = q(f);
    console.log(`     r=${String(r).padStart(3)}   shipped ${oldM(r).toFixed(3)}   refit ${newM(r).toFixed(3)}   ${(((newM(r) / oldM(r)) - 1) * 100).toFixed(0).padStart(4)}%`);
  }
  return { key, kind, alpha: c2[0], beta: c2[1], gamma: c2[2], r2: Number(r2b.toFixed(3)), n: pts.length,
           range: [ratings[0], ratings[ratings.length - 1]] as [number, number] };
}

async function main() {
  console.log(`curve refit on observed tournament play (min ${MIN_DEN} denominator per card)\n`);
  const out = JSON.parse(JSON.stringify(CURVES)) as any;
  for (const k of ["k", "bb", "hr", "xbh", "babip"]) {
    const f = await fit("hit", k);
    Object.assign(out.hit[k], { alpha: f.alpha, beta: f.beta, gamma: f.gamma, r2: f.r2, n: f.n, rating_range: f.range });
  }
  for (const k of ["k", "bb", "hr"]) {
    const f = await fit("pit", k);
    Object.assign(out.pit[k], { alpha: f.alpha, beta: f.beta, gamma: f.gamma, r2: f.r2, n: f.n, rating_range: f.range });
  }
  out.frame = `observed tournament play, ${new Set(rows.map((r: any) => r.series)).size} series, per-series normalised, Jim-beater teams excluded (observed/3)`;
  out.generatedAt = new Date().toISOString();
  out.pit.babip = { ...out.pit.babip, note: "NOT refitted — OOTP's export carries no hits-allowed counter, so pBABIP cannot be checked against observed play. Still the July projection fit." };
  console.log(`\npit.babip left alone: no hits-allowed counter in the export, so it cannot be audited or refitted.`);
  if (WRITE) { writeFileSync(OUT, JSON.stringify(out, null, 2)); console.log(`\nwrote ${OUT}`); }
  else console.log(`\n(dry run — pass --write to emit ${OUT})`);
  process.exit(0);
}
main();
