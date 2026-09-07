import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResultLine, parseResultLines } from "./result-lines";
import { scoreResult } from "./scoring";

const AS_OF = "2026-09-07";

test("a prose row in the screen's column order", () => {
  const p = parseResultLine(
    "★ Daily Perfectly Gold (2220177) [+] PD Daily 64 / 64 - Bo7 1999/DH/BP 100 CS, HDPk Yesterday 5th-8th Place",
    AS_OF,
  );
  assert.deepEqual(p.problems, []);
  assert.equal(p.occurredOn, "2026-09-06");
  assert.deepEqual(p.input, { name: "Daily Perfectly Gold (2220177)", standingsTag: "PD Daily", field: "64 / 64", status: "5th-8th" });
  const s = scoreResult(p.input!);
  assert.equal(s.eventId, 2220177);
  assert.deepEqual(s.categories, ["PD Daily"]);
  assert.equal(s.points, 6);
});

test("tab-separated rows, multi-category tags, TW dropped", () => {
  const rows = parseResultLines(
    [
      "Sunday High Iron Floor and Gold Ceiling (1600025)\tGld,Cp,TW\t128 / 128 - Bo7\t<=GOLD; MIN 50; 1767 Cap; Variant Limit 7\tDH\t400 CS, 3 HDPk\tYesterday\t5th-8th Place",
      "Sunday Open Main Event (1620025)\tOp,TW\t256 / 256 - Bo7\t\tDH/BP\t550 CS, 4 HDPk\tYesterday\t65th-128th Plac",
      "Daily Perfectly Silver (2550165)\tPD Daily\t64 / 64 - Bo5F7\t\t2008/DH/BP\t100 CS, HDPk\tSep. 5th\t17th-32nd Place",
    ].join("\n"),
    AS_OF,
  );
  assert.equal(rows.length, 3);
  for (const r of rows) assert.deepEqual(r.problems, [], r.line);
  const hi = scoreResult(rows[0].input!);
  assert.deepEqual(hi.categories, ["Gold", "Cap"]);
  assert.equal(hi.points, 10);
  assert.equal(hi.totalPoints, 20);
  // the restrictions column says "1767 Cap" and "<=GOLD" - neither may read as the tag
  assert.equal(rows[0].input!.standingsTag, "Gld,Cp,TW");
  const open = scoreResult(rows[1].input!);
  assert.deepEqual(open.categories, ["Open"]);
  assert.equal(open.points, 1, "65th-128th of 256 is 1 point");
  assert.equal(rows[2].occurredOn, "2026-09-05");
});

test("a date ordinal is not a placement, a two-digit date is not a field size", () => {
  const p = parseResultLine("Daily Late Silver (1240177) Silver 128 / 128 - Bo7 1992/DH/BP 120 CS, 2 HDPk Sep. 1st 33rd-64th Place", AS_OF);
  assert.equal(p.input?.status, "33rd-64th");
  assert.equal(p.occurredOn, "2026-09-01");
  const q = parseResultLine("Daily Late Silver (1240100) | Silver | 128 / 128 - Bo7 | 12/10 | Winner", "2026-12-12");
  assert.equal(q.input?.field, "128 / 128");
  assert.equal(q.occurredOn, "2026-12-10");
  assert.equal(q.input?.status, "Winner");
});

test("a row without a date falls back to null; without an id it is refused", () => {
  const p = parseResultLine("Daily Gold Slots (1320176) Gold,Cap 64 / 64 - Bo7 33rd-64th Place", AS_OF);
  assert.equal(p.occurredOn, null);
  assert.deepEqual(p.problems, []);
  const bad = parseResultLine("Daily Gold Slots Gold,Cap 64 / 64 - Bo7 Yesterday 33rd-64th Place", AS_OF);
  assert.equal(bad.input, null);
  assert.match(bad.problems[0], /event id/);
});

test("a restriction word after the field size is not mistaken for a missing tag", () => {
  const p = parseResultLine("Some Event (1234567) 64 / 64 - Bo7 Cards <= GOLD Yesterday 9th-16th Place", AS_OF);
  assert.equal(p.input, null);
  assert.ok(p.problems.some((x) => /standings tag/.test(x)));
});

test("Eliminated scores nothing but is logged", () => {
  const p = parseResultLine("Thursday Overnight Under the Covers (2360023) PD Weekly 256 / 256 - Bo7 Yesterday Eliminated", AS_OF);
  const s = scoreResult(p.input!);
  assert.equal(s.eliminated, true);
  assert.equal(s.points, 0);
});

test("month/day without a year picks the most recent past occurrence", () => {
  const p = parseResultLine("X (1000001) Silver 64 / 64 - Bo7 Dec 30 9th-16th Place", "2027-01-02");
  assert.equal(p.occurredOn, "2026-12-30");
});
