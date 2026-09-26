import { test } from "node:test";
import assert from "node:assert/strict";
import { maxAssignment } from "./assign";
import { optimizeRoster } from "./roster-optimize";
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
