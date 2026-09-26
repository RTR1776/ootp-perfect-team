import { test } from "node:test";
import assert from "node:assert/strict";
import { dataConfidence } from "./data-confidence";

const base = { seriesFiles: 3, seriesTeams: 120, poolSize: 1000, poolWithPlay: 980, poolMedianN: 1500, eraBand: { band: "Expansion", series: 5 }, envYearKnown: true, parkOnFile: true };

test("a well-exported event with a played-out pool reads good; no exports and a thin era read slim", () => {
  assert.equal(dataConfidence(base).level, "good");
  assert.equal(dataConfidence({ ...base, seriesFiles: 0 }).level, "fair");
  assert.equal(dataConfidence({ ...base, seriesFiles: 0, eraBand: { band: "Live Ball", series: 3 } }).level, "fair");
  assert.equal(dataConfidence({ ...base, seriesFiles: 0, eraBand: { band: "Deadball", series: 2 } }).level, "slim");
  assert.equal(dataConfidence({ ...base, poolWithPlay: 300, poolMedianN: 60 }).level, "slim");
  assert.equal(dataConfidence({ ...base, parkOnFile: false }).level, "fair");
  // a two-team sliver does not count as an export
  assert.equal(dataConfidence({ ...base, seriesFiles: 1, seriesTeams: 2 }).points[0].level, "slim");
  const c = dataConfidence({ ...base, seriesFiles: 0 });
  assert.equal(c.points[0].short, "no data");
  // the era is not listed; the park only when its factors are missing
  assert.equal(c.points.length, 2);
  assert.equal(dataConfidence({ ...base, parkOnFile: false }).points.length, 3);
});
