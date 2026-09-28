import { test } from "node:test";
import assert from "node:assert/strict";
import { describePosFloor, LJ_FLOOR, parsePosFloor, posFloorAt } from "./pos-floor";

test("L.J.'s floor: 60 at every position, none at DH", () => {
  assert.equal(posFloorAt(LJ_FLOOR, "C"), 60);
  assert.equal(posFloorAt(LJ_FLOOR, "SS"), 60);
  assert.equal(posFloorAt(LJ_FLOOR, "LF"), 60);
  assert.equal(posFloorAt(LJ_FLOOR, "1B"), 60);
  assert.equal(posFloorAt(LJ_FLOOR, "DH"), 0);
  assert.equal(posFloorAt(null, "C"), 0);
  assert.equal(posFloorAt(60, "CF"), 60, "a plain number is the floor everywhere…");
  assert.equal(posFloorAt(60, "1B"), 0, "…but first base");
});

test("the flag form reads back into the same floor", () => {
  assert.deepEqual(parsePosFloor("70,1B:0,LF:50"), { default: 70, "1B": 0, LF: 50 });
  assert.deepEqual(parsePosFloor("60,1B:60"), { default: 60, "1B": 60 });
  assert.equal(parsePosFloor("70"), 70);
  assert.equal(parsePosFloor(""), null);
  assert.throws(() => parsePosFloor("70,LF:x"));
});

test("the floor in words", () => {
  assert.equal(describePosFloor(LJ_FLOOR), "60");
  assert.equal(describePosFloor({ default: 70, "1B": 0, LF: 50 }), "70; LF 50; none at 1B");
  assert.equal(describePosFloor(70), "70; none at 1B");
  assert.equal(describePosFloor({ LF: 50 }), "none; LF 50");
  assert.equal(describePosFloor(null), "none");
});
