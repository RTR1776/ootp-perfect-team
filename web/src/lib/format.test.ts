import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, chicagoDay, date, daysAgo, ip, pct, pp, range, rate3, signed, stamp, tone } from "./format";

const M = "−";

test("rates drop the leading zero and use a real minus", () => {
  assert.equal(rate3(0.3412), ".341");
  assert.equal(rate3(-0.012), `${M}.012`);
  assert.equal(rate3(1.0344), "1.034");
  assert.equal(rate3(-0.0002), ".000", "no minus on a value that prints as zero");
  assert.equal(rate3(null), "—");
});

test("signed rounds first, so a zero has no sign and no colour", () => {
  assert.equal(signed(4.24), "+4.2");
  assert.equal(signed(-1), `${M}1.0`);
  assert.equal(signed(-0.04), "0.0");
  assert.equal(signed(0.04), "0.0");
  assert.equal(signed(2.345, 2), "+2.35");
  assert.equal(tone(-0.04), null);
  assert.equal(tone(0.05), "positive");
  assert.equal(tone(-0.3), "negative");
  assert.equal(tone(0.004, 2), null);
});

test("percent, Perfect Points and innings", () => {
  assert.equal(pct(0.342), "34%");
  assert.equal(pct(0.342, 1), "34.2%");
  assert.equal(pp(1800), "1,800");
  assert.equal(pp(22_400), "22k");
  assert.equal(pp(2_500_000), "2.50M");
  assert.equal(pp(999_700), "1.00M");
  assert.equal(ip(19.3333), "19.1");
  assert.equal(ip(19.6667), "19.2");
  assert.equal(ip(7), "7.0");
  assert.equal(ip(1234.6667), "1,234.2", "big workloads group like PA");
  assert.equal(ip(null), "—");
});

test("dates are Chicago calendar days, never negative ages", () => {
  // 23:30 in Chicago on 09-27 is already 09-28 in UTC.
  const now = new Date("2026-09-28T04:30:00Z");
  assert.equal(chicagoDay(now), "2026-09-27");
  assert.equal(ago(new Date("2026-09-28T04:00:00Z"), now), "today", "an upload 30 minutes ago, 'tomorrow' in UTC");
  assert.equal(ago("2026-09-27", now), "today");
  assert.equal(ago("2026-09-26", now), "1d");
  assert.equal(ago("2026-09-21", now), "6d");
  assert.equal(ago("2026-09-30", now), "today", "a future date clamps to today");
  assert.equal(daysAgo(null, now), null);
  // Before noon UTC the old helper printed "(-1d)" for today's date.
  assert.equal(daysAgo("2026-09-27", new Date("2026-09-27T08:00:00Z")), 0);
});

test("short dates add the year only when it differs", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  assert.equal(date("2026-09-07", now), "Sep 7");
  assert.equal(date("2025-12-31", now), "Dec 31, 2025");
  assert.equal(range("2026-09-07", "2026-10-04", now), "Sep 7 – Oct 4");
  assert.equal(date(undefined, now), "—");
});

test("clock stamps are Chicago times, with the day when it isn't today", () => {
  const now = new Date("2026-09-27T21:00:00Z"); // 16:00 in Chicago
  assert.equal(stamp(new Date("2026-09-27T19:02:00Z"), now), "14:02");
  assert.equal(stamp(Date.parse("2026-09-27T05:10:00Z"), now), "00:10", "just after midnight in Chicago is today");
  assert.equal(stamp("2026-09-27T04:30:00Z", now), "Sep 26 23:30", "late on the 26th in Chicago is the 27th in UTC");
  assert.equal(stamp(null, now), "—");
  assert.equal(stamp("not a date", now), "—");
});
