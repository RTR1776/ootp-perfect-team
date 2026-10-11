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
 * Arms' spread by run-environment era, on top of the calibration slope.
 *
 * The pitcher slope above was fitted in the PT default frame (2010, neutral
 * park) and applied everywhere. Checked 2026-10-11 with the production scorer
 * in each series' own environment (66 archived series + the six PTCS 7
 * Championship brackets, cards with 50+ BF, FIP-based runs above the field):
 * observed runs per modelled run were 1.60 in 1946–76 environments and 1.31
 * in 1977–93, against 0.92 in the default. Two-fold by series, those two bands
 * held (1.49 / 1.74 and 1.28 / 1.34); every other band flipped sign between
 * folds, so they stay at 1. With this rule the held-out slope went 1.26 → 1.08
 * and 1.10 → 0.96, Pearson r rose in both folds, and the
 * Championship (never used to fit it) went 1.41 → 0.94. The 10-05 Daily
 * Diamond 1990 Onward check (1957 RE) had found 1.47.
 */
export const ARM_ERA_SPREAD: { from: number; to: number; factor: number }[] = [
  { from: 1946, to: 1976, factor: 1.5 },
  { from: 1977, to: 1993, factor: 1.3 },
];

/**
 * TEAM WEIGHTS — what a modelled run of glove and of pitching is worth in run
 * differential, against a modelled run of bat (= 1), by run-environment era.
 *
 * Fitted 2026-10-11 (scripts/model-v2: teams.mts → fit.py) on 4,793 team rows:
 * 1,213 league seasons (HD/PEL/LD, ~160 games each; 1952, 1959, 1989 theme
 * weeks and the 2010-13 default) and 3,580 tournament team-events (36 cap
 * exports + the six PTCS 7 Championship brackets). Each team's offence,
 * defence and pitching were scored on the production model in the event's own
 * environment (arm era spread and glove calibration already in), centred
 * within the event, and compared with run differential per game.
 *
 * Pooled, a model run of pitching bought 2.4–3.1× a model run of bat and a
 * glove run 3–4× (bootstrap 90%: pitching 2.5–3.8, glove 3.3–4.5). The glove
 * effect runs entirely through fielding actually made: with observed ZR in the
 * tournament fit the model-glove term goes to −0.02. Cross-validated — fit on
 * league seasons, scored on tournaments and back, and 5-fold by event — the
 * three weights beat equal weights everywhere (5-fold 0.474 → 0.503; tournament
 * → league 0.546 → 0.569). Per-band values come from a grid scored directly on
 * each band's league and tournament rows (no fitting, so each cell is out of
 * sample); 1994–2009 has tournament rows only and wants much less. Before
 * 1946 has no team data and takes a middle value. Roster traits (stamina,
 * speed, handedness) did not transfer between league and tournament and are
 * not used.
 */
export const TEAM_WEIGHTS: { from: number; to: number; def: number; pit: number }[] = [
  { from: 0, to: 1945, def: 2, pit: 2 },
  { from: 1946, to: 1976, def: 3, pit: 2.5 },
  { from: 1977, to: 1993, def: 3, pit: 2 },
  { from: 1994, to: 2009, def: 1.5, pit: 1.5 },
  { from: 2010, to: 9999, def: 3, pit: 2.5 },
];

/** Glove and pitching weights against a bat run (= 1) for a run-environment year; the 2010 band with no year. */
export function teamWeights(year: number | null | undefined): { def: number; pit: number } {
  const y = year ?? 2010;
  const b = TEAM_WEIGHTS.find((w) => y >= w.from && y <= w.to) ?? TEAM_WEIGHTS[TEAM_WEIGHTS.length - 1];
  return { def: b.def, pit: b.pit };
}

/**
 * Arm ratings the calibrated model still under-prices, by era band: runs per
 * 700 BF to ADD per +10 rating above the centre (where an average arm sits,
 * so the correction moves good arms against bad ones, not the arms' level).
 *
 * Measured 2026-10-11 (scripts/model-v2/ratings.py) on the archive with the
 * production scorer in each series' own environment: observed runs above the
 * field (FIP-based) regressed jointly on the model and every rating, two-fold
 * by series. Kept only where both halves agreed in sign and size; applied at
 * 0.75 of the pooled miss. pHR is short in every band; Stuff before 1977.
 * pBABIP reads as over-priced against FIP, but FIP leaves balls in play out by
 * construction, so that reading is an artefact and pBABIP is left alone.
 */
export const ARM_RATING_FIX: { from: number; to: number; runs: Record<string, number> }[] = [
  { from: 0, to: 1945, runs: { Stuff: 0.53 } },
  { from: 1946, to: 1976, runs: { Stuff: 0.45, pHR: 0.38 } },
  { from: 1977, to: 1993, runs: { pHR: 0.38 } },
  { from: 1994, to: 2009, runs: { pHR: 0.68 } },
  { from: 2010, to: 9999, runs: { pHR: 0.53 } },
];
/** Where ARM_RATING_FIX is zero: the BF-weighted mean of each rating across the archive. */
export const ARM_RATING_CENTER: Record<string, number> = { Stuff: 92, pHR: 100 };

