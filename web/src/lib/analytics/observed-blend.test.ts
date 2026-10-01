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
  assert.equal(gold.n, 1000, "the Bronze play is left out of a Gold event");
  assert.ok(Math.abs(gold.runs) < 1e-9);
  assert.equal(bronze.n, 2000, "a Bronze event keeps play against stronger fields");
});
