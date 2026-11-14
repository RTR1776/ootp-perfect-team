import test from "node:test";
import assert from "node:assert/strict";
import { dualSeeds, rulesExcess } from "./dual-seed";
import type { FillCard, FillShape } from "./roster-fill";
import { rosterObjective } from "./roster-objective";
import { optimizeRoster } from "./roster-optimize";
import type { RosterRules } from "./roster-rules";
import { twoWayId, unitOf } from "./two-way";

/*
 * Daily Silver & Friends Slots, 2026-11-14, in small: one Perfect slot, held by
 * Alex Rodriguez at short. Every Ed Rile (1B/SP 102) seed carried two Perfect
 * cards, the climb could not leave an illegal start, and the dual phase logged
 * "no legal board" without ever comparing him both ways.
 */
const hitter = (cardId: number, name: string, val: number, pos: Record<string, number>, extra: Partial<FillCard> = {}): FillCard => ({
  cardId, name, val, year: 2000, isPitcher: false, role: null, baseOwned: true, variantOwned: false, variant: false, player: name,
  ratings: Object.fromEntries(Object.entries(pos).map(([p, r]) => [`Pos Rating ${p}`, r])), ...extra,
});
const pitcher = (cardId: number, name: string, val: number, extra: Partial<FillCard> = {}): FillCard => ({
  cardId, name, val, year: 2000, isPitcher: true, role: "SP", baseOwned: true, variantOwned: false, variant: false, player: name, ratings: { Stamina: 80 }, ...extra,
});

const RILE = 1;
const pool: FillCard[] = [
  hitter(RILE, "Ed Rile", 102, { "1B": 70 }),
  { ...pitcher(twoWayId(RILE), "Ed Rile", 102), player: "Ed Rile" },
  hitter(2, "Alex Rodriguez", 102, { SS: 90, "3B": 80 }),
  hitter(3, "Lee Thomas", 77, { "1B": 70 }),
  hitter(4, "CJ Abrams", 78, { SS: 85 }),
  hitter(5, "Ryan Braun", 74, { "3B": 70, LF: 60 }),
  // Off the roster: a Bronze bat with no shortstop rating (so Abrams must move to short), and a Silver one.
  hitter(6, "Cheap Bat", 65, { "1B": 60 }),
  hitter(7, "Silver Bat", 76, { "1B": 60 }),
  pitcher(8, "Ed Reulbach", 97),
  pitcher(9, "Fritz Ostermueller", 64),
];
const byId = new Map(pool.map((c) => [c.cardId, c]));
const shape: FillShape = { lineupPos: ["SS", "1B", "DH"], spKeys: ["SP1", "SP2"], rpKeys: [], benchKeys: ["BN1"], bats: 4 };
const dshape: FillShape = { ...shape, bats: 5, benchKeys: ["BN1", "BN2"] };
// 1 Perfect, 1 Diamond, 3 Silver, 1 Bronze: six cards.
const rules: RosterRules = {
  name: "Slots in small", dh: true, ratingsMin: null, ratingsMax: null, cardYearMin: null, cardYearMax: null, isDraft: false,
  restrictions: { slots: { P: 1, D: 1, S: 3, B: 1 }, cards: 6 },
};
const board = {
  "R:SS": 2, "L:SS": 2, "R:1B": 3, "L:1B": 3, "R:DH": 4, "L:DH": 4, BN1: 5, SP1: 8, SP2: 9,
};
const runs = new Map<number, number>([[RILE, 25], [twoWayId(RILE), 9], [2, 20], [3, 5], [4, 6], [5, 1], [6, 0], [7, 2], [8, 10], [9, 2]]);
const dobj = rosterObjective(pool, { shape: dshape, runsR: runs, runsL: runs, lhpShare: 0.3 });

