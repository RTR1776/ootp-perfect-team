import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceLine, evidenceRule, setRuleGuard, setsNarrow, summariseSetEvidence, yearsNarrow } from "./set-evidence";
import { cardTypeRuleLabel, parseCardTypeRule } from "./roster-rules";

const rows = (spec: [cardType: number, year: number, n: number][]) =>
  spec.flatMap(([cardType, year, n]) => Array.from({ length: n }, () => ({ cardType, year })));

// Daily All-Star Hardware Slots (9100139) as its field played it through 2026-09-27.
const hardware = summariseSetEvidence(rows([[5, 1957, 209], [9, 1990, 111]]))!;
// Daily Live Plus (9100186): 2026 cards of four sets.
const livePlus = summariseSetEvidence(rows([[1, 2026, 141], [6, 2026, 60], [7, 2026, 3], [5, 2026, 2]]))!;
const none = { cardTypes: false, cardYears: false, anySet: false };

test("counts cards per set, most-played first, with the years", () => {
  assert.equal(hardware.n, 320);
  assert.deepEqual(hardware.types, [5, 9]);
  assert.deepEqual(hardware.counts, { 5: 209, 9: 111 });
  assert.deepEqual([hardware.yearMin, hardware.yearMax], [1957, 1990]);
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
  assert.equal(setRuleGuard("liveplus", livePlus, { ...none, cardTypes: true }), null, "a set rule given by hand settles it");

  const wide = summariseSetEvidence(rows([[1, 2026, 30], [2, 1940, 30], [4, 1960, 30], [5, 1980, 30], [8, 1990, 30]]));
  assert.equal(setRuleGuard("dankdaily", wide, none), null);
  assert.equal(setRuleGuard("nothing", null, none), null, "no exports, nothing to go on");
});
