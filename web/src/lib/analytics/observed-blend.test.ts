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

test("ownSeriesOnly reads only the event's own series", () => {
  const own = observedRunsFrom(book, model, undefined, { series: "bronze", ratingsMax: 69, ownSeriesOnly: true }).get(1)!;
  assert.equal(own.n, 1000, "the Gold play is left out");
  assert.ok(Math.abs(own.runs - (0.05 / 1.25) * 700) < 1e-6);
  assert.equal(observedRunsFrom(book, model, undefined, { series: "silver", ownSeriesOnly: true }).size, 0, "no play in its own series, no line");
});

test("an own-series read uses the age-weighted line when the row has by_day", () => {
  // 1000 PA at +.050 a month ago (weight 0.5) and 1000 PA level with the field today.
  const aged: ObservedBook = {
    ...book,
    lines: [
      { card_id: 1, series: "gold", is_pitcher: false, pa: 2000, woba: 0.345, ip: 0, fip: null, bf: 0, dw: 1500, ddev: 0.5 * (0.05 / 1.25) * 1000 },
      { card_id: 2, series: "gold", is_pitcher: false, pa: 1000, woba: 0.37, ip: 0, fip: null, bf: 0, dw: null, ddev: null },
    ] as never,
    played: [
      { card_id: 1, series: "gold", is_pitcher: false, pa: 2000, bf: 0, dw: 1500 },
      { card_id: 2, series: "gold", is_pitcher: false, pa: 1000, bf: 0, dw: null },
    ] as never,
  };
  const ev = { series: "gold", ratingsMax: 89, ownSeriesOnly: true };
  const a = observedRunsFrom(aged, model, undefined, ev).get(1)!;
  assert.equal(a.n, 1500, "the sample shrinks with age");
  assert.ok(Math.abs(a.runs - (20 / 1500) * 700) < 1e-6, "the old +.050 counts at half weight");
  const b = observedRunsFrom(aged, model, undefined, ev).get(2)!;
  assert.equal(b.n, 1000, "a row from before by_day reads whole");
  const whole = observedRunsFrom(aged, model, undefined, { series: "gold", ratingsMax: 89 }).get(1)!;
  assert.equal(whole.n, 2000, "a read that isn't own-series ignores age");
});