test("rulesExcess: tier slots counted from the top, a two-way card once; the cap in points; the variant cap", () => {
  assert.equal(rulesExcess(board, byId, rules), 0);
  // Rile in for Ostermueller: two Perfect cards for one Perfect slot.
  assert.equal(rulesExcess({ ...board, SP2: twoWayId(RILE), BN2: RILE }, byId, rules), 100_000);
  // 102 + 77 + 78 + 74 + 97 + 64 = 492 against a 480 cap.
  assert.equal(rulesExcess(board, byId, { ...rules, restrictions: { teamCap: 480 } }), 12);
  const vByid = new Map([...byId].map(([id, c]) => [id, id === 3 || id === 4 ? { ...c, variant: true, variantOwned: true } : c]));
  assert.equal(rulesExcess(board, vByid, { ...rules, restrictions: { ...rules.restrictions, variantCap: 1 } }), 1_000);
});

test("dual seed in a slots event: the card holding the Perfect slot gives way, and the positions are re-solved", () => {
  const { seeds, why } = dualSeeds({ board, bat: RILE, pool, rules, shape, dshape, slotValue: dobj.slotValue, objective: dobj.objective });
  assert.equal(why, null);
  assert.ok(seeds.length >= 1);
  const s = seeds[0];
  assert.match(s.note, /^Alex Rodriguez \(102\) out for Cheap Bat \(65\)$/);
  assert.equal(rulesExcess(s.slots, byId, rules), 0);
  // His arm took the weaker rotation slot; Abrams moved from DH to short, the only other shortstop.
  assert.equal(s.slots.SP2, twoWayId(RILE));
  assert.deepEqual([s.slots["R:SS"], s.slots["L:SS"]], [4, 4]);
  assert.ok(Object.values(s.slots).includes(RILE), "his bat is on the roster");
  assert.equal(new Set(Object.values(s.slots).map(unitOf)).size, 6, "six players, Rile counted once");
  // A Silver bat doesn't fit: the Bronze slot Ostermueller left is the one free.
  assert.ok(seeds.every((x) => !Object.values(x.slots).includes(7)));
});

test("the repaired seed climbs to a legal board with him in both roles, which beats the board without him", () => {
  const { seeds } = dualSeeds({ board, bat: RILE, pool, rules, shape, dshape, slotValue: dobj.slotValue, objective: dobj.objective });
  const r = optimizeRoster(seeds[0].slots, pool, rules, dshape, { objective: dobj.objective, slotValue: dobj.slotValue, pairMoves: { aTop: 10, bCheapest: 12, rank: dobj.rank }, maxPasses: 20 });
  assert.equal(r.legal, true);
  const on = new Set(Object.values(r.slots));
  assert.ok(on.has(RILE) && on.has(twoWayId(RILE)), "Rile in both roles");
  const base = rosterObjective(pool, { shape, runsR: runs, runsL: runs, lhpShare: 0.3 });
  assert.ok(r.score > base.objective(board), `${r.score} vs ${base.objective(board)}`);
});

test("a cap: the dearest card gives way when one move clears it; none when nothing he owns fits", () => {
  const capRules: RosterRules = { ...rules, restrictions: { teamCap: 102 + 77 + 78 + 74 + 97 + 64, cards: 6 } };
  const { seeds } = dualSeeds({ board, bat: RILE, pool, rules: capRules, shape, dshape, slotValue: dobj.slotValue, objective: dobj.objective });
  assert.ok(seeds.length >= 1);
  for (const s of seeds) assert.equal(rulesExcess(s.slots, byId, capRules), 0);
  // A cap nothing can clear: every card is dearer than the cap leaves room for.
  const tight: RosterRules = { ...rules, restrictions: { teamCap: 300, cards: 6 } };
  const none = dualSeeds({ board, bat: RILE, pool, rules: tight, shape, dshape, slotValue: dobj.slotValue, objective: dobj.objective });
  assert.equal(none.seeds.length, 0);
  assert.match(none.why ?? "", /makes room/);
});

test("without a broken rule the seed is the plain one", () => {
  const open: RosterRules = { ...rules, restrictions: { cards: 6 } };
  const { seeds } = dualSeeds({ board, bat: RILE, pool, rules: open, shape, dshape, slotValue: dobj.slotValue, objective: dobj.objective });
  assert.deepEqual(seeds.map((s) => s.note), ["as seeded"]);
  assert.equal(seeds[0].slots.BN2, RILE);
});
