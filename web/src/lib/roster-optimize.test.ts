import { test } from "node:test";
import assert from "node:assert/strict";
import { maxAssignment } from "./assign";
import { CAP_BACKUP_FLOOR, backupFloorAt, backupPositions, missingBackups, optimizeRoster } from "./roster-optimize";
import { capLedger } from "./cap-ledger";
import { rosterObjective } from "./roster-objective";
import type { FillCard, FillShape } from "./roster-fill";
import type { RosterRules } from "./roster-rules";

/** Every assignment of rows to distinct columns, best total — the reference. */
function bruteMax(w: number[][]): number | null {
  const n = w.length, m = w[0]?.length ?? 0;
  let best: number | null = null;
  const used = new Array<boolean>(m).fill(false);
  const go = (i: number, acc: number) => {
    if (i === n) { if (best == null || acc > best) best = acc; return; }
    for (let j = 0; j < m; j++) {
      if (used[j] || !Number.isFinite(w[i][j])) continue;
      used[j] = true; go(i + 1, acc + w[i][j]); used[j] = false;
    }
  };
  go(0, 0);
  return best;
}

test("maxAssignment matches brute force, forbidden pairings included", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let trial = 0; trial < 300; trial++) {
    const n = 1 + Math.floor(rnd() * 5), m = n + Math.floor(rnd() * 3);
    const w = Array.from({ length: n }, () => Array.from({ length: m }, () => (rnd() < 0.25 ? -Infinity : Math.round(rnd() * 40 - 10))));
    const a = maxAssignment(w), ref = bruteMax(w);
    if (ref == null) { assert.equal(a, null, `trial ${trial}: infeasible`); continue; }
    assert.ok(a, `trial ${trial}: expected an assignment`);
    assert.equal(new Set(a).size, n, "distinct columns");
    assert.equal(a.reduce((s, j, i) => s + w[i][j], 0), ref, `trial ${trial}`);
  }
  assert.deepEqual(maxAssignment([]), []);
  assert.equal(maxAssignment([[1], [2]]), null, "more rows than columns");
});

/* A three-way reshuffle: each bat is slick at the next man's position and
   merely playable at his own. Swaps fix the vs-LHP board, but vs RHP the bench
   shares the group and every two-card move is illegal or worse — the trap that
   left Josh Gibson on the bench vs RHP (Negro Leagues Slots, 2026-09-26). */
const hitter = (id: number, pos: Record<string, number>, variant = false, owned = true): FillCard => ({
  cardId: id, name: `H${id}`, val: 80, year: 1950, isPitcher: false, role: null, cardType: 4,
  ratings: Object.fromEntries(Object.entries(pos).map(([p, r]) => [`Pos Rating ${p}`, r])),
  baseOwned: variant ? false : owned, variantOwned: variant ? owned : false, variant,
});
const rules: RosterRules = { name: "Synthetic", dh: false, ratingsMin: null, ratingsMax: null, cardYearMin: null, cardYearMax: null, isDraft: false, restrictions: { cards: 4 } };
const shape: FillShape = { lineupPos: ["1B", "3B", "SS"], spKeys: [], rpKeys: [], benchKeys: ["BN1"], bats: 4 };

test("the optimiser re-solves positions: a three-way rotation swap moves cannot reach", () => {
  const pool = [
    hitter(1, { "1B": 70, "3B": 120 }),
    hitter(2, { "3B": 70, SS: 120 }),
    hitter(3, { SS: 70, "1B": 120 }),
    hitter(4, { "1B": 60 }),
  ];
  const runs = new Map(pool.map((c) => [c.cardId, 10]));
  const obj = rosterObjective(pool, { shape, runsR: runs, runsL: runs });
  const start = { "R:1B": 1, "R:3B": 2, "R:SS": 3, "L:1B": 1, "L:3B": 2, "L:SS": 3, BN1: 4 };

  const swapsOnly = optimizeRoster(start, pool, rules, shape, { objective: obj.objective });
  assert.deepEqual([swapsOnly.slots["R:1B"], swapsOnly.slots["R:3B"], swapsOnly.slots["R:SS"]], [1, 2, 3], "swaps alone stay stuck vs RHP");

  const r = optimizeRoster(start, pool, rules, shape, { objective: obj.objective, slotValue: obj.slotValue });
  assert.deepEqual(
    [r.slots["R:1B"], r.slots["R:3B"], r.slots["R:SS"], r.slots["L:1B"], r.slots["L:3B"], r.slots["L:SS"], r.slots.BN1],
    [3, 1, 2, 3, 1, 2, 4],
  );
  assert.ok(r.score > swapsOnly.score + 1);
  assert.ok(Math.abs(r.score - obj.objective(r.slots)) < 1e-9, "reported score is the objective's");
});

