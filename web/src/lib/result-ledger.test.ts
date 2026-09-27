import { test } from "node:test";
import assert from "node:assert/strict";
import { dumpEvent, eventLogLine, mergeDays, placementBand, type DumpRow, type LedgerEvent } from "./result-ledger";

const CATS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Live", "Cap", "PD Daily", "PD Weekly"] as const;
const ev = (o: Partial<LedgerEvent> & { occurredOn: string }): LedgerEvent => ({
  eventId: 1, name: "Daily X", categories: ["Silver"], points: 0, fieldSize: 64, placement: null, eliminated: false, ...o,
});

test("a day is counted from exactly one source", () => {
  const days = mergeDays(
    ["2026-09-05", "2026-09-06", "2026-09-07"],
    CATS,
    [
      { occurredOn: "2026-09-05", category: "Silver", points: 4, note: "imported day" },
      { occurredOn: "2026-09-05", category: "Bronze", points: 2, note: "imported day" },
      { occurredOn: "2026-09-07", category: "Gold", points: 0, note: null }, // zero placeholder
    ],
    [
      ev({ eventId: 1600025, name: "Sunday High Iron Floor and Gold Ceiling (1600025)", occurredOn: "2026-09-07", categories: ["Gold", "Cap"], points: 10, fieldSize: 128, placement: "5th-8th" }),
      ev({ eventId: 2220177, name: "Daily Perfectly Gold (2220177)", occurredOn: "2026-09-07", categories: ["PD Daily"], points: 6, placement: "5th-8th" }),
    ],
  );
  assert.equal(days[0].source, "import");
  assert.equal(days[0].points.Silver, 4);
  assert.equal(days[0].note, "imported day");
  assert.equal(days[1].source, "none");
  assert.equal(days[1].points.Silver, 0);
  assert.equal(days[2].source, "results");
  assert.equal(days[2].conflict, false, "an all-zero imported row is a placeholder, not a conflict");
  assert.equal(days[2].points.Gold, 10);
  assert.equal(days[2].points.Cap, 10);
  assert.equal(days[2].points["PD Daily"], 6);
  assert.equal(days[2].points.Silver, 0);
  assert.match(days[2].note!, /^Sunday High Iron Floor and Gold Ceiling 1600025 5-8 \(128\) \+10 G\/\+10 C; Perfectly Gold 2220177 5-8 \(64\) \+6 PDD$/);
});

test("both sources on one day: results count, the import is flagged and shown", () => {
  const [d] = mergeDays(
    ["2026-09-06"],
    CATS,
    [{ occurredOn: "2026-09-06", category: "Gold", points: 10, note: "sheet said 10 G" }],
    [ev({ eventId: 1320175, name: "Daily Gold Slots (1320175)", occurredOn: "2026-09-06", categories: ["Gold", "Cap"], points: 3, placement: "9th-16th" })],
  );
  assert.equal(d.source, "results");
  assert.equal(d.conflict, true);
  assert.equal(d.points.Gold, 3, "never the sum of both");
  assert.deepEqual(d.importPoints?.Gold, 10);
  assert.match(d.note!, /imported total for this day also on file: G 10/);
});

test("log lines read like the tracker notes", () => {
  assert.equal(eventLogLine(ev({ eventId: 1640170, name: "Daily Bronze 1910-59 (1640170)", occurredOn: "x", categories: ["Bronze"], points: 25, placement: "1st" })), "Bronze 1910-59 1640170 WINNER (64) +25 B");
  assert.equal(eventLogLine(ev({ eventId: 2430025, name: "Saturday Shrinkage (2430025)", occurredOn: "x", categories: ["PD Weekly"], points: 0, fieldSize: 256, placement: null, eliminated: true })), "Saturday Shrinkage 2430025 eliminated (256) unscored");
  assert.equal(eventLogLine(ev({ eventId: 1320176, name: "Daily Gold Slots (1320176)", occurredOn: "x", categories: ["Gold", "Cap"], points: 0, placement: "33rd-64th" })), "Gold Slots 1320176 33-64 (64) 0");
});

