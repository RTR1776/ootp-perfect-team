import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_BOARD, boardContent, boardDiff, boardKey, boardReducer, diffText, droppedNote, parseSaved, restoreBoard,
  runsText, sameBoard, slotKeys, toSaved, whereIs, type BoardState,
} from "./build-board";

const LINEUP = ["C", "1B", "SS"];
const board = (over: Partial<BoardState> = {}): BoardState => ({ ...EMPTY_BOARD, tid: 9100139, ...over });

test("slot keys run vs RHP, vs LHP, rotation, closer and pen, bench", () => {
  assert.deepEqual(slotKeys(LINEUP, { bench: 2, sp: 2, rp: 3 }), [
    "R:C", "R:1B", "R:SS", "L:C", "L:1B", "L:SS", "SP1", "SP2", "CL", "RP1", "RP2", "BN1", "BN2",
  ]);
  assert.deepEqual(slotKeys([], { bench: 0, sp: 0, rp: 1 }), ["CL"]);
  assert.equal(boardKey(560), "build:board:560");
});

test("placing a card takes him out of his other slot in the same group only", () => {
  let s = board({ slots: { "R:1B": 7, "L:1B": 7, BN1: 3 } });
  s = boardReducer(s, { type: "place", slot: "R:SS", id: 7, label: "Put Wood at vs RHP SS" });
  assert.deepEqual(s.slots, { "R:1B": null, "L:1B": 7, BN1: 3, "R:SS": 7 }, "vs LHP keeps him; vs RHP moves him");
  s = boardReducer(s, { type: "place", slot: "BN1", id: 7, label: "bench" });
  assert.equal(s.slots["R:SS"], null, "the bench shares the vs RHP group");
  assert.equal(s.slots.BN1, 7);
});

test("a swap trades two slots, and a change that changes nothing is the same object", () => {
  const s = board({ slots: { "R:1B": 1, "R:SS": 2 } });
  const t = boardReducer(s, { type: "swap", from: "R:1B", to: "R:SS", label: "swap" });
  assert.deepEqual([t.slots["R:1B"], t.slots["R:SS"]], [2, 1]);
  assert.equal(boardReducer(s, { type: "place", slot: "R:1B", id: 1, label: "same" }), s);
  assert.equal(boardReducer(s, { type: "set", next: { slots: { "R:SS": 2, "R:1B": 1, BN1: null } }, label: "same cards" }), s, "an emptied slot equals a missing one");
  const empty = board();
  assert.equal(boardReducer(empty, { type: "set", next: { slots: {} }, label: "Clear the board" }), empty, "clearing an empty board is no step");
  const cleared = boardReducer(s, { type: "set", next: { slots: {} }, label: "Clear the board" });
  assert.notEqual(cleared, s);
  assert.ok(sameBoard(cleared, board()));
});

test("the kept board round-trips, names included, and junk reads as nothing", () => {
  const s = board({ slots: { "R:C": 11, "L:C": 11, SP1: 12, BN9: 13, CL: null }, forms: { 11: true } });
  const keys = slotKeys(LINEUP, { bench: 1, sp: 1, rp: 1 });
  const saved = toSaved(s, keys, { bench: 1, sp: 1, rp: 1 }, (id) => ({ 11: "Josh Gibson", 12: "Satchel Paige" })[id], 1_790_000_000_000);
  assert.deepEqual(saved.slots, { "R:C": 11, "L:C": 11, SP1: 12 }, "only the board's own filled slots");
  assert.deepEqual(saved.names, { 11: "Josh Gibson", 12: "Satchel Paige" });
  assert.deepEqual(parseSaved(JSON.stringify(saved)), saved);
  assert.deepEqual(boardContent(s, keys, { bench: 1, sp: 1, rp: 1 }), { slots: saved.slots, forms: saved.forms, counts: saved.counts });
  for (const junk of [null, "", "{", "[]", "null", JSON.stringify({ ...saved, v: 2 }), JSON.stringify({ ...saved, counts: { bench: 1 } })]) {
    assert.equal(parseSaved(junk), null, `junk: ${junk}`);
  }
  const odd = parseSaved(JSON.stringify({ ...saved, slots: { "R:C": 11, "R:1B": "x", SP1: -3 }, forms: { 11: "yes", 12: false } }));
  assert.deepEqual(odd?.slots, { "R:C": 11 }, "bad ids are skipped");
  assert.deepEqual(odd?.forms, { 12: false });
});

