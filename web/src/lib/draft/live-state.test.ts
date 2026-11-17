import test from "node:test";
import assert from "node:assert/strict";
import { freshDraft, withPick } from "./live-state";

test("a round that keeps 2: the pack stays up after the first pick and clears after the second", () => {
  const s0 = { ...freshDraft(12), pack: [1, 2, 3, 4], round: "P" };
  const s1 = withPick(s0, 2, 2);
  assert.deepEqual(s1.picks, [2]);
  assert.deepEqual(s1.pack, [1, 3, 4], "the rest of the pack stays for pick 2");
  assert.equal(s1.round, "P", "and so does the round");
  const s2 = withPick(s1, 4, 2);
  assert.deepEqual(s2.picks, [2, 4]);
  assert.deepEqual(s2.pack, [], "the round's last pick clears it");
  assert.equal(s2.round, null);
});

test("keep 1, a card not in the pack, or a pack with nothing left: the pick clears the pack", () => {
  const s0 = { ...freshDraft(6), pack: [1, 2], round: "B" };
  assert.deepEqual(withPick(s0, 1).pack, []);
  assert.deepEqual(withPick(s0, 9, 2).pack, [], "taken off the board, not from the pack");
  assert.deepEqual(withPick({ ...s0, pack: [1] }, 1, 2).pack, []);
  // A stale count from an earlier pack doesn't carry: an empty pack starts at 0.
  const fresh = withPick({ ...freshDraft(12), pack: [5, 6], packTaken: 0 }, 5, 2);
  assert.deepEqual(fresh.pack, [6]);
  assert.deepEqual(withPick({ ...freshDraft(12), pack: [], packTaken: 1 }, 7, 2).picks, [7]);
});
