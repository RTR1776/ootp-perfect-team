import test from "node:test";
import assert from "node:assert/strict";
import { eventRosterArgs, type CatalogueEvent } from "./event-roster-args";

const base: CatalogueEvent = {
  id: 1, name: "Test", envYear: null, stadium: null, dh: true, ratingsMin: null, ratingsMax: null,
  cardYearMin: null, cardYearMax: null, series: null, isDraft: false, restrictions: null,
};
const flag = (args: string[], k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };

test("Daily Live Bronze reads as the flags it was built with by hand", () => {
  const r = eventRosterArgs({
    ...base, name: "Daily Live Bronze", envYear: 2010, stadium: "2026 Kauffman Stadium", ratingsMin: 40, ratingsMax: 69,
    series: "livebronzedaily", restrictions: { cardTypes: ["Live"], valueWindowFrom: "name: Bronze" },
  }, { seriesStale: false });
  assert.deepEqual(r.problems, []);
  assert.deepEqual([flag(r.args, "year"), flag(r.args, "park"), flag(r.args, "park-year"), flag(r.args, "min"), flag(r.args, "max")], ["2010", "Kauffman Stadium", "2026", "40", "69"]);
  assert.ok(r.args.includes("--dh"));
  assert.equal(flag(r.args, "card-types"), "1");
  assert.deepEqual([flag(r.args, "card-year-min"), flag(r.args, "card-year-max")], ["2026", "2026"], "Live cards are this season's");
  assert.equal(flag(r.args, "series"), "livebronzedaily");
  assert.equal(flag(r.args, "size"), "26");
});

test("Friday Nightmare Cap's 10-02 rules: cap, variant cap, No LE, no DH, old exports left out", () => {
  const r = eventRosterArgs({
    ...base, name: "Friday Nightmare Cap", envYear: 1971, stadium: "1970 County Stadium", dh: false, ratingsMin: 65, ratingsMax: 79,
    series: "nightmarecap", restrictions: { teamCap: 1805, variantCap: 6, noLimitedEdition: true, cards: 26, formatSince: "2026-10-02" },
  }, { seriesStale: true });
  assert.deepEqual(r.problems, []);
  assert.ok(!r.args.includes("--dh"));
  assert.deepEqual([flag(r.args, "cap"), flag(r.args, "variant-cap"), flag(r.args, "obs-exclude")], ["1805", "6", "nightmarecap"]);
  assert.ok(r.args.includes("--no-le"));
  assert.equal(flag(r.args, "series"), undefined);
});

test("slots, no variants, card years, and a PT-default event in no park", () => {
  const r = eventRosterArgs({
    ...base, cardYearMin: 1910, cardYearMax: 1959,
    restrictions: { slots: { I: 5, B: 5, S: 4, G: 4, D: 4, P: 4 }, variantsAllowed: false, notes: ["default RE"] },
  }, { seriesStale: false });
  assert.equal(flag(r.args, "slots"), "P4,D4,G4,S4,B5,I5");
  assert.equal(flag(r.args, "variant-cap"), "0");
  assert.deepEqual([flag(r.args, "card-year-min"), flag(r.args, "card-year-max"), flag(r.args, "year")], ["1910", "1959", "2010"]);
  assert.equal(flag(r.args, "park"), undefined);
  assert.ok(r.notes.some((n) => n.startsWith("neutral park")));
});

test("a rule the flags can't carry stops the event: unknown DH, an unreadable set rule, a draft", () => {
  assert.ok(eventRosterArgs({ ...base, dh: null }, { seriesStale: false }).problems.includes("DH rule not on file"));
  assert.ok(eventRosterArgs({ ...base, restrictions: { cardTypes: ["Mystery Set"] } }, { seriesStale: false }).problems.some((p) => p.startsWith("card-set rule")));
  assert.ok(eventRosterArgs({ ...base, isDraft: true }, { seriesStale: false }).problems.includes("a draft"));
});
