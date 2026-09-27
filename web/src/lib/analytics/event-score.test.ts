import { test } from "node:test";
import assert from "node:assert/strict";
import { tournamentEraYear } from "./event-score";

test("the PT default reads as no era year, however the catalogue spells it", () => {
  assert.equal(tournamentEraYear({ envYear: 2010 }), null, "databotai's label for the PT default");
  assert.equal(tournamentEraYear({ envYear: null, restrictions: { notes: ["default RE"] } }), null);
  assert.equal(tournamentEraYear({ envYear: null }), null);
  assert.equal(tournamentEraYear({ envYear: 1992 }), 1992);
  assert.equal(tournamentEraYear({ envYear: 1987, restrictions: { notes: ["default RE"] } }), 1987, "a stated year wins");
});