test("a card whose rostered copy is not owned is moved off the board", () => {
  // Card 3 is on the start board as a base copy L.J. does not own.
  const pool = [
    hitter(1, { "1B": 90 }), hitter(2, { "3B": 90 }), hitter(3, { SS: 120 }, false, false),
    hitter(4, { SS: 80, "1B": 60 }), hitter(5, { "1B": 60 }),
  ];
  const runs = new Map(pool.map((c) => [c.cardId, c.cardId === 3 ? 40 : 10]));
  const obj = rosterObjective(pool, { shape, runsR: runs, runsL: runs });
  const start = { "R:1B": 1, "R:3B": 2, "R:SS": 3, "L:1B": 1, "L:3B": 2, "L:SS": 3, BN1: 5 };
  const r = optimizeRoster(start, pool, rules, shape, { objective: obj.objective, slotValue: obj.slotValue });
  assert.ok(!Object.values(r.slots).includes(3), "the unowned copy is gone");
  assert.equal(r.startLegal, false);
  assert.equal(r.legal, true);
  assert.equal(r.slots["R:SS"], 4);
});

test("the roster never shrinks: a vs-LHP-only platoon bat keeps his spot", () => {
  // Three bats on a three-man roster: 1 starts vs RHP, 2 sits, 3 starts only
  // vs LHP. Bat 1 is better vs LHP too, so re-solving the vs-LHP board alone
  // would start him there and leave bat 3 with no slot — a 2-man roster.
  const one: FillShape = { lineupPos: ["1B"], spKeys: [], rpKeys: [], benchKeys: ["BN1"], bats: 3 };
  const three: RosterRules = { ...rules, restrictions: { cards: 3 } };
  const pool = [hitter(1, { "1B": 90 }), hitter(2, { "1B": 90 }), hitter(3, { "1B": 90 })];
  const runsR = new Map([[1, 20], [2, 5], [3, 5]]), runsL = new Map([[1, 20], [2, 5], [3, 8]]);
  const obj = rosterObjective(pool, { shape: one, runsR, runsL });
  const start = { "R:1B": 1, BN1: 2, "L:1B": 3 };
  const r = optimizeRoster(start, pool, three, one, { objective: obj.objective, slotValue: obj.slotValue });
  assert.equal(new Set(Object.values(r.slots)).size, 3, JSON.stringify(r.slots));
  assert.equal(r.legal, true);
});

test("a locked card outside the pruned candidate lists still reaches the board", () => {
  // Five better bats outrank him everywhere, so with candidateLimit 2 the
  // pruned search never saw the locked card (Incaviglia, 2026-09-26) — `keep`
  // holds him in, and the must-carry penalty then pulls him onto the board.
  const one: FillShape = { lineupPos: ["DH"], spKeys: [], rpKeys: [], benchKeys: [], bats: 2 };
  const two: RosterRules = { ...rules, restrictions: { cards: 2 } };
  const pool = [1, 2, 3, 4, 5, 6].map((id) => hitter(id, {}));
  const runs = new Map(pool.map((c) => [c.cardId, c.cardId === 6 ? 1 : c.cardId * 10]));
  const locks = new Set([6]);
  const obj = rosterObjective(pool, { shape: one, runsR: runs, runsL: runs, mustIds: locks });
  const start = { "R:DH": 5, "L:DH": 5 };
  const opts = { objective: obj.objective, pairMoves: { aTop: 2, bCheapest: 2, rank: obj.rank }, candidateLimit: 2 };
  const pruned = optimizeRoster(start, pool, two, one, opts);
  assert.ok(!Object.values(pruned.slots).includes(6), "without keep the pruned search cannot see him");
  const kept = optimizeRoster(start, pool, two, one, { ...opts, keep: locks });
  assert.ok(Object.values(kept.slots).includes(6), JSON.stringify(kept.slots));
});

