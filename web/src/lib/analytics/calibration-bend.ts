/**
 * Fitting the bend in the bat calibration (calibration.ts calibratedHitRuns).
 *
 * Each point is one card in one series: its raw model runs per 700 (absolute,
 * on the calibration frame), what it did above its field, and its PA. Both the
 * straight line and the bend are fitted within series (every column is
 * centred on its series' weighted mean), so a field's level cancels, exactly
 * as model:calibrate's slope is.
 */
export interface BendPoint { series: string; x: number; y: number; w: number }
export interface BendFit { at: number; below: number; above: number; rmse: number }

/** Columns centred on each series' weighted mean. */
function centred(points: readonly BendPoint[], cols: (p: BendPoint) => number[]): { X: number[][]; y: number[]; w: number[] } {
  const k = cols(points[0]).length;
  const sum = new Map<string, { w: number; x: number[]; y: number }>();
  for (const p of points) {
    const e = sum.get(p.series) ?? { w: 0, x: new Array(k).fill(0), y: 0 };
    const c = cols(p);
    e.w += p.w; e.y += p.w * p.y; for (let j = 0; j < k; j++) e.x[j] += p.w * c[j];
    sum.set(p.series, e);
  }
  const X: number[][] = [], y: number[] = [], w: number[] = [];
  for (const p of points) {
    const e = sum.get(p.series)!; const c = cols(p);
    X.push(c.map((v, j) => v - e.x[j] / e.w)); y.push(p.y - e.y / e.w); w.push(p.w);
  }
  return { X, y, w };
}

/** Weighted least squares on one or two centred columns (no intercept: everything is centred). */
function solve(X: number[][], y: number[], w: number[]): number[] {
  const k = X[0].length;
  if (k === 1) {
    let a = 0, b = 0; for (let i = 0; i < y.length; i++) { a += w[i] * X[i][0] * X[i][0]; b += w[i] * X[i][0] * y[i]; }
    return [a > 0 ? b / a : 0];
  }
  let a = 0, b = 0, c = 0, d = 0, e = 0;
  for (let i = 0; i < y.length; i++) {
    const [u, v] = X[i]; a += w[i] * u * u; b += w[i] * u * v; c += w[i] * v * v; d += w[i] * u * y[i]; e += w[i] * v * y[i];
  }
  const det = a * c - b * b;
  if (!(Math.abs(det) > 1e-9)) return [a > 0 ? d / a : 0, 0];
  return [(d * c - b * e) / det, (a * e - b * d) / det];
}

const rmseOf = (X: number[][], y: number[], w: number[], beta: number[]): number => {
  let ss = 0, sw = 0;
  for (let i = 0; i < y.length; i++) { let f = 0; for (let j = 0; j < beta.length; j++) f += beta[j] * X[i][j]; ss += w[i] * (y[i] - f) ** 2; sw += w[i]; }
  return Math.sqrt(ss / sw);
};

const lineCols = (p: BendPoint) => [p.x];
const bendCols = (at: number) => (p: BendPoint) => [p.x, Math.max(p.x - at, 0)];

export function fitLine(points: readonly BendPoint[]): { slope: number; rmse: number } {
  const { X, y, w } = centred(points, lineCols);
  const b = solve(X, y, w);
  return { slope: b[0], rmse: rmseOf(X, y, w, b) };
}

export function fitBend(points: readonly BendPoint[], at: number): BendFit {
  const { X, y, w } = centred(points, bendCols(at));
  const b = solve(X, y, w);
  return { at, below: b[0], above: b[0] + b[1], rmse: rmseOf(X, y, w, b) };
}

/**
 * Held out by series: fit both on a random half of the series, score both on
 * the other half, `splits` times. `better` counts the splits where the bend's
 * error is lower; `gain` is the mean drop in RMSE (runs per 700). Seeded, so a
 * rerun on the same lines gives the same count.
 */
export function heldOutBend(points: readonly BendPoint[], at: number, splits = 40, seed = 7): { better: number; of: number; gain: number } {
  const series = [...new Set(points.map((p) => p.series))].sort();
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  let better = 0, gain = 0, done = 0;
  for (let s = 0; s < splits; s++) {
    const order = [...series];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const train = new Set(order.slice(0, order.length >> 1));
    const a = points.filter((p) => train.has(p.series)), b = points.filter((p) => !train.has(p.series));
    if (a.length < 10 || b.length < 10) continue;
    const line = fitLine(a), bend = fitBend(a, at);
    const tl = centred(b, lineCols), tb = centred(b, bendCols(at));
    const el = rmseOf(tl.X, tl.y, tl.w, [line.slope]), eb = rmseOf(tb.X, tb.y, tb.w, [bend.below, bend.above - bend.below]);
    if (eb < el - 1e-12) better++;
    gain += el - eb; done++;
  }
  return { better, of: done, gain: done ? gain / done : 0 };
}