test("restoring drops and names cards no longer in the pool, and keeps the saved counts", () => {
  const saved = parseSaved(JSON.stringify({
    v: 1,
    slots: { "R:C": 1, "L:C": 1, "R:1B": 2, "L:1B": 3, SP1: 4, CL: 5, BN1: 6, BN2: 7 },
    forms: { 1: true, 2: false },
    counts: { bench: 2, sp: 1, rp: 1 },
    names: { 2: "De Vries", 7: "Manush" },
    savedAt: 1,
  }))!;
  const r = restoreBoard(saved, { inPool: (id) => id !== 2 && id !== 3, baseline: { bench: 3, sp: 1, rp: 2 }, lineupPos: LINEUP });
  assert.deepEqual(r.slots, { "R:C": 1, "L:C": 1, SP1: 4, CL: 5, BN1: 6, BN2: 7 });
  assert.deepEqual(r.dropped, [{ id: 2, name: "De Vries", why: "pool" }, { id: 3, name: "#3", why: "pool" }]);
  assert.deepEqual(r.adj, { bench: -1, sp: 0, rp: -1 }, "offsets from today's baseline give the saved counts");
  assert.deepEqual(r.forms, { 1: true }, "a dropped card's copy choice goes too");
  assert.equal(droppedNote(r.dropped), "Removed from your board: De Vries, #3 (not legal here or no longer owned).");

  // The event dropped its DH: a card whose only slot was DH comes off; one who also starts elsewhere stays.
  const dh = parseSaved(JSON.stringify({ v: 1, slots: { "R:DH": 8, "L:DH": 9, "R:C": 9 }, forms: {}, counts: { bench: 0, sp: 0, rp: 1 }, names: { 8: "Ott" }, savedAt: 1 }))!;
  const r2 = restoreBoard(dh, { inPool: () => true, baseline: { bench: 0, sp: 0, rp: 1 }, lineupPos: LINEUP });
  assert.deepEqual(r2.slots, { "R:C": 9 });
  assert.deepEqual(r2.dropped, [{ id: 8, name: "Ott", why: "slot" }]);
  assert.equal(droppedNote(r2.dropped), "Removed: Ott (that slot is no longer on the board).");
  assert.equal(droppedNote([]), "");
});

test("the diff names cards in and out, and ignores reshuffles", () => {
  const order = slotKeys(LINEUP, { bench: 1, sp: 2, rp: 1 });
  const before = { "R:C": 1, "R:1B": 2, "R:SS": 3, "L:C": 1, "L:1B": 2, "L:SS": 3, SP1: 4, SP2: 5, CL: 6, BN1: 7 };
  const reshuffled = { ...before, SP1: 5, SP2: 4, "R:1B": 7, BN1: 2 };
  assert.deepEqual(boardDiff(before, reshuffled, order), { added: [], removed: [] });
  const names: Record<number, string> = { 2: "Brandon Wood", 5: "Rogers Hornsby", 8: "Hank Aaron", 9: "Scott Rolen" };
  const after = { ...before, "R:1B": 8, "L:1B": 8, SP2: 9 };
  const d = boardDiff(before, after, order);
  assert.deepEqual(d, { added: [8, 9], removed: [2, 5] });
  assert.equal(whereIs(after, 8, order), "1B");
  assert.equal(whereIs(after, 9, order), "SP");
  assert.equal(whereIs(after, 7, order), "bench");
  assert.equal(diffText(d, after, order, (id) => names[id] ?? `#${id}`), "In: Hank Aaron 1B, Scott Rolen SP. Out: Brandon Wood, Rogers Hornsby.");
  assert.equal(diffText({ added: [], removed: [] }, after, order, String), "Same players.");
  assert.equal(diffText({ added: [], removed: [1, 2, 3, 4, 5, 6] }, {}, order, (id) => `P${id}`), "Out: P1, P2, P3, P4 and 2 more.");
});

test("a change in runs reads before, after and the difference", () => {
  assert.equal(runsText(311.4, 359.5), "+311.4 → +359.5 runs (+48.1)");
  assert.equal(runsText(12, -3.04), "+12.0 → −3.0 runs (−15.0)");
  assert.equal(runsText(null, 3), "");
});
