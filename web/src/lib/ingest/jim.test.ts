import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForJimBeaters } from "./jim";
import type { LeagueStint } from "./league";

const stint = (org: string, isPitcher: boolean, stats: Record<string, number>, pa = 0): LeagueStint => ({
  cid: 1, name: "x", pos: isPitcher ? "SP" : "1B", org, clan: null, isFreeAgent: false, isPitcher,
  val: 80, tier: "Gold", isVariant: false, cardYear: 2000, ratings: {}, pa, ip: 0, use: 0, war: 0, stats,
});

/** A team's season: one pitcher row with the record, one hitter row with the runs. */
const team = (org: string, games: number, rs: number, ra: number) => [
  stint(org, true, { W: Math.round(games / 2), L: games - Math.round(games / 2), Ra: ra }),
  stint(org, false, { R: rs }, games * 39),
];

test("a swept Jim series lights up a round-two exit at 7x the field", () => {
  const stints = [
    ...team("Hudson Railers", 8, 296, 30),   // the real one, run 19
    ...Array.from({ length: 20 }, (_, i) => team(`Team ${i}`, 5 + (i % 9), (5 + (i % 9)) * 4, (5 + (i % 9)) * 4 + (i % 3))).flat(),
  ];
  const scan = scanForJimBeaters(stints);
  assert.equal(scan.flagged.length, 1);
  assert.equal(scan.flagged[0].org, "Hudson Railers");
  assert.ok(scan.flagged[0].rpgMultiple > 6, `multiple ${scan.flagged[0].rpgMultiple}`);
});

test("a deep run dilutes the series but the total differential still catches it", () => {
  // 40 games: 36 real at 4.4 R/G, 4 vs Jim at 60 — 2.3x the field, +240 on the season
  const stints = [
    ...team("Krakow Hussars", 40, Math.round(36 * 4.4 + 240), Math.round(40 * 4.4)),
    ...Array.from({ length: 20 }, (_, i) => team(`Team ${i}`, 10 + (i % 9), Math.round((10 + (i % 9)) * 4.4), Math.round((10 + (i % 9)) * 4.3))).flat(),
  ];
  const scan = scanForJimBeaters(stints);
  assert.deepEqual(scan.flagged.map((f) => f.org), ["Krakow Hussars"]);
});

test("a merely hot lineup is left alone", () => {
  // 5 games at 8 R/G with a normal differential is a good series, not a Jim;
  // so is an elite 40-game run at +3 a game (Freedom Grabbers, Diamond 16)
  const stints = [
    ...team("Waltham River Otters", 5, 40, 29),
    ...team("Freedom Grabbers", 40, 280, 160),
    ...Array.from({ length: 20 }, (_, i) => team(`Team ${i}`, 5 + (i % 9), (5 + (i % 9)) * 4, (5 + (i % 9)) * 4)).flat(),
  ];
  assert.equal(scanForJimBeaters(stints).flagged.length, 0);
});

test("too few teams to call a median means no flags", () => {
  assert.equal(scanForJimBeaters(team("A", 4, 200, 0)).flagged.length, 0);
});
