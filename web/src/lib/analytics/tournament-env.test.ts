import { test } from "node:test";
import assert from "node:assert/strict";
import { parkFor } from "./tournament-env";

test("catalogue park spellings resolve to the park the factor table files", () => {
  const gabp = parkFor("2026 Great American Ball Park");
  assert.equal(gabp.name, "Great American Ballpark");
  assert.equal(gabp.year, 2026);
  assert.ok((gabp.row?.hrL ?? 1) > 1.1, "a home-run park, not neutral");
  assert.equal(parkFor("2008 McAfee Coliseum").name, "McAfee Stadium");
  const mmp = parkFor("2005 Minute Maid Park");
  assert.deepEqual([mmp.name, mmp.year, mmp.row?.hrR], ["Minute Maid Park", 2005, 1.12], "the 2005 park, not today's Daikin Park");
  assert.deepEqual([parkFor("2026 Minute Maid Park").name, parkFor("2026 Minute Maid Park").year], ["Daikin Park", 2026], "the alias has the exact year");
  // Between the two, the nearer year wins, as it does inside one park's rows.
  assert.equal(parkFor("2019 Minute Maid Park").name, "Daikin Park");
  assert.equal(parkFor("2012 Minute Maid Park").name, "Minute Maid Park");
  assert.equal(parkFor("Minute Maid Park").name, "Daikin Park", "no year: the park as it is now");
  assert.deepEqual([parkFor("2005 Minue Maid Park").name, parkFor("2005 Minue Maid Park").year], ["Minute Maid Park", 2005], "the old spelling still resolves");
  assert.equal(parkFor("Heinsohn Park").name, "Heinsohn Ballpark");
  assert.equal(parkFor("1908 Comisky Park").name, "Comiskey Park");
  // exact names still win over near misses
  assert.equal(parkFor("2026 PNC Park").name, "PNC Park");
  assert.equal(parkFor("2026 Truist Park").name, "Truist Park");
  // neutral by design, and unknown parks stay neutral rather than guessed
  assert.equal(parkFor("2025 Standard Stadium").row, null);
  assert.equal(parkFor("1890 Exposition Park").row, null);
});

test("the CLI's park lookup accepts the same spellings", async () => {
  const { parkRow } = await import("./runenv-view");
  assert.ok((parkRow("Great American Ball Park", 2026)?.hrL ?? 1) > 1.1);
  assert.equal(parkRow("Great American Ballpark", 2004)?.hrL, 1.087);
  assert.equal(parkRow("Standard Stadium", 2025), null);
  assert.equal(parkRow("Minute Maid Park", 2005)?.hrR, 1.12);
  assert.equal(parkRow("Minute Maid Park", 2026)?.hrR, parkRow("Daikin Park", 2026)?.hrR, "the CLI agrees with /build");
});
