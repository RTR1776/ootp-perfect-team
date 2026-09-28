import { test } from "node:test";
import assert from "node:assert/strict";
import { describePosFloor, LJ_FLOOR, parsePosFloor, posFloorAt } from "./pos-floor";

test("L.J.'s floor: 70 everywhere, 50 in left, none at first or DH", () => {
  assert.equal(posFloorAt(LJ_FLOOR, "C"), 70);
  assert.equal(posFloorAt(LJ_FLOOR, "SS"), 70);
  assert.equal(posFloorAt(LJ_FLOOR, "LF"), 50);
  assert.equal(posFloorAt(LJ_FLOOR, "1B"), 0);
  assert.equal(posFloorAt(LJ_FLOOR, "DH"), 0);
  assert.equal(posFloorAt(null, "C"), 0);
  assert.equal(posFloorAt(60, "CF"), 60, "a plain number is the floor everywhere…");
  assert.equal(posFloorAt(60, "1B"), 0, "…but first base");
});

test("the flag form reads back into the same floor", () => {
  assert.deepEqual(parsePosFloor("70,1B:0,LF:50"), LJ_FLOOR);
  assert.equal(parsePosFloor("70"), 70);
  assert.equal(parsePosFloor(""), null);
  assert.throws(() => parsePosFloor("70,LF:x"));
});

test("the floor in words", () => {
  assert.equal(describePosFloor(LJ_FLOOR), "70; LF 50; none at 1B");
  assert.equal(describePosFloor(70), "70; none at 1B");
  assert.equal(describePosFloor({ LF: 50 }), "none; LF 50");
  assert.equal(describePosFloor(null), "none");
});
