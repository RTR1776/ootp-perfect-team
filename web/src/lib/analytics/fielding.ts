/**
 * Position defence in runs. See scripts/fielding-fit.ts for the measurement:
 * runs = (rating − field mean at the position) × ZR-per-point × runs-per-ZR,
 * per full season (1,400 innings ≈ 700 PA), scaled to the PA asked for.
 *
 * Only differences between candidates at the same position matter to a roster
 * search (every position is filled exactly once per board, so the per-position
 * constant cancels); the field mean is there so the number reads sensibly on
 * its own.
 */
import fielding from "@/data/fielding.json";

type PosFit = { slope: number; mean: number };
const FIT = fielding as { runsPerZR: number; positions: Record<string, PosFit> };

export const FIELDING_FIT = FIT;

export function fieldingRuns(pos: string, rating: number | null | undefined, pa = 700): number {
  const f = FIT.positions[pos];
  if (!f || rating == null || !Number.isFinite(rating) || rating <= 0) return 0;
  return (rating - f.mean) * f.slope * FIT.runsPerZR * (pa / 700);
}

/** Runs per rating point at a position, per 700 PA. */
export function fieldingRunsPerPoint(pos: string): number {
  const f = FIT.positions[pos];
  return f ? f.slope * FIT.runsPerZR : 0;
}
