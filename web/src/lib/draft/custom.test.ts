import { test } from "node:test";
import assert from "node:assert/strict";
import { customFormat, customFromParams, customKey, customQuery, DRAFT_PRESETS, mixCards, mixLabel, mixText, parseMix } from "./custom";
import { allRounds, fitsRound, replay, roundsLeft } from "./formats";

test("a tier mix reads from letters and counts, in any order", () => {
  assert.deepEqual(parseMix("G26"), { Gold: 26 });
  assert.deepEqual(parseMix(" i2, b6 ,S6,g6,D4,p2 "), { Iron: 2, Bronze: 6, Silver: 6, Gold: 6, Diamond: 4, Perfect: 2 });
  assert.equal(mixText(parseMix("I2,B6,S6,G6,D4,P2")!), "P2,D4,G6,S6,B6,I2");
  assert.equal(mixLabel(parseMix("B17,P4")!), "4 Perfect, 17 Bronze");
  assert.equal(mixCards(parseMix("P14,B12")!), 26);
  assert.deepEqual(parseMix("G20,G6"), { Gold: 26 }, "a tier named twice adds up");
  for (const bad of ["", "26", "X5", "G", "G-3", "Gold 26", "G0"]) assert.equal(parseMix(bad), null, bad);
  for (const p of DRAFT_PRESETS) assert.equal(mixCards(parseMix(p.mix)!), 26, p.name);
});

test("a setup reads off the query string, says what is missing, and round-trips", () => {
  assert.deepEqual(customFromParams({ e: "custom" }), { draft: null, errors: [], started: false });
  const bad = customFromParams({ mix: "G5", year: "1700" });
  assert.equal(bad.draft, null);
  assert.equal(bad.errors.length, 2);
  const ok = customFromParams({ mix: "g26", year: "1996", dh: "1", park: "1996 Dodger Stadium", pack: "choose", n: "8", ev: "9100212", name: "Daily All-Gold", teams: "64" });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.draft, { mix: { Gold: 26 }, year: 1996, dh: true, park: "1996 Dodger Stadium", pack: "choose", packSize: 8, name: "Daily All-Gold", eventId: 9100212, teams: 64 });
  const again = customFromParams(Object.fromEntries(new URLSearchParams(customQuery(ok.draft!))));
  assert.deepEqual(again.draft, ok.draft);
  // Defaults: no park is neutral, packs are mixed sixes, 64 teams, a name from the mix.
  const bare = customFromParams({ mix: "P4,B17", year: "1939" }).draft!;
  assert.deepEqual([bare.park, bare.pack, bare.packSize, bare.teams, bare.dh, bare.eventId], [null, "mixed", 6, 64, false, null]);
  assert.equal(bare.name, "Draft: 4 Perfect, 17 Bronze");
});

test("the format the engine runs: one round kind per tier, every position, and picks use the rounds up", () => {
  const d = customFromParams({ mix: "P4,B17", year: "1939", park: "1940 Braves Field" }).draft!;
  const f = customFormat(d);
  assert.equal(f.cards, 21);
  assert.deepEqual(f.rounds.map((r) => [r.key, r.tier, r.count, r.pack]), [["P", "Perfect", 4, "mixed"], ["B", "Bronze", 17, "mixed"]]);
  assert.equal(roundsLeft(allRounds(f)), 21);
  assert.ok(fitsRound(f.rounds[0], { tier: "Perfect", group: "SP" }) && fitsRound(f.rounds[1], { tier: "Bronze", group: "C" }));
  assert.ok(!fitsRound(f.rounds[1], { tier: "Gold", group: "C" }));
  const r = replay(f, [{ tier: "Perfect", group: "SP" }, { tier: "Bronze", group: "SS" }, { tier: "Gold", group: "1B" }]);
  assert.equal(roundsLeft(r.rem), 19);
  assert.equal(r.unplaced, 1, "a Gold card fits no round of this draft");
  assert.equal(f.assumed.length, 3);
});

test("picks are stored per setup: a different environment or park is a different draft", () => {
  const a = customFromParams({ mix: "G26", year: "1996", park: "1996 Dodger Stadium", dh: "1" }).draft!;
  assert.equal(customKey(a), "custom:G26:1996:dh:1996-dodger-stadium:0");
  assert.notEqual(customKey(a), customKey({ ...a, year: 1986 }));
  assert.notEqual(customKey(a), customKey({ ...a, dh: false }));
  assert.notEqual(customKey(a), customKey({ ...a, park: null }));
  assert.equal(customKey(a), customKey({ ...a, name: "another name", packSize: 9, pack: "choose", teams: 256 }), "the name and the pack settings do not change what a card is worth");
});
