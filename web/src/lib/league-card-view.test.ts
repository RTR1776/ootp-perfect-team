import { test } from "node:test";
import assert from "node:assert/strict";
import { armRows, boardTitle, lockOptions, rosterRows, seasonBat, teamTotals, type LineupLike, type PoolRow } from "./league-card-view";

const OTT = "Mel Ott#86272", WOOD = "Brandon Wood#86593", BAILEY = "Ed Bailey#86637", ROLEN = "Scott Rolen#86405";
const PIAZZA = "Mike Piazza#86463", BANKS = "Ernie Banks#86621", NEW = "Juan Soto#90001";
const POOL: PoolRow[] = [
  { entry: OTT, label: "Mel Ott 101", vR: 4.6, vL: 0.1, positions: { CF: 70, RF: 91 } },
  { entry: WOOD, label: "Brandon Wood 101", vR: 0.0, vL: -10.0, positions: { "1B": 90, "3B": 120, SS: 112 } },
  { entry: BAILEY, label: "Ed Bailey 97 VAR", vR: 2.6, vL: -49.6, positions: { C: 110 } },
  { entry: ROLEN, label: "Scott Rolen 101", vR: -4.7, vL: 1.7, positions: { "3B": 137 } },
  { entry: PIAZZA, label: "Mike Piazza 101 VAR", vR: 3.0, vL: -1.1, positions: { C: 69 } },
  { entry: BANKS, label: "Ernie Banks 102", vR: 4.5, vL: 8.6, positions: { SS: 128, "1B": 100 } },
];
const BATS = [OTT, WOOD, BAILEY, ROLEN, PIAZZA, BANKS];
const lineup = (rows: Array<[slot: string, entry: string, runs: number]>): LineupLike => ({
  lineup: rows.map(([slot, entry, runs]) => ({ slot, entry, label: POOL.find((p) => p.entry === entry)!.label, runs })),
  total: rows.reduce((n, r) => n + r[2], 0),
});

test("the lock menus offer only players who can play the slot, best glove first; at DH every bat (C5)", () => {
  const ss = lockOptions("SS", "vR", BATS, POOL);
  assert.deepEqual(ss, [[BANKS, "Ernie Banks · SS 128"], [WOOD, "Brandon Wood · SS 112"]]);
  assert.ok(!ss.some(([e]) => e === PIAZZA), "the SS menu doesn't offer Piazza");
  assert.deepEqual(lockOptions("C", "vR", BATS, POOL).map(([e]) => e), [BAILEY, PIAZZA]);
  const dh = lockOptions("DH", "vL", BATS, POOL);
  assert.equal(dh.length, BATS.length, "anyone can DH");
  assert.deepEqual(dh[0], [BANKS, "Ernie Banks · bat +8.6"], "best bat on this board first");
  assert.deepEqual(dh.at(-1), [BAILEY, "Ed Bailey · bat −49.6"]);

  // Just added: offered by name until he is scored.
  assert.deepEqual(lockOptions("SS", "vR", [...BATS, NEW], POOL).at(-1), [NEW, "Juan Soto"]);
  // His own lock stays in the menu even where the player can't play, so the select reads true.
  assert.deepEqual(lockOptions("SS", "vR", BATS, POOL, PIAZZA).at(-1), [PIAZZA, "Mike Piazza · can't play SS"]);
  assert.equal(lockOptions("SS", "vR", BATS, POOL, BANKS).filter(([e]) => e === BANKS).length, 1, "a legal lock is listed once");
  // Before the first score everyone is offered by name.
  assert.deepEqual(lockOptions("SS", "vR", BATS, []).map(([e]) => e), BATS);
});

test("the headline is (1 − lhp)·vR + lhp·vL; the team adds the staff (C6)", () => {
  const now = { vR: lineup([["C", BAILEY, 7.3], ["SS", BANKS, 8.1]]), vL: lineup([["SS", BANKS, 12.2], ["C", PIAZZA, -1.0]]) };
  const t = teamTotals({ now, lhp: 0.47, staff: { total: 20.8 } });
  const near = (a: number | null, b: number) => assert.ok(a != null && Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(t.vR, 15.4);
  near(t.vL, 11.2);
  near(t.bats, 0.53 * 15.4 + 0.47 * 11.2);
  near(t.team, t.bats! + 20.8);
  assert.equal(teamTotals({ now, lhp: 0.47, staff: null }).team, null, "no staff: no team total");
  assert.equal(teamTotals({ now: { vR: now.vR, vL: null }, lhp: 0.47, staff: null }).bats, null, "a board with no lineup: no headline");
  assert.equal(teamTotals(null).bats, null);
  near(seasonBat(10, 0, 0.44), 5.6);
  assert.equal(seasonBat(10, null, 0.44), null);
  assert.equal(boardTitle("vR", 0.47), "vs RHP · 53%");
  assert.equal(boardTitle("vL", 0.47), "vs LHP · 47%");
  assert.equal(boardTitle("vL", null), "vs LHP");
});

test("the team table: starters by boards started, then the bench, each by his season bat (C6)", () => {
  const now = {
    vR: lineup([["C", BAILEY, 7.3], ["SS", BANKS, 8.1], ["DH", OTT, 4.6]]),
    vL: lineup([["C", PIAZZA, -1.0], ["SS", BANKS, 12.2], ["3B", ROLEN, 1.7]]),
  };
  const { starters, bench, waiting } = rosterRows([...BATS, NEW], POOL, now, 0.47);
  assert.deepEqual(starters.map((r) => [r.entry, r.plays]), [
    [BANKS, "SS vs both"], [OTT, "DH vs R"], [PIAZZA, "C vs L"], [ROLEN, "3B vs L"], [BAILEY, "C vs R"],
  ]);
  assert.deepEqual(bench.map((r) => [r.entry, r.plays]), [[WOOD, "Bench"]], "everyone who starts on neither board");
  assert.deepEqual(waiting.map((r) => r.entry), [NEW], "not scored yet");

  const split = rosterRows(BATS, POOL, { vR: lineup([["DH", BAILEY, 2.6]]), vL: lineup([["C", BAILEY, -49.6]]) }, 0.47);
  assert.equal(split.starters[0].plays, "DH vs R · C vs L");
  const before = rosterRows(BATS, POOL, null, 0.47);
  assert.equal(before.waiting.length, BATS.length, "before the first score nobody is on the bench");
  assert.equal(before.bench.length, 0);
});

test("the pitchers' table: the rotation and the pen in slot order, then who sits, then who isn't scored", () => {
  const pool = ["A", "B", "C", "D"].map((entry) => ({ entry }));
  const staff = { rotation: [{ slot: "SP1", entry: "C" }], bullpen: [{ slot: "CL", entry: "A" }], out: [{ entry: "B" }] };
  const r = armRows(["A", "B", "C", "D", "E"], pool, staff);
  assert.deepEqual(r.pitching.map((x) => [x.entry, x.slot]), [["C", "SP1"], ["A", "CL"]]);
  assert.deepEqual(r.sits.map((x) => x.entry), ["B", "D"]);
  assert.deepEqual(r.waiting, ["E"]);
  assert.deepEqual(armRows(["A"], pool, null).waiting, ["A"], "no staff scored yet");
});
