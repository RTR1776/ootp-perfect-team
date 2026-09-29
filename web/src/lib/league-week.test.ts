import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV_YEAR_MAX, ENV_YEAR_MIN, LEAGUE_ENV_YEAR, leagueWeekOf, parseEnvYear } from "./league-week";
import { eraFor, eraTable } from "./analytics/tournament-env";

test("a league export is keyed by the Sunday its season ends", () => {
  const on = (m: number, d: number) => leagueWeekOf(new Date(2026, m - 1, d, 21, 30));
  assert.equal(on(9, 23), "2026-09-27", "Wednesday, part-played");
  assert.equal(on(9, 26), "2026-09-27", "Saturday, part-played");
  assert.equal(on(9, 27), "2026-09-27", "Sunday, finished");
  assert.equal(on(9, 28), "2026-09-27", "Monday, the season that just ended");
  assert.equal(on(9, 29), "2026-10-04", "Tuesday, the next season");
  assert.equal(on(9, 30), "2026-10-04", "across a month end");
});

test("an env year is one the era table can price", () => {
  assert.equal(parseEnvYear("1989"), 1989);
  assert.equal(parseEnvYear(" 1959 "), 1959);
  assert.equal(parseEnvYear(String(LEAGUE_ENV_YEAR)), 2010);
  for (const bad of ["", "89", "19890", "1883", "2027", "0", "abcd", null, undefined]) assert.equal(parseEnvYear(bad), null, String(bad));
  // The range is the era table's, so every accepted year has rates to score in.
  const years = Object.keys(eraTable).map(Number).filter((y) => y > 0);
  assert.equal(Math.min(...years), ENV_YEAR_MIN);
  assert.equal(Math.max(...years), ENV_YEAR_MAX);
  for (let y = ENV_YEAR_MIN; y <= ENV_YEAR_MAX; y++) assert.ok(eraFor(y), `no era row for ${y}`);
});
