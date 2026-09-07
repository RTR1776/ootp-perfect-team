import { test } from "node:test";
import assert from "node:assert/strict";
import { eventLogLine, mergeDays, type LedgerEvent } from "./result-ledger";

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
