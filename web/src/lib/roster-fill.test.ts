import { test } from "node:test";
import assert from "node:assert/strict";
import { eraStaff, fillRoster, fitMaps, HIT_POS, isComplete, rosterShape, type FillCard, type FillShape } from "./roster-fill";
import { validateRoster, type RosterRules, type RosterSlot } from "./roster-rules";

test("era staff sizes follow L.J.'s bands (2026-09-07) and hitters take the rest", () => {
  assert.deepEqual([eraStaff(2024).sp, eraStaff(2024).rp], [5, 7], "L.J. 10-04: 5 SP at most, never 8 RP, never 13 arms");
  assert.deepEqual([eraStaff(2006).sp, eraStaff(2006).rp], [5, 7]);
  assert.deepEqual([eraStaff(1984).sp, eraStaff(1984).rp], [5, 6]);
  assert.deepEqual([eraStaff(1968).sp, eraStaff(1968).rp], [5, 5]);
  assert.deepEqual([eraStaff(1935).sp, eraStaff(1935).rp], [4, 4]);
  assert.deepEqual([eraStaff(1907).sp, eraStaff(1907).rp], [4, 3]);
  for (const y of [1907, 1935, 1968, 1984, 2006, 2024]) assert.ok(eraStaff(y).sp <= 5 && eraStaff(y).rp <= 7 && eraStaff(y).sp + eraStaff(y).rp <= 12, `5 SP, 7 RP, 12 arms at most (${y})`);
  const cap = rosterShape(1935, 8, 26, null);
  assert.deepEqual([cap.bats, cap.sp, cap.rp, cap.source], [18, 4, 4, "era"]);
  const dh = rosterShape(2010, 9, 26, null);
  assert.deepEqual([dh.bats, dh.sp, dh.rp], [14, 5, 7]);
  const observed = rosterShape(1935, 8, 26, { avgSp: 4.4, avgRp: 6, avgBats: 12.6 });
  assert.deepEqual([observed.bats, observed.sp, observed.rp, observed.source], [15, 4, 7, "observed"], "exports win over the table, but the pen stops at 7 and the staff at 12");
  const explicit = rosterShape(2010, 9, 26, { avgSp: 5, avgRp: 8, avgBats: 13 });
  assert.deepEqual([explicit.bats, explicit.sp, explicit.rp], [14, 5, 7], "--sp 5 --rp 8 comes out 5 SP / 7 RP / 14 bats");
  const six = rosterShape(2010, 9, 26, { avgSp: 6, avgRp: 6, avgBats: 14 });
  assert.deepEqual([six.bats, six.sp, six.rp], [14, 5, 7], "a 6th starter goes to the pen as a long man");
  const deadball = rosterShape(1910, 8, 26, { avgSp: 4, avgRp: 3, avgBats: 19 });
  assert.deepEqual([deadball.bats, deadball.sp, deadball.rp], [19, 4, 3], "small staffs are left alone");
  assert.equal(rosterShape(1935, 8, 22, null).bats, 14, "roster size other than 26");
  const modernCards = rosterShape(1957, 9, 26, null, 1990);
  assert.deepEqual([modernCards.bats, modernCards.sp, modernCards.rp], [15, 5, 6], "1957 RE with 1990-on cards staffs like the 1990s");
  assert.deepEqual([rosterShape(2009, 9, 26, null, 1800).sp, rosterShape(2009, 9, 26, null, 1800).rp], [5, 7], "an older card window leaves a modern RE alone");
});

