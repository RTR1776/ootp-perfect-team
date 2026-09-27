import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_LIMIT, initHistory, pushHistory, redoHistory, redoLabel, sealHistory, undoHistory, undoLabel } from "./use-undoable";

const team = initHistory<string[]>(["Ott", "Wood", "Bailey"]);

test("undo and redo walk the history, and say what they will do", () => {
  let h = pushHistory(team, ["Wood", "Bailey"], { label: "Remove Mel Ott" });
  h = pushHistory(h, ["Wood"], { label: "Remove Ed Bailey" });
  assert.equal(undoLabel(h), "Remove Ed Bailey");
  h = undoHistory(h);
  assert.deepEqual(h.present, ["Wood", "Bailey"]);
  assert.equal(undoLabel(h), "Remove Mel Ott");
  assert.equal(redoLabel(h), "Remove Ed Bailey");
  h = undoHistory(h);
  assert.deepEqual(h.present, ["Ott", "Wood", "Bailey"]);
  assert.equal(undoLabel(h), null);
  assert.equal(undoHistory(h), h, "nothing left to undo");
  h = redoHistory(redoHistory(h));
  assert.deepEqual(h.present, ["Wood"]);
  assert.equal(redoHistory(h), h, "nothing left to redo");
});

test("a new edit clears redo", () => {
  let h = pushHistory(team, ["Wood", "Bailey"], { label: "Remove Mel Ott" });
  h = undoHistory(h);
  h = pushHistory(h, ["Ott", "Wood", "Bailey", "Soto"], { label: "Add Juan Soto" });
  assert.equal(redoLabel(h), null);
  assert.equal(undoLabel(h), "Add Juan Soto");
});

test("typing into one field is one step until it is sealed", () => {
  let h = initHistory({ power: 150 });
  h = pushHistory(h, { power: 1 }, { label: "Power vR", coalesceKey: "power" });
  h = pushHistory(h, { power: 16 }, { label: "Power vR", coalesceKey: "power" });
  h = pushHistory(h, { power: 160 }, { label: "Power vR", coalesceKey: "power" });
  assert.equal(h.past.length, 1);
  assert.deepEqual(undoHistory(h).present, { power: 150 });
  h = sealHistory(h);
  h = pushHistory(h, { power: 165 }, { label: "Power vR", coalesceKey: "power" });
  assert.equal(h.past.length, 2, "after blur the next edit is its own step");
  assert.deepEqual(undoHistory(h).present, { power: 160 });
});

test("an action that changes nothing is not a step, and history is capped", () => {
  const same = team.present;
  assert.equal(pushHistory(team, same, { label: "no-op" }), team);
  let h = initHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = pushHistory(h, i, { label: `set ${i}` });
  assert.equal(h.past.length, HISTORY_LIMIT);
  assert.equal(h.present, HISTORY_LIMIT + 10);
});
