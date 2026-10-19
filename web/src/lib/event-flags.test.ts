import { test } from "node:test";
import assert from "node:assert/strict";
import { eventRules, readEventFlags } from "./event-flags";
import { LJ_FLOOR } from "./pos-floor";

test("defaults are env-roster's: full role trust, two catchers and long men, backups on, the whole pool", () => {
  const f = readEventFlags([]);
  assert.equal(f.roleTrust, 1);
  assert.equal(f.minCatchers, 2);
  assert.equal(f.minLongMen, 2);
  assert.equal(f.minShortstops, 0);
  assert.equal(f.backups, true);
  assert.equal(f.candidateLimit, null);
  assert.equal(f.minPos, LJ_FLOOR);
  assert.equal(f.eraYear, 2010, "PT default reads as 2010");
  assert.equal(f.size, 26);
});

test("the Monday Wonky flags reach the rules: slot tiers, card years, value window", () => {
  const f = readEventFlags(["--year", "2009", "--min", "40", "--max", "99", "--card-year-min", "1800", "--card-year-max", "1949",
    "--slots", "D13,S7,B6", "--role-trust", "0.25", "--sp", "5", "--rp", "7", "--bats", "14", "--no-team-weights", "--min-pos", "60,SS:85"]);
  assert.deepEqual(f.slots, { D: 13, S: 7, B: 6 });
  assert.equal(f.roleTrust, 0.25);
  assert.equal(f.noTeamWeights, true);
  assert.deepEqual([f.sp, f.rp, f.bats], [5, 7, 14]);
  const r = eventRules(f);
  assert.deepEqual(r.restrictions?.slots, { D: 13, S: 7, B: 6 });
  assert.equal(r.cardYearMax, 1949);
  assert.equal(r.ratingsMin, 40);
  assert.equal(f.eraYear, 2009);
  assert.equal(readEventFlags(["--no-era-correct"]).eraYear, null);
});

test("--slots refuses what it cannot read", () => {
  assert.throws(() => readEventFlags(["--slots", "X13"]), /could not read/);
});