test("minCatchers puts a second catcher on the roster even when a better bat sits there", () => {
  const sh: FillShape = { lineupPos: ["C", "DH"], spKeys: [], rpKeys: [], benchKeys: ["BN1"], bats: 3 };
  const three: RosterRules = { ...rules, restrictions: { cards: 3 } };
  const pool = [hitter(1, { C: 90 }), hitter(2, {}), hitter(3, {}), hitter(4, { C: 80 })];
  const runs = new Map([[1, 10], [2, 30], [3, 20], [4, 1]]);
  const obj = rosterObjective(pool, { shape: sh, runsR: runs, runsL: runs });
  const start = { "R:C": 1, "R:DH": 2, BN1: 3, "L:C": 1, "L:DH": 2 };
  const free = optimizeRoster(start, pool, three, sh, { objective: obj.objective });
  assert.equal(free.slots.BN1, 3, "left alone, the better bat keeps the bench seat");
  const two = optimizeRoster(start, pool, three, sh, { objective: obj.objective, minCatchers: 2 });
  assert.equal(two.legal, true);
  assert.ok(Object.values(two.slots).includes(4), JSON.stringify(two.slots));
});

test("backups puts a second centre fielder on the roster, and leaves positions the pool can't cover twice alone", () => {
  const sh: FillShape = { lineupPos: ["CF", "DH"], spKeys: [], rpKeys: [], benchKeys: ["BN1"], bats: 3 };
  const three: RosterRules = { ...rules, restrictions: { cards: 3 } };
  const pool = [hitter(1, { CF: 90, SS: 70 }), hitter(2, {}), hitter(3, {}), hitter(4, { CF: 80 })];
  const runs = new Map([[1, 10], [2, 30], [3, 20], [4, 1]]);
  const obj = rosterObjective(pool, { shape: sh, runsR: runs, runsL: runs });
  const start = { "R:CF": 1, "R:DH": 2, BN1: 3, "L:CF": 1, "L:DH": 2 };
  const free = optimizeRoster(start, pool, three, sh, { objective: obj.objective });
  assert.equal(free.slots.BN1, 3, "left alone, the better bat keeps the bench seat");
  const b = optimizeRoster(start, pool, three, sh, { objective: obj.objective, backups: true });
  assert.ok(Object.values(b.slots).includes(4), JSON.stringify(b.slots));
  assert.deepEqual(b.missingBackups, [], "SS has one man in the pool, so it is not asked for");
});

test("two starters who can both play 2B are not each other's backup; a bench utility man is", () => {
  const pool = [hitter(1, { "2B": 90 }), hitter(2, { "3B": 90, "2B": 70 }), hitter(3, { LF: 90 }), hitter(4, { "2B": 60, "3B": 60 })];
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const positions = backupPositions(pool, rules);
  const starters = { "R:2B": 1, "R:3B": 2, "L:2B": 1, "L:3B": 2 };
  assert.deepEqual(missingBackups({ ...starters, BN1: 3 }, byId, positions), ["2B vR", "3B vR", "2B vL", "3B vL"]);
  assert.deepEqual(missingBackups({ ...starters, BN1: 4 }, byId, positions), [], "one utility card covers both spots");
  // The other hand's platoon starter backs up this hand: 4 starts 2B vs LHP only.
  assert.deepEqual(missingBackups({ "R:2B": 1, "R:3B": 2, "L:2B": 4, "L:3B": 2, BN1: 3 }, byId, positions), ["3B vL"]);
});

