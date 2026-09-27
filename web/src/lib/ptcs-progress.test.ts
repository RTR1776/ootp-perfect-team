import { test } from "node:test";
import assert from "node:assert/strict";
import { SAFE_MARGIN, lastDataIndex, periodCalendar, safeMark, standings, verdictLabel } from "./ptcs-progress";
import type { MergedDay } from "./result-ledger";

const CATS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Live", "Cap", "PD Daily", "PD Weekly"] as const;

/** Merged days from each day's points; null is a day with nothing on file. */
function days(spec: (Record<string, number> | null)[]): MergedDay[] {
  return spec.map((p, i) => ({
    date: `2026-09-${String(7 + i).padStart(2, "0")}`,
    points: Object.fromEntries(CATS.map((c) => [c, p?.[c] ?? 0])),
    source: p ? "results" : "none",
    conflict: false, importPoints: null, note: null, events: [],
  }));
}

test("safe at is the higher line plus 10%, rounded up: the PTCS 7 standing doc's numbers", () => {
  assert.equal(SAFE_MARGIN, 0.1);
  // [ours, cwhit, safe at], from Docs/PTCS 7 Standing 2026-09-27.md
  const doc: [number, number, number][] = [
    [97, 95, 107], [266, 269, 296], [73, 73, 81], [100, 107, 118],
    [98, 94, 108], [97, 91, 107], [59, 77, 85], [127, 129, 142],
  ];
  for (const [ours, cwhit, safeAt] of doc) assert.equal(safeMark(0, ours, cwhit)?.safeAt, safeAt, `${ours}/${cwhit}`);
  assert.equal(safeMark(0, 100, null)?.safeAt, 110, "float noise (100 × 1.1 = 110.00000000000001) adds no point");
  assert.deepEqual(safeMark(101, 98, 94), { line: 98, safeAt: 108, toSafe: 7 });
  assert.equal(safeMark(120, 97, 91)?.toSafe, 0, "never negative");
  assert.deepEqual(safeMark(5, null, 40), { line: 40, safeAt: 44, toSafe: 39 }, "one line is enough");
  assert.equal(safeMark(5, null, undefined), null);
});

test("days left counts today, on Chicago's calendar", () => {
  // 03:00Z on the 27th is still the 26th in Chicago.
  assert.equal(periodCalendar("2026-09-07", "2026-10-04", new Date("2026-09-27T03:00:00Z")).daysLeft, 9);
  const p = periodCalendar("2026-09-07", "2026-10-04", new Date("2026-09-27T17:00:00Z"));
  assert.equal(p.today, "2026-09-27");
  assert.equal(p.daysLeft, 8, "10-04 − 09-27 + 1");
  assert.equal(p.remaining, 7, "remaining still leaves today out");
  assert.equal(periodCalendar("2026-09-07", "2026-10-04", new Date("2026-09-07T17:00:00Z")).daysLeft, 28);
  assert.equal(periodCalendar("2026-09-07", "2026-10-04", new Date("2026-10-04T17:00:00Z")).daysLeft, 1);
  const after = periodCalendar("2026-09-07", "2026-10-04", new Date("2026-10-05T17:00:00Z"));
  assert.equal(after.daysLeft, 0);
  assert.equal(after.finished, true);
  assert.equal(periodCalendar("2026-09-07", "2026-10-04", new Date("2026-09-01T17:00:00Z")).daysLeft, 28, "not started: all of it");
});

test("pace runs to the last day with data, from the category's own first scoring day", () => {
  // Days 1-4 logged, day 5 not logged yet, day 6 is today.
  const d = days([{ Gold: 10 }, { Gold: 10, Silver: 6 }, { Silver: 6 }, { Gold: 10, Silver: 6 }, null, null]);
  assert.equal(lastDataIndex(d), 3);
  const o = { totalDays: 28, daysLeft: 23, dayIndex: 6, ourLines: { Gold: 100, Silver: 100 } };
  const [gold] = standings(d, ["Gold"], o);
  assert.equal(gold.pace, 7.5, "30 over days 1-4, not over the 6 days to today");
  assert.equal(gold.projected, 30 + 7.5 * 24, "carried over the 24 days after the data");
  const [silver] = standings(d, ["Silver"], o);
  assert.equal(silver.pace, 6, "a staggered start is a plan, not a deficit");
  const [open] = standings(days([{ Open: 10 }, { Open: 10 }, null]), ["Open"], { totalDays: 28, daysLeft: 26, dayIndex: 3, ourLines: { Open: 100 } });
  assert.equal(open.pace, 10);
  assert.equal(open.projected, null, "no projection before three scoring days");
});

