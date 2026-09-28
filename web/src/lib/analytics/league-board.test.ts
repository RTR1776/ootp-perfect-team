import { test } from "node:test";
import assert from "node:assert/strict";
import { hitterQual, pitcherQual } from "./league-board";

test("one week's scope qualifies nothing under L.J.'s 500 PA / 400 IP floors", () => {
  assert.equal(pitcherQual("SP", "all", 1), 400);
  assert.equal(pitcherQual("SP", "vL", 1), 200, "a side is half a pitcher's line");
  assert.equal(hitterQual("all", 1), 500);
  assert.equal(hitterQual("vL", 1), 167, "a side's floor is its share of a whole line");
  assert.equal(hitterQual("vR", 1), 333);
});

test("longer scopes keep their larger per-week thresholds; relievers keep theirs", () => {
  assert.equal(pitcherQual("SP", "all", 10), 1000);
  assert.equal(pitcherQual("SP", "vR", 10), 500);
  assert.equal(hitterQual("all", 4), 1200);
  assert.equal(pitcherQual("RP", "all", 1), 30);
  assert.equal(pitcherQual("RP", "vL", 3), 45);
});
