import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { P5, P6, dayOf, dumpReach, projectFromDumps, readCwhitTargets } from "./ptcs-projection";
import type { DumpEvent, ParsedDump } from "./analytics/dumps";

/** PTCS 9's shape: 35 days from a Monday. */
const PERIOD = { start: "2026-11-02", end: "2026-12-06" };
const POOL = Array.from({ length: 400 }, (_, i) => `u${i}`);

/** 10am Central on a day, so the event sits squarely inside that Central day. */
const at10 = (iso: string) => Date.parse(`${iso}T15:00:00Z`) / 1000;

/**
 * A synthetic dump: `perDay` events a day over P5, P6 and the first `days`
 * days of the period, with `lastDay` events on the day after those (the day
 * the dump was pulled), each a 64-man field drawn from a pool of 400.
 */
function dump(source: "tournaments" | "drafts", o: { perDay: number; days: number; lastDay: number }): ParsedDump {
  const name = source === "tournaments" ? "Daily Low Bronze" : "Daily All-Gold";
  const prefix = source === "tournaments" ? "1" : "2";
  const days: [string, number][] = [];
  for (const w of [P5, P6]) for (let d = w.start; d <= w.end; d = dayOf(d, 2)) days.push([d, o.perDay]);
  for (let n = 1; n <= o.days; n++) days.push([dayOf(PERIOD.start, n), o.perDay]);
  if (o.lastDay > 0) days.push([dayOf(PERIOD.start, o.days + 1), o.lastDay]);
  const events: DumpEvent[] = [];
  let k = 0;
  for (const [iso, count] of days) {
    for (let j = 0; j < count; j++, k++) {
      events.push({
        id: `${prefix}${String(k).padStart(6, "0")}`, name, start: at10(iso) + j * 60,
        finishers: Array.from({ length: 64 }, (_, i) => POOL[(k * 37 + i * 7) % POOL.length]),
      });
    }
  }
  const utc = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  return { source, events, dateMin: utc(events[0].start), dateMax: utc(events[events.length - 1].start) };
}

const both = (t: ParsedDump, d: ParsedDump) => ({
  tournaments: { file: "pt27_tournaments_competitve_dump_20261110.csv", dump: t },
  drafts: { file: "pt27_drafts_competitve_dump_20261110.csv", dump: d },
});

test("a dump pulled early on its last day reaches the day before it", () => {
  // Days 1-8 whole, then two events on day 9 (11-10): the 11-09 dump's shape, 6 on 11-09 against ~55.
  const r = dumpReach(dump("tournaments", { perDay: 20, days: 8, lastDay: 2 }));
  assert.deepEqual(r, { reach: "2026-11-09", last: "2026-11-10", lastEvents: 2, usual: 20, partial: true });

  const whole = dumpReach(dump("tournaments", { perDay: 20, days: 8, lastDay: 0 }));
  assert.equal(whole.reach, "2026-11-09", "a whole last day is kept");
  assert.equal(whole.partial, false);

  const slow = dumpReach(dump("tournaments", { perDay: 20, days: 8, lastDay: 12 }));
  assert.equal(slow.partial, false, "a day over half the usual is a whole day (09-28 ran 51 against 55)");

  const short: ParsedDump = { source: "drafts", events: [{ id: "2000001", name: "Daily All-Gold", start: at10("2026-11-09"), finishers: ["a"] }], dateMin: "", dateMax: "" };
  assert.deepEqual(dumpReach(short), { reach: "2026-11-09", last: "2026-11-09", lastEvents: 1, usual: null, partial: false }, "too few days to judge: kept");
});

test("N is the last whole day, so the period's line and the history's are cut on the same day", () => {
  // Tournaments: day 9 thin. Drafts: day 9 thin as well (the 11-09 dumps had 6 and 4).
  const t = dump("tournaments", { perDay: 20, days: 8, lastDay: 2 });
  const d = dump("drafts", { perDay: 12, days: 8, lastDay: 1 });
  const p = projectFromDumps({ period: PERIOD, ...both(t, d) });
  assert.equal(p.day, 8, "not 9: the dump holds 2 of day 9's 20 events");
  assert.equal(p.dumpDay, 8);
  assert.equal(p.binding.reach, "2026-11-09");
  assert.ok(p.sources.every((s) => s.partial && s.last === "2026-11-10"));

  // The same projection as forcing day 8, and different from the thin day 9 the old rule used.
  const forced8 = projectFromDumps({ period: PERIOD, day: 8, ...both(t, d) });
  assert.deepEqual(p.lines, forced8.lines);
  const thin9 = projectFromDumps({ period: PERIOD, day: 9, ...both(t, d) });
  const bronze = (x: typeof p) => x.lines.find((l) => l.category === "Bronze")!;
  assert.ok(bronze(p).now > 0 && bronze(p).projected > 0, "the synthetic field makes a line");
  assert.ok(bronze(thin9).projected < bronze(p).projected,
    `a thin day 9 grown by the history's whole day 9 reads low: ${bronze(thin9).projected} against ${bronze(p).projected}`);
});

test("the staler dump still binds, each on its own last whole day", () => {
  // Tournaments whole through day 8, pulled early on day 9; drafts complete through day 9 itself.
  const t = dump("tournaments", { perDay: 20, days: 8, lastDay: 3 });
  const d = dump("drafts", { perDay: 12, days: 9, lastDay: 0 });
  const p = projectFromDumps({ period: PERIOD, ...both(t, d) });
  assert.equal(p.day, 8);
  assert.equal(p.binding.kind, "tournaments");
  assert.deepEqual(p.sources.map((s) => [s.kind, s.reach, s.partial]), [["tournaments", "2026-11-09", true], ["drafts", "2026-11-10", false]]);
});

test("cwhit's board carries its cycle and its length", () => {
  const dir = mkdtempSync(join(tmpdir(), "cwhit-"));
  try {
    writeFileSync(join(dir, "2026-11-20 cycle9 targets.csv"),
      "Category,CurrentQP,Rank,ProjectedCutoff,Need,Status,LastCutoff,HistAdj,Current128,ProgressPct,Weeks,Confidence,Source\n" +
      "Gold,56,48,120,35,Currently top 128,120,91,26,28.5,5,Medium,Hist\nIron,0,,130,102,Need QP,129,101,27,25.5,5,Medium,Hist\n");
    assert.deepEqual(readCwhitTargets(dir), { file: "2026-11-20 cycle9 targets.csv", lines: { Gold: 120, Iron: 130 }, cycle: 9, days: 35 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
