import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceLine, evidenceRule, liveAbsent, setRuleGuard, setsNarrow, summariseSetEvidence, yearsNarrow } from "./set-evidence";
import { cardTypeRuleLabel, parseCardTypeRule } from "./roster-rules";

const rows = (spec: [cardType: number, year: number, n: number][]) =>
  spec.flatMap(([cardType, year, n]) => Array.from({ length: n }, () => ({ cardType, year })));

// Daily All-Star Hardware Slots (9100139) as its field played it through 2026-09-27.
const hardware = summariseSetEvidence(rows([[5, 1874, 1], [5, 1957, 208], [9, 2022, 111]]))!;
// Daily Live Plus (9100186): 2026 cards of four sets.
const livePlus = summariseSetEvidence(rows([[1, 2026, 141], [6, 2026, 60], [7, 2026, 3], [5, 2026, 2]]))!;
const none = { cardTypes: false, cardYears: false, anySet: false };

test("counts cards per set, most-played first, with the years", () => {
  assert.equal(hardware.n, 320);
  assert.deepEqual(hardware.types, [5, 9]);
  assert.deepEqual(hardware.counts, { 5: 209, 9: 111 });
  assert.deepEqual([hardware.yearMin, hardware.yearMax], [1874, 2022]);
  assert.equal(evidenceLine(hardware), "HAS 209 · HH 111 (320 cards)");
  assert.equal(summariseSetEvidence([]), null);
});

test("the implied rule is in the form the catalogue stores and the parser reads", () => {
  assert.equal(evidenceRule(hardware), "Historical All-Star+Hardware Heroes");
  assert.deepEqual(parseCardTypeRule(evidenceRule(hardware))?.sort(), [5, 9]);
  for (let code = 1; code <= 10; code++) assert.deepEqual(parseCardTypeRule(cardTypeRuleLabel([code])), [code], `set ${code} round-trips`);
});

test("narrow means enough cards from three sets or fewer, or from one year", () => {
  assert.ok(setsNarrow(hardware));
  assert.ok(!setsNarrow(livePlus), "four sets");
  assert.ok(yearsNarrow(livePlus));
  assert.ok(!yearsNarrow(hardware));
  assert.ok(!setsNarrow(summariseSetEvidence(rows([[1, 2026, 40]]))!), "40 cards is too few to call it a rule");
});

test("the roster scripts stop on narrow evidence until a rule or --any-set is given", () => {
  const stop = setRuleGuard("allstarhardwareslots", hardware, none)!;
  assert.match(stop, /--card-types 5,9/);
  assert.match(stop, /Historical All-Star\+Hardware Heroes/);
  assert.equal(setRuleGuard("allstarhardwareslots", hardware, { ...none, cardTypes: true }), null);
  assert.equal(setRuleGuard("allstarhardwareslots", hardware, { ...none, anySet: true }), null);

  assert.match(setRuleGuard("liveplus", livePlus, none)!, /--card-year-min 2026 --card-year-max 2026/);
  assert.equal(setRuleGuard("liveplus", livePlus, { ...none, cardYears: true }), null);
  // Sets and years are separate rules: --card-types 1,6 let older-year Future Legends into Live Plus.
  assert.match(setRuleGuard("liveplus", livePlus, { ...none, cardTypes: true })!, /--card-year-min 2026/);

  const wide = summariseSetEvidence(rows([[1, 2026, 30], [2, 1880, 30], [4, 1960, 30], [5, 1980, 30], [8, 1990, 30]]));
  assert.equal(setRuleGuard("dankdaily", wide, none), null);
  assert.equal(setRuleGuard("nothing", null, none), null, "no exports, nothing to go on");
});

test("a year range or a missing Live set is a rule too", () => {
  // Iron & Friends OOTP Era: 263 cards, all 1999–2026, many sets.
  const ootpEra = summariseSetEvidence(rows([[1, 2026, 59], [7, 2005, 51], [8, 2010, 32], [5, 1999, 31], [6, 2020, 24], [9, 2003, 23], [3, 2012, 18], [10, 2001, 17], [4, 2008, 8]]))!;
  assert.ok(!setsNarrow(ootpEra));
  assert.ok(yearsNarrow(ootpEra));
  assert.match(setRuleGuard("ironandfriends", ootpEra, { cardTypes: false, cardYears: false, anySet: false })!, /--card-year-min 1999 --card-year-max 2026/);
  // Monday Up And At Them Bronze: 623 cards, 1873–2026, never a Live card.
  const noLive = summariseSetEvidence(rows([[7, 1950, 231], [8, 1873, 106], [3, 2026, 75], [5, 1990, 67], [10, 2000, 47], [2, 1920, 36], [4, 1900, 29], [6, 2024, 16], [9, 1985, 16]]))!;
  assert.ok(liveAbsent(noLive));
  assert.ok(!yearsNarrow(noLive));
  assert.match(setRuleGuard("bronzeweekly", noLive, { cardTypes: false, cardYears: false, anySet: false })!, /every set but Live/);
  assert.ok(!liveAbsent(summariseSetEvidence(rows([[7, 1950, 120], [5, 1990, 80]]))!), "200 cards is too few to call a missing Live set a rule");
});

test("cards with no set or year don't count toward a reading", () => {
  const e = summariseSetEvidence([...rows([[1, 2026, 5]]), ...Array.from({ length: 45 }, () => ({ cardType: null, year: null }))])!;
  assert.equal(e.n, 5);
  assert.equal(e.nYears, 5);
  assert.ok(!setsNarrow(e), "5 typed cards is too few");
});
