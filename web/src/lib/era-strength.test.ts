import test from "node:test";
import assert from "node:assert/strict";
import { ERAS, ERA_TIERS, oneForm, teamRuns, tierView, valueAt, type EraCard } from "./era-strength";
import { fieldingRuns } from "@/lib/analytics/fielding";

const flat = (x: number) => ERAS.map(() => x);
const glove = flat(1);
let next = 1;
const bat = (o: Partial<EraCard> & { runs: number[] }): EraCard => ({
  id: next++, name: `Bat ${next}`, val: 65, year: 1990, set: 5, le: false, released: "2026-03-20",
  role: null, owned: false, variant: false, pos: {}, ask: 1000, last10: 900, ...o,
});
const arm = (role: "SP" | "RP", runs: number[], o: Partial<EraCard> = {}) => bat({ role, runs, ...o });
const bronze = ERA_TIERS[0];

test("the five eras are read at three PT environments each", () => {
  assert.equal(ERAS.length, 5);
  for (const e of ERAS) assert.equal(e.years.length, 3);
});

test("a bat plays a spot only at L.J.'s floor of 60; DH takes any bat; arms stay in their role", () => {
  const c = bat({ runs: flat(5), pos: { SS: 80, "2B": 59 } });
  assert.deepEqual(valueAt(c, "SS", glove), flat(5 + fieldingRuns("SS", 80)));
  assert.equal(valueAt(c, "2B", glove), null, "59 at second is under the floor");
  assert.deepEqual(valueAt(c, "DH", glove), flat(5));
  assert.equal(valueAt(c, "SP", glove), null);
  const sp = arm("SP", flat(3));
  assert.deepEqual(valueAt(sp, "SP", glove), flat(3));
  assert.equal(valueAt(sp, "RP", glove), null);
  assert.equal(valueAt(sp, "DH", glove), null);
});

test("the glove counts for more in an era that puts more balls in play", () => {
  const c = bat({ runs: flat(0), pos: { SS: 150 } });
  assert.ok(fieldingRuns("SS", 150) > 0);
  const v = valueAt(c, "SS", [1.3, 1, 1, 1, 0.8])!;
  assert.ok(v[0] > v[4]);
});

test("the team total uses each card once, filling the scarce gloves first", () => {
  // One great shortstop who can also play first, and a first baseman.
  const ss = bat({ runs: flat(20), pos: { SS: 90, "1B": 90 } });
  const first = bat({ runs: flat(5), pos: { "1B": 80 } });
  const total = teamRuns([ss, first], glove, 0);
  const expected = 20 + fieldingRuns("SS", 90) + 5 + fieldingRuns("1B", 80);
  assert.ok(Math.abs(total - expected) < 1e-9, `${total} vs ${expected}`);
});

test("his variant stands in for the base card, once", () => {
  const base = bat({ id: 500, runs: flat(1), owned: true });
  const v = { ...base, variant: true, runs: flat(4) };
  const forms = oneForm([base, v]);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].variant, true);
});

test("the tier view: the gap to the best, and the top unowned cards ranked by average or worst era", () => {
  const mine = bat({ runs: flat(2), pos: { C: 80 }, owned: true });
  const steady = bat({ runs: flat(4), pos: { C: 80 } });
  const spiky = bat({ runs: [30, 0, 0, 0, -5], pos: { C: 80 } });
  const tooDear = bat({ runs: flat(50), pos: { C: 80 }, val: 75 });
  const view = tierView([mine, steady, spiky, tooDear], bronze, glove);

  const c = view.spots.avg.find((r) => r.spot === "C")!;
  assert.equal(c.mine?.card.id, mine.id);
  assert.equal(c.best?.card.id, spiky.id, "spiky has the higher average (5 against 4)");
  assert.ok(Math.abs(c.gap[0]! - 28) < 1e-9, "the deadball gap is spiky's 30 against his 2");
  assert.equal(c.gap[4], 2, "in the modern era steady is the best, 2 ahead");

  const byAvg = view.buys.avg.filter((b) => b.spot === "C").map((b) => b.card.id);
  const byWorst = view.buys.worst.filter((b) => b.spot === "C").map((b) => b.card.id);
  assert.deepEqual(byAvg, [spiky.id, steady.id], "the Silver card is over the Bronze ceiling");
  assert.deepEqual(byWorst, [steady.id, spiky.id]);
  const s = view.buys.worst.find((b) => b.card.id === steady.id)!;
  assert.deepEqual(s.gain, flat(2));
});

test("a spot he owns no one at shows no gap and no gain, not a zero", () => {
  const theirs = bat({ runs: flat(5), pos: { CF: 90 } });
  const view = tierView([theirs, arm("SP", flat(1), { owned: true })], bronze, glove);
  const cf = view.spots.avg.find((r) => r.spot === "CF")!;
  assert.equal(cf.mine, null);
  assert.deepEqual(cf.gap, ERAS.map(() => null));
  assert.deepEqual(view.buys.avg.find((b) => b.spot === "CF")!.gain, ERAS.map(() => null));
});

test("era-proof cards are his own, bats and arms ranked by their worst era", () => {
  const steady = bat({ runs: flat(3), owned: true });
  const spiky = bat({ runs: [20, 20, 20, 20, -10], owned: true });
  const ace = arm("SP", flat(2), { owned: true });
  const notMine = bat({ runs: flat(9) });
  const view = tierView([steady, spiky, ace, notMine], bronze, glove);
  assert.deepEqual(view.core.map((x) => x.card.id), [steady.id, spiky.id, ace.id]);
  assert.equal(view.core[0].spot, "DH");
});

test("an arm's gain is over the arm it would replace: his fifth starter, not his ace", () => {
  const mine = [9, 7, 5, 3, 1].map((x) => arm("SP", flat(x), { owned: true }));
  const shop = arm("SP", flat(4));
  const view = tierView([...mine, shop], bronze, glove);
  const b = view.buys.avg.find((x) => x.card.id === shop.id)!;
  assert.deepEqual(b.gain, flat(3), "4 against his fifth starter's 1");
  const four = tierView([...mine.slice(0, 4), shop], bronze, glove);
  assert.deepEqual(four.buys.avg.find((x) => x.card.id === shop.id)!.gain, ERAS.map(() => null), "with four starters there is no fifth to replace");
});

test("a card that is his best at two spots plays one: the other spot's gain is over who actually plays there", () => {
  // Greedy order fills RF before LF, so the star plays right and the weak left fielder plays left.
  const star = bat({ runs: flat(20), pos: { LF: 80, RF: 80 }, owned: true });
  const weakLeft = bat({ runs: flat(0.5), pos: { LF: 80 }, owned: true });
  const buy = bat({ runs: flat(5), pos: { LF: 80 } });
  const view = tierView([star, weakLeft, buy], bronze, glove);
  const b = view.buys.avg.find((x) => x.spot === "LF" && x.card.id === buy.id)!;
  assert.deepEqual(b.gain, flat(4.5), "over the weak left fielder, not over the star");
  const lf = view.spots.avg.find((r) => r.spot === "LF")!;
  assert.equal(lf.mine?.card.id, weakLeft.id);
  assert.deepEqual(lf.gap, flat(4.5), "the best possible team plays the buy in left");
});
