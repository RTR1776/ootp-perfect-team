import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueCatcherRuns } from "./league-lineup";
import { formRatings } from "../card-forms";

test("league catcher defence: framing drives it, and a variant's catcher ratings ride its C boost", () => {
  const piazza = { CatcherFrame: 78, "Catcher Arm": 59, CatcherAbil: 61 };
  const salas = { CatcherFrame: 109, "Catcher Arm": 110, CatcherAbil: 101 };
  // pooled league results per 1,000 innings: Piazza −12.7, Salas +5.2 (fit −12.9 / +5.2)
  assert.ok(Math.abs(leagueCatcherRuns(piazza, 1000)! + 12.9) < 0.1);
  assert.ok(Math.abs(leagueCatcherRuns(salas, 1000)! - 5.2) < 0.1);
  assert.ok(leagueCatcherRuns({ ...salas, CatcherFrame: 119 })! - leagueCatcherRuns(salas)! > 4.5, "+10 framing is ~5 runs a full season");
  assert.equal(leagueCatcherRuns({ "Pos Rating C": 120 }), null, "no catcher ratings, no number");

  const base = { "Pos Rating C": 120, "Pos Rating 1B": 60, ...salas };
  const variant = formRatings(base, { DEF: 129 }, "C");
  assert.equal(variant["Pos Rating C"], 129);
  assert.equal(variant.CatcherFrame, 117, "109 × 129/120");
  assert.equal(variant["Catcher Arm"], 118);
  assert.equal(formRatings(base, { DEF: 120 }, "C").CatcherFrame, 109, "a base copy is untouched");
  assert.equal(formRatings(base, { "POS C": 129 }, "C").CatcherFrame, 117, "a typed variant C rating boosts them too");
});

test("gloves scale with the environment's balls in play", async () => {
  const { gloveScale } = await import("./fielding");
  const { eraTable } = await import("./tournament-env");
  const ptDefault = gloveScale(eraTable["0"].rates), deadball = gloveScale(eraTable["1920"].rates);
  assert.ok(ptDefault < 0.9 && ptDefault >= 0.7, `PT default gives the fielders less to do (${ptDefault.toFixed(2)})`);
  assert.ok(deadball > 1.15 && deadball <= 1.35, `1920 gives them more (${deadball.toFixed(2)})`);
  assert.equal(gloveScale(null), 1);
});
