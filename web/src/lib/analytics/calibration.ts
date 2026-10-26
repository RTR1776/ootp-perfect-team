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
/*
 * 2026-10-11: effectively off (was 5000). Tested three ways against tournament
 * results with a card's play in OTHER event types blended in: PTCS 7
 * Championship bats 0.279 ratings-only vs 0.272 at K=5000; Championship teams
 * 0.396 vs 0.376; 3,580 team-events in 42 exports, win% 0.375 vs 0.371 (and
 * worse at every smaller K). Ratings scored in the event's own environment
 * beat the track record, so the blend is kept only as a negligible tie-break.
 */
export const OBS_K_DEFAULT = 1_000_000;

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
 * TEAM WEIGHTS (TOURNAMENTS) — what a modelled run of glove and of pitching is
 * worth in tournament wins, against a modelled run of bat (= 1).
 *
 * L.J. 2026-10-11: league play is normalised and tournaments are not — two
 * models. These are fitted on tournaments only (scripts/model-v2: teams.mts →
 * tourfit.py): 3,580 team-events in 42 exports (36 cap events + the six PTCS 7
 * Championship brackets; 1946–76, 1994–2009 and 2010+ environments), each
 * team's offence / defence / pitching scored on the production model in the
 * event's own environment, centred within the event, against win%.
 *
 * Tournament win% is mostly luck: 17% of its variance is skill, so the best any
 * model can do is a correlation of about 0.41. Equal weights reach 0.375; one
 * pooled 2 / 2 reaches 0.380 out of sample (5-fold by event), and per-era
 * weights did not beat it held out (they fit noise), so one weight for every
 * era. The league seasons, which wanted ~3 / 2.5, are not used here.
 *
 * Starters and the pen split (10-11, penfit.py on the same team-events with the
 * pitching runs split by role): every one of five held-out fits picked a
 * starter weight of 1–1.5 and a pen weight of 2.5–4, with no loss against 2 / 2
 * out of sample, and the field's best quarter spends fewer Perfect / Diamond
 * cards on starters than we did. L.J. chose starters 1.5, the pen left at 2.
 *
 * Refit 2026-10-17 on the cleaned archive, with variant copies scored as their
 * own form in the harness (Docs/Model Audit 2026-10-17.md): equal weights rose
 * to 0.402 and these weights to 0.406, against 0.407 for the held-out choice.
 * The folds again picked starters 1 and the pen 2–3, inside noise, so no change.
 *
 * BY ERA, 2026-10-25 (Docs/Model Review 2026-10-25.md §2): the archive harness
 * (685 exports, 54,273 team-events; scripts/model-review/teamweights-oldprices.py)
 * with the gloves on centred rating gaps at FIELDING_CALIBRATION prices and
 * framing as its own term. Weights (glove / framing / starters / pen) chosen by
 * grid on half the exports, scored on the other half, 40 half-samples per band
 * against the production 2 / 1 / 1.5 / 2:
 *   1977–93: 1.25 / 0.5 / 1.0 / 3.0, +0.0046 held out, better in 40/40
 *   1994–2009: 1.25 / 0.5 / 1.0 / 2.5, +0.0022, 38/40
 *   ≤1945 (5/40), 1946–76 (18/40) and 2010+ (31/40): production holds.
 * End to end with the pBABIP fix (scripts/model-review/endtoend.py): +0.0015
 * overall, better in 40/40; 1977–93 +0.0076, 1994–2009 +0.0034.
 * `frm` weights catcher framing (fielding.ts framingRuns), which was added at 1
 * outside the glove's weight; it stays 1 where production holds.
 */
export const TEAM_WEIGHTS: { from: number; to: number; def: number; frm: number; pit: number; sp: number; rp: number }[] = [
  { from: 0, to: 1976, def: 2, frm: 1, pit: 2, sp: 1.5, rp: 2 },
  { from: 1977, to: 1993, def: 1.25, frm: 0.5, pit: 2, sp: 1, rp: 3 },
  { from: 1994, to: 2009, def: 1.25, frm: 0.5, pit: 2, sp: 1, rp: 2.5 },
  { from: 2010, to: 9999, def: 2, frm: 1, pit: 2, sp: 1.5, rp: 2 },
];

