import { test } from "node:test";
import assert from "node:assert/strict";
import { envFitMaps } from "./env-fit";
import { eraBand, eraCorrectionPerPoint } from "./calibration";
import { eraTable } from "./tournament-env";

const bat = (id: number, over: Record<string, number>) => {
  const r: Record<string, number> = {};
  for (const k of ["Avoid Ks", "Eye", "Power", "Gap", "BABIP"]) for (const s of ["", " vL", " vR"]) r[(s ? k.replace("Avoid Ks", "Avoid K") : k) + s] = 110;
  for (const [k, v] of Object.entries(over)) { r[k] = v; r[k.replace("Avoid Ks", "Avoid K") + " vL"] = v; r[k.replace("Avoid Ks", "Avoid K") + " vR"] = v; }
  return { cardId: id, isPitcher: false, bats: "R", ratings: r };
};

test("the era correction pays BABIP what play returned, and leaves an average card and every arm alone", () => {
  const era = eraTable["1975"] ?? eraTable["0"];
  const pool = [bat(1, { BABIP: 150 }), bat(2, { Power: 150 }), bat(3, {}), { cardId: 4, isPitcher: true, bats: null, role: "SP", ratings: { Stuff: 120, Control: 120, pHR: 120, pBABIP: 120, "Stuff vL": 120, "Control vL": 120, "pHR vL": 120, "pBABIP vL": 120, "Stuff vR": 120, "Control vR": 120, "pHR vR": 120, "pBABIP vR": 120 } }];
  const plain = envFitMaps(pool, { era: era.rates, park: null });
  const fixed = envFitMaps(pool, { era: era.rates, park: null, eraYear: 1975 });
  const gain = (id: number) => fixed.runsR.get(id)! - plain.runsR.get(id)!;
  assert.ok(gain(1) > 2, `BABIP card gains ${gain(1)}`);
  assert.ok(gain(1) > gain(2), "BABIP is the under-priced rating in 1961-76 play");
  assert.ok(Math.abs(gain(3)) < 1e-9, "an average card is the zero");
  assert.ok(Math.abs(gain(4)) < 1e-9, "arms are not corrected");
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