test("a pen with no long men climbs to two, a swap at a time", () => {
  const sh: FillShape = { lineupPos: ["DH"], spKeys: ["SP1"], rpKeys: ["CL", "RP1", "RP2"], benchKeys: [], bats: 1 };
  const five: RosterRules = { ...rules, restrictions: { cards: 5 } };
  const arm = (id: number, stamina: number, role = "RP") => ({ cardId: id, name: `P${id}`, val: 80, year: 2026, isPitcher: true, role, cardType: 1, ratings: { Stamina: stamina }, baseOwned: true, variantOwned: false, variant: false });
  const pool = [hitter(1, {}), arm(2, 80, "SP"), arm(3, 15), arm(4, 15), arm(5, 15), arm(6, 60, "SP"), arm(7, 70, "SP")];
  const runs = new Map([[1, 10], [2, 5], [3, 4], [4, 4], [5, 4], [6, 1], [7, 1]]);
  const obj = rosterObjective(pool as never, { shape: sh, runsR: runs, runsL: runs });
  const start = { "R:DH": 1, "L:DH": 1, SP1: 2, CL: 3, RP1: 4, RP2: 5 };
  const r = optimizeRoster(start, pool as never, five, sh, { objective: obj.objective, minLongMen: 2 });
  const pen = [r.slots.CL, r.slots.RP1, r.slots.RP2];
  assert.ok(pen.includes(6) && pen.includes(7), JSON.stringify(r.slots));
});

test("with the cap full, an upgrade is paid for by a near-equal cheaper card, not the slot's cheapest", () => {
  // Dregs 10-27: Sam Huff caught over Tony Pena Sr. because the +11 for Pena could only be
  // paid by dropping some slot to a 50. Here 1B can go from H1 to H2 (+20 runs, +10 value)
  // only if 3B goes from H3 to H4 (-1 run, -10 value); H5, the cheapest 3B, costs 40 runs.
  const two: FillShape = { lineupPos: ["1B", "3B"], spKeys: [], rpKeys: [], benchKeys: [], bats: 2 };
  const capped: RosterRules = { ...rules, restrictions: { cards: 2, teamCap: 130 } };
  const at = (id: number, pos: Record<string, number>, val: number) => ({ ...hitter(id, pos), val });
  const pool = [at(1, { "1B": 90 }, 60), at(2, { "1B": 90 }, 70), at(3, { "3B": 90 }, 70), at(4, { "3B": 90 }, 60), at(5, { "3B": 90 }, 50)];
  const runs = new Map([[1, 0], [2, 20], [3, 10], [4, 9], [5, -30]]);
  const obj = rosterObjective(pool, { shape: two, runsR: runs, runsL: runs });
  const start = { "R:1B": 1, "R:3B": 3, "L:1B": 1, "L:3B": 3 };
  const r = optimizeRoster(start, pool, capped, two, { objective: obj.objective, slotValue: obj.slotValue, pairMoves: { aTop: 2, bCheapest: 1, rank: obj.rank } });
  assert.equal(r.legal, true);
  assert.deepEqual([r.slots["R:1B"], r.slots["R:3B"]], [2, 4], JSON.stringify(r.slots));
});

test("a cap event judges backups at a 60 glove, not the starter's floor (L.J. 10-31)", () => {
  const floors = { default: 60, SS: 85, CF: 90 };
  const capped: RosterRules = { ...rules, restrictions: { cards: 4, teamCap: 300 } };
  assert.equal(backupFloorAt(rules, floors, "SS"), 85, "no cap: the starter's floor");
  assert.equal(backupFloorAt(capped, floors, "SS"), CAP_BACKUP_FLOOR);
  assert.equal(backupFloorAt(capped, floors, "1B"), 60);
  // A 70 SS backs up an SS in a cap event, not in an uncapped one.
  const pool = [hitter(1, { SS: 95 }), hitter(2, { SS: 70, "2B": 70, "3B": 70 }), hitter(3, { LF: 80 })];
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const board = { "R:SS": 1, "L:SS": 1, BN1: 2 };
  assert.deepEqual(backupPositions(pool, rules, floors).map((b) => b.pos), [], "uncapped: only one SS at 85+");
  assert.deepEqual(missingBackups(board, byId, backupPositions(pool, capped, floors)), [], "capped: the utility man covers SS");
});

