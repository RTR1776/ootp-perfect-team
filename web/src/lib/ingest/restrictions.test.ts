import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRestrictions, tierWindowFromName } from "./restrictions";
import { parseCardTypeRule } from "../roster-rules";

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

test("Diamond refresh 2026-09-09: every blurb parses", () => {
  const daily = parseRestrictions("1985 RE, Variants on, 1982 Kingdome");
  assert.equal(daily.reYear, 1985);
  assert.equal(daily.park, "1982 Kingdome", "Kingdome has no Park/Stadium suffix");

  const forever = parseRestrictions("2019 RE, 2026 Dell Diamond");
  assert.equal(forever.reYear, 2019);
  assert.equal(forever.park, "2026 Dell Diamond");

  const cap = parseRestrictions("1788 cap, 1968 RE, Variants on, 1976 Jarry Park");
  assert.equal(cap.teamCap, 1788);
  assert.equal(cap.reYear, 1968);
  assert.equal(cap.park, "1976 Jarry Park");

  const live = parseRestrictions("now at 2026 Rate Field");
  assert.equal(live.park, "2026 Rate Field");
  assert.equal(live.reYear, null);

  const slots = parseRestrictions("Negro Leagues, All-Stars, Snapshots, Unsung Heroes and Hardware Heroes cards only; SLOTS: 12 Diamond, 8 Gold, 3 Silver, 3 Bronze, 0 Iron; Default RE, 1984 Jack Murphy Stadium");
  assert.deepEqual(slots.cardTypes, ["Negro Leagues", "All-Stars", "Snapshots", "Unsung Heroes", "Hardware Heroes"]);
  assert.deepEqual(slots.slots, { D: 12, G: 8, S: 3, B: 3, I: 0 });
  assert.deepEqual(slots.notes, ["default RE"]);
  assert.equal(slots.park, "1984 Jack Murphy Stadium");
  assert.equal(slots.cards, null, "'cards only' is not a roster size");

  const upTo = parseRestrictions("cards up to 1969, 2009 RE, DH off, Variants on, 1996 Coors Field");
  assert.equal(upTo.yearMax, 1969);
  assert.equal(upTo.reYear, 2009);
  assert.equal(upTo.dh, false);

  const onward = parseRestrictions("Cards >= 1990; 64 teams, Best of 7, 1957 RE, DH on, Variants on, 1954 Griffith Stadium");
  assert.equal(onward.yearMin, 1990);
  assert.equal(onward.yearMax, null);
  assert.equal(onward.reYear, 1957);
  assert.equal(onward.teams, 64);
  assert.equal(onward.bestOf, 7);

  // The old single-item form is unchanged by the comma-list pass.
  assert.deepEqual(parseRestrictions("64 teams, Best of 5, Snapshots cards only").cardTypes, ["Snapshots"]);

  assert.deepEqual(tierWindowFromName("Daily Low Diamond Only"), { min: 90, max: 94, basis: "Low Diamond Only" });
  assert.equal(tierWindowFromName("Daily Diamond 1990 Onward")?.max, 99);
});

test("card-type rule reader knows the Diamond Slots names", () => {
  assert.deepEqual(parseCardTypeRule("Negro Leagues"), [2]);
  assert.deepEqual(parseCardTypeRule("All-Stars"), [5]);
  assert.deepEqual(parseCardTypeRule("Unsung Heroes"), [8]);
  assert.deepEqual(parseCardTypeRule("Hardware Heroes"), [9]);
});