/* ---- a synthetic pool: 40 hitters across the positions, 24 arms ---- */
function hitter(id: number, pos: string, off: number, def: number, val: number, extraPos?: [string, number]): FillCard {
  const r: Record<string, number> = { Eye: off, "Eye vL": off - 5, "Eye vR": off + 5, "Avoid Ks": off, "Avoid K vL": off, "Avoid K vR": off, Power: off, "Power vL": off, "Power vR": off, Gap: off, "Gap vL": off, "Gap vR": off, [`Pos Rating ${pos}`]: def };
  if (extraPos) r[`Pos Rating ${extraPos[0]}`] = extraPos[1];
  return { cardId: id, name: `H${id}`, val, year: 1950, isPitcher: false, role: null, cardType: 4, ratings: r, baseOwned: true, variantOwned: false, variant: false };
}
function arm(id: number, role: string, q: number, val: number): FillCard {
  return { cardId: id, name: `P${id}`, val, year: 1950, isPitcher: true, role, cardType: 4, ratings: { pHR: q, Stuff: q, Control: q, pBABIP: q, "pHR vL": q, "pHR vR": q, "Stuff vL": q, "Stuff vR": q, "Control vL": q, "Control vR": q }, baseOwned: true, variantOwned: false, variant: false };
}
function pool(): FillCard[] {
  const out: FillCard[] = [];
  let id = 1;
  for (const pos of HIT_POS) for (let i = 0; i < 5; i++) out.push(hitter(id++, pos, 60 + i * 8, 50 + i * 5, 55 + i * 4));
  for (let i = 0; i < 12; i++) out.push(arm(id++, "SP", 50 + i * 4, 55 + i * 2));
  for (let i = 0; i < 12; i++) out.push(arm(id++, i === 0 ? "CL" : "RP", 45 + i * 4, 52 + i * 2));
  return out;
}
const ENV_YEAR = 1935;
const rules = (extra: Partial<RosterRules> = {}): RosterRules => ({
  name: "Synthetic 1935", dh: false, ratingsMin: null, ratingsMax: 74, cardYearMin: null, cardYearMax: null, isDraft: false, restrictions: { cards: 26 }, ...extra,
});
const shapeFor = (): FillShape => {
  const s = rosterShape(ENV_YEAR, 8, 26, null);
  return { lineupPos: [...HIT_POS], bats: s.bats, spKeys: Array.from({ length: s.sp }, (_, i) => `SP${i + 1}`), rpKeys: ["CL", ...Array.from({ length: s.rp - 1 }, (_, i) => `RP${i + 1}`)], benchKeys: Array.from({ length: s.bats - 8 }, (_, i) => `BN${i + 1}`) };
};
const toSlots = (res: Record<string, number>, lineup: readonly string[]): RosterSlot[] => Object.entries(res).map(([k, cardId]) => { const [a, b] = k.split(":"); return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineup.indexOf(b) + 1 : null, useVariant: false }; });