test("the cap ledger prices each card against the best floor card that can take his slots", () => {
  const v = (c: FillCard, val: number): FillCard => ({ ...c, val });
  const sh: FillShape = { lineupPos: ["SS"], spKeys: [], rpKeys: [], benchKeys: ["BN1"], bats: 2 };
  const pool = [v(hitter(1, { SS: 90 }), 90), v(hitter(2, { SS: 90 }), 40), v(hitter(3, { SS: 90 }), 40), v(hitter(4, {}), 48)];
  const runs = new Map([[1, 20], [2, 5], [3, 2], [4, 3]]);
  const capped: RosterRules = { ...rules, restrictions: { cards: 2, teamCap: 200 } };
  const obj = rosterObjective(pool as never, { shape: sh, runsR: runs, runsL: runs });
  const lg = capLedger({ slots: { "R:SS": 1, "L:SS": 1, BN1: 4 }, pool, rules: capped, objective: obj.objective });
  assert.ok(lg);
  assert.equal(lg.floorValue, 40);
  const ss = lg.rows.find((r) => r.cardId === 1)!, bn = lg.rows.find((r) => r.cardId === 4)!;
  assert.equal(ss.above, 50);
  assert.equal(ss.sub, "H2", "the best floor SS replaces him");
  assert.ok(ss.runs! > 0 && bn.above === 8);
  assert.equal(capLedger({ slots: { "R:SS": 1, "L:SS": 1, BN1: 4 }, pool, rules, objective: obj.objective }), null, "no cap, no ledger");
});

/* Cross-role moves (Saturday Bronze Cap, 2026-11-07). Two starters, a three-man pen, and the cap
   full, so the only legal swaps are like-for-like in value. */
const arm = (id: number, val: number, role: "SP" | "RP", stamina = role === "SP" ? 70 : 20): FillCard => ({
  cardId: id, name: `P${id}`, val, year: 2016, isPitcher: true, role, cardType: 1, ratings: { Stamina: stamina },
  baseOwned: true, variantOwned: false, variant: false,
});
const staffShape: FillShape = { lineupPos: ["DH"], spKeys: ["SP1", "SP2"], rpKeys: ["CL", "RP1", "RP2"], benchKeys: [], bats: 1 };
const staffRules = (cap: number): RosterRules => ({ ...rules, restrictions: { cards: 6, teamCap: cap } });
const bat = { ...hitter(1, {}), val: 50 };

test("a starter in for the closer: the staff is re-solved around him (he starts, the SP2 relieves)", () => {
  // X (#7, 60) is the closer's (#4, 60) price. Closing he is worse than #4 (9 runs to 12); starting
  // he is far better than #3 (9 to 2), who is fine in the pen. No one-slot move gets there.
  const pool = [bat, arm(2, 50, "SP"), arm(3, 40, "SP"), arm(4, 60, "RP"), arm(5, 40, "RP"), arm(6, 40, "RP"), arm(7, 60, "SP")];
  const runs = new Map([[1, 10], [2, 10], [3, 2], [4, 12], [5, 6], [6, 3], [7, 9]]);
  const obj = rosterObjective(pool, { shape: staffShape, runsR: runs, runsL: runs });
  const start = { "R:DH": 1, "L:DH": 1, SP1: 2, SP2: 3, CL: 4, RP1: 5, RP2: 6 };
  const cap = staffRules(280);

  const plain = optimizeRoster(start, pool, cap, staffShape, { objective: obj.objective, slotValue: obj.slotValue });
  assert.ok(!Object.values(plain.slots).includes(7), "without the staff tier he is scored closing, and loses");

  const r = optimizeRoster(start, pool, cap, staffShape, { objective: obj.objective, slotValue: obj.slotValue, staffTier: true });
  assert.equal(r.legal, true);
  assert.deepEqual([r.slots.SP1, r.slots.SP2], [2, 7], JSON.stringify(r.slots));
  assert.deepEqual([r.slots.CL, r.slots.RP1, r.slots.RP2], [5, 6, 3], "the best reliever closes; the old SP2 relieves");
  assert.ok(r.score > plain.score + 1, `${r.score} vs ${plain.score}`);
  assert.ok(Math.abs(r.score - obj.objective(r.slots)) < 1e-9, "reported score is the objective's");

  // A polish from the plain climb's stopping point may skip straight to the staff tier: same board.
  const polished = optimizeRoster(plain.slots, pool, cap, staffShape, { objective: obj.objective, slotValue: obj.slotValue, staffTier: true, atOptimum: true });
  assert.deepEqual(polished.slots, r.slots);
  assert.equal(polished.score, r.score);
});

