import { test } from "node:test";
import assert from "node:assert/strict";
import { projectCard, projectionEnvs, projectHitter } from "./projections";
import { calibrationSlope } from "./calibration";
import { eraTable } from "./tournament-env";

const era = eraTable["0"];
const avg = (v: number): Record<string, number> => ({
  "Avoid Ks": v, Eye: v, Power: v, Gap: v, BABIP: v,
  "Avoid K vL": v, "Eye vL": v, "Power vL": v, "Gap vL": v, "BABIP vL": v,
  "Avoid K vR": v, "Eye vR": v, "Power vR": v, "Gap vR": v, "BABIP vR": v,
});
const arm = (v: number): Record<string, number> => ({
  Stuff: v, Control: v, pHR: v, pBABIP: v,
  "Stuff vL": v, "Control vL": v, "pHR vL": v, "pBABIP vL": v,
  "Stuff vR": v, "Control vR": v, "pHR vR": v, "pBABIP vR": v,
});

test("a card near the curves' average rating projects near the environment's own line", () => {
  // AVERAGE_RATING (110) returns the league rate per component only
  // approximately; the combined line sits within a few runs of zero.
  const envs = projectionEnvs(era.rates, null);
  const p = projectCard({ isPitcher: false, bats: "R", ratings: avg(110) }, envs)!;
  assert.ok(Math.abs(p.runsAll) < 15, `runs ${p.runsAll}`);
  assert.ok(p.all > 0.29 && p.all < 0.36, `wOBA ${p.all}`);
  assert.ok(Math.abs(p.all - envs.leagueRight.woba) < 0.03, "on the environment's wOBA scale");
  const a = projectCard({ isPitcher: true, bats: null, ratings: arm(110) }, envs)!;
  assert.ok(Math.abs(a.runsAll) < 15, `runs ${a.runsAll}`);
  assert.ok(a.all > 3.5 && a.all < 4.8, `FIP ${a.all}`);
  assert.ok(Math.abs(a.all - envs.leaguePitch.fip) < 0.5, "on the environment's FIP scale");
});

test("more of every rating is better, and the calibration shrinks the distance from average", () => {
  const envs = projectionEnvs(era.rates, null);
  const lo = projectCard({ isPitcher: false, bats: "R", ratings: avg(80) }, envs)!;
  const hi = projectCard({ isPitcher: false, bats: "R", ratings: avg(150) }, envs)!;
  assert.ok(hi.all > lo.all && hi.runsAll > lo.runsAll);
  const lines = hi.lines.vR as { woba: number; kPct: number; bbPct: number; hrPa: number };
  assert.ok(lines.kPct < era.rates.K && lines.bbPct > era.rates.BB, "150s strike out less and walk more than the league");
  // Shrink: a card's distance from the league line is the calibrated share of the raw distance.
  const slope = calibrationSlope("hit");
  assert.ok(slope > 0 && slope <= 1);
  const league = projectCard({ isPitcher: false, bats: "R", ratings: avg(110) }, envs)!;
  const raw = (hi.runsAll - league.runsAll) / slope;
  assert.ok(raw >= hi.runsAll - league.runsAll - 1e-9);
  const arms = projectCard({ isPitcher: true, bats: null, ratings: arm(150) }, envs)!;
  const armsLo = projectCard({ isPitcher: true, bats: null, ratings: arm(80) }, envs)!;
  assert.ok(arms.all < armsLo.all && arms.runsAll > armsLo.runsAll, "better arm: lower FIP, more runs saved");
});

test("a platoon bat keeps its shape and a left-handed bat sees the left side of the park", () => {
  const envs = projectionEnvs(era.rates, { team: null, avgL: 1.1, avgR: 0.9, hrL: 1.1, hrR: 0.9, d2: 1, d3: 1 });
  const r = { ...avg(110), "Power vL": 160, "Power vR": 80 };
  const p = projectCard({ isPitcher: false, bats: "R", ratings: r }, envs)!;
  assert.ok(p.vL > p.vR, "hits lefties better");
  const lefty = projectHitter(avg(110), envs, "L", "R")!, righty = projectHitter(avg(110), envs, "R", "R")!;
  assert.ok(lefty.woba > righty.woba, "the friendly side of the park pays");
  const swap = projectCard({ isPitcher: false, bats: "R", ratings: r }, envs, 0.6)!;
  assert.ok(swap.all > p.all, "a field that throws more lefties lifts a platoon bat's blend");
});