test("fill completes a legal 26 under the era shape and validateRoster agrees", () => {
  const r = rules(), p = pool(), shape = shapeFor();
  const { slots, lambda } = fillRoster(p, r, shape, fitMaps(p));
  assert.equal(lambda, 0);
  assert.ok(isComplete(slots, shape));
  const v = validateRoster(toSlots(slots, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
  assert.equal(v.counts.players, 26);
  assert.equal(shape.spKeys.length, 4); assert.equal(shape.rpKeys.length, 4); assert.equal(shape.benchKeys.length, 10);
});

test("a team cap is met by trading value down, not by leaving slots empty", () => {
  const r = rules({ restrictions: { cards: 26, teamCap: 1560 } }), p = pool(), shape = shapeFor();
  const plainValue = Object.values(fillRoster(p, rules(), shape, fitMaps(p)).slots);
  const uncapped = [...new Set(plainValue)].reduce((n, id) => n + (p.find((c) => c.cardId === id)!.val ?? 0), 0);
  assert.ok(uncapped > 1560, `uncapped fill (${uncapped}) must exceed the cap for the test to mean anything`);
  const { slots, lambda } = fillRoster(p, r, shape, fitMaps(p));
  assert.ok(lambda > 0);
  assert.ok(isComplete(slots, shape));
  const v = validateRoster(toSlots(slots, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
  assert.ok(v.counts.value <= 1560);
});

test("lineup slots score defense at the assigned position", () => {
  const p = pool();
  // a shortstop who is a poor 3B, and a real 3B with the same bat: the 3B slot must prefer the real 3B
  const ss = hitter(900, "SS", 100, 95, 70, ["3B", 10]);
  const tb = hitter(901, "3B", 100, 70, 70);
  p.push(ss, tb);
  const r = rules(), shape = shapeFor();
  const fits = fitMaps(p);
  assert.ok((fits.atR["3B"].get(901) ?? 0) > (fits.atR["3B"].get(900) ?? 0), "at 3B the real 3B outranks the SS");
  assert.ok((fits.fitR.get(900) ?? 0) >= (fits.fitR.get(901) ?? 0), "overall fit still favours the better glove");
  const { slots } = fillRoster(p, r, shape, fits);
  assert.equal(slots["R:3B"], 901);
  assert.equal(slots["R:SS"], 900);
});

/* ---- locked cards (must): carried inside the fill, under every rule ---- */
const onBoard = (res: Record<string, number>) => new Set(Object.values(res));
const keyOf = (res: Record<string, number>, id: number) => Object.keys(res).filter((k) => res[k] === id);

test("a locked bat the fill passes over is carried on the bench, and the board stays a legal 26", () => {
  const r = rules(), p = pool(), shape = shapeFor(), fits = fitMaps(p);
  const weakC = p.find((c) => !c.isPitcher && c.ratings["Pos Rating C"] && c.ratings.Eye === 60)!;
  assert.ok(!onBoard(fillRoster(p, r, shape, fits).slots).has(weakC.cardId), "the plain fill leaves him out");
  const { slots } = fillRoster(p, r, shape, fits, new Set([weakC.cardId]));
  assert.deepEqual(keyOf(slots, weakC.cardId).map((k) => k.slice(0, 2)), ["BN"]);
  const v = validateRoster(toSlots(slots, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
  assert.equal(v.counts.players, 26);
});

test("a locked starter takes a rotation slot instead of making a 27th player", () => {
  const r = rules(), p = pool(), shape = shapeFor(), fits = fitMaps(p);
  const weakSp = p.filter((c) => c.role === "SP").sort((a, b) => (a.val ?? 0) - (b.val ?? 0))[0];
  const { slots } = fillRoster(p, r, shape, fits, new Set([weakSp.cardId]));
  assert.ok(keyOf(slots, weakSp.cardId)[0]?.startsWith("SP"));
  const v = validateRoster(toSlots(slots, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
  assert.equal(v.counts.players, 26);
});

test("tier slots count the locked card; one that no longer fits is left off, and the board still completes", () => {
  const r = rules({ restrictions: { cards: 26, slots: { S: 2, B: 24, I: 26 } } }), p = pool(), shape = shapeFor(), fits = fitMaps(p);
  const silverRp = p.filter((c) => c.isPitcher && c.role !== "SP" && (c.val ?? 0) >= 70).sort((a, b) => (a.val ?? 0) - (b.val ?? 0));
  assert.equal(silverRp.length, 3);
  const one = fillRoster(p, r, shape, fits, new Set([silverRp[0].cardId])).slots;
  assert.ok(onBoard(one).has(silverRp[0].cardId));
  let v = validateRoster(toSlots(one, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
  const three = fillRoster(p, r, shape, fits, new Set(silverRp.map((c) => c.cardId))).slots;
  assert.deepEqual(silverRp.map((c) => onBoard(three).has(c.cardId)), [true, true, false], "two Silver slots: the third lock is left off");
  assert.ok(isComplete(three, shape));
  v = validateRoster(toSlots(three, shape.lineupPos), p, r);
  assert.equal(v.ready, true, [...v.errors, ...v.incomplete].map((e) => e.message).join(" | "));
});

test("a locked bat the board has no slot for is released, not left holding a roster spot", () => {
  const r = rules({ restrictions: { cards: 16 } }), p = pool(), fits = fitMaps(p);
  const shape: FillShape = { lineupPos: [...HIT_POS], bats: 8, spKeys: ["SP1", "SP2", "SP3", "SP4"], rpKeys: ["CL", "RP1", "RP2", "RP3"], benchKeys: [] };
  const weakC = p.find((c) => !c.isPitcher && c.ratings["Pos Rating C"] && c.ratings.Eye === 60)!;
  const { slots } = fillRoster(p, r, shape, fits, new Set([weakC.cardId]));
  assert.ok(!onBoard(slots).has(weakC.cardId));
  assert.ok(isComplete(slots, shape), "eight starters, not seven and an empty spot");
});