/** Glove, framing and pitching weights against a bat run (= 1) for a run-environment year; the 2010 band with no year. */
export function teamWeights(year: number | null | undefined): { def: number; frm: number; pit: number; sp: number; rp: number } {
  const y = year ?? 2010;
  const b = TEAM_WEIGHTS.find((w) => y >= w.from && y <= w.to) ?? TEAM_WEIGHTS[TEAM_WEIGHTS.length - 1];
  return { def: b.def, frm: b.frm, pit: b.pit, sp: b.sp, rp: b.rp };
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
 *
 * Raised 2026-10-14 (Docs/Model Audit 2026-10-14.md): with these in, the
 * archive still read pHR short by ~0.3 per +10 in every band from 1946 on and
 * Stuff short by ~0.3 in 1946–2009, on runs allowed and on FIP alike (Control
 * and pBABIP disagreed between the two, so they stay). +0.3 each: within-series
 * r against runs allowed 0.529 → 0.546 (1946–2009), 0.324 → 0.336 (2010+).
 *
 * pBABIP, 2026-10-25 (Docs/Model Review 2026-10-25.md §3): at team level,
 * residual win% after the production score rose with the staff's BF-weighted
 * pBABIP (archive harness, 54,273 team-events). As a correction it held out in
 * 1946–76 (36/40, ≈ +0.33 runs per 700 BF per +10) and 1977–93 (37/40, ≈ +0.74),
 * not before 1946 (23/40), in 1994–2009 (26/40) or from 2010 (20/40); applied at
 * 0.75 like the rest, in those two bands only. The FIP and card-level checks
 * above could not see it: FIP leaves balls in play out, and the pBABIP curve
 * was never refit (the export has no hits-allowed counter).
 */
export const ARM_RATING_FIX: { from: number; to: number; runs: Record<string, number> }[] = [
  { from: 0, to: 1945, runs: { Stuff: 0.53 } },
  { from: 1946, to: 1976, runs: { Stuff: 0.75, pHR: 0.68, pBABIP: 0.25 } },
  { from: 1977, to: 1993, runs: { Stuff: 0.3, pHR: 0.68, pBABIP: 0.55 } },
  { from: 1994, to: 2009, runs: { Stuff: 0.3, pHR: 0.98 } },
  { from: 2010, to: 9999, runs: { pHR: 0.83 } },
];
/** Where ARM_RATING_FIX is zero: the BF-weighted mean of each rating across the archive (pBABIP 102.5, rounded). */
export const ARM_RATING_CENTER: Record<string, number> = { Stuff: 92, pHR: 100, pBABIP: 100 };

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

/**
 * PARK HAND OFFSET (2026-10-11). env-fit scores each bat against an average bat
 * OF ITS OWN SIDE in the park (each side's environment carries its own league
 * baseline, and the linear weights are rescaled to the era's scoring), so a
 * park that suppresses lefties and helps righties moved neither: at 1971 Dodger
 * Stadium an average left bat is −11.4 runs per 700 PA and a right bat +6.1
 * against the field's mixed park, and the model saw none of it. L.J.'s PTCS 7
 * Championship rosters ran +20 points of left-handed PA over the median team
 * while the deepest teams ran −7 and Liam −16.
 *
 * Measured on the archive (scripts/model-v2/check1.py, 10,013 bat lines in 56
 * series with a park): observed runs above the field rose 0.44 per run of that
 * offset (two-fold by series 0.53 / 0.37; the most lopsided parks 0.40; the
 * Championship 0.37), with held-out correlation up in both halves. This is the
 * share of the offset that is added back.
 *
 * Re-checked 2026-10-25 (Docs/Model Review 2026-10-25.md §1): shrinking the
 * park factors themselves (with this at 1) predicted wins worse in every era
 * band, so the stated factors and this 0.44 stay.
 */
export const PARK_HAND_TRUST = 0.44;

/**
 * SPEED (2026-10-11). The card model prices Avoid K, BABIP, Gap, Power and Eye;
 * Speed, Stealing and Baserunning are in no curve. Over 3,580 tournament
 * team-events, runs scored per game beyond the model's offence rose 0.059 per
 * sd (8.3 points) of the lineup's PA-weighted Speed, positive in all five
 * held-out folds (scripts/model-v2/check23.py). For one bat that is ~1.2 runs
 * per 700 PA per +10 Speed; applied at 0.75, from the archive's PA-weighted
 * mean of 65. Stealing and Baserunning added nothing once Speed was in.
 */
export const SPEED_RUNS_PER_POINT = 0.09;
export const SPEED_CENTER = 65;

/**
 * STAFF STAMINA (2026-10-11). Runs allowed per game beyond the model's pitching
 * and defence fell 0.127 per sd (8 points) of the staff's BF-weighted Stamina,
 * every held-out fold between −0.137 and −0.114 (3,580 tournament team-events).
 * Card by card a high-stamina arm is NOT better per batter (−0.69 runs per +10
 * against runs allowed), so this is a staff effect — starters who go deep keep
 * the weakest arms out of the game — priced as each arm's share of it: a run of
 * team stamina is ~2.5 runs a season, divided over the staff's weights, ≈ 0.25
 * per stamina point; applied at half, from the archive's BF-weighted mean of 71.
 * Observed starter share of BF looked far stronger but is partly a result
 * (starters who are hit come out), so it is not used.
 */
export const STAMINA_RUNS_PER_POINT = 0.12;
export const STAMINA_CENTER = 71;

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
