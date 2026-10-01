import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSplitSeries } from "./format-split";

test("a run before the format date goes to its own series; the rest stay", () => {
  assert.equal(formatSplitSeries("silverweekly", "2026-09-17", "2026-09-24"), "silverweekly-pre20260924");
  assert.equal(formatSplitSeries("silverweekly", "2026-09-24", "2026-09-24"), "silverweekly", "the first run of the format is current");
  assert.equal(formatSplitSeries("silverweekly", null, "2026-09-24"), "silverweekly", "no known run date: unchanged");
  assert.equal(formatSplitSeries("goldcapdaily", "2026-09-17", undefined), "goldcapdaily", "no format date: unchanged");
});
