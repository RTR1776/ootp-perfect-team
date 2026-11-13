import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCalibration } from "./calibration-guard";
import { CALIBRATION } from "./calibration";

// The fits on either side of 2026-10-30 (Docs/Arm Model Audit 2026-10-31.md).
const oct25 = { hit: { slope: 0.512, intercept: 0, applied: true, r: 0.62, sdModel: 15.9, lines: 13600 }, pit: { slope: 0.58, intercept: 0, applied: true, r: 0.62, sdModel: 8.4, lines: 11650 } };
const oct30 = { hit: oct25.hit, pit: { slope: 0.2609, intercept: 0, applied: true, r: 0.42, sdModel: 12.6, lines: 11658 } };

test("the 10-30 arm fit is refused, for the slope, the correlation and the spread", () => {
  const c = checkCalibration(oct30, oct25);
  assert.equal(c.ok, false);
  const text = c.problems.join("\n");
  assert.match(text, /arms: slope 0\.2609 is outside/);
  assert.match(text, /arms: slope 0\.58 -> 0\.2609 \(-55%\)/);
  assert.match(text, /arms: r 0\.62 -> 0\.42/);
  assert.match(text, /spread 8\.4 -> 12\.6/);
  assert.ok(!/bats/.test(text), "the bat side did not move");
});

test("an ordinary refit passes, with or without a file to compare against", () => {
  const next = { hit: { ...oct25.hit, slope: 0.4991, r: 0.6293 }, pit: { ...oct25.pit, slope: 0.6241, r: 0.6619, sdModel: 8.42 } };
  assert.deepEqual(checkCalibration(next, oct25), { ok: true, problems: [] });
  assert.deepEqual(checkCalibration(next, null), { ok: true, problems: [] });
});

test("a cut-short play table and a missing side are caught", () => {
  const short = { hit: { ...oct25.hit, lines: 6000 }, pit: oct25.pit };
  assert.match(checkCalibration(short, oct25).problems.join("\n"), /bats: fitted lines 13600 -> 6000/);
  assert.match(checkCalibration({ hit: oct25.hit }, oct25).problems.join("\n"), /arms: no fit/);
});

test("the calibration in the repo is one the guard would accept", () => {
  const c = checkCalibration(CALIBRATION as never, null);
  assert.deepEqual(c.problems, []);
});
