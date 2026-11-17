import test from "node:test";
import assert from "node:assert/strict";
import { allRounds, DRAFT_FORMATS, groupOf, inBand, inPool, keepFor, nextRound, pricedPack, replay, roundFor, roundsLeft, screenAt, screensText, stepsLeft, withCounts, type DraftFormat, type DraftGroup } from "./formats";
import type { Tier } from "@/lib/tiers";

const six = DRAFT_FORMATS["6lpowerplay"], five = DRAFT_FORMATS["5ldeadball"];
const card = (tier: Tier, group: DraftGroup) => ({ tier, group });

test("each format's rounds make its roster, tier by tier as the catalogue's slot rule has it", () => {
  const tiers = (f: typeof six) => {
    const out: Record<string, number> = {};
    for (const r of f.rounds) out[r.tier] = (out[r.tier] ?? 0) + r.count;
    return out;
  };
  assert.equal(roundsLeft(allRounds(six)), 26);
  assert.deepEqual(tiers(six), { Bronze: 19, Iron: 3, Silver: 2, Gold: 2 }, "6L slots B19 G2 I3 S2");
  assert.equal(roundsLeft(allRounds(five)), 21);
  assert.deepEqual(tiers(five), { Bronze: 17, Iron: 3, Silver: 1 }, "5L slots B17 I3 S1");
});

