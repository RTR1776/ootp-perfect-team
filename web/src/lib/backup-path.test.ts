import { test } from "node:test";
import assert from "node:assert/strict";
import { freeBackupPath } from "./backup-path";

test("a second backup on a day keeps the day in its name", () => {
  const taken = new Set<string>();
  const exists = (p: string) => taken.has(p);
  const first = "Docs/Archive/saved-rosters-2026-11-12.json.gz";
  assert.equal(freeBackupPath(first, exists), first);
  taken.add(first);
  // Not saved-rosters-2026-11-2.json.gz: the suffix must not eat the day.
  assert.equal(freeBackupPath(first, exists), "Docs/Archive/saved-rosters-2026-11-12-2.json.gz");
  taken.add("Docs/Archive/saved-rosters-2026-11-12-2.json.gz");
  assert.equal(freeBackupPath(first, exists), "Docs/Archive/saved-rosters-2026-11-12-3.json.gz");
});

test("a name given with --out is treated the same way", () => {
  const taken = new Set(["x/before-rebuild.json.gz", "x/notes.json"]);
  const exists = (p: string) => taken.has(p);
  assert.equal(freeBackupPath("x/before-rebuild.json.gz", exists), "x/before-rebuild-2.json.gz");
  assert.equal(freeBackupPath("x/notes.json", exists), "x/notes-2.json");
  assert.equal(freeBackupPath("x/free.json.gz", exists), "x/free.json.gz");
});
