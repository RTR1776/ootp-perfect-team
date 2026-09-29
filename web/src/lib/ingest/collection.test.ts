import test from "node:test";
import assert from "node:assert/strict";
import { impliedBaseCopies, impliedBaseRow } from "./collection";

test("a variant with no base row implies the base copy, except a clubhouse card's", () => {
  const rows = [
    { cardId: 1, isVariant: true },                                // variant only: base implied
    { cardId: 2, isVariant: true }, { cardId: 2, isVariant: false }, // both listed: nothing to add
    { cardId: 3, isVariant: false },                               // base only
    { cardId: 4, isVariant: true },                                // clubhouse: not assumed
    { cardId: null, isVariant: true },                             // unmatched: skipped
    { cardId: 1, isVariant: true },                                // listed twice: implied once
  ];
  assert.deepEqual(impliedBaseCopies(rows, (id) => id === 4), [1]);
});

test("the implied row is a base copy marked as implied, with the variant's name and value", () => {
  const variant = { cardId: 7, name: "Steve Pearce", pos: "1B", cardValue: 69, released: "03/13/2026", isVariant: true };
  const r = impliedBaseRow(variant);
  assert.equal(r.isVariant, false);
  assert.equal(r.matchQuality, "implied");
  assert.equal(r.cardId, 7);
  assert.deepEqual(r.ratings, {});
});
