import { test } from "node:test";
import assert from "node:assert/strict";
import { eraStaff, fillRoster, fitMaps, HIT_POS, isComplete, rosterShape, type FillCard, type FillShape } from "./roster-fill";
import { validateRoster, type RosterRules, type RosterSlot } from "./roster-rules";

test("era staff sizes follow L.J.'s bands (2026-09-07) and hitters take the rest", () => {
  assert.deepEqual([eraStaff(2024).sp, eraStaff(2024).rp], [5, 8]);
  assert.deepEqual([eraStaff(2006).sp, eraStaff(2006).rp], [5, 7]);
  assert.deepEqual([eraStaff(1984).sp, eraStaff(1984).rp], [5, 6]);
  assert.deepEqual([eraStaff(1968).sp, eraStaff(1968).rp], [5, 5]);
  assert.deepEqual([eraStaff(1935).sp, eraStaff(1935).rp], [4, 4]);
  assert.deepEqual([eraStaff(1907).sp, eraStaff(1907).rp], [4, 3]);
  for (const y of [1907, 1935, 1968, 1984, 2006, 2024]) assert.ok(eraStaff(y).rp <= 8, `never 9 RP (${y})`);
  const cap = rosterShape(1935, 8, 26, null);
  assert.deepEqual([cap.bats, cap.sp, cap.rp, cap.source], [18, 4, 4, "era"]);
  const dh = rosterShape(2010, 9, 26, null);
  assert.deepEqual([dh.bats, dh.sp, dh.rp], [13, 5, 8]);
  const observed = rosterShape(1935, 8, 26, { avgSp: 4.4, avgRp: 6, avgBats: 12.6 });
  assert.deepEqual([observed.bats, observed.sp, observed.rp, observed.source], [13, 4, 9, "observed"], "exports win over the table");
  assert.equal(rosterShape(1935, 8, 22, null).bats, 14, "roster size other than 26");
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