/** Runs per 700 BF to add to an arm for its ratings in this era (0 with no year). */
export function armRatingFix(year: number | null | undefined, ratings: Record<string, number>): number {
  if (year == null) return 0;
  const b = ARM_RATING_FIX.find((x) => year >= x.from && year <= x.to);
  if (!b) return 0;
  let d = 0;
  for (const [k, perTen] of Object.entries(b.runs)) {
    const v = ratings[k];
    if (v != null && Number.isFinite(v)) d += (perTen * (v - (ARM_RATING_CENTER[k] ?? 100))) / 10;
  }
  return d;
}

/** The arms' spread multiplier for a run-environment year (1 outside the bands, or with no year). */
export function armEraSpread(year: number | null | undefined): number {
  if (year == null) return 1;
  return ARM_ERA_SPREAD.find((b) => year >= b.from && year <= b.to)?.factor ?? 1;
}

/**
 * What each rating returned in play, per era band: runs per 700 PA per +10
 * rating, within series (series fixed effects), from `pnpm era:slopes` on
 * 57 series / 13.4M PA, 2026-09-19. The calibrated model pays a single
 * scaled line per environment; play pays BABIP two to three times that in
 * every era and Power and Avoid Ks more before 1994, Eye and Gap about the
 * same. The correction below is the gap per rating point, applied to bats
 * before the observed blend. Arms have no panel yet and are left alone.
 */
export const ERA_SLOPES: { band: string; from: number; to: number; series: number; runs: Record<string, number> }[] = [
  { band: "Deadball", series: 4, from: 0, to: 1920, runs: { Power: 0.89, Eye: 1.09, "Avoid Ks": 1.02, BABIP: 3.66, Gap: 0.96 } },
  { band: "Live Ball", series: 3, from: 1921, to: 1945, runs: { Power: 2.88, Eye: 0.92, "Avoid Ks": 1.02, BABIP: 2.51, Gap: 0.34 } },
  { band: "Integration", series: 6, from: 1946, to: 1960, runs: { Power: 2.84, Eye: 0.96, "Avoid Ks": 1.18, BABIP: 3.24, Gap: 0.83 } },
  { band: "Expansion", series: 5, from: 1961, to: 1976, runs: { Power: 2.13, Eye: 0.61, "Avoid Ks": 1.37, BABIP: 2.05, Gap: 0.32 } },
  { band: "Free Agency", series: 8, from: 1977, to: 1993, runs: { Power: 2.38, Eye: 0.72, "Avoid Ks": 1.21, BABIP: 2.77, Gap: 0.81 } },
  // Steroid band raised 2026-10-11 (scripts/model-v2/ratings.py, 1,448 bat lines, both halves agreeing; 0.75 of the measured miss): Power +0.53, Avoid Ks +0.23, BABIP +0.23.
  { band: "Steroid", series: 8, from: 1994, to: 2009, runs: { Power: 2.71, Eye: 0.67, "Avoid Ks": 0.71, BABIP: 1.47, Gap: 0.60 } },
  { band: "Modern", series: 23, from: 2010, to: 9999, runs: { Power: 2.53, Eye: 0.58, "Avoid Ks": 1.44, BABIP: 2.02, Gap: 0.63 } },
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

/**
 * Power's curve, on top of the era correction. The era slopes are linear per
 * rating point, and play pays Power on a log curve: checked 2026-10-01 against
 * the production model (era fix applied, each series' own environment, park
 * and left-handed share), 1,424 bats over 72 series. The residual (play minus
 * model) rose by about 4 runs per 700 PA per e-fold of Power, a doubling being
 * about +2.6, and nothing else was stable across halves. Contact-only bats
 * (Power under 60, Contact 110+) ran 2.5 runs under the model; this term alone
 * clears that.
 *
 * Fit within series on half the series and tested on the other half: 3.6 and
 * 4.1, error per card down 4% both ways; 3.8 on all of them. Deadball (6 series)
 * gave 0.3 and 5.5 and made the held-out half worse, so it is left at zero.
 * The rating is floored at 20: a vL Power of 1 is "no power", not -12 runs.
 * Cwhit's site rates contact bats higher still; play does not.
 */
export const POWER_CURVE = { runsPerELog: 3.8, from: 1921, ref: ERA_AVERAGE_RATING, floor: 20 } as const;

/** Runs to add to a bat's board for its Power on that board, in this era. */
export function powerCurveRuns(year: number | null | undefined, power: number | null | undefined): number {
  if (year == null || year < POWER_CURVE.from || power == null || !Number.isFinite(power)) return 0;
  return POWER_CURVE.runsPerELog * Math.log(Math.max(power, POWER_CURVE.floor) / POWER_CURVE.ref);
}
