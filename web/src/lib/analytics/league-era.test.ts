import { test } from "node:test";
import assert from "node:assert/strict";
import { fitEra, hitTotalsOf } from "./league-era";
import { eraTable } from "./runenv-view";
import { rateLine, solveEnv } from "./run-env";

/** A season's hitter totals that sit exactly on an era's baseline line. */
function totalsAt(year: string, pa = 180_000) {
  const e = eraTable[year];
  const l = rateLine(e.rates, solveEnv(e.rates, e.rg, null).RG);
  const ab = pa * 0.9;
  return { pa, ab, h: l.avg * ab, hr: l.hrPa * pa, k: l.kPct * pa };
}

test("a theme week's line fits its era, far from the 2010 norm", () => {
  for (const year of ["1959", "1989"]) {
    const fit = fitEra(totalsAt(year), "test")!;
    assert.equal(fit.year, year);
    assert.ok(fit.themed && fit.offNorm, `${year} should warn`);
  }
});

test("an ordinary line near 2010 is not off the norm, even when the fit is sharp", () => {
  for (const year of ["2010", "2013"]) {
    const fit = fitEra(totalsAt(year), "test")!;
    assert.equal(fit.offNorm, false, year);
  }
});

test("no plate appearances, no fit", () => {
  assert.equal(fitEra({ pa: 0, ab: 0, h: 0, hr: 0, k: 0 }, "test"), null);
});

test("hitter totals leave pitchers out", () => {
  const t = hitTotalsOf([
    { isPitcher: false, stats: { PA: 600, AB: 540, H: 150, HR: 30, K: 120 } },
    { isPitcher: true, stats: { PA: 3, AB: 3, H: 0, HR: 0, K: 3 } },
    { isPitcher: false, stats: { PA: 100 } },
  ]);
  assert.deepEqual(t, { pa: 700, ab: 540, h: 150, hr: 30, k: 120 });
});
