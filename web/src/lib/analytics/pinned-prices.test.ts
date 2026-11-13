/**
 * What the scorer says about ten fixed cards in six environments, written
 * down. Nothing else in the suite fails when a change moves a card's price;
 * this does. The numbers are the raw model (`calibrate: false`): ratings to
 * rates on the curves, the era's run environment, the park by batter side.
 * The weekly calibration is left out on purpose, so a Monday refit does not
 * trip it; a change to curves.json, eras.json, park-factors.json or the run
 * maths does.
 *
 * If a change here is intended, say why in the commit and paste the new
 * numbers; if it is not, this just found it. (Written 2026-11-12, after a
 * week in which the blend's reference and the pen's ranking were both found
 * to be pricing cards differently from what the code's comments said.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { envFitMaps } from "./env-fit";
import { eraTable, parkFor } from "./tournament-env";

const bat = (id: number, o: Record<string, number>, bats = "R") => {
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries({ "Avoid Ks": 100, Eye: 100, Power: 100, Gap: 100, BABIP: 100, ...o })) {
    r[k] = v;
    const s = k === "Avoid Ks" ? "Avoid K" : k;
    r[`${s} vL`] = v; r[`${s} vR`] = v;
  }
  return { cardId: id, isPitcher: false, bats, ratings: r };
};
const arm = (id: number, o: Record<string, number>, role = "SP") => {
  const r: Record<string, number> = { Stamina: role === "SP" ? 75 : 20 };
  for (const [k, v] of Object.entries({ Stuff: 100, Control: 100, pHR: 100, pBABIP: 100, ...o })) { r[k] = v; r[`${k} vL`] = v; r[`${k} vR`] = v; }
  return { cardId: id, isPitcher: true, bats: null, role, ratings: r };
};

/** Five bats and five arms, each with one clear shape. */
function pool() {
  const p = [
    bat(1, {}),                                                      // 100 across the board
    bat(2, { Power: 160 }),                                          // a slugger, better vs LHP (below)
    bat(3, { Eye: 150, "Avoid Ks": 140 }),                           // plate discipline
    bat(4, { BABIP: 150, Gap: 140 }, "L"),                           // a left-handed contact bat, softer vs LHP (below)
    bat(5, { Power: 60, Eye: 70, "Avoid Ks": 60, BABIP: 70, Gap: 60 }), // a weak bat
    arm(11, {}),                                                     // 100 across the board
    arm(12, { Stuff: 160 }),                                         // a strikeout arm, softer vs LHB (below)
    arm(13, { Control: 150, pHR: 140 }),                             // control and the ball in the park
    arm(14, { Stuff: 60, Control: 70, pHR: 60 }),                    // a weak arm
    arm(15, { Stuff: 130, pBABIP: 140 }, "RP"),                      // a reliever
  ];
  p[1].ratings["Power vL"] = 185; p[1].ratings["Power vR"] = 150;
  p[3].ratings["BABIP vL"] = 120;
  p[6].ratings["Stuff vL"] = 135;
  return p;
}

/** Runs per 700 on the vs-RHP and vs-LHP boards, card by card in pool order. */
const PINNED: [label: string, year: number, stadium: string | null, runs: number[]][] = [
  ["1919", 1919, null, [2.98, 2.98, 8.13, 12.63, 11.75, 11.75, 17.56, 14.26, -23.8, -23.8, 3.59, 3.59, 5.4, 5.21, 8.43, 8.43, -7.92, -7.92, 11.39, 11.39]],
  ["1968", 1968, null, [4.17, 4.17, 22.14, 37.83, 16.8, 16.8, 15.4, 12.78, -32.13, -32.13, 4.97, 4.97, 8.81, 8.4, 13.12, 13.12, -19.77, -19.77, 13.18, 13.18]],
  ["1987 at Yankee Stadium", 1987, "1987 Yankee Stadium", [4.27, 4.27, 23.51, 40.3, 16.93, 16.93, 19.32, 15.81, -32.83, -32.83, 5.43, 5.43, 9.47, 9.04, 14.48, 14.48, -21.69, -21.69, 14.24, 14.24]],
  ["1996 at Coors", 1996, "1995 Coors Field", [6.65, 6.65, 35.21, 60.15, 27.3, 27.3, 21.89, 18.04, -53.08, -53.08, 7.84, 7.84, 14.57, 13.85, 19.75, 19.75, -31.25, -31.25, 20.85, 20.85]],
  ["2010", 2010, null, [5.12, 5.12, 27.26, 46.59, 20.93, 20.93, 17.86, 14.93, -39.42, -39.42, 6.05, 6.05, 11.49, 10.91, 15.41, 15.41, -25.21, -25.21, 15.88, 15.88]],
  ["2019", 2019, null, [5.88, 5.88, 34.92, 60.27, 24.14, 24.14, 17.44, 14.77, -44.82, -44.82, 6.85, 6.85, 13.8, 13.05, 17.71, 17.71, -32.31, -32.31, 17.37, 17.37]],
];

test("the raw scorer's price for ten fixed cards in six environments is what it was", () => {
  const cards = pool();
  for (const [label, year, stadium, runs] of PINNED) {
    const park = stadium ? parkFor(stadium) : null;
    if (stadium) assert.ok(park?.row, `${stadium} is on file`);
    const f = envFitMaps(cards, { era: eraTable[String(year)].rates, park: park?.row ?? null, roleTrust: 0.25, calibrate: false });
    cards.forEach((c, i) => {
      const r = f.runsR.get(c.cardId)!, l = f.runsL.get(c.cardId)!;
      assert.ok(Math.abs(r - runs[2 * i]) < 0.006, `${label}: card ${c.cardId} vs RHP reads ${r.toFixed(2)}, was ${runs[2 * i]}`);
      assert.ok(Math.abs(l - runs[2 * i + 1]) < 0.006, `${label}: card ${c.cardId} vs LHP reads ${l.toFixed(2)}, was ${runs[2 * i + 1]}`);
    });
  }
});

test("the pinned cards keep their order: what each shape is worth, era to era", () => {
  const cards = pool();
  const at = (year: number) => envFitMaps(cards, { era: eraTable[String(year)].rates, park: null, roleTrust: 0.25, calibrate: false }).runsR;
  const dead = at(1919), modern = at(2019);
  // Power is worth far more now than in deadball; contact held its value.
  assert.ok(modern.get(2)! - modern.get(1)! > 4 * (dead.get(2)! - dead.get(1)!));
  assert.ok(dead.get(4)! > dead.get(2)! && modern.get(2)! > modern.get(4)!, "the contact bat leads in 1919, the slugger in 2019");
  // The weak bat and the weak arm are below average everywhere; the control arm beats the strikeout arm.
  for (const m of [dead, modern]) { assert.ok(m.get(5)! < 0 && m.get(14)! < 0); assert.ok(m.get(13)! > m.get(12)!); }
});
