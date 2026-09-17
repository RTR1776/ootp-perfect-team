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
