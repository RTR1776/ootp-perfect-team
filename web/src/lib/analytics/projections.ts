/**
 * PROJECTIONS — what a card's ratings say it will do in a given environment.
 *
 * This is the one place a "projected line" comes from. It is the curve model
 * (card-value.ts: rating -> component rate, fitted on observed tournament play
 * and normalised per series) pushed through an era's rate profile and a park,
 * then read back as the stats a human compares against an observed line:
 * wOBA / AVG / OBP / SLG / K% / BB% / HR per PA for a bat, FIP / K9 / BB9 /
 * HR9 for an arm, and runs per 700 PA above a league-average card on the
 * same environment's linear weights.
 *
 * It replaces "model v0" (projection.ts, a linear regression of career wOBA
 * on seven ratings, r² .28, one global fit with no park or era). That model
 * could not tell a 1919 deadball event from 2000 Coors, so its pWOBA was a
 * ranking device and nothing more. These numbers are on the stat scale of
 * the event itself, so a projected .330 wOBA can be set next to the .331
 * the card actually produced in that series.
 *
 * The wOBA weights are the ones observed wOBA is computed with (league.ts),
 * and FIP uses the same constant as fipOf, so projected and observed are
 * comparable by construction.
 *
 * What it does NOT include: the relief role effect (roleRuns, applied by
 * env-fit at a trusted fraction), observed play (observed-blend, applied by
 * env-fit), and defence (fielding.ts). Those belong to the roster scorer;
 * a projection is the ratings alone.
 */
import {
  cardRuns, envFor, hitterRates, pitcherRates, rangeFlags, type Env, type RangeFlag, type Split,
} from "./card-value";
import { applyPark, blendPark, linearWeights, probs, type EraRates, type ParkFactors } from "./run-env";
import { FIP_CONSTANT } from "./league";
import { calibrationSlope } from "./calibration";
import type { ParkRow } from "./tournament-env";

/** wOBA weights, identical to league.ts's `W` so projected == observed scale. */
const WOBA = { BB: 0.69, HB: 0.72, b1: 0.888, b2: 1.271, b3: 1.616, HR: 2.101 };

/** The three sides of an environment: the park as a left-handed bat sees it,
 *  as a right-handed bat sees it, and blended for an arm facing the field —
 *  each with the line a league-average card produces there, which is what a
 *  projection is shrunk toward. */
export interface ProjectionEnvs {
  left: Env; right: Env; pitch: Env;
  leagueLeft: HitterLine; leagueRight: HitterLine; leaguePitch: PitcherLine;
}

const side = (era: EraRates, park: ParkRow | null, lhbShare: number): Env => {
  const f: ParkFactors | null = park ? blendPark(park, lhbShare) : null;
  return envFor(era, f, linearWeights(f ? applyPark(era, f) : era));
};

/**
 * `lhbShare` is the share of plate appearances a pitcher in this field faces
 * from left-handed bats; series_meta.lhb_pa_share when the series has exports,
 * 0.35 otherwise.
 */
export function projectionEnvs(era: EraRates, park: ParkRow | null, lhbShare = 0.35): ProjectionEnvs {
  const left = side(era, park, 1), right = side(era, park, 0), pitch = side(era, park, lhbShare);
  return {
    left, right, pitch,
    leagueLeft: rawHitterLine(era, left), leagueRight: rawHitterLine(era, right), leaguePitch: rawPitcherLine(era, pitch),
  };
}

/**
 * CALIBRATED. The curves overstate the spread between cards by about half
 * (scripts/model-calibrate.ts: within a field, +10 modelled runs came back as
 * +5.1 for bats and +4.8 for arms). Every projected number here is therefore
 * the league-average line plus the calibrated share of the card's distance
 * from it, so a projected .330 wOBA means what an observed .330 means. The
 * uncalibrated curve output is available as `raw` for anyone auditing the
 * curves themselves.
 */
const shrink = <T extends object>(line: T, league: T, slope: number): T => {
  if (slope === 1) return line;
  const a = line as unknown as Record<string, number>, b = league as unknown as Record<string, number>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(a)) out[k] = b[k] + slope * (a[k] - b[k]);
  return out as unknown as T;
};

/** Which side of the park a batter stands on for a board. */
export const batsLeftOn = (bats: string | null | undefined, board: "R" | "L"): boolean =>
  board === "R" ? bats === "L" || bats === "S" : bats === "L";

export interface HitterLine {
  woba: number; avg: number; obp: number; slg: number; babip: number;
  kPct: number; bbPct: number; hrPa: number;
  /** Runs per 700 PA above a league-average card in this environment. */
  runs: number;
}

export interface PitcherLine {
  fip: number; k9: number; bb9: number; hr9: number; whip: number;
  /** Runs SAVED per 700 batters faced against a league-average arm. */
  runs: number;
}

function rawHitterLine(rates: EraRates, env: Env): HitterLine {
  const withPark = env.park ? applyPark(rates, env.park) : rates;
  const p = probs(withPark);
  const ab = 1 - withPark.BB - withPark.HBP;
  const h = p.B1 + p.B2 + p.B3 + p.HR;
  const woba = WOBA.BB * withPark.BB + WOBA.HB * withPark.HBP + WOBA.b1 * p.B1 + WOBA.b2 * p.B2 + WOBA.b3 * p.B3 + WOBA.HR * p.HR;
  const bip = ab - withPark.K - p.HR;
  return {
    woba,
    avg: h / ab,
    obp: h + withPark.BB + withPark.HBP,
    slg: (p.B1 + 2 * p.B2 + 3 * p.B3 + 4 * p.HR) / ab,
    babip: bip > 0 ? (h - p.HR) / bip : 0,
    kPct: withPark.K, bbPct: withPark.BB, hrPa: p.HR,
    runs: cardRuns(rates, env),
  };
}