test("the 6L's Bronze rounds are locked to a position: two catchers, one at every other spot, five starters, five relievers", () => {
  const bronze = six.rounds.filter((r) => r.tier === "Bronze");
  assert.ok(bronze.every((r) => r.pack === "fixed"));
  const count = (g: DraftGroup) => bronze.filter((r) => r.groups.includes(g)).reduce((a, r) => a + r.count, 0);
  assert.equal(count("C"), 2);
  for (const g of ["1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const) assert.equal(count(g), 1, g);
  assert.equal(count("DH"), 1, "a DH card comes out of the 1B round");
  assert.equal(count("SP"), 5);
  assert.equal(count("RP"), 5);
  const iron = six.rounds.find((r) => r.tier === "Iron")!;
  assert.ok(!iron.groups.includes("C") && !iron.groups.includes("SP") && !iron.groups.includes("RP"), "Iron rounds are bats, never a catcher");
});

test("a pick uses up the most specific round it fits; one that fits none is reported, not forced", () => {
  const rem = allRounds(six);
  assert.equal(roundFor(six, rem, card("Bronze", "SS"))?.key, "B-SS");
  assert.equal(roundFor(six, rem, card("Bronze", "DH"))?.key, "B-1B");
  assert.equal(roundFor(six, rem, card("Gold", "SP"))?.key, "G-any");
  assert.equal(roundFor(six, rem, card("Iron", "C")), null, "no Iron catcher round");
  assert.equal(roundFor(five, allRounds(five), card("Bronze", "C"))?.key, "B");

  const r = replay(six, [card("Bronze", "C"), card("Bronze", "C"), card("Bronze", "C"), card("Silver", "RP")]);
  assert.equal(r.rem["B-C"], 0);
  assert.equal(r.unplaced, 1, "a third Bronze catcher has no round");
  assert.deepEqual(r.used, ["B-C", "B-C", null, "S-any"]);
  assert.equal(r.rem["S-any"], 1);
});

test("a card's pack group: listed position for bats, SP or RP for arms (a closer is a reliever)", () => {
  assert.equal(groupOf({ isPitcher: false, position: "SS", role: null }), "SS");
  assert.equal(groupOf({ isPitcher: false, position: "DH", role: null }), "DH");
  assert.equal(groupOf({ isPitcher: true, position: "P", role: "SP" }), "SP");
  assert.equal(groupOf({ isPitcher: true, position: "P", role: "RP" }), "RP");
  assert.equal(groupOf({ isPitcher: false, position: "P", role: null }), null, "a hitter card listed P has no bat group");
});

const tiersOf = (f: DraftFormat) => {
  const out: Record<string, number> = {};
  for (const r of f.rounds) out[r.tier] = (out[r.tier] ?? 0) + r.count;
  return out;
};

test("PTMS 3: each draft's rounds add up to its roster, in the environment and park the event screens give", () => {
  const [pd1, pd2, pd3] = [DRAFT_FORMATS.ptms3pd1, DRAFT_FORMATS.ptms3pd2, DRAFT_FORMATS.ptms3pd3];
  for (const f of [pd1, pd2, pd3]) {
    assert.equal(roundsLeft(allRounds(f)), f.cards, f.series);
    assert.equal(f.teams, 128, f.series);
    assert.ok(f.ordered, `${f.series} deals its tiers top down`);
  }
  assert.deepEqual([pd1.envYear, pd1.dh, pd1.cards], [1986, true, 26]);
  assert.deepEqual([pd2.envYear, pd2.dh, pd2.cards], [2015, true, 26]);
  assert.deepEqual([pd3.envYear, pd3.dh, pd3.cards], [1939, false, 21]);
  assert.deepEqual(tiersOf(pd3), { Perfect: 7, Bronze: 14 }, "screen: R1 pick 1, R2-4 pick 2 Perfect; then Bronze to 21");
  assert.deepEqual(tiersOf(DRAFT_FORMATS.ptcs8pdweekly), { Perfect: 8, Iron: 13 }, "L.J.'s PTCS 8 team: 8 Perfect, 13 Iron");
  assert.deepEqual(tiersOf(pd2), { Perfect: 4, Diamond: 4, Gold: 4, Silver: 6, Bronze: 6, Iron: 2 });
  assert.deepEqual(tiersOf(pd1), { Perfect: 2, Diamond: 4, Gold: 6, Silver: 6, Bronze: 6, Iron: 2 });
  // Low of Lows: each tier's bottom band, as the screen gives it (Perfect 100 only).
  const band = Object.fromEntries(pd1.rounds.map((r) => [r.tier, [r.valueMin ?? null, r.valueMax ?? null]]));
  assert.deepEqual(band, { Perfect: [100, 100], Diamond: [90, 94], Gold: [80, 84], Silver: [70, 74], Bronze: [60, 64], Iron: [40, 49] });
  assert.deepEqual(pd2.rounds.slice(0, 2).map((r) => [r.key, r.valueMin, r.valueMax ?? null]), [["P101", 101, null], ["P", 100, 100]], "round 1 101+, round 2 100");
  assert.deepEqual([pd1.starts, pd2.starts, pd3.starts], ["Sat 21 Nov, 07:59 AM", "Sat 21 Nov, 08:29 AM", "Sat 21 Nov, 08:49 AM"]);
});

test("PTMS 3: the game's 13 rounds, as the event screens list them, add up to each round kind", () => {
  for (const f of [DRAFT_FORMATS.ptms3pd1, DRAFT_FORMATS.ptms3pd2, DRAFT_FORMATS.ptms3pd3]) {
    assert.equal(f.screens?.length, 13, f.series);
    const kept: Record<string, number> = {};
    for (const s of f.screens!) kept[s.round] = (kept[s.round] ?? 0) + s.keep;
    assert.deepEqual(kept, allRounds(f), `${f.series}: each kind's count is its rounds' keeps`);
    // The list is in the format's own round order: every kind's rounds come together.
    const order = f.screens!.map((s) => s.round).filter((k, i, a) => a[i - 1] !== k);
    assert.deepEqual(order, f.rounds.map((r) => r.key), f.series);
  }
  assert.deepEqual(DRAFT_FORMATS.ptms3pd3.screens!.map((s) => s.keep), [1, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 1]);
  assert.ok(DRAFT_FORMATS.ptms3pd1.screens!.every((s) => s.keep === 2) && DRAFT_FORMATS.ptms3pd2.screens!.every((s) => s.keep === 2));
});

test("the round a pick comes from, and how many it keeps, follow the game's list by picks made", () => {
  const pd3 = DRAFT_FORMATS.ptms3pd3;
  assert.deepEqual(screenAt(pd3, 0), { no: 1, screen: { round: "P", keep: 1 }, taken: 0 });
  assert.deepEqual(screenAt(pd3, 1), { no: 2, screen: { round: "P", keep: 2 }, taken: 0 });
  assert.deepEqual(screenAt(pd3, 2), { no: 2, screen: { round: "P", keep: 2 }, taken: 1 });
  assert.equal(screenAt(pd3, 7)?.no, 5, "pick 8 is round 5, the first Bronze");
  assert.equal(screenAt(pd3, 20)?.no, 13);
  assert.equal(screenAt(pd3, 21), null, "done");
  assert.deepEqual([0, 1, 2, 7, 8, 9, 10, 19, 20].map((n) => keepFor(pd3, n)), [1, 2, 2, 1, 1, 1, 2, 2, 1]);
  assert.equal(keepFor(pd3, 1, 3), 2, "the game's list wins over the page's setting");
  assert.equal(keepFor(six, 0, 2), 2, "no list: the page's setting");
  assert.equal(keepFor(six, 0), 1);
  assert.equal(screenAt(six, 0), null);
});

test("the picks left come in the game's order with their own keep; a card typed in the wrong round costs that round", () => {
  const pd3 = DRAFT_FORMATS.ptms3pd3;
  const full = stepsLeft(pd3, allRounds(pd3))!;
  assert.equal(full.length, 21);
  assert.deepEqual(full.map((s) => s.keep).join(""), "122222211122222222221");
  assert.deepEqual(stepsLeft(pd3, { P: 6, B: 14 })![0], { key: "P", keep: 2 }, "after round 1, round 2");
  const early = stepsLeft(pd3, { P: 7, B: 13 })!;
  assert.deepEqual(early.slice(7, 9), [{ key: "B", keep: 1 }, { key: "B", keep: 1 }], "a Bronze typed first uses up round 5's");
  assert.equal(stepsLeft(six, allRounds(six)), null);
});

test("a typed Perfect goes to the round whose band holds it, else any Perfect round left", () => {
  const pd2 = DRAFT_FORMATS.ptms3pd2, rem = allRounds(pd2);
  assert.equal(roundFor(pd2, rem, { tier: "Perfect", group: "SS", val: 102 })?.key, "P101");
  assert.equal(roundFor(pd2, rem, { tier: "Perfect", group: "SS", val: 100 })?.key, "P");
  assert.equal(roundFor(pd2, { ...rem, P101: 0 }, { tier: "Perfect", group: "SS", val: 102 })?.key, "P", "out of band, still a Perfect round");
  assert.equal(roundFor(pd2, rem, { tier: "Perfect", group: "SS" })?.key, "P101", "no value: the first in order");
});

test("the screen list reads as the event screen does, and goes when the counts are set by hand", () => {
  const pd3 = DRAFT_FORMATS.ptms3pd3;
  assert.equal(screensText(pd3), "13 rounds of 12: R1 Perfect, keep 1 · R2-4 Perfect, keep 2 · R5-7 Bronze 60-69, keep 1 · R8-12 Bronze 60-69, keep 2 · R13 Bronze 60-69, keep 1");
  assert.equal(screensText(six), null);
  const f = withCounts(pd3, { P: 8, B: 13 });
  assert.equal(f.screens, undefined);
  assert.equal(keepFor(f, 0), 2, "back to the format's keep");
});

test("the next round of an ordered draft is the first kind with rounds left; unordered drafts keep the old guess", () => {
  const pd1 = DRAFT_FORMATS.ptms3pd1;
  const rem = allRounds(pd1);
  assert.equal(nextRound(pd1, rem)?.key, "P");
  const after = replay(pd1, [card("Perfect", "SS"), card("Perfect", "CF")]).rem;
  assert.equal(nextRound(pd1, after)?.key, "D", "two Perfect picks, then the Diamond rounds");
  const done = replay(pd1, Array.from({ length: 26 }, (_, k) => card(pd1.rounds.find((r, j) => k < pd1.rounds.slice(0, j + 1).reduce((a, x) => a + x.count, 0))!.tier, "SS"))).rem;
  assert.equal(nextRound(pd1, done), null, "nothing after the last pick");
  assert.equal(nextRound(six, allRounds(six)), null, "the 6L's order is not on file: no guess with 13 kinds");
  assert.equal(nextRound(five, allRounds(five))?.key, "B", "3 kinds: the one with most left");
});

test("a value band is about the pool, not about where a typed pick goes", () => {
  const pd1 = DRAFT_FORMATS.ptms3pd1, d = pd1.rounds.find((r) => r.key === "D")!;
  assert.ok(inBand(d, { val: 94 }) && !inBand(d, { val: 95 }));
  assert.ok(inPool(d, { tier: "Diamond", val: 90 }) && !inPool(d, { tier: "Gold", val: 84 }));
  assert.equal(roundFor(pd1, allRounds(pd1), card("Diamond", "C"))?.key, "D", "a 97 typed in still uses up a Diamond round");
});

test("round counts set on the page override the file's and move the roster size", () => {
  const pd1 = DRAFT_FORMATS.ptms3pd1;
  assert.equal(withCounts(pd1, {}), pd1);
  assert.equal(withCounts(pd1, { P: 2 }), pd1, "the same count is no change");
  const f = withCounts(pd1, { P: 4, G: 4 });
  assert.equal(f.cards, 26);
  assert.deepEqual(tiersOf(f), { Perfect: 4, Diamond: 4, Gold: 4, Silver: 6, Bronze: 6, Iron: 2 });
  assert.equal(withCounts(pd1, { G: 4 }).cards, 24);
  assert.equal(withCounts(pd1, { I: 0 }).cards, 24);
  assert.equal(pd1.rounds[0].count, 2, "the file's format is untouched");
});

test("keeping 2 of a 12-card pack is priced about as the best of 8 for each pick", () => {
  assert.equal(pricedPack(6), 6, "keep 1: the pack itself");
  assert.equal(pricedPack(12, 2), 8);
  assert.equal(pricedPack(2, 2), 1);
  for (const f of [DRAFT_FORMATS.ptms3pd1, DRAFT_FORMATS.ptms3pd2, DRAFT_FORMATS.ptms3pd3]) {
    assert.equal(f.packSize, 12, f.series);
    assert.ok(f.rounds.every((r) => r.pack === "mixed"), `${f.series}: mixed screens`);
  }
});
