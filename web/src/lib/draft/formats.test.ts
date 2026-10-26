import test from "node:test";
import assert from "node:assert/strict";
import { allRounds, DRAFT_FORMATS, groupOf, replay, roundFor, roundsLeft, type DraftGroup } from "./formats";
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
