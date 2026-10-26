import test from "node:test";
import assert from "node:assert/strict";
import { assumedVariantRatings, VARIANT_BOOST } from "./card-forms";

test("an assumed variant scales the split ratings ×1.08 and carries Contact; positions stay the base card's", () => {
  const base = {
    "Power vR": 50, "Power vL": 40, "Eye vR": 100, "BABIP vR": 80, "BABIP vL": 70, "Avoid K vR": 60, "Avoid K vL": 50,
    "Contact vR": 75, "Contact vL": 65, "Stuff vR": 90, "Pos Rating SS": 80, Speed: 70,
  };
  const v = assumedVariantRatings(base);
  assert.equal(VARIANT_BOOST, 1.08);
  assert.equal(v["Power vR"], 54);
  assert.equal(v["Power vL"], 43);
  assert.equal(v["Eye vR"], 108);
  assert.equal(v["Stuff vR"], 97);
  // Contact rebuilt from the BABIP (+6) and Avoid K (+5) deltas.
  assert.equal(v["Contact vR"], Math.round(75 + 0.5702 * 6 + 0.4733 * 5));
  assert.equal(v["Pos Rating SS"], 80);
  assert.equal(v.Speed, 70);
});
