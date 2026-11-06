import { test } from "node:test";
import assert from "node:assert/strict";
import { filedState } from "./export-filed";

test("the newest batch for a series decides; a file it dropped is 'removed'", () => {
  const { filed, redo } = filedState([
    { id: 1, scope: ["goldfather"], files: [{ name: "goldfather_226.csv" }, { name: "goldfather_235.csv" }] },
    { id: 2, scope: ["goldfather"], files: [{ name: "goldfather_226.csv" }] },
  ]);
  assert.ok(filed.has("goldfather_226"));
  assert.ok(!filed.has("goldfather_235"));
  assert.equal(redo.get("goldfather_235"), "removed");
});

test("a file the newest batch marks noStats needs exporting again", () => {
  const { filed, redo } = filedState([
    { id: 7, scope: ["latesilver"], files: [{ name: "latesilver_235.csv" }, { name: "latesilver_236.csv", noStats: true }] },
  ]);
  assert.ok(filed.has("latesilver_235"));
  assert.equal(redo.get("latesilver_236"), "no-stats");
});

test("a re-export filed later clears the flag", () => {
  const { filed, redo } = filedState([
    { id: 7, scope: ["latesilver"], files: [{ name: "latesilver_236.csv", noStats: true }] },
    { id: 9, scope: ["latesilver"], files: [{ name: "latesilver_236.csv" }] },
  ]);
  assert.ok(filed.has("latesilver_236"));
  assert.equal(redo.size, 0);
});

test("other series' batches don't touch a series", () => {
  const { filed } = filedState([
    { id: 1, scope: ["goldfather"], files: [{ name: "goldfather_235.csv" }] },
    { id: 2, scope: ["latesilver"], files: [{ name: "latesilver_236.csv" }] },
  ]);
  assert.ok(filed.has("goldfather_235"));
  assert.ok(filed.has("latesilver_236"));
});
