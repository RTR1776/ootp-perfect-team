import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueTeam, newerTeamSheet } from "./league-team";
import { ARM_SLOT, SLOTS } from "./league-card-state";

test("the team sheet is whole: 26 players, nine a board, five starters, every lock on the lists", () => {
  const t = leagueTeam;
  assert.match(t.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set([...t.bats, ...t.arms]).size, t.bats.length + t.arms.length, "no one listed twice");
  assert.equal(t.bats.length + t.arms.length, 26);
  for (const e of [...t.bats, ...t.arms]) assert.match(e, /^[^#]+#\d+$/, `${e}: entries are "Name#cardId", as the export writes them`);
  for (const b of ["vR", "vL"] as const) {
    assert.deepEqual(Object.keys(t.lineups[b]).sort(), [...SLOTS].sort(), `${b}: all nine slots`);
    const on = Object.values(t.lineups[b]);
    assert.equal(new Set(on).size, 9, `${b}: nine different players`);
    for (const e of on) assert.ok(t.bats.includes(e), `${b}: ${e} is on the hitters' list`);
  }
  const slots = Object.keys(t.staff);
  for (const s of slots) assert.match(s, ARM_SLOT);
  assert.equal(slots.filter((s) => s.startsWith("SP")).length, 5);
  for (const e of Object.values(t.staff)) assert.ok(t.arms.includes(e), `${e} is on the pitchers' list`);
});

test("the sheet stands in for the export only while it is newer", () => {
  const t = { ...leagueTeam, asOf: "2026-09-28" };
  assert.equal(newerTeamSheet("2026-09-27", t)?.source, "your roster of 2026-09-28");
  assert.deepEqual(newerTeamSheet("2026-09-27", t)?.locks?.vR, t.lineups.vR);
  assert.equal(newerTeamSheet("2026-09-28", t), null, "an export of the same day wins");
  assert.equal(newerTeamSheet("2026-10-04", t), null);
  assert.ok(newerTeamSheet(null, t), "no export on file: the sheet");
});
