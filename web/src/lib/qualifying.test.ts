import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderPoints, leagueBand, leaguePoints, leagueTierOf, nextMilestone, placeByRecord, PTWC_CATEGORIES, standingOf } from "./qualifying";

test("ladder points follow the PTCS/PTMS table", () => {
  assert.equal(ladderPoints("1st"), 300);
  assert.equal(ladderPoints("9th-16th"), 20);
  assert.equal(ladderPoints("65th-128th"), 1);
  assert.equal(ladderPoints("129th-256th"), null);
});

test("league tiers and points", () => {
  assert.equal(leagueTierOf("PEL"), "Perfect");
  assert.equal(leagueTierOf("HD451"), "High Diamond");
  assert.equal(leagueTierOf("ld404"), "Low Diamond");
  assert.equal(leagueTierOf("XYZ"), null);
  assert.equal(leaguePoints("Perfect", 29), 35);
  assert.equal(leaguePoints("High Diamond", 14), 20);
  assert.equal(leaguePoints("High Diamond", 17), 10);
  assert.equal(leaguePoints("Low Diamond", 3), 25);
  assert.equal(leaguePoints("High Gold", 9), 0);
  assert.equal(leaguePoints("Low Gold", 5), 0);
});

test("league outcomes score by their band", () => {
  const pts = (tier: Parameters<typeof leaguePoints>[0], band: string) => leaguePoints(tier, leagueBand(band)!.place);
  assert.equal(pts("Low Diamond", "1st"), 50);
  assert.equal(pts("High Diamond", "9th-16th"), 20);
  assert.equal(pts("High Diamond", "17th-last"), 10);
  assert.equal(pts("Perfect", "17th-last"), 35);
  assert.equal(pts("High Gold", "9th-16th"), 0);
  assert.equal(leagueBand("nope"), null);
});

test("Cap and Live stay out of the PTWC weekly points; PD berths are their own standing", () => {
  assert.ok(!PTWC_CATEGORIES.includes("Cap" as never) && !PTWC_CATEGORIES.includes("Live" as never));
  assert.equal(PTWC_CATEGORIES.length, 8);
  assert.equal(standingOf("PD Daily"), "perfect_draft");
  assert.equal(standingOf("Silver"), "tournament");
});

test("place by record: win share, then wins; no decisions, no place", () => {
  const mine = (o: string) => o.startsWith("KC");
  const teams = [
    { org: "A", w: 95, l: 67 }, { org: "KC Torrent - JW", w: 82, l: 81 }, { org: "B", w: 82, l: 80 },
    { org: "C", w: 70, l: 92 }, { org: "Free Agents", w: 0, l: 0 },
  ];
  assert.deepEqual(placeByRecord(teams, mine), { place: 3, of: 4, w: 82, l: 81 });
  assert.equal(placeByRecord([{ org: "KC", w: 0, l: 0 }], mine), null);
});

test("next milestone", () => {
  assert.equal(nextMilestone("2026-10-16")?.name, "PTCS 8");
  assert.equal(nextMilestone("2026-11-08")?.name, "PTMS 3");
  assert.equal(nextMilestone("2027-03-01"), null);
});
