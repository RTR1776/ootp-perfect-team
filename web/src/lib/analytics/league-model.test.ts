import { test } from "node:test";
import assert from "node:assert/strict";
import { boardRatings, envPrices, leagueHitRuns, LEAGUE_MODEL, type BoardRatings } from "./league-model";
import { eraTable } from "./tournament-env";

test("the league model: an average bat is ~0, better ratings add runs, a theme week re-prices them", () => {
  const ref = LEAGUE_MODEL.reference["PEL|vR"];
  const avg: BoardRatings = { K: 50 * Math.exp(ref.lK), BA: 50 * Math.exp(ref.lBA), GAP: 50 * Math.exp(ref.lGAP), POW: 50 * Math.exp(ref.lPOW), EYE: 50 * Math.exp(ref.lEYE) };
  assert.ok(Math.abs(leagueHitRuns(ref.app, avg, "PEL", "vR") - LEAGUE_MODEL.coef.intercept) < 1e-9, "the league's average bat sits at the intercept");
  const better = { ...avg, POW: avg.POW * 1.2, EYE: avg.EYE * 1.2 };
  assert.ok(leagueHitRuns(ref.app, better, "PEL", "vR") > 1, "more Power and Eye pay");
  const ordinary = envPrices((eraTable["0"] ?? eraTable["2010"]).rates);
  for (const v of Object.values(ordinary)) assert.ok(Math.abs(v - 1) < 1e-9, "an ordinary week prices every rating at 1");
  const y1989 = envPrices(eraTable["1989"].rates);
  assert.ok(y1989.K < 0.8, `a 1989 theme week pays less for Avoid K (${y1989.K.toFixed(2)})`);
  assert.deepEqual(boardRatings({ "Avoid K vL": 1, "BABIP vL": 2, "Gap vL": 3, "Power vL": 4, "Eye vL": 5 }, "vL"), { K: 1, BA: 2, GAP: 3, POW: 4, EYE: 5 });
  assert.equal(boardRatings({ "Avoid K vL": 1 }, "vL"), null);
});
