import { test } from "node:test";
import assert from "node:assert/strict";
import { envFitMaps } from "./env-fit";
import { armEraSpread, armRatingFix, eraBand, eraCorrectionPerPoint, powerCurveRuns } from "./calibration";
import { FIELDING_CALIBRATION, FIELDING_FIT, fieldingRuns } from "./fielding";
import { eraTable } from "./tournament-env";

const bat = (id: number, over: Record<string, number>) => {
  const r: Record<string, number> = {};
  for (const k of ["Avoid Ks", "Eye", "Power", "Gap", "BABIP"]) for (const s of ["", " vL", " vR"]) r[(s ? k.replace("Avoid Ks", "Avoid K") : k) + s] = 110;
  for (const [k, v] of Object.entries(over)) { r[k] = v; r[k.replace("Avoid Ks", "Avoid K") + " vL"] = v; r[k.replace("Avoid Ks", "Avoid K") + " vR"] = v; }
  return { cardId: id, isPitcher: false, bats: "R", ratings: r };
};

test("the era correction pays BABIP what play returned, leaves an average card alone, and widens arms only by the era spread", () => {
  const era = eraTable["1975"] ?? eraTable["0"];
  const pool = [bat(1, { BABIP: 150 }), bat(2, { Power: 150 }), bat(3, {}), { cardId: 4, isPitcher: true, bats: null, role: "SP", ratings: { Stuff: 120, Control: 120, pHR: 120, pBABIP: 120, "Stuff vL": 120, "Control vL": 120, "pHR vL": 120, "pBABIP vL": 120, "Stuff vR": 120, "Control vR": 120, "pHR vR": 120, "pBABIP vR": 120 } }];
  const plain = envFitMaps(pool, { era: era.rates, park: null });
  const fixed = envFitMaps(pool, { era: era.rates, park: null, eraYear: 1975 });
  const gain = (id: number) => fixed.runsR.get(id)! - plain.runsR.get(id)!;
  assert.ok(gain(1) > 2, `BABIP card gains ${gain(1)}`);
  assert.ok(gain(1) > gain(2), "BABIP is the under-priced rating in 1961-76 play");
  assert.ok(Math.abs(gain(3)) < 1e-9, "an average card is the zero");
  assert.ok(Math.abs(fixed.runsR.get(4)! - (armEraSpread(1975) * plain.runsR.get(4)! + armRatingFix(1975, pool[3].ratings))) < 1e-9, "arms get the era spread and the rating fix, nothing else");
  assert.ok(armRatingFix(1975, pool[3].ratings) > 0, "a 120 Stuff / 120 pHR arm gains in 1975");
  assert.equal(armRatingFix(1975, { Stuff: 92, pHR: 100 }), 0, "an average arm is the zero");
  assert.equal(armRatingFix(null, pool[3].ratings), 0);
  assert.equal(armEraSpread(1975), 1.5);
  assert.equal(armEraSpread(1985), 1.3);
  assert.equal(armEraSpread(2010), 1);
  assert.equal(armEraSpread(1930), 1);
  assert.equal(armEraSpread(null), 1);
  assert.equal(eraBand(1975)?.band, "Expansion");
  assert.equal(eraBand(null), null);
  const pp = eraCorrectionPerPoint(1975, { Power: 1.58, BABIP: 1.06 })!;
  assert.ok(Math.abs(pp.BABIP - 0.099) < 1e-3 && Math.abs(pp.Power - 0.055) < 1e-3);
  const off = envFitMaps(pool, { era: era.rates, park: null, eraYear: 1975, calibrate: false });
  assert.equal(off.runsR.get(1), envFitMaps(pool, { era: era.rates, park: null, calibrate: false }).runsR.get(1), "calibrate:false switches the correction off too");
});