function rawPitcherLine(rates: EraRates, env: Env): PitcherLine {
  const withPark = env.park ? applyPark(rates, env.park) : rates;
  const p = probs(withPark);
  const onBase = p.B1 + p.B2 + p.B3 + p.HR + withPark.BB + withPark.HBP;
  const paPer9 = 27 / Math.max(1 - onBase, 1e-9);
  const fip = ((13 * p.HR + 3 * (withPark.BB + withPark.HBP) - 2 * withPark.K) * paPer9) / 9 + FIP_CONSTANT;
  return {
    fip,
    k9: withPark.K * paPer9, bb9: withPark.BB * paPer9, hr9: p.HR * paPer9,
    whip: ((p.B1 + p.B2 + p.B3 + p.HR + withPark.BB) * paPer9) / 9,
    runs: -cardRuns(rates, env),
  };
}

/** A hitter on one board: vs-RHP uses the vR ratings, vs-LHP the vL ratings. */
export function projectHitter(r: Record<string, number>, envs: ProjectionEnvs, bats: string | null | undefined, board: "R" | "L"): HitterLine | null {
  const leftSide = batsLeftOn(bats, board);
  const env = leftSide ? envs.left : envs.right;
  const rates = hitterRates(r, env.rates, board === "R" ? "vR" : "vL");
  return rates ? shrink(rawHitterLine(rates, env), leftSide ? envs.leagueLeft : envs.leagueRight, calibrationSlope("hit")) : null;
}

export function projectPitcher(r: Record<string, number>, envs: ProjectionEnvs, split: Split): PitcherLine | null {
  const rates = pitcherRates(r, envs.pitch.rates, split);
  return rates ? shrink(rawPitcherLine(rates, envs.pitch), envs.leaguePitch, calibrationSlope("pit")) : null;
}

/** The share of a hitter's plate appearances that come against left-handed pitching. */
export const HIT_LHP_SHARE = 0.3;
/** The share of an arm's batters faced that are the vs-LHB read. */
export const PIT_VL_SHARE = 0.45;

export interface CardProjection {
  kind: "hit" | "pit";
  /** The headline stat: wOBA for a bat, FIP for an arm. */
  all: number; vL: number; vR: number;
  /** Runs per 700 PA (bats) or runs saved per 700 BF (arms), same three reads. */
  runsAll: number; runsL: number; runsR: number;
  /** The full projected line per side, for the card face. */
  lines: { vL: HitterLine | PitcherLine; vR: HitterLine | PitcherLine };
  /** Ratings past the curves' fitted range — the number there is an extrapolation. */
  flags: RangeFlag[];
}

/**
 * Both boards for one card. `all` is the app's standing blend: a bat sees
 * 70% right-handed pitching (or `lhpShare` when the field's own split is
 * known), an arm is read 45/55 vs left/right bats.
 */
export function projectCard(
  card: { isPitcher: boolean; bats?: string | null; ratings: Record<string, number> },
  envs: ProjectionEnvs,
  lhpShare = HIT_LHP_SHARE,
): CardProjection | null {
  if (card.isPitcher) {
    const vL = projectPitcher(card.ratings, envs, "vL"), vR = projectPitcher(card.ratings, envs, "vR");
    if (!vL || !vR) return null;
    const wL = PIT_VL_SHARE, wR = 1 - PIT_VL_SHARE;
    return {
      kind: "pit",
      all: wL * vL.fip + wR * vR.fip, vL: vL.fip, vR: vR.fip,
      runsAll: wL * vL.runs + wR * vR.runs, runsL: vL.runs, runsR: vR.runs,
      lines: { vL, vR }, flags: rangeFlags(card.ratings, "pit"),
    };
  }
  const vL = projectHitter(card.ratings, envs, card.bats, "L"), vR = projectHitter(card.ratings, envs, card.bats, "R");
  if (!vL || !vR) return null;
  const wL = lhpShare, wR = 1 - lhpShare;
  return {
    kind: "hit",
    all: wL * vL.woba + wR * vR.woba, vL: vL.woba, vR: vR.woba,
    runsAll: wL * vL.runs + wR * vR.runs, runsL: vL.runs, runsR: vR.runs,
    lines: { vL, vR }, flags: rangeFlags(card.ratings, "hit"),
  };
}

/** The wire-friendly slice of a projection: the six numbers a table shows. */
export interface Proj {
  all: number | null; vL: number | null; vR: number | null;
  runsAll: number | null; runsL: number | null; runsR: number | null;
}
export const EMPTY_PROJ: Proj = { all: null, vL: null, vR: null, runsAll: null, runsL: null, runsR: null };

export function projOf(p: CardProjection | null): Proj {
  if (!p) return EMPTY_PROJ;
  return { all: p.all, vL: p.vL, vR: p.vR, runsAll: p.runsAll, runsL: p.runsL, runsR: p.runsR };
}
