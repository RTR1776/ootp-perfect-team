import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dumpFileDate, isCompetitiveDumpFile, isQuickEvent, newestDumpFile, periodInPlay, periodsForDump } from "./dump-files";

const PERIODS = [
  { name: "PTCS 7", startsOn: "2026-09-07", endsOn: "2026-10-04" },
  { name: "PTCS 8", startsOn: "2026-10-05", endsOn: "2026-11-01" },
  { name: "PTCS 9", startsOn: "2026-11-02", endsOn: "2026-12-06" },
];

test("the newest dump is the newest competitive one, though a Quick dump sorts after it", () => {
  const dir = mkdtempSync(join(tmpdir(), "dumps-"));
  for (const f of [
    "pt27_tournaments_competitve_dump_20261102.csv", "pt27_tournaments_competitve_dump_20261109.csv",
    "pt27_tournaments_quick_dump_20261019.csv", "pt27_drafts_competitve_dump_20261109.csv", "pt27_drafts_quick_dump_20261019.csv",
  ]) writeFileSync(join(dir, f), "");
  // What import:myresults did until 11-12: every name holding the kind, sorted, last.
  const naive = (kind: string) => [
    "pt27_tournaments_competitve_dump_20261109.csv", "pt27_tournaments_quick_dump_20261019.csv",
    "pt27_drafts_competitve_dump_20261109.csv", "pt27_drafts_quick_dump_20261019.csv",
  ].filter((f) => f.includes(kind)).sort().pop();
  assert.equal(naive("tournaments"), "pt27_tournaments_quick_dump_20261019.csv");
  assert.equal(newestDumpFile(dir, "tournaments"), "pt27_tournaments_competitve_dump_20261109.csv");
  assert.equal(newestDumpFile(dir, "drafts"), "pt27_drafts_competitve_dump_20261109.csv");
});

test("competitive dump files: the Quick dumps are not one", () => {
  assert.equal(isCompetitiveDumpFile("pt27_tournaments_competitve_dump_20261109.csv"), true);
  assert.equal(isCompetitiveDumpFile("pt27_drafts_competitve_dump_20260817.csv"), true);
  assert.equal(isCompetitiveDumpFile("pt27_tournaments_quick_dump_20261019.csv"), false);
  assert.equal(isCompetitiveDumpFile("pt27_drafts_quick_dump_20261019.csv"), false);
  assert.equal(dumpFileDate("pt27_drafts_competitve_dump_20261109.csv"), "2026-11-09");
  assert.equal(dumpFileDate("notes.txt"), undefined);
});

test("Quick and EF events by name; competitive events are not", () => {
  // Every title shape in the 10-19 Quick dumps that carries rtr1776.
  for (const n of [
    "Q-Diamond-Bo5-T16-ID812", "Q-Gold-Bo5-T16-ID3", "Q-Silver-Bo5-T16-ID44", "Q-LowD-Bo5-T16-ID9", "Q-Bo5-T16-ID0",
    "EF-4T-Challenge-Diamond-ID2", "EF-H2H-Challenge-Diamond-ID7",
    "PD-Q-Bo5-T16-ID51", "PD-Q-Bo5-T16-Speed-5min-ID6", "PD-EF-4T-Challenge-ID1", "PD-EF-H2H-Challenge-ID3",
  ]) assert.equal(isQuickEvent(n), true, n);
  for (const n of [
    "Daily Diamond 1990 Onward", "Daily Gold Quick", "Sunday PD Main Event", "Laptophound's Daily 5L Deadball",
    "Daily Open Slots", "Quick", "EF Hutton Invitational",
  ]) assert.equal(isQuickEvent(n), false, n);
});

test("a dump is scored in the period it reaches", () => {
  assert.deepEqual(periodsForDump(PERIODS, "2026-11-09").map((p) => p.name), ["PTCS 9"]);
  assert.deepEqual(periodsForDump(PERIODS, "2026-10-26").map((p) => p.name), ["PTCS 8"]);
  assert.equal(periodInPlay(PERIODS, "2026-11-12")?.name, "PTCS 9");
  assert.equal(periodInPlay(PERIODS, "2026-12-07"), undefined);
});

test("the first dump after a period closes is also that period's final board", () => {
  // Monday 11-02: PTCS 8 ended the day before, PTCS 9 opened that morning.
  assert.deepEqual(periodsForDump(PERIODS, "2026-11-02").map((p) => p.name), ["PTCS 8", "PTCS 9"]);
  // A week on, the closed period is settled.
  assert.deepEqual(periodsForDump(PERIODS, "2026-11-08").map((p) => p.name), ["PTCS 8", "PTCS 9"]);
  assert.deepEqual(periodsForDump(PERIODS, "2026-11-09").map((p) => p.name), ["PTCS 9"]);
  // After the last period on file ends, its final dump still has a home.
  assert.deepEqual(periodsForDump(PERIODS, "2026-12-07").map((p) => p.name), ["PTCS 9"]);
  assert.deepEqual(periodsForDump(PERIODS, "2026-12-21"), []);
  // Before the first period on file.
  assert.deepEqual(periodsForDump(PERIODS, "2026-08-17"), []);
});
