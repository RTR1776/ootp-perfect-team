import { test } from "node:test";
import assert from "node:assert/strict";
import { buyCall, clubhouseSet, clubhouseTitleMatches, eventName, isDraftResult, netGain, ppPerCs, sellCall, tierOf, weightedGain } from "./buy-plan";

test("tiers and drafts from result categories", () => {
  assert.equal(tierOf(["Iron", "Cap"]), "Iron");
  assert.equal(tierOf(["Open", "Live", "Cap"]), "Open");
  assert.equal(tierOf(["Diamond", "Cap"]), "Diamond");
  assert.equal(tierOf(["PD Daily"]), null);
  assert.equal(isDraftResult(["PD Weekly"]), true);
  assert.equal(isDraftResult(["Gold", "Cap"]), false);
  assert.equal(eventName("Daily Iron Lunch (2200239)"), "Daily Iron Lunch");
});

test("net gain counts starts, and room only when it pays", () => {
  assert.equal(netGain({ status: "start", gain: 11.2 }), 11.2);
  assert.equal(netGain({ status: "bench", gain: 0, room: { gross: 25.1, cost: 13.1 } }), 12.000000000000002);
  assert.equal(netGain({ status: "bench", gain: 0, room: { gross: 10.4, cost: 13.1 } }), 0);
  assert.equal(netGain({ status: "bench", gain: 0, room: { gross: 10, cost: null } }), 0);
  assert.equal(netGain({ status: "on", gain: 0 }), 0);
});

test("weighted gain is gain times entries a week", () => {
  const w = new Map([[1, 2.7], [2, 1]]);
  assert.equal(weightedGain([{ eventId: 1, gain: 10 }, { eventId: 2, gain: 5 }, { eventId: 3, gain: 99 }], w), 32);
});

test("buy and sell calls", () => {
  assert.deepEqual(buyCall(57500, 36888), { call: "bid", target: 37000 });
  assert.deepEqual(buyCall(null, 2325000), { call: "bid", target: 2325000 });
  assert.deepEqual(buyCall(39000, 37000), { call: "buy", target: 39000 });
  assert.deepEqual(buyCall(null, 14472), { call: "bid", target: 15000 });
  // No ask and no sales: a release the market hasn't priced, or a Clubhouse card that doesn't trade.
  assert.deepEqual(buyCall(null, null), { call: "none", target: null });
  assert.deepEqual(buyCall(0, 0), { call: "none", target: null });
  assert.deepEqual(sellCall(38000, 59500, 44317), { call: "take", target: 38000 });
  assert.deepEqual(sellCall(45007, 125001, 170709), { call: "list", target: 122000 });
  assert.deepEqual(sellCall(0, 0, 69918), { call: "list", target: 68000 });
});

test("PP per CS is the median over cards that trade", () => {
  assert.equal(ppPerCs([{ cs: 20, pp: 23627 }, { cs: 80, pp: 40000 }, { cs: 90, pp: 55949 }, { cs: 10, pp: null }]), 621.6555555555556);
  assert.equal(ppPerCs([]), null);
  // A Clubhouse card with no CS price on file (not in the screenshots) doesn't count.
  assert.equal(ppPerCs([{ cs: 20, pp: 23627 }, { cs: null, pp: 450000 }]), 1181.35);
});

test("Clubhouse set from the title", () => {
  assert.equal(clubhouseSet("Clubhouse - Baseball Reference 10 SP Sandy Koufax LAD 1963", "SP", "Sandy Koufax"), "Baseball Reference 10");
  assert.equal(clubhouseSet("Clubhouse - Mariners 50th Anniversary 3B Kyle Seager SEA 2016", "3B", "Kyle Seager"), "Mariners 50th Anniversary");
  assert.equal(clubhouseSet("Clubhouse - Rookie of the Year 1B Sal Stewart CIN 2025", "1B", "Sal Stewart"), "Rookie of the Year");
  // The name isn't where it's expected: the whole remainder.
  assert.equal(clubhouseSet("Clubhouse - Snapshot SP Javier Vazquez MON 2001", "RP", "Javier Vazquez"), "Snapshot SP Javier Vazquez MON 2001");
});

test("Clubhouse titles match on position and year", () => {
  assert.equal(clubhouseTitleMatches("Clubhouse - Playoff Stars 3B Alex Bregman HOU 2019", { pos: "3B", year: "2019" }), true);
  assert.equal(clubhouseTitleMatches("Clubhouse - All-Time Legend SS Ozzie Smith STL Peak", { pos: "SS", year: "Peak" }), true);
  assert.equal(clubhouseTitleMatches("Clubhouse - Snapshot SP Javier Vazquez MON 2001", { pos: "RP", year: "2001" }), false);
  assert.equal(clubhouseTitleMatches("Limited Edition/57 2B Joe Gordon CLE 1942", { pos: "2B", year: "1942" }), false);
});