test("a reliever who cannot start, in for a starter: a pen arm who can start moves up", () => {
  // #7 (RP, 50) is the SP2's (#3, 50) price and cannot start; #4, a long man in the pen, can,
  // though worse than #3 (2 runs to 4), so swapping the two alone loses. The move exists only
  // with the staff re-solved: #7 closes, #4 starts, #3 goes.
  const pool = [bat, arm(2, 50, "SP"), arm(3, 50, "SP"), arm(4, 40, "SP"), arm(5, 40, "RP"), arm(6, 40, "RP"), arm(7, 50, "RP")];
  const runs = new Map([[1, 10], [2, 10], [3, 4], [4, 2], [5, 6], [6, 3], [7, 12]]);
  const obj = rosterObjective(pool, { shape: staffShape, runsR: runs, runsL: runs });
  const start = { "R:DH": 1, "L:DH": 1, SP1: 2, SP2: 3, CL: 5, RP1: 4, RP2: 6 };
  const r = optimizeRoster(start, pool, staffRules(270), staffShape, { objective: obj.objective, slotValue: obj.slotValue, staffTier: true });
  assert.equal(r.legal, true);
  assert.deepEqual([r.slots.SP1, r.slots.SP2], [2, 4], JSON.stringify(r.slots));
  assert.deepEqual([r.slots.CL, r.slots.RP1, r.slots.RP2], [7, 5, 6]);
  assert.ok(!Object.values(r.slots).includes(3));
});

test("a pair move: a dearer starter in for the closer, paid by a cheaper bat, scored with the staff re-solved", () => {
  // #7 (SP, 70) for the closer #4 (60) breaks the cap by 10; the bat #8 (40) for #1 (50) pays it.
  // Closing, #7 loses to #4 and the pair loses; starting (the SP2 to the pen) it wins.
  const pool = [{ ...bat, val: 50 }, arm(2, 50, "SP"), arm(3, 40, "SP"), arm(4, 60, "RP"), arm(5, 40, "RP"), arm(6, 40, "RP"), arm(7, 70, "SP"), { ...hitter(8, {}), val: 40 }];
  const runs = new Map([[1, 5], [2, 10], [3, 2], [4, 12], [5, 6], [6, 3], [7, 9], [8, 4]]);
  const obj = rosterObjective(pool, { shape: staffShape, runsR: runs, runsL: runs });
  const start = { "R:DH": 1, "L:DH": 1, SP1: 2, SP2: 3, CL: 4, RP1: 5, RP2: 6 };
  const opts = { objective: obj.objective, slotValue: obj.slotValue, pairMoves: { aTop: 10, bCheapest: 10, rank: obj.rank }, staffTier: true };
  const r = optimizeRoster(start, pool, staffRules(280), staffShape, opts);
  assert.equal(r.legal, true);
  assert.deepEqual([r.slots.SP1, r.slots.SP2, r.slots.CL, r.slots["R:DH"]], [2, 7, 5, 8], JSON.stringify(r.slots));
  assert.ok(Math.abs(r.score - obj.objective(r.slots)) < 1e-9);
});

