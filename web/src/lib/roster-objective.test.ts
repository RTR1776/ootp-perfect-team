import { test } from "node:test";
import assert from "node:assert/strict";
import { rosterObjective } from "./roster-objective";
import { fieldingRuns } from "./analytics/fielding";
import type { FillCard, FillShape } from "./roster-fill";

const card = (id: number, isPitcher: boolean, pos?: [string, number]): FillCard => ({
  cardId: id, name: `c${id}`, val: 80, year: 2000, isPitcher, role: isPitcher ? "SP" : null, cardType: 4,
  ratings: pos ? { [`Pos Rating ${pos[0]}`]: pos[1] } : {}, baseOwned: true, variantOwned: false, variant: false,
});
const shape: FillShape = { lineupPos: ["SS", "DH"], spKeys: ["SP1"], rpKeys: ["CL"], benchKeys: ["BN1"], bats: 3 };

test("the objective weighs boards by LHP share, prices gloves in runs, and discounts the pen and bench", () => {
  const pool = [card(1, false, ["SS", 120]), card(2, false, ["SS", 80]), card(3, true), card(4, true), card(5, false)];
  const runsR = new Map([[1, 10], [2, 20], [3, 8], [4, 6], [5, 4]]);
  const runsL = new Map([[1, 12], [2, 22], [3, 8], [4, 6], [5, 4]]);
  const o = rosterObjective(pool, { shape, runsR, runsL, lhpShare: 0.4, rpWeight: 0.31, benchWeight: 0.1 });
  const board = { "R:SS": 1, "R:DH": 2, "L:SS": 1, "L:DH": 2, SP1: 3, CL: 4, BN1: 5 };
  const glove = fieldingRuns("SS", 120);
  const expect = 0.6 * (10 + glove + 20) + 0.4 * (12 + glove + 22) + 8 + 0.31 * 6 + 0.1 * 4;
  assert.ok(Math.abs(o.objective(board) - expect) < 1e-9, `${o.objective(board)} vs ${expect}`);
  // The better bat at short loses to the better glove when the glove gap is worth more than the bat gap.
  assert.ok(o.rank("R:SS", pool[0]) > o.rank("R:SS", pool[1]) === glove - fieldingRuns("SS", 80) > 10);
  assert.equal(o.defAt(2, "DH"), 0);
  assert.equal(o.defAt(3, "SS"), 0, "pitchers have no glove term");
});

test("a must-carry card missing from the board costs 1000 runs", () => {
  const pool = [card(1, false), card(2, false)];
  const runs = new Map([[1, 5], [2, 5]]);
  const o = rosterObjective(pool, { shape: { ...shape, lineupPos: ["DH"], spKeys: [], rpKeys: [], benchKeys: [] }, runsR: runs, runsL: runs, mustIds: new Set([2]) });
  assert.ok(o.objective({ "R:DH": 1, "L:DH": 1 }) < -900);
  assert.ok(o.objective({ "R:DH": 2, "L:DH": 2 }) > 0);
});

test("the pen's innings are fixed: more relievers than the field splits the same weight more ways", () => {
  const pool = [card(1, true), card(2, true), card(3, true), card(4, true)];
  const runs = new Map([[1, 10], [2, 10], [3, 10], [4, 10]]);
  const pen = (n: number): FillShape => ({ lineupPos: [], spKeys: ["SP1"], rpKeys: Array.from({ length: n }, (_, i) => `RP${i + 1}`), benchKeys: [], bats: 0 });
  const board = (n: number) => Object.fromEntries([["SP1", 1], ...Array.from({ length: n }, (_, i) => [`RP${i + 1}`, i + 1])]);
  const score = (n: number, field: number | null) => rosterObjective(pool, { shape: pen(n), runsR: runs, runsL: runs, rpWeight: 0.4, spWeight: 1.5, fieldSp: 1, fieldRp: field }).objective(board(n));
  // Measured at a 2-reliever field: 2 or 4 relievers of the same quality are worth the same pen.
  assert.ok(Math.abs(score(2, 2) - score(4, 2)) < 1e-9);
  assert.ok(Math.abs(score(2, 2) - (1.5 * 10 + 2 * 0.4 * 10)) < 1e-9);
  // Without the field's count each arm keeps the measured weight (the old behaviour).
  assert.ok(Math.abs(score(4, null) - (1.5 * 10 + 4 * 0.4 * 10)) < 1e-9);
});

test("the pen tilts mildly to its best arm (CL first) and a big bench shares the bench's PA", async () => {
  const { penTilt, BENCH_SLOTS } = await import("./roster-objective");
  const t5 = penTilt(5);
  assert.ok(Math.abs(t5.reduce((a, b) => a + b, 0) - 5) < 1e-9, "mean 1");
  assert.ok(t5[0] > t5[4] && t5[0] < 1.5, `mild tilt ${t5.map((x) => x.toFixed(2))}`);
  assert.deepEqual(penTilt(2), [1, 1]);
  const pool = [card(1, false), card(2, false), card(3, false), card(4, false), card(5, false), card(6, false), card(7, false)];
  const runs = new Map(pool.map((c) => [c.cardId, 10]));
  const bench = (n: number): FillShape => ({ lineupPos: [], spKeys: [], rpKeys: [], benchKeys: Array.from({ length: n }, (_, i) => `BN${i + 1}`), bats: n });
  const score = (n: number) => rosterObjective(pool, { shape: bench(n), runsR: runs, runsL: runs, benchWeight: 0.1 }).objective(Object.fromEntries(Array.from({ length: n }, (_, i) => [`BN${i + 1}`, i + 1])));
  assert.ok(Math.abs(score(2) - 2 * 0.1 * 10) < 1e-9, "a small bench keeps 0.1 a bat");
  assert.ok(Math.abs(score(7) - BENCH_SLOTS * 10) < 1e-9, "seven bats share the bench's 0.33 slots");
});
