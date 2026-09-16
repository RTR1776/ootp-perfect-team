/**
 * What a point of position rating is worth in runs, by position — measured on
 * L.J.'s own archived exports, not assumed.
 *
 *   pnpm fielding:fit        writes src/data/fielding.json
 *
 * Two regressions over Archive/Completed (every export carries the game's own
 * rating at all eight positions plus fielding lines):
 *
 *  1. Runs per ZR. OOTP's hitter WAR decomposes, in runs (×10 at ~4.5 R/G):
 *       WAR·10 = 1.00·wRAA + 0.72·(wSB+UBR) + 0.89·ZR + positional terms
 *     (R² .80 on 1,935 stints with 150+ PA, 2026-09-16). wRAA at exactly 1.00
 *     pins the scale, so the game counts a unit of ZR as ≈0.89 runs.
 *
 *  2. ZR per rating point. For stints of 100+ fielding innings, ZR per 1,400
 *     innings (a full season) regressed on the rating at the stint's listed
 *     position, innings-weighted. Slopes 2026-09-16: 2B .174, SS .156, 3B .150,
 *     1B .141, RF .097, LF .089, CF .065, C .036 ZR per point (r .13–.32: one
 *     stint's ZR is noisy, the slope is not). Catcher value in OOTP is framing
 *     and arm, which ZR does not see, so C is under-credited here.
 *
 * fieldingRuns() multiplies the two: a 38-point gap at second base is 38 ×
 * .174 × .89 ≈ 5.9 runs per full season.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "@/lib/ingest/eligible-pool";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIR = join(ROOT, "Archive/Completed");
const POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const FULL_SEASON_INNINGS = 1400;

function ols(X: number[][], y: number[]) {
  const n = X.length, p = X[0].length; const A = Array.from({ length: p }, () => Array(p + 1).fill(0));
  for (let i = 0; i < n; i++) for (let a = 0; a < p; a++) { A[a][p] += X[i][a] * y[i]; for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; }
  for (let i = 0; i < p; i++) { let m = i; for (let j = i + 1; j < p; j++) if (Math.abs(A[j][i]) > Math.abs(A[m][i])) m = j; [A[i], A[m]] = [A[m], A[i]]; for (let j = 0; j < p; j++) { if (j === i) continue; const f = A[j][i] / A[i][i]; for (let k = i; k <= p; k++) A[j][k] -= f * A[i][k]; } }
  const beta = A.map((r, i) => r[p] / r[i]); const yhat = X.map((r) => r.reduce((s, v, k) => s + v * beta[k], 0)); const ym = y.reduce((a, b) => a + b, 0) / n;
  const ssr = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0), sst = y.reduce((s, v) => s + (v - ym) ** 2, 0);
  return { beta, r2: 1 - ssr / sst, n };
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".csv")).sort();
const warX: number[][] = [], warY: number[] = [];
const fld: Record<string, { x: number; y: number; w: number }[]> = Object.fromEntries(POS.map((p) => [p, []]));
let used = 0;
for (const f of files) {
  let rows: Record<string, string>[];
  try { rows = parseCsv(readFileSync(join(DIR, f), "utf8")); } catch { continue; }
  if (!rows.length || !("ZR" in rows[0]) || !("IP_1" in rows[0])) continue;
  used++;
  for (const r of rows) {
    const pos = (r.POS || "").trim(); const pi = POS.indexOf(pos); if (pi < 0) continue;
    const ip = Number(r.IP_1), zr = Number(r.ZR), rating = Number(r[pos]);
    if (Number.isFinite(ip) && ip >= 100 && Number.isFinite(zr) && Number.isFinite(rating)) fld[pos].push({ x: rating, y: zr / ip * FULL_SEASON_INNINGS, w: ip });
    const pa = Number(r.PA), war = Number(r.WAR), wraa = Number(r.wRAA), wsb = Number(r.wSB), ubr = Number(r.UBR);
    if ([pa, war, wraa, wsb, ubr, zr, ip].every(Number.isFinite) && pa >= 150) { warX.push([wraa, wsb + ubr, zr, pa, ...POS.map((_, i) => (i === pi ? ip : 0))]); warY.push(war * 10); }
  }
}
const war = ols(warX, warY);
const runsPerZR = war.beta[2];
console.log(`WAR decomposition: n=${war.n} R²=${war.r2.toFixed(3)}  wRAA ${war.beta[0].toFixed(3)}  wSB+UBR ${war.beta[1].toFixed(3)}  ZR ${runsPerZR.toFixed(3)} runs per unit`);

const positions: Record<string, { slope: number; mean: number; meanZR: number; n: number; innings: number; r: number }> = {};
for (const p of POS) {
  const d = fld[p];
  const W = d.reduce((s, q) => s + q.w, 0), mx = d.reduce((s, q) => s + q.w * q.x, 0) / W, my = d.reduce((s, q) => s + q.w * q.y, 0) / W;
  let sxy = 0, sxx = 0, syy = 0; for (const q of d) { sxy += q.w * (q.x - mx) * (q.y - my); sxx += q.w * (q.x - mx) ** 2; syy += q.w * (q.y - my) ** 2; }
  const slope = sxy / sxx, r = sxy / Math.sqrt(sxx * syy);
  positions[p] = { slope: +slope.toFixed(4), mean: +mx.toFixed(1), meanZR: +my.toFixed(2), n: d.length, innings: Math.round(W), r: +r.toFixed(3) };
  console.log(`${p.padEnd(2)} n=${d.length}  mean rating ${mx.toFixed(0)}  ${slope.toFixed(3)} ZR/pt  ×${runsPerZR.toFixed(2)} = ${(slope * runsPerZR).toFixed(3)} runs per point per ${FULL_SEASON_INNINGS} inn  r=${r.toFixed(2)}`);
}
const out = {
  fitted: new Date().toISOString().slice(0, 10), files: used, fullSeasonInnings: FULL_SEASON_INNINGS,
  runsPerZR: +runsPerZR.toFixed(3), warFit: { n: war.n, r2: +war.r2.toFixed(3), wRAA: +war.beta[0].toFixed(3), baserunning: +war.beta[1].toFixed(3) },
  positions,
};
writeFileSync(join(__dirname, "../src/data/fielding.json"), JSON.stringify(out, null, 2) + "\n");
console.log("wrote src/data/fielding.json");
