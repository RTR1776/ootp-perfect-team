import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueWeekOf } from "./league-week";

test("a league export is keyed by the Sunday its season ends", () => {
  const on = (m: number, d: number) => leagueWeekOf(new Date(2026, m - 1, d, 21, 30));
  assert.equal(on(9, 23), "2026-09-27", "Wednesday, part-played");
  assert.equal(on(9, 26), "2026-09-27", "Saturday, part-played");
  assert.equal(on(9, 27), "2026-09-27", "Sunday, finished");
  assert.equal(on(9, 28), "2026-09-27", "Monday, the season that just ended");
  assert.equal(on(9, 29), "2026-10-04", "Tuesday, the next season");
  assert.equal(on(9, 30), "2026-10-04", "across a month end");
});