// my_results rows as import:myresults stores them (PTCS 7, read 2026-09-27).
const dumpRow = (o: Partial<DumpRow>): DumpRow => ({
  eventId: "1640180", name: "Daily Bronze 1910-59", startAt: new Date("2026-09-15T01:00:00Z"),
  finish: 3, fieldSize: 64, points: 10, categories: "Bronze", ...o,
});

test("a dump row becomes a ledger event on its Chicago start date", () => {
  const e = dumpEvent(dumpRow({}));
  assert.equal(e.occurredOn, "2026-09-14", "8 pm Central on the 14th is the 15th in UTC");
  assert.equal(e.eventId, 1640180);
  assert.equal(e.source, "dump");
  assert.equal(e.finish, 3);
  assert.equal(e.placement, "3rd-4th");
  assert.deepEqual(dumpEvent(dumpRow({ categories: "Open,Cap" })).categories, ["Open", "Cap"]);
  assert.equal(eventLogLine(e), "Bronze 1910-59 1640180 3-4 (64) +10 B · dump");
});

test("finishes fall in the Your Tournaments bands", () => {
  const cases: [number, string][] = [
    [1, "1st"], [2, "2nd"], [3, "3rd-4th"], [4, "3rd-4th"], [5, "5th-8th"], [8, "5th-8th"], [9, "9th-16th"],
    [16, "9th-16th"], [17, "17th-32nd"], [33, "33rd-64th"], [64, "33rd-64th"], [65, "65th-128th"], [129, "129th-256th"], [256, "129th-256th"],
  ];
  for (const [finish, band] of cases) assert.equal(placementBand(finish), band, `finish ${finish}`);
});

test("an event in both the ledger and the dump counts once", () => {
  const logged = ev({ eventId: 1610027, name: "Sunday Open Slots (1610027)", occurredOn: "2026-09-20", categories: ["Open", "Cap"], points: 6, placement: "9th-16th" });
  const same = dumpEvent(dumpRow({ eventId: "1610027", name: "Sunday Open Slots", startAt: new Date("2026-09-20T19:00:00Z"), finish: 9, fieldSize: 128, points: 6, categories: "Open,Cap" }));
  const other = dumpEvent(dumpRow({ eventId: "1940117", name: "Daily Late 1900s", startAt: new Date("2026-09-21T02:00:00Z"), finish: 14, points: 3, categories: "Open" }));
  const [d] = mergeDays(["2026-09-20"], CATS, [], [logged, same, other]);
  assert.equal(d.points.Open, 9, "6 once, plus the 3 only the dump has");
  assert.equal(d.points.Cap, 6);
  assert.equal(d.source, "results", "a day with anything logged is a logged day");
  assert.deepEqual(d.events.map((e) => e.source ?? "results"), ["results", "dump"]);
  assert.match(d.note!, /Late 1900s 1940117 9-16 \(64\) \+3 Op · dump/);
});

test("a day only the dump saw counts as a dump day", () => {
  const [d] = mergeDays(["2026-09-14"], CATS, [], [dumpEvent(dumpRow({}))]);
  assert.equal(d.source, "dump");
  assert.equal(d.points.Bronze, 10);
  assert.equal(d.conflict, false);
});

test("the dump never counts on a day the imported tracker covers", () => {
  const days = mergeDays(
    ["2026-09-05", "2026-09-06"],
    CATS,
    [{ occurredOn: "2026-09-05", category: "Silver", points: 4, note: "imported day" }],
    [
      dumpEvent(dumpRow({ eventId: "1900100", startAt: new Date("2026-09-05T23:00:00Z"), points: 6, categories: "Silver,Cap" })),
      dumpEvent(dumpRow({ eventId: "1900101", startAt: new Date("2026-09-06T23:00:00Z"), points: 3, categories: "Silver,Cap" })),
    ],
  );
  assert.equal(days[0].source, "import");
  assert.equal(days[0].points.Silver, 4, "the tracker's total, not 4 + 6");
  assert.equal(days[0].points.Cap, 0);
  assert.equal(days[1].source, "dump");
  assert.equal(days[1].points.Silver, 3);
});