test("the cap tier: an upgrade no single cheaper card can pay for is paid for by two", () => {
  // The cap is full. 1B can go from H1 to H2 for +30 runs at +10 value. No single slot can give
  // 10 back for less than 40 runs, but 3B and SS can give 5 each for 2 runs apiece.
  const three: FillShape = { lineupPos: ["1B", "3B", "SS"], spKeys: [], rpKeys: [], benchKeys: [], bats: 3 };
  const capped: RosterRules = { ...rules, restrictions: { cards: 3, teamCap: 210 } };
  const at = (id: number, pos: Record<string, number>, val: number) => ({ ...hitter(id, pos), val });
  const pool = [
    at(1, { "1B": 90 }, 70), at(2, { "1B": 90 }, 80),
    at(3, { "3B": 90 }, 70), at(4, { "3B": 90 }, 65), at(5, { "3B": 90 }, 60),
    at(6, { SS: 90 }, 70), at(7, { SS: 90 }, 65), at(8, { SS: 90 }, 60),
  ];
  const runs = new Map([[1, 0], [2, 30], [3, 10], [4, 8], [5, -30], [6, 10], [7, 8], [8, -30]]);
  const obj = rosterObjective(pool, { shape: three, runsR: runs, runsL: runs });
  const start = { "R:1B": 1, "R:3B": 3, "R:SS": 6, "L:1B": 1, "L:3B": 3, "L:SS": 6 };
  const opts = { objective: obj.objective, slotValue: obj.slotValue, pairMoves: { aTop: 3, bCheapest: 3, rank: obj.rank } };
  const ids = (s: Record<string, number>) => [s["R:1B"], s["R:3B"], s["R:SS"]];

  const plain = optimizeRoster(start, pool, capped, three, opts);
  assert.deepEqual(ids(plain.slots), [1, 3, 6], "single moves and pairs cannot get there");

  const r = optimizeRoster(start, pool, capped, three, { ...opts, capTier: true });
  assert.equal(r.legal, true);
  assert.deepEqual(ids(r.slots), [2, 4, 7], JSON.stringify(r.slots));
  assert.ok(Math.abs(r.score - obj.objective(r.slots)) < 1e-9, "reported score is the objective's");
  assert.ok(Math.abs(r.score - plain.score - (30 - 2 - 2)) < 1e-9, "+30 for the bat, 2 lost at each of the other two spots");
  // A polish of a board already at the plain moves' optimum lands on the same roster.
  const polished = optimizeRoster(plain.slots, pool, capped, three, { ...opts, capTier: true, atOptimum: true });
  assert.deepEqual(ids(polished.slots), [2, 4, 7]);
  // With no cap there is nothing for the tier to do.
  const free = optimizeRoster(start, pool, { ...rules, restrictions: { cards: 3 } }, three, { ...opts, capTier: true });
  assert.deepEqual(ids(free.slots), [2, 3, 6]);
});

