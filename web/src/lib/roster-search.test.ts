import { test } from "node:test";
import assert from "node:assert/strict";
import { fitMaps, type FillCard, type FillShape } from "./roster-fill";
import { rosterObjective } from "./roster-objective";
import type { RosterRules } from "./roster-rules";
import { fromPlainFits, runSearch, searchCard, searchStarts, toPlainFits, type SearchMessage, type SearchRequest } from "./roster-search";

const hit = (id: number, pos: Record<string, number>, val = 80): FillCard => ({
  cardId: id, name: `H${id}`, val, year: 1990, isPitcher: false, role: null, cardType: 4,
  ratings: { ...Object.fromEntries(Object.entries(pos).map(([p, r]) => [`Pos Rating ${p}`, r])), Eye: 60 + id, Power: 50 + id },
  baseOwned: true, variantOwned: false, variant: false,
});
const arm = (id: number, role: string, val = 80): FillCard => ({
  cardId: id, name: `P${id}`, val, year: 1990, isPitcher: true, role, cardType: 4,
  ratings: { Stuff: 50 + id, Control: 60 }, baseOwned: true, variantOwned: false, variant: false,
});
const pool = [
  hit(1, { C: 90 }), hit(2, { C: 85 }), hit(3, { "1B": 90 }), hit(4, { "1B": 80 }), hit(5, { SS: 90 }), hit(6, { SS: 80 }),
  arm(11, "SP"), arm(12, "SP"), arm(13, "RP"), arm(14, "RP"),
];
const rules: RosterRules = { name: "Synthetic", dh: false, ratingsMin: null, ratingsMax: null, cardYearMin: null, cardYearMax: null, isDraft: false, restrictions: { cards: 6 } };
const shape: FillShape = { lineupPos: ["C", "1B", "SS"], spKeys: ["SP1"], rpKeys: ["CL"], benchKeys: ["BN1"], bats: 4 };
const runs = new Map<number, number>([[1, 5], [2, 3], [3, 10], [4, 2], [5, 8], [6, 1], [11, 6], [12, 9], [13, 4], [14, 7]]);

const request = (over: Partial<SearchRequest> = {}): SearchRequest => ({
  mode: "quick", board: { "R:C": 2 }, pool, rules, shape, fits: toPlainFits(fitMaps(pool)),
  runsR: [...runs], runsL: [...runs], lhpShare: 0.3, locks: [], minCatchers: 0, ...over,
});
const collect = (req: SearchRequest, now?: () => number) => {
  const out: SearchMessage[] = [];
  runSearch(req, (m) => out.push(m), now);
  return out;
};

test("fit maps survive the trip to the worker, and cards travel light", () => {
  const f = fitMaps(pool);
  assert.deepEqual(fromPlainFits(JSON.parse(JSON.stringify(toPlainFits(f)))), f);
  const slim = searchCard(pool[0]);
  assert.deepEqual(slim.ratings, { "Pos Rating C": 90 }, "only position ratings");
  assert.equal(slim.cardType, 4);
});

test("the board as it stands is the first start, its holes filled from the greedy fill", () => {
  const starts = searchStarts(request());
  assert.equal(starts[0].label, "your board");
  assert.equal(starts[0].slots["R:C"], 2, "his pick stays");
  assert.equal(starts[1].label, "the greedy fill");
  assert.notEqual(starts[1].slots["R:C"], 2);
  for (const s of starts) assert.equal(Object.keys(s.slots).length, 9, `${s.label} fills all nine slots`);
  const keys = starts.map((s) => [...new Set(Object.values(s.slots))].sort((a, b) => a - b).join(","));
  assert.equal(new Set(keys).size, keys.length, "distinct rosters only");
});

test("quick mode climbs each start once, posting progress before each and the best at the end", () => {
  const msgs = collect(request());
  const starts = searchStarts(request());
  const end = msgs.at(-1)!;
  assert.equal(end.type, "done");
  const polished = msgs.filter((m) => m.current?.endsWith(", full pool")).length;
  assert.ok(polished >= 1 && polished <= 2, "its best boards are polished over the full pool");
  assert.equal(end.done, starts.length + polished);
  assert.equal(end.total, end.done);
  assert.equal(end.cut, false);
  assert.deepEqual(msgs.slice(0, starts.length).map((m) => m.current), starts.map((s) => s.label));
  assert.deepEqual(msgs.slice(0, -1).map((m) => m.done), msgs.slice(0, -1).map((_, i) => i));
  const obj = rosterObjective(pool, { shape, runsR: runs, runsL: runs, lhpShare: 0.3 });
  assert.ok(end.best);
  assert.ok(Math.abs(end.best.score - obj.objective(end.best.slots)) < 1e-9);
  assert.equal(end.best.slots["R:1B"], 3, "the best 1B bat starts");
  for (const s of starts) assert.ok(end.best.score >= obj.objective(s.slots) - 1e-9, `never worse than ${s.label}`);
});

test("deep mode climbs each start under both settings", () => {
  const msgs = collect(request({ mode: "deep" }));
  const end = msgs.at(-1)!;
  const n = searchStarts(request({ mode: "deep" })).length;
  const polished = msgs.filter((m) => m.current?.endsWith(", full pool")).length;
  assert.ok(polished >= 1 && polished <= 3);
  assert.equal(end.done, 2 * n + polished);
  assert.equal(end.total, end.done);
  assert.ok(msgs.some((m) => m.current?.endsWith(", wide")));
});

test("quick mode starts no climb after its time budget; the first always runs", () => {
  let calls = 0;
  const clock = () => 20_000 * calls++; // each reading is 20 s later
  const end = collect(request({ budgetMs: 10_000 }), clock).at(-1)!;
  assert.equal(end.done, 2, "one climb, then its board polished");
  assert.equal(end.cut, true);
  assert.ok(end.best, "the one climb's board is kept");
  calls = 0;
  const deep = collect(request({ mode: "deep", budgetMs: 10_000 }), clock).at(-1)!;
  assert.equal(deep.cut, false, "Search longer has no budget");
  assert.equal(deep.done, deep.total);
});

test("a locked card is on every board the search keeps", () => {
  const end = collect(request({ locks: [6], board: {} })).at(-1)!;
  assert.ok(end.best && Object.values(end.best.slots).includes(6), "the weak SS stays because he is locked");
});
