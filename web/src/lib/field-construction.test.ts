import { test } from "node:test";
import assert from "node:assert/strict";
import { summariseSeries, teamBuilds } from "./field-construction";
import { clanOf, type LeagueStint } from "./ingest/league";

const row = (org: string, val: number, p: Partial<LeagueStint> & { stats?: Record<string, number> }): LeagueStint => ({
  cid: 1, name: "x", pos: p.isPitcher ? "SP" : "CF", org, clan: clanOf(org), isFreeAgent: false, isPitcher: false,
  val, tier: null, isVariant: false, cardYear: null, ratings: {}, pa: 0, ip: 0, use: 0, war: 0, stats: {}, ...p,
});
const team = (org: string, wins: number) => [
  ...Array.from({ length: 9 }, (_, i) => row(org, i < 6 ? 101 : 95, { pa: 45 })),
  row(org, 65, { pa: 3 }), // a bench bat: 3 PA against a 45 PA slot
  row(org, 102, { isPitcher: true, stats: { G_p: 3, GS_p: 3, BF: 80, W: wins, L: 1 } }),
  row(org, 88, { isPitcher: true, stats: { G_p: 2, GS_p: 2, BF: 50, W: 0, L: 1 } }),
  row(org, 55, { isPitcher: true, pos: "RP", stats: { G_p: 4, GS_p: 0, BF: 18, W: 1, L: 0 } }),
];

test("field construction: tiers by role, the best quarter, clans, and the measured slot weights", () => {
  assert.equal(clanOf("Kansas City Torrent - JW"), "JW");
  const run = [
    ...team("Ann Arbor Blue - HotL", 9), ...team("Millbrook - HotL", 1), ...team("Rockford - HotL", 2),
    ...team("Kansas City Torrent - JW", 4), ...team("Solo Nine", 0),
    ...[1, 2, 3].flatMap((k) => team(`Filler ${k}`, 0)),
  ];
  const teams = teamBuilds(run);
  const kc = teams.find((t) => t.mine)!;
  assert.deepEqual(kc.tiers.P, { bats: 6, bench: 0, sp: 1, rp: 0 });
  assert.deepEqual(kc.tiers.D, { bats: 3, bench: 0, sp: 0, rp: 0 });
  assert.deepEqual(kc.tiers.G, { bats: 0, bench: 0, sp: 1, rp: 0 });
  assert.deepEqual(kc.tiers.B, { bats: 0, bench: 1, sp: 0, rp: 0 });
  assert.deepEqual(kc.tiers.I, { bats: 0, bench: 0, sp: 0, rp: 1 });
  assert.equal(kc.w, 5);
  const s = summariseSeries([teams]);
  assert.equal(s.teams, 8);
  const top = s.groups.find((g) => g.key === "top")!;
  assert.equal(top.n, 2, "a quarter of 8, by wins");
  assert.ok(s.groups.some((g) => g.key === "clan:HOTL" && g.label === "HotL" && g.n === 3));
  assert.ok(!s.groups.some((g) => g.key === "clan:JW"), "one JW entry is under the three-entry floor");
  assert.equal(s.groups.find((g) => g.key === "mine")!.n, 1);
  // lineup slot: 408 PA / 9 = 45.3; starters 130 BF over 2 = 65 -> 1.43; the reliever 18 -> 0.4
  assert.equal(s.spWeight, 1.43);
  assert.equal(s.rpWeight, 0.4);
});