test("under a cap the search is checked against brute force: never above it, and close", () => {
  // Small enough to enumerate: 5 bats from 10, 4 arms from 8, every assignment of each.
  const small: FillShape = { lineupPos: ["C", "SS", "CF", "DH"], spKeys: ["SP1", "SP2"], rpKeys: ["CL", "RP1"], benchKeys: ["BN1"], bats: 5 };
  const POSN = ["C", "SS", "CF"];
  let seed = 20261112;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const combos = <T,>(a: T[], k: number): T[][] => {
    const out: T[][] = [];
    const go = (i: number, cur: T[]) => { if (cur.length === k) { out.push([...cur]); return; } for (let j = i; j <= a.length - (k - cur.length); j++) { cur.push(a[j]); go(j + 1, cur); cur.pop(); } };
    go(0, []);
    return out;
  };
  let cases = 0, plainMiss = 0, tierMiss = 0, tierGap = 0;
  for (let t = 0; t < 24; t++) {
    const pool: FillCard[] = [];
    const runsR = new Map<number, number>(), runsL = new Map<number, number>();
    for (let i = 0; i < 10; i++) {
      const id = i + 1, val = 40 + Math.floor(rnd() * 60);
      const pos: Record<string, number> = { [POSN[i % 3]]: 60 + Math.floor(rnd() * 40) };
      if (rnd() < 0.5) pos[POSN[Math.floor(rnd() * 3)]] ??= 50 + Math.floor(rnd() * 40);
      pool.push({ ...hitter(id, pos), val });
      const b = (val - 70) * 0.9 + (rnd() - 0.5) * 30, sp = (rnd() - 0.5) * 20;
      runsR.set(id, b + sp); runsL.set(id, b - sp);
    }
    for (let i = 0; i < 8; i++) {
      const id = 11 + i, val = 40 + Math.floor(rnd() * 60), role = i < 5 ? "SP" : "RP";
      pool.push({ cardId: id, name: `P${id}`, val, year: 1950, isPitcher: true, role, cardType: 4, ratings: { Stamina: role === "SP" ? 70 : 20 }, baseOwned: true, variantOwned: false, variant: false });
      const r = (val - 70) * 0.9 + (rnd() - 0.5) * 30;
      runsR.set(id, r); runsL.set(id, r);
    }
    const cap = Math.round(9 * (pool.reduce((n, c) => n + (c.val ?? 0), 0) / pool.length + 3));
    const capped: RosterRules = { ...rules, dh: true, restrictions: { cards: 9, teamCap: cap } };
    const obj = rosterObjective(pool, { shape: small, runsR, runsL });
    const elig = (k: string, c: FillCard) => {
      const p = k.includes(":") ? k.split(":")[1] : k;
      if (/^SP/.test(p)) return c.isPitcher && c.role === "SP";
      if (/^RP|^CL/.test(p)) return c.isPitcher;
      if (/^BN/.test(p) || p === "DH") return !c.isPitcher;
      return !c.isPitcher && (c.ratings[`Pos Rating ${p}`] ?? 0) > 0;
    };
    const solve = (rows: string[], cs: FillCard[]) => {
      const m = rows.map((k) => cs.map((c) => (elig(k, c) ? obj.slotValue(k, c.cardId) : -Infinity)));
      const a = maxAssignment(m);
      if (!a || a.some((j, i) => !Number.isFinite(m[i][j]))) return null;
      return { total: a.reduce((s, j, i) => s + m[i][j], 0), ids: a.map((j) => cs[j].cardId) };
    };
    const rRows = [...small.lineupPos.map((p) => `R:${p}`), ...small.benchKeys], lRows = small.lineupPos.map((p) => `L:${p}`), staff = [...small.spKeys, ...small.rpKeys];
    // The true best, and any legal board to start from.
    let best = -Infinity, start: Record<string, number> | null = null, worst = Infinity;
    const hit = combos(pool.filter((c) => !c.isPitcher), 5).flatMap((H) => {
      const r = solve(rRows, H), l = solve(lRows, H);
      return r && l ? [{ v: H.reduce((n, c) => n + (c.val ?? 0), 0), total: r.total + l.total, r, l }] : [];
    });
    const arm = combos(pool.filter((c) => c.isPitcher), 4).flatMap((S) => {
      const s = solve(staff, S);
      return s ? [{ v: S.reduce((n, c) => n + (c.val ?? 0), 0), total: s.total, s }] : [];
    });
    for (const h of hit) for (const a of arm) {
      if (h.v + a.v > cap) continue;
      const total = h.total + a.total;
      if (total > best) best = total;
      if (total < worst) {
        worst = total;
        start = Object.fromEntries([...rRows.map((k, i) => [k, h.r.ids[i]]), ...lRows.map((k, i) => [k, h.l.ids[i]]), ...staff.map((k, i) => [k, a.s.ids[i]])]);
      }
    }
    if (!start || !Number.isFinite(best)) continue;
    cases++;
    const opts = { objective: obj.objective, slotValue: obj.slotValue, pairMoves: { aTop: 10, bCheapest: 12, rank: obj.rank }, maxPasses: 80 };
    // From the WORST legal board, so the climb has the whole way to go.
    const plain = optimizeRoster(start, pool, capped, small, opts);
    const tier = optimizeRoster(start, pool, capped, small, { ...opts, staffTier: true, capTier: true });
    for (const r of [plain, tier]) {
      assert.equal(r.legal, true, `case ${t}`);
      assert.ok(r.score <= best + 1e-6, `case ${t}: the search (${r.score}) cannot beat every roster there is (${best})`);
    }
    assert.ok(tier.score >= plain.score - 1e-9, `case ${t}: the tiers never finish below the plain climb`);
    if (best - plain.score > 1e-6) plainMiss++;
    if (best - tier.score > 1e-6) { tierMiss++; tierGap += best - tier.score; }
  }
  assert.ok(cases >= 20, `${cases} cases`);
  assert.ok(tierMiss <= plainMiss, `tiers miss ${tierMiss}, plain ${plainMiss}`);
  // Where the search stands today, from one start: a later change that does worse fails here.
  // (11 of 24 and a mean gap of 0.69 runs on 2026-11-12, from one start at the worst legal board.)
  assert.ok(tierMiss <= Math.ceil(cases * 0.5), `the best roster missed in ${tierMiss} of ${cases}`);
  assert.ok(tierGap / cases < 1.0, `mean gap ${(tierGap / cases).toFixed(2)} runs`);
});
