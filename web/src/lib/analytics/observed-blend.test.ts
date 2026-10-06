import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldFloor, observedRunsFrom, type ObservedBook } from "./observed-blend";

// One bat, 1000 PA in a Bronze field (66) at +.050 wOBA, 1000 PA in a Gold field (86) at +.000.
const book: ObservedBook = {
  lines: [
    { card_id: 1, series: "bronze", is_pitcher: false, pa: 1000, woba: 0.37, ip: 0, fip: null, bf: 0 },
    { card_id: 1, series: "gold", is_pitcher: false, pa: 1000, woba: 0.32, ip: 0, fip: null, bf: 0 },
  ] as never,
  base: new Map([["bronze", { woba: 0.32, fip: 4 }], ["gold", { woba: 0.32, fip: 4 }]]),
  played: [
    { card_id: 1, series: "bronze", is_pitcher: false, pa: 1000, bf: 0 },
    { card_id: 1, series: "gold", is_pitcher: false, pa: 1000, bf: 0 },
  ] as never,
  strength: new Map([["bronze", 66], ["gold", 86]]),
};
const model = () => 0;

test("a Gold event counts only play against fields near its own strength", () => {
  assert.equal(fieldFloor(book, { series: "gold", ratingsMax: 89 }), 78, "own series strength less 8");
  assert.equal(fieldFloor(book, { series: null, ratingsMax: 89 }), 78, "else the ceiling less 3, less 8");
  assert.equal(fieldFloor(book, {}), null);
  const all = observedRunsFrom(book, model)!.get(1)!;
  const gold = observedRunsFrom(book, model, undefined, { series: "gold", ratingsMax: 89 }).get(1)!;
  const bronze = observedRunsFrom(book, model, undefined, { series: "bronze", ratingsMax: 69 }).get(1)!;
  assert.equal(all.n, 2000);
  assert.ok(all.runs > 10, "the Bronze field's +.050 lifts the pooled line");
  assert.equal(gold.n, 0, "the Bronze play is left out of a Gold event, and the Gold play is its own");
  assert.equal(gold.own?.n, 1000);
  assert.ok(Math.abs(gold.own!.runs) < 1e-9);
  assert.equal(bronze.n, 1000, "a Bronze event keeps play against stronger fields, apart from its own");
  assert.equal(bronze.own?.n, 1000);
});

test("the event's own play is blended on top with OBS_K_OWN, after the other events' line", async () => {
  const { envFitMaps } = await import("./env-fit");
  const { OBS_K_OWN, OBS_K_DEFAULT } = await import("./calibration");
  const r: Record<string, number> = {};
  for (const k of ["Avoid K", "Eye", "Power", "Gap", "BABIP"]) for (const sfx of ["", " vL", " vR"]) r[(sfx ? k : k === "Avoid K" ? "Avoid Ks" : k) + sfx] = 110;
  const card = { cardId: 7, isPitcher: false, bats: "R", ratings: r };
  const { eraTable } = await import("./tournament-env");
  const era = (eraTable["2010"] ?? eraTable["0"]).rates;
  const plain = envFitMaps([card], { era, park: null });
  const base = 0.7 * plain.runsR.get(7)! + 0.3 * plain.runsL.get(7)!;
  const fit = (o: { runs: number; n: number; own?: { runs: number; n: number } | null }) => {
    const f = envFitMaps([card], { era, park: null, observed: new Map([[7, { ...o, model: base }]]) });
    return 0.7 * f.runsR.get(7)! + 0.3 * f.runsL.get(7)! - base;
  };
  const elsewhere = 10, n = 5000;
  const g = (n / (n + OBS_K_DEFAULT)) * elsewhere;
  assert.ok(Math.abs(fit({ runs: base + elsewhere, n }) - g) < 1e-6, "no own line: the old blend");
  const own = { runs: base - 20, n: 2500 };
  const want = g + (own.n / (own.n + OBS_K_OWN)) * (own.runs - (base + g));
  assert.ok(Math.abs(fit({ runs: base + elsewhere, n, own }) - want) < 1e-6, `own line on top: ${fit({ runs: base + elsewhere, n, own })} vs ${want}`);
  assert.ok(Math.abs(fit({ runs: 0, n: 0, own }) - (own.n / (own.n + OBS_K_OWN)) * (own.runs - base)) < 1e-6, "own line alone");
});
