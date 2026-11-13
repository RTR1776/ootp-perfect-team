/**
 * Is a new calibration safe to write over the one in use?
 *
 * On 2026-10-30 one card (a pHR vL of 4, far below its curve's window, scored
 * at -2,842 runs) flattened the arm fit: slope 0.58 -> 0.26, r 0.62 -> 0.42,
 * the model's spread 8.4 -> 12.6. The filer wrote it on quit, the push carried
 * it to main, and every roster for two days priced arms at under half their
 * worth. Nothing looked at the numbers on the way through. This does.
 *
 * A fit is refused when a side's slope or correlation is outside the range any
 * healthy fit has landed in, or when it moves sharply against the file it
 * would replace. model:calibrate runs it before writing; --force writes anyway.
 */
import type { Calibration, CalibrationSide } from "./calibration";

export interface GuardedSide extends CalibrationSide { lines?: number; sdModel?: number }

/** Every applied fit on record sits well inside these: bats 0.50-0.51, arms 0.48-0.62; r 0.51-0.66. */
export const CALIBRATION_BOUNDS = {
  slope: { min: 0.35, max: 0.9 },
  rMin: 0.45,
  /** Against the file being replaced. */
  slopeMove: 0.15,   // relative
  rDrop: 0.06,       // absolute
  spreadMove: 0.25,  // relative, the model's sd over the fitted lines
  linesDrop: 0.3,    // relative: a truncated table
} as const;

export interface CalibrationCheck { ok: boolean; problems: string[] }

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(0)}%`;

export function checkCalibration(
  next: { hit?: GuardedSide; pit?: GuardedSide },
  prev: { hit?: GuardedSide; pit?: GuardedSide } | Calibration | null,
): CalibrationCheck {
  const B = CALIBRATION_BOUNDS;
  const problems: string[] = [];
  for (const [kind, label] of [["hit", "bats"], ["pit", "arms"]] as const) {
    const n = next[kind] as GuardedSide | undefined;
    if (!n) { problems.push(`${label}: no fit`); continue; }
    if (!Number.isFinite(n.slope)) { problems.push(`${label}: slope is not a number`); continue; }
    if (n.slope < B.slope.min || n.slope > B.slope.max) problems.push(`${label}: slope ${n.slope} is outside ${B.slope.min}-${B.slope.max}`);
    if (n.r != null && n.r < B.rMin) problems.push(`${label}: r ${n.r} is under ${B.rMin}`);
    const bend = n.bend;
    if (bend && !([bend.at, bend.below, bend.above].every(Number.isFinite) && bend.below > 0 && bend.above > 0 && bend.below <= 1 && bend.above <= bend.below)) {
      if (bend.applied) problems.push(`${label}: the bend in use reads below ${bend.below}, above ${bend.above}`);
    }
    const p = (prev as { hit?: GuardedSide; pit?: GuardedSide } | null)?.[kind];
    if (!p || !Number.isFinite(p.slope) || !(p.slope > 0)) continue;
    const move = n.slope / p.slope - 1;
    if (Math.abs(move) > B.slopeMove) problems.push(`${label}: slope ${p.slope} -> ${n.slope} (${pct(move)})`);
    if (n.r != null && p.r != null && p.r - n.r > B.rDrop) problems.push(`${label}: r ${p.r} -> ${n.r}`);
    if (n.sdModel != null && p.sdModel != null && p.sdModel > 0 && Math.abs(n.sdModel / p.sdModel - 1) > B.spreadMove) {
      problems.push(`${label}: the model's spread ${p.sdModel} -> ${n.sdModel} (${pct(n.sdModel / p.sdModel - 1)}); look for a card scored far off the scale`);
    }
    if (n.lines != null && p.lines != null && p.lines > 0 && 1 - n.lines / p.lines > B.linesDrop) {
      problems.push(`${label}: fitted lines ${p.lines} -> ${n.lines}; the play table looks cut short`);
    }
  }
  return { ok: problems.length === 0, problems };
}
