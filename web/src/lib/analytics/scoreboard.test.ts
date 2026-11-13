import { test } from "node:test";
import assert from "node:assert/strict";
import { boardGroup, buildScoreboard, kindBoard, seriesRecord, weekOf } from "./scoreboard";
import type { DumpEvent, ParsedDump } from "./dumps";

const T = (iso: string) => Date.parse(`${iso}T15:00:00Z`) / 1000;
/** A full field in finishing order with `me` at `pos` and `star` (if any) winning. */
const field = (size: number, me: string | null, pos: number, star: string | null = null): string[] => {
  const f = Array.from({ length: size }, (_, i) => `p${i + 1}`);
  if (star) f[0] = star;
  if (me) f[pos - 1] = me;
  return f;
};
const ev = (id: number, name: string, iso: string, finishers: string[]): DumpEvent => ({ id: String(id), name, start: T(iso), finishers });
const dump = (source: "tournaments" | "drafts", events: DumpEvent[]): ParsedDump => ({
  source, events, dateMin: "2026-09-01", dateMax: new Date(Math.max(...events.map((e) => e.start)) * 1000).toISOString().slice(0, 10),
});

test("a finishing position fixes the series record", () => {
  assert.deepEqual(seriesRecord(1, 128), { won: 7, lost: 0 });
  assert.deepEqual(seriesRecord(2, 128), { won: 6, lost: 1 });
  assert.deepEqual(seriesRecord(3, 64), { won: 4, lost: 1 });
  assert.deepEqual(seriesRecord(8, 64), { won: 3, lost: 1 });
  assert.deepEqual(seriesRecord(9, 64), { won: 2, lost: 1 });
  assert.deepEqual(seriesRecord(33, 64), { won: 0, lost: 1 });
  assert.deepEqual(seriesRecord(65, 128), { won: 0, lost: 1 });
  assert.deepEqual(seriesRecord(64, 128), { won: 1, lost: 1 });
});

test("weeks start on Monday, and an event is filed under its first category", () => {
  assert.equal(weekOf(T("2026-11-02")), "2026-11-02"); // a Monday, the day PTCS 9 opened
  assert.equal(weekOf(T("2026-11-08")), "2026-11-02"); // the Sunday after
  assert.equal(weekOf(T("2026-11-09")), "2026-11-09");
  assert.equal(boardGroup("Daily Goldfather II", "tournaments"), "Gold");
  assert.equal(boardGroup("Sunday PD Main Event", "drafts"), "PD Weekly");
  assert.equal(boardGroup("Daily All-Gold", "drafts"), "PD Daily");
});

test("his line, the windows and the rank among regulars", () => {
  const events: DumpEvent[] = [];
  let id = 1;
  // The recent 14 days: he wins two 64s and goes out in round one once; "ace" wins the rest.
  events.push(ev(id++, "Daily Goldfather II", "2026-11-09", field(64, "RTR1776", 1)));
  events.push(ev(id++, "Daily Goldfather II", "2026-11-08", field(64, "RTR1776", 1)));
  events.push(ev(id++, "Daily Late Silver", "2026-11-03", field(64, "RTR1776", 40, "ace")));
  events.push(ev(id++, "Daily Late Silver", "2026-11-02", field(64, null, 0, "ace")));
  // The 14 days before: he goes out in round one twice.
  events.push(ev(id++, "Daily Goldfather II", "2026-10-20", field(64, "RTR1776", 50, "ace")));
  events.push(ev(id++, "Daily Goldfather II", "2026-10-21", field(64, "RTR1776", 60, "ace")));
  // A Quick event and a short field never count.
  events.push(ev(id++, "Q-Gold-Bo5-T16-ID9", "2026-11-09", field(16, "RTR1776", 1)));
  events.push(ev(id++, "Daily Goldfather II", "2026-11-07", field(64, "RTR1776", 1).slice(0, 61)));

  const k = kindBoard(dump("tournaments", events), "rtr1776", { recentDays: 14, regularPerRecent: 2, weeks: 8 });
  const [now, before] = k.windows;
  assert.equal(now.label, "Last 14 days");
  assert.deepEqual([now.me.entries, now.me.won, now.me.lost, now.me.titles], [3, 12, 1, 2]);
  assert.equal(now.me.pct, 92.3);
  assert.equal(now.me.ptsPer, Math.round(((25 + 25 + 0) / 3) * 100) / 100);
  assert.deepEqual([before.me.entries, before.me.won, before.me.lost], [2, 0, 2]);
  // Regulars (2+ events): "ace" won both of his (12-0), then him, then the rest of the field.
  assert.equal(now.rank, 2);
  assert.ok(now.regulars >= 2);
  // Weeks, oldest first; by category with the earlier line beside it; by event.
  assert.deepEqual(k.weeks.map((w) => [w.week, w.entries]), [["2026-10-19", 2], ["2026-11-02", 2], ["2026-11-09", 1]]);
  const gold = k.groups.find((g) => g.group === "Gold")!;
  assert.deepEqual([gold.entries, gold.won, gold.before.entries, gold.before.won], [2, 12, 2, 0]);
  assert.deepEqual(k.events.map((e) => [e.name, e.entries, e.size]), [["Daily Goldfather II", 2, 64], ["Daily Late Silver", 1, 64]]);
  // Round by round: he played the round of 64 three times and won it twice; the final twice and won both.
  const r64 = k.rounds.find((r) => r.left === 64)!, r2 = k.rounds.find((r) => r.left === 2)!;
  assert.deepEqual([r64.played, r64.won, r2.played, r2.won], [3, 2, 2, 2]);
  assert.equal(r64.topPct, 100, "the best regular won every round he played");
});

test("the board carries both kinds and the day the dumps reach", () => {
  const t = dump("tournaments", [ev(1, "Daily Goldfather II", "2026-11-09", field(64, "rtr1776", 2))]);
  const d = dump("drafts", [ev(2000001, "Daily All-Gold", "2026-11-08", field(64, "rtr1776", 5))]);
  const b = buildScoreboard(t, d, "rtr1776", "2026-11-12");
  assert.equal(b.through, "2026-11-08", "the earlier of the two dumps' last days");
  assert.equal(b.tournaments.windows[0].me.won, 5);
  assert.equal(b.drafts.windows[0].me.won, 3);
  assert.equal(b.drafts.groups[0].group, "PD Daily");
  assert.deepEqual(kindBoard({ source: "drafts", events: [], dateMin: "", dateMax: "" }, "x", { recentDays: 42, regularPerRecent: 30, weeks: 16 }).weeks, []);
});
