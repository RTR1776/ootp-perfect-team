import { test } from "node:test";
import assert from "node:assert/strict";
import { parkFor } from "./tournament-env";

test("catalogue park spellings resolve to the park the factor table files", () => {
  const gabp = parkFor("2026 Great American Ball Park");
  assert.equal(gabp.name, "Great American Ballpark");
  assert.equal(gabp.year, 2026);
  assert.ok((gabp.row?.hrL ?? 1) > 1.1, "a home-run park, not neutral");
  assert.equal(parkFor("2008 McAfee Coliseum").name, "McAfee Stadium");
  assert.equal(parkFor("2005 Minute Maid Park").name, "Daikin Park");
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
});
