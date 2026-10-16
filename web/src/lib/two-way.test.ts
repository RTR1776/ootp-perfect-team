import { test } from "node:test";
import assert from "node:assert/strict";
import { canHit, canPitch, cardIdOf, formIdForSlot, twoWayForm, twoWayId, withTwoWayForms } from "./two-way";
import { FIELD_POSITIONS, fitsPosition, validateRoster, type RosterCard, type RosterRules, type RosterSlot } from "./roster-rules";

// Ohtani's 2026 Live card (81776): listed DH, full pitching splits.
const ohtani = { "Stuff vL": 118, "Stuff vR": 120, "Control vL": 78, "Control vR": 79, "pHR vL": 110, "pHR vR": 112, "pBABIP vL": 114, "pBABIP vR": 118, Stamina: 82, Power: 108, Eye: 103, "Avoid Ks": 64, BABIP: 102, Gap: 93, "Power vL": 101, "Power vR": 110 };
// A plain bat: OOTP rates a non-pitcher 1 on every pitching split.
const cruz = { "Stuff vL": 1, "Stuff vR": 1, "Control vL": 1, "Control vR": 1, "pHR vL": 1, "pHR vR": 1, "pBABIP vL": 75, "pBABIP vR": 74, Power: 100, Eye: 94, "Avoid Ks": 53, BABIP: 139, Gap: 72, "Power vL": 99, "Power vR": 101 };
// Ruth's 1916 SP card (86439) and a pitcher who can't hit.
const ruth = { Power: 105, Eye: 79, "Avoid Ks": 62, BABIP: 91, Gap: 99, "Power vL": 10, "Power vR": 133 };
const weakBat = { Power: 20, Eye: 25, "Avoid Ks": 30, BABIP: 30, Gap: 20, "Power vL": 18, "Power vR": 22 };

// Tyler Fitzgerald's SS card (84362): mop-up Stuff/Control/pHR, pBABIP left blank.
const mopUp = { "Stuff vL": 35, "Stuff vR": 43, "Control vL": 60, "Control vR": 63, "pHR vL": 51, "pHR vR": 64, "pBABIP vL": 1, "pBABIP vR": 1 };

test("who has the other role: real pitching splits, or a pitcher's bat over the floor", () => {
  assert.equal(canPitch(ohtani), true);
  assert.equal(canPitch(cruz), false);
  assert.equal(canPitch(mopUp), false, "a blank pBABIP is not a pitcher");
  assert.equal(canHit(ruth), true);
  assert.equal(canHit(weakBat), false);
});

test("the other-role form has its own id, the flipped role and the same player; ids map back", () => {
  const c = { cardId: 81776, isPitcher: false, role: null, ratings: ohtani, player: "ohtansh01" };
  const f = twoWayForm(c)!;
  assert.equal(f.cardId, twoWayId(81776));
  assert.equal(f.isPitcher, true);
  assert.equal(f.player, "ohtansh01");
  assert.equal(cardIdOf(f.cardId), 81776);
  assert.equal(cardIdOf(-twoWayId(81776)), 81776, "a variant's two-way form too");
  assert.equal(twoWayForm(f), null, "a form has no form of its own");
  assert.equal(twoWayForm({ cardId: 81904, isPitcher: false, role: null, ratings: cruz }), null);
  assert.equal(withTwoWayForms([c, { cardId: 81904, isPitcher: false, role: null, ratings: cruz }]).length, 3);
});

test("a saved slot resolves to the form that plays it", () => {
  const pool = new Map([[81776, { isPitcher: false }], [twoWayId(81776), { isPitcher: true }], [81904, { isPitcher: false }]]);
  const has = (id: number) => pool.get(id);
  assert.equal(formIdForSlot(81776, "SP1", has), twoWayId(81776));
  assert.equal(formIdForSlot(81776, "R:DH", has), 81776);
  assert.equal(formIdForSlot(81776, "CL", has), twoWayId(81776));
  assert.equal(formIdForSlot(81904, "SP1", has), 81904, "no form: left as saved, for the rules to reject");
});

const rules: RosterRules = { dh: true, ratingsMin: 40, ratingsMax: 105, cardYearMin: null, cardYearMax: null, isDraft: false, restrictions: null };
const card = (cardId: number, isPitcher: boolean, ratings: Record<string, number>, role: string | null = null): RosterCard =>
  ({ cardId, name: `Card ${cardId}`, val: 80, year: 2000, isPitcher, role, cardType: 7, baseOwned: true, variantOwned: false, ratings });

test("the rules take a two-way card in either role, not both at once", () => {
  const sho = card(1, false, ohtani), bat = card(2, false, cruz), babe = card(3, true, ruth, "SP"), arm = card(4, true, weakBat, "SP");
  assert.equal(fitsPosition(sho, "SP1"), true);
  assert.equal(fitsPosition(sho, "CL"), true);
  assert.equal(fitsPosition(bat, "SP1"), false);
  assert.equal(fitsPosition(babe, "DH"), true);
  assert.equal(fitsPosition(babe, "BN1"), true);
  assert.equal(fitsPosition(babe, "1B"), false, "no 1B rating");
  assert.equal(fitsPosition(arm, "DH"), false);

  // A full roster with the two-way hitter in the rotation.
  const field = Object.fromEntries(FIELD_POSITIONS.map((p) => [`Pos Rating ${p}`, 60]));
  const cards: RosterCard[] = Array.from({ length: 26 }, (_, i) => card(i + 10, i >= 14, { ...field, ...cruz }, i >= 14 ? "SP" : null));
  cards[14] = { ...sho, cardId: 24 };
  const slots: RosterSlot[] = [];
  for (const hand of ["R", "L"]) [...FIELD_POSITIONS, "DH"].forEach((slot, i) => slots.push({ cardId: i + 10, slot, versusHand: hand, lineupOrder: i + 1, useVariant: false }));
  for (let i = 9; i < 26; i++) slots.push({ cardId: i + 10, slot: i < 14 ? `BN${i - 8}` : i < 19 ? `SP${i - 13}` : i < 20 ? "CL" : `RP${i - 19}`, versusHand: "both", lineupOrder: null, useVariant: false });
  const ok = validateRoster(slots, cards, rules);
  assert.deepEqual(ok.errors, [], "Ohtani at SP1 is legal");

  // The same card at DH too: one way per roster.
  const both = slots.map((s) => (s.slot === "DH" && s.versusHand === "R" ? { ...s, cardId: 24 } : s));
  assert.ok(validateRoster(both, cards, rules).errors.some((e) => e.code === "two-way-both"));
});
