/**
 * The model's calibration, as fitted by scripts/model-calibrate.ts.
 *
 * Pure and dependency-free so both the scorer (env-fit) and the projected
 * lines (projections) can read it in the browser. See model-calibrate.ts for
 * how the slope is measured; only the slope is applied — the within-field
 * intercept is ~0 by construction and applying it would move the zero.
 */
import CALIBRATION_JSON from "@/data/model-calibration.json";

export interface CalibrationSide { slope: number; intercept: number; applied: boolean; r?: number; rmse?: number; cards?: number; n?: number }
export interface Calibration { fittedAt: string | null; hit: CalibrationSide; pit: CalibrationSide }

export const CALIBRATION = CALIBRATION_JSON as unknown as Calibration;

/** The slope to apply for a side, 1 when the fit is recorded but not applied. */
export function calibrationSlope(kind: "hit" | "pit"): number {
  const s = CALIBRATION[kind];
  return s && s.applied && Number.isFinite(s.slope) && s.slope > 0 ? s.slope : 1;
}

/** Runs above league average, put on the observed scale. */
export const OBS_K_DEFAULT = 5000;