test("verdicts: safe, short of safe, on pace, behind", () => {
  const d = days([
    { Cap: 50, Silver: 34, Open: 10, Bronze: 2 },
    { Cap: 50, Silver: 34, Open: 10, Bronze: 2 },
    { Cap: 50, Silver: 33, Open: 10, Bronze: 2 },
  ]);
  const o = { totalDays: 10, daysLeft: 8, dayIndex: 3, ourLines: { Cap: 127, Silver: 98, Open: 97, Bronze: 100 }, cwhitLines: { Cap: 129, Silver: 94 } };
  const by = Object.fromEntries(standings(d, ["Cap", "Silver", "Open", "Bronze"], o).map((r) => [r.category, r]));
  assert.equal(by.Cap.verdict, "safe");
  assert.equal(verdictLabel(by.Cap), "safe — stop");
  assert.equal(by.Silver.verdict, "to-safe", "101 is past the line (98) but short of safe (108)");
  assert.equal(verdictLabel(by.Silver), "7 to safe");
  assert.equal(by.Open.verdict, "on-pace", "30 + 10 × 7 = 100 ≥ 97");
  assert.equal(verdictLabel(by.Open), "on pace");
  assert.equal(by.Bronze.verdict, "behind", "6 + 2 × 7 = 20 < 100");
  assert.equal(by.Bronze.gap, 94);
  assert.equal(verdictLabel(by.Bronze), "needs 11.8/day", "94 over 8 days, today included");
  assert.equal(standings(d, ["Iron"], { ...o, ourLines: {} })[0].verdict, "no-line");
});

test("not playing: from day 7, under a tenth of the line, too few scoring days to forecast", () => {
  const o = { totalDays: 28, daysLeft: 22, ourLines: { Live: 121, Iron: 91 }, cwhitLines: { Live: 136, Iron: 102 } };
  const early = days([{ Live: 1 }, null, null, null, null, null]);
  assert.equal(standings(early, ["Live"], { ...o, daysLeft: 23, dayIndex: 6 })[0].verdict, "behind", "never before day 7");
  const d = days([{ Live: 1 }, {}, { Live: 1 }, {}, {}, {}, {}]);
  const [live, iron] = standings(d, ["Live", "Iron"], { ...o, dayIndex: 7 });
  assert.equal(live.verdict, "not-playing", "two incidental 1-point days");
  assert.equal(iron.verdict, "not-playing");
  assert.equal(verdictLabel(iron), "not playing");
  const back = days([{ Live: 1 }, {}, { Live: 1 }, {}, {}, {}, { Live: 1 }]);
  assert.equal(standings(back, ["Live"], { ...o, dayIndex: 7 })[0].verdict, "behind", "a third scoring day makes it active again");
  const big = days([{ Live: 15 }, {}, {}, {}, {}, {}, {}]);
  assert.equal(standings(big, ["Live"], { ...o, dayIndex: 7 })[0].verdict, "behind", "a tenth of the line is being played");
});

test("rows run by action: most still to get first, then safe, then not playing", () => {
  const d = days([
    { Cap: 60, Silver: 34, Bronze: 17, "PD Daily": 64, Live: 1 },
    { Cap: 60, Silver: 34, Bronze: 17, "PD Daily": 63 },
    { Cap: 66, Silver: 33, Bronze: 17, "PD Daily": 63 },
    {}, {}, {}, {},
  ]);
  const order = standings(d, ["Iron", "Bronze", "Silver", "Live", "Cap", "PD Daily"], {
    totalDays: 28, daysLeft: 22, dayIndex: 7,
    ourLines: { Iron: 91, Bronze: 100, Silver: 98, Live: 121, Cap: 127, "PD Daily": 266 },
    cwhitLines: { Iron: 102, Bronze: 107, Silver: 94, Live: 136, Cap: 129, "PD Daily": 269 },
  }).map((r) => r.category);
  assert.deepEqual(order, ["PD Daily", "Bronze", "Silver", "Cap", "Live", "Iron"]);
});

test("points from the dump are counted and reported per category", () => {
  const [d] = days([{ Bronze: 13, Open: 3 }]);
  d.events = [
    { eventId: 1640180, name: "Daily Bronze 1910-59", occurredOn: d.date, categories: ["Bronze"], points: 10, fieldSize: 64, placement: "3rd-4th", eliminated: false, source: "dump", finish: 3 },
    { eventId: 1820174, name: "Daily Bronze OOTP Era", occurredOn: d.date, categories: ["Bronze"], points: 3, fieldSize: 128, placement: "17th-32nd", eliminated: false },
    { eventId: 1940117, name: "Daily Late 1900s", occurredOn: d.date, categories: ["Open"], points: 3, fieldSize: 64, placement: "9th-16th", eliminated: false, source: "dump", finish: 14 },
  ];
  const by = Object.fromEntries(standings([d], ["Bronze", "Open"], { totalDays: 28, daysLeft: 28, dayIndex: 1, ourLines: {} }).map((r) => [r.category, r]));
  assert.equal(by.Bronze.total, 13);
  assert.equal(by.Bronze.fromDump, 10);
  assert.equal(by.Open.fromDump, 3);
});
