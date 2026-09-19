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

/**
 * What each rating returned in play, per era band: runs per 700 PA per +10
 * rating, within series (series fixed effects), from `pnpm era:slopes` on
 * 57 series / 13.4M PA, 2026-09-19. The calibrated model pays a single
 * scaled line per environment; play pays BABIP two to three times that in
 * every era and Power and Avoid Ks more before 1994, Eye and Gap about the
 * same. The correction below is the gap per rating point, applied to bats
 * before the observed blend. Arms have no panel yet and are left alone.
 */
export const ERA_SLOPES: { band: string; from: number; to: number; runs: Record<string, number> }[] = [
  { band: "Deadball", from: 0, to: 1920, runs: { Power: 0.89, Eye: 1.09, "Avoid Ks": 1.02, BABIP: 3.66, Gap: 0.96 } },
  { band: "Live Ball", from: 1921, to: 1945, runs: { Power: 2.88, Eye: 0.92, "Avoid Ks": 1.02, BABIP: 2.51, Gap: 0.34 } },
  { band: "Integration", from: 1946, to: 1960, runs: { Power: 2.84, Eye: 0.96, "Avoid Ks": 1.18, BABIP: 3.24, Gap: 0.83 } },
  { band: "Expansion", from: 1961, to: 1976, runs: { Power: 2.13, Eye: 0.61, "Avoid Ks": 1.37, BABIP: 2.05, Gap: 0.32 } },
  { band: "Free Agency", from: 1977, to: 1993, runs: { Power: 2.38, Eye: 0.72, "Avoid Ks": 1.21, BABIP: 2.77, Gap: 0.81 } },
  { band: "Steroid", from: 1994, to: 2009, runs: { Power: 2.18, Eye: 0.67, "Avoid Ks": 0.48, BABIP: 1.24, Gap: 0.60 } },
  { band: "Modern", from: 2010, to: 9999, runs: { Power: 2.53, Eye: 0.58, "Avoid Ks": 1.44, BABIP: 2.02, Gap: 0.63 } },
];

export const eraBand = (year: number | null | undefined) =>
  year == null ? null : ERA_SLOPES.find((b) => year >= b.from && year <= b.to) ?? null;

/** The split-rating key a hitter's overall rating name maps to ("Avoid Ks" → "Avoid K vR"). */
export const ERA_SPLIT_KEY: Record<string, string> = { Power: "Power", Eye: "Eye", "Avoid Ks": "Avoid K", BABIP: "BABIP", Gap: "Gap" };
/** The curves' average rating, where the correction is zero. */
export const ERA_AVERAGE_RATING = 110;

/**
 * Runs per rating point to ADD to a bat's calibrated model runs in this era,
 * given the model's own calibrated line (runs per +10) for the board's
 * environment. Null when the year has no band or the line is missing.
 */
export function eraCorrectionPerPoint(year: number | null | undefined, modelLine: Record<string, number>): Record<string, number> | null {
  const band = eraBand(year);
  if (!band) return null;
  const out: Record<string, number> = {};
  for (const r of Object.keys(band.runs)) if (modelLine[r] != null) out[r] = (band.runs[r] - modelLine[r]) / 10;
  return out;
}
