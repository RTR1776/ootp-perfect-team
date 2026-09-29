import test from "node:test";
import assert from "node:assert/strict";
import { newSince, savedCollectionId } from "./saved-roster-freshness";

const card = (cardId: number, baseOwned: boolean, variantOwned: boolean) => ({ cardId, baseOwned, variantOwned });
const then = { base: new Set([1, 2, 5]), variant: new Set([3]) };

test("a new variant, and a card owned in neither form before, are new where variants are allowed", () => {
  const pool = [
    card(1, true, true),   // base before, variant new: Pearce
    card(2, true, false),  // unchanged
    card(3, true, true),   // variant before, base row new: adds nothing here
    card(4, true, false),  // new card: Steve Sax
    card(5, true, false),  // unchanged
  ];
  assert.deepEqual(newSince(pool, then, true), [{ cardId: 1, variant: true }, { cardId: 4, variant: false }]);
});

test("where variants are barred, only base copies count, including one whose variant was owned", () => {
  const pool = [card(1, true, true), card(3, true, true), card(4, true, false), card(6, false, true)];
  assert.deepEqual(newSince(pool, then, false), [{ cardId: 3, variant: false }, { cardId: 4, variant: false }]);
});

test("the saved collection id is read from the roster's notes", () => {
  assert.equal(savedCollectionId(JSON.stringify({ version: 1, status: "ready", collectionUploadId: 144 })), 144);
  assert.equal(savedCollectionId(JSON.stringify({ version: 1 })), null);
  assert.equal(savedCollectionId("not json"), null);
  assert.equal(savedCollectionId(null), null);
});