test("observed play moves a variant by the base card's deviation, not back to the base card's level", () => {
  const era = eraTable["2010"] ?? eraTable["0"];
  const base = bat(10, { Power: 120, Eye: 115 });
  const variant = { ...bat(10, { Power: 129, Eye: 124 }) }; // same card id, the owned variant's ratings
  const plainBase = envFitMaps([base], { era: era.rates, park: null });
  const plainVar = envFitMaps([variant], { era: era.rates, park: null });
  const both = (f: typeof plainBase) => 0.7 * f.runsR.get(10)! + 0.3 * f.runsL.get(10)!;
  const model = both(plainBase);
  const boost = both(plainVar) - model;
  assert.ok(boost > 1, `a +9 Power / +9 Eye variant is worth runs (${boost.toFixed(2)})`);

  // 50,000 PA of play, 4 runs better than the base card's ratings say.
  const obs = { runs: model + 4, n: 50_000 };
  const w = obs.n / (obs.n + 5000);

  // Base card: with or without the reference, the same shift as the old level blend.
  const old = (obs.n * obs.runs + 5000 * model) / (obs.n + 5000);
  const b1 = envFitMaps([base], { era: era.rates, park: null, observed: new Map([[10, obs]]) });
  const b2 = envFitMaps([base], { era: era.rates, park: null, observed: new Map([[10, { ...obs, model }]]) });
  assert.ok(Math.abs(both(b1) - old) < 1e-9 && Math.abs(both(b2) - old) < 1e-9, "base card unchanged");

  // Variant: its own model plus the base card's +4, weighted. The level blend kept only (1 - w) of the boost.
  const v = envFitMaps([variant], { era: era.rates, park: null, observed: new Map([[10, { ...obs, model }]]) });
  assert.ok(Math.abs(both(v) - (model + boost + w * 4)) < 1e-9, "variant keeps its boost");
  const vOld = envFitMaps([variant], { era: era.rates, park: null, observed: new Map([[10, obs]]) });
  assert.ok(Math.abs(both(vOld) - (model + (1 - w) * boost + w * 4)) < 1e-9, "without the reference, the level blend (the old behaviour)");
});

test("Power's log curve: more for big power, less for none, nothing in deadball or for an average card", () => {
  const pool = [bat(1, { Power: 220 }), bat(2, { Power: 1 }), bat(3, {})];
  const era = eraTable["2010"] ?? eraTable["0"];
  const plain = envFitMaps(pool, { era: era.rates, park: null, eraYear: 2010 });
  assert.ok(Math.abs(powerCurveRuns(2010, 220) - 3.8 * Math.log(2)) < 1e-9);
  assert.equal(powerCurveRuns(2010, 1), powerCurveRuns(2010, 20), "floored at 20");
  assert.equal(powerCurveRuns(1915, 220), 0, "deadball is left alone");
  assert.equal(powerCurveRuns(2010, 110), 0);
  assert.equal(powerCurveRuns(null, 220), 0);
  const lin = (id: number) => plain.runsR.get(id)!;
  assert.ok(lin(1) - lin(3) > powerCurveRuns(2010, 220) - 1e-9, "the curve adds to what the era line already pays");
});

test("glove runs carry the per-position calibration, and first base is left alone", () => {
  const cf = FIELDING_FIT.positions.CF;
  const raw = (cf.mean + 20 - cf.mean) * cf.slope * FIELDING_FIT.runsPerZR;
  assert.ok(Math.abs(fieldingRuns("CF", cf.mean + 20) - raw * FIELDING_CALIBRATION.CF) < 1e-9);
  assert.equal(FIELDING_CALIBRATION["1B"], 1);
  assert.equal(fieldingRuns("CF", cf.mean), 0, "the field mean is still the zero");
});

test("team weights: gloves and pitching against a bat run, by era", async () => {
  const { teamWeights } = await import("./calibration");
  assert.deepEqual(teamWeights(1970), { def: 3, pit: 2.5 });
  assert.deepEqual(teamWeights(1985), { def: 3, pit: 2 });
  assert.deepEqual(teamWeights(2000), { def: 1.5, pit: 1.5 });
  assert.deepEqual(teamWeights(2010), { def: 3, pit: 2.5 });
  assert.deepEqual(teamWeights(1920), { def: 2, pit: 2 });
  assert.deepEqual(teamWeights(null), teamWeights(2010));
});
