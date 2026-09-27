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

/* A plain team: one player per field slot, rated 100 there only, and a DH who plays nowhere. */
const BAT = Object.fromEntries(["Avoid K", "BABIP", "Gap", "Power", "Eye"].flatMap((k) => [[`${k} vR`, 100], [`${k} vL`, 100]]));
const FIELDERS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const TEAM = [
  ...FIELDERS.map((p, id) => ({ id, label: `${p} man`, bats: "R", ratings: { ...BAT, [`Pos Rating ${p}`]: 100 } })),
  { id: 8, label: "DH man", bats: "L", ratings: { ...BAT } },
];

test("the lock menus' ratings: every field slot rated above 0, rounded", async () => {
  const { fieldRatings } = await import("./league-lineup");
  assert.deepEqual(fieldRatings({ "Pos Rating 3B": 137.4, "Pos Rating SS": 0, "Pos Rating P": 50, "Pos Rating C": 45 }), { C: 45, "3B": 137 });
  assert.deepEqual(fieldRatings({}), {});
});

test("locks that can't make a legal nine: each is taken off in turn, then all of them", async () => {
  const { leagueLineups, solveAround, keptLocks } = await import("./league-lineup");
  const m = leagueLineups(TEAM, { family: "PEL", year: 2010 });
  const ids = TEAM.map((h) => h.id);
  const slotOf = (l: { lineup: Array<{ slot: string; id: number }> } | null, id: number) => l?.lineup.find((x) => x.id === id)?.slot;

  const free = solveAround(m.solve, ids, "vR", {});
  assert.ok(free.lineup, "the plain team fields nine");
  assert.deepEqual(free.dropped, []);

  // The DH man at short: he has no rating there.
  assert.equal(m.solve(ids, "vR", { SS: 8 }), null);
  const ss = solveAround(m.solve, ids, "vR", { SS: 8, LF: 5 });
  assert.deepEqual(ss.dropped, ["SS"], "only the bad lock goes");
  assert.equal(slotOf(ss.lineup, 4), "SS");
  assert.equal(slotOf(ss.lineup, 5), "LF", "the other lock holds");
  assert.deepEqual(keptLocks({ SS: 8, LF: 5 }, ss.dropped), { LF: 5 });

  // The only catcher at DH: nobody else can catch.
  const dh = solveAround(m.solve, ids, "vL", { DH: 0 });
  assert.deepEqual(dh.dropped, ["DH"]);
  assert.equal(slotOf(dh.lineup, 0), "C");

  // Two bad locks: neither alone fixes it, so both go.
  const both = solveAround(m.solve, ids, "vR", { DH: 0, SS: 8 });
  assert.deepEqual(both.dropped, ["SS", "DH"]);
  assert.ok(both.lineup);

  // Eight players can't field nine, locks or not: nothing to drop.
  const short = solveAround(m.solve, ids.slice(0, 8), "vR", { SS: 4 });
  assert.equal(short.lineup, null);
  assert.deepEqual(short.dropped, []);
});
