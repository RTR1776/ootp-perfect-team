import { test } from "node:test";
import assert from "node:assert/strict";
import { fitBend, fitLine, heldOutBend, type BendPoint } from "./calibration-bend";
import { activeBend, calibratedHitRuns, type CalibrationSide } from "./calibration";

/** A deterministic field: `n` cards spread over raw runs, each series at its own level. */
function fields(truth: (x: number) => number, series = 24, n = 60): BendPoint[] {
  let s = 12345;
  const rand = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2 ** 32; };
  const out: BendPoint[] = [];
  for (let f = 0; f < series; f++) {
    const level = -20 + 60 * rand();
    for (let i = 0; i < n; i++) {
      const x = -30 + 90 * rand();
      out.push({ series: `s${f}`, x, y: truth(x) + level + 8 * (rand() - 0.5), w: 300 + Math.floor(3000 * rand()) });
    }
  }
  return out;
}

test("a bend in the data is recovered, and it holds out", () => {
  const pts = fields((x) => (x <= 16 ? 0.62 * x : 0.62 * 16 + 0.3 * (x - 16)));
  const b = fitBend(pts, 16);
  assert.ok(Math.abs(b.below - 0.62) < 0.02, `below ${b.below}`);
  assert.ok(Math.abs(b.above - 0.3) < 0.03, `above ${b.above}`);
  const line = fitLine(pts);
  assert.ok(line.slope > b.above && line.slope < b.below, "one slope lands between the two");
  assert.ok(b.rmse < line.rmse);
  const h = heldOutBend(pts, 16);
  assert.equal(h.of, 40);
  assert.ok(h.better >= 38, `better in ${h.better}/40`);
  assert.deepEqual(heldOutBend(pts, 16), h, "seeded: the same lines give the same count");
});

test("straight data gives two equal slopes and no steady held-out win", () => {
  const pts = fields((x) => 0.5 * x);
  const b = fitBend(pts, 16);
  assert.ok(Math.abs(b.below - 0.5) < 0.02 && Math.abs(b.above - 0.5) < 0.03, `${b.below} / ${b.above}`);
  assert.ok(heldOutBend(pts, 16).better < 30);
});

test("calibratedHitRuns: the straight slope until a bend is switched on, then two slopes joined at the knee", () => {
  const side: CalibrationSide = { slope: 0.5, intercept: 0, applied: true };
  assert.equal(calibratedHitRuns(40, side), 20);
  const off: CalibrationSide = { ...side, bend: { at: 16, below: 0.6, above: 0.3, applied: false } };
  assert.equal(activeBend(off), null);
  assert.equal(calibratedHitRuns(40, off), 20, "recorded, not applied");
  const on: CalibrationSide = { ...side, bend: { at: 16, below: 0.6, above: 0.3, applied: true } };
  assert.ok(Math.abs(calibratedHitRuns(10, on) - 6) < 1e-12);
  assert.ok(Math.abs(calibratedHitRuns(16, on) - 9.6) < 1e-12);
  assert.ok(Math.abs(calibratedHitRuns(40, on) - (9.6 + 0.3 * 24)) < 1e-12);
  assert.ok(Math.abs(calibratedHitRuns(-20, on) + 12) < 1e-12, "below the knee is one line through zero");
  // A bend that would pay more above the knee than below it, or a broken one, is ignored.
  assert.equal(activeBend({ ...side, bend: { at: 16, below: 0.3, above: 0.6, applied: true } }), null);
  assert.equal(activeBend({ ...side, bend: { at: 16, below: Number.NaN, above: 0.3, applied: true } }), null);
  assert.equal(calibratedHitRuns(40, { slope: 0.9, intercept: 0, applied: false }), 40, "a recorded-only slope is 1");
});
