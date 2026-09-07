import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRestrictions, tierWindowFromName } from "./restrictions";

test("tier words in a name give the databotai-style window", () => {
  assert.deepEqual(tierWindowFromName("Daily Bronze OOTP Era"), { min: null, max: 69, basis: "Bronze" });
  assert.deepEqual(tierWindowFromName("Daily Low Gold Retrospectus"), { min: null, max: 84, basis: "Low Gold" });
  assert.deepEqual(tierWindowFromName("Daily Low Bronze Only"), { min: 60, max: 64, basis: "Low Bronze Only" });
  assert.equal(tierWindowFromName("Monday Gold Floor Cap")?.min, 80);
  assert.equal(tierWindowFromName("Sunday High Iron Floor and Gold Ceiling")?.min, 50);
  assert.equal(tierWindowFromName("Sunday High Iron Floor and Gold Ceiling")?.max, 89);
});

test("two tiers joined by a dash are a range: floor at the first, ceiling at the second", () => {
  // Gold refresh 2026-09-07: Sporer's Golden Childhood became this.
  assert.deepEqual(tierWindowFromName("Daily High Silver-Low Gold Cap"), { min: 75, max: 84, basis: "High Silver-Low Gold" });
  assert.deepEqual(tierWindowFromName("Daily Silver to Gold Slots"), { min: 70, max: 89, basis: "Silver to Gold" });
  // a range written backwards is contradictory - fall through to the word loop
  assert.notEqual(tierWindowFromName("Gold-Silver")?.min, 80);
});

test("names without a tier word, Open events and & Friends events say nothing", () => {
  assert.equal(tierWindowFromName("Daily Golden Age"), null);
  assert.equal(tierWindowFromName("Daily Goldfather II"), null);
  assert.equal(tierWindowFromName("Sunday Open Main Event"), null);
  assert.equal(tierWindowFromName("Daily Silver & Friends Slots"), null);
  assert.equal(tierWindowFromName("Daily All-Gold", { isDraft: true }), null, "a Perfect Draft is a round sequence, not a window");
});

test("Gold refresh blurbs parse", () => {
  const lowGold = parseRestrictions("64 teams, Best of 5-Bo7F, Default RE, DH on, Variant Cap 8, 2026 Fenway Park");
  assert.equal(lowGold.teams, 64);
  assert.equal(lowGold.bestOf, 5);
  assert.equal(lowGold.reYear, null);
  assert.ok(lowGold.notes.includes("default RE"));
  assert.equal(lowGold.dh, true);
  assert.equal(lowGold.variantCap, 8);
  assert.equal(lowGold.park, "2026 Fenway Park");

  const goldCap = parseRestrictions("now open to Live cards, 64 teams, 1780 cap, 1999 RE, Variants on, 1999 Jacobs Field");
  assert.equal(goldCap.teamCap, 1780);
  assert.equal(goldCap.reYear, 1999);
  assert.equal(goldCap.variantsAllowed, true);
  assert.equal(goldCap.cardTypes, null, "'open to Live cards' is not a cards-only clause");

  const slots = parseRestrictions("SLOTS: 12 Gold, 8 Silver, 6 Bronze, 0 Iron; 1968 RE, DH on, Variant Cap 13, 1968 Connie Mack Stadium");
  assert.deepEqual(slots.slots, { G: 12, S: 8, B: 6, I: 0 });
  assert.equal(slots.reYear, 1968);
  assert.equal(slots.variantCap, 13);
  assert.equal(slots.park, "1968 Connie Mack Stadium");

  const goldenAge = parseRestrictions("Cards up to 1929, 1925 RE, DH off, 1930 Hamtramck Stadium");
  assert.equal(goldenAge.yearMax, 1929);
  assert.equal(goldenAge.reYear, 1925);
  assert.equal(goldenAge.dh, false);

  const hsLg = parseRestrictions("Best of 7, 2068 cap, 2007 RE, DH on, Variants on, 2008 Shea Stadium, moved to 2pm ET");
  assert.equal(hsLg.bestOf, 7);
  assert.equal(hsLg.teamCap, 2068);
  assert.equal(hsLg.reYear, 2007);

  const standard = parseRestrictions("64 teams, Best of 7, Default RE, Variants off, Heinsohn Park");
  assert.equal(standard.variantsAllowed, false);
  assert.equal(standard.park, "Heinsohn Park");
  assert.equal(standard.teams, 64);

  const moved = parseRestrictions("moved to 128 teams, 1974 RE, DH off, Variants on, 1971 Yankee Stadium");
  assert.equal(moved.teams, 128);
  assert.equal(moved.reYear, 1974);
});
