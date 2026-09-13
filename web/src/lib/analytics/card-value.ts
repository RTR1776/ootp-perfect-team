/**
 * What a card is worth in a given run environment — with no observed data.
 *
 * WHY THIS EXISTS. /build ranks cards on projected wOBA (one global fit) and
 * on observed stats from matched tournaments. For the PTCS championship both
 * are thin: the Silver berth has no comparable event in the whole catalogue
 * and the Cap berth has one run of 21k PA. So this module goes the other way
 * round — it takes the ratings, pushes them through the fitted rating->rate
 * curves, drops the resulting rate profile into the era + ballpark, and values
 * it with THAT environment's own linear weights. Every number is a model
 * output, so it is available for an environment nobody has ever played.
 *
 * The curves (src/data/curves.json) are log-log with a curvature term:
 *
 *     rate = env_rate * exp(alpha + beta*x + gamma*x^2),  x = log(rating / 50)
 *
 * `env_rate` is the league rate the curve was fitted against, so the multiplier
 * is ~1.0 at a league-average rating (~110 on the climbing scale). Transferring
 * a card to 1935 means applying that multiplier to 1935's rate, not to 2026's —
 * the shape moves, the level does not.
 *
 * REFITTED 2026-09-13 on observed tournament play (pnpm curve:refit): 51 series,
 * ~21M plate appearances, each card's rate normalised to its OWN series so that
 * 51 run environments pool into one fit. The previous curves (kept as
 * curves.v1-projections.json) were fitted in July on one league's projected
 * rates and were pure power laws, which cannot saturate. gamma = 0 reproduces
 * that form exactly, so a rating that really is log-linear is unharmed.
 *
 * What changed, and why it matters when you spend points:
 *   - POWER was the worst fit of the eight (power-law R² .70 on observed play).
 *     The old curve was dragged shallow by low-Power cards, who still run into
 *     some home runs; freeing the curvature lifted R² to .87 and raised what
 *     +10 Power buys by 30-40% in every environment.
 *   - BABIP's old R² of .26 was read as "close to noise". It was not: that R²
 *     was per-card-season, where a few hundred balls in play is mostly variance.
 *     Pooled to ~8M balls in play the same curve fits at R² .71, and the refit
 *     raises it further. You CAN buy batting average — just less of it than you
 *     can buy power.
 *   - EYE was slightly too steep and is now worth ~0.3 runs less per +10.
 *   - On arms everything flattened: pHR was the most over-valued rating in the
 *     old set (-0.8 runs per +10 in a modern environment), Control and Stuff
 *     came down, pBABIP went up. In a deadball environment pBABIP now outranks
 *     Control, which it did not before.
 *
 * The pitcher half is a LATERAL move on the metric that matters — ranking cards
 * against what they actually did. Paired bootstrap over 809 arms: Spearman
 * 0.458 -> 0.447, 95% CI on the difference [-0.025, +0.002]. It is kept because
 * it rests on observed play rather than projections, not because it ranks
 * better. The hitter half is a real gain: 0.428 -> 0.492, CI [+0.047, +0.081].
 *
 * Units follow the era table: K/BB/HBP per PA, HR/2B/3B per ball-in-play,
 * BABIP per (BIP - HR). Mixing them up inflates an environment by ~30%.
 */

import CURVES from "@/data/curves.json";
import {
  applyPark, runsPerPa, type EraRates, type LinearWeights, type ParkFactors,
} from "@/lib/analytics/run-env";

interface Curve {
  alpha: number; beta: number; r2: number; n: number; env_rate: number; rating: string;
  /**
   * Curvature in log-rating. The original curves were pure power laws, which
   * are unbounded: Power 170 got a 1.92x home-run multiplier when observed play
   * says 1.63x. gamma bends the log-log line so a rating can saturate.
   * Absent or 0 reproduces the old power law exactly.
   */
  gamma?: number;
  /** The rating window the curve was fitted over; outside it the power law extrapolates. */
  rating_range?: [number, number];
}

type CurveTable = {
  hit: Record<string, Curve> & { xbh_3b_share: number; hbp_rate_env: number };
  pit: Record<string, Curve> & { hbp_rate_env: number };
  frame: string;
  generatedAt: string;
};

let curves = CURVES as unknown as CurveTable;

/**
 * Swap the curve table at runtime. For offline scripts only — curve:refit needs
 * to score the same cards under a candidate fit and the shipped one to say
 * whether the refit is an improvement. Nothing in the app calls this.
 */
export function __setCurves(next: unknown) { curves = next as CurveTable; }
export function __getCurves(): unknown { return curves; }

/** Curve rating names are the engine's; the card table speaks the shop's. */
export const HIT_RATING: Record<string, string> = {
  k: "Avoid Ks", bb: "Eye", hr: "Power", xbh: "Gap", babip: "BABIP",
};
export const PIT_RATING: Record<string, string> = {
  k: "Stuff", bb: "Control", hr: "pHR", babip: "pBABIP",
};

/** vL / vR column for each overall rating, so a split can be valued on its own. */
const SPLIT_OF: Record<string, { vL: string; vR: string }> = {
  "Avoid Ks": { vL: "Avoid K vL", vR: "Avoid K vR" },
  Eye: { vL: "Eye vL", vR: "Eye vR" },
  Power: { vL: "Power vL", vR: "Power vR" },
  Gap: { vL: "Gap vL", vR: "Gap vR" },
  BABIP: { vL: "BABIP vL", vR: "BABIP vR" },
  Stuff: { vL: "Stuff vL", vR: "Stuff vR" },
  Control: { vL: "Control vL", vR: "Control vR" },
  pHR: { vL: "pHR vL", vR: "pHR vR" },
  pBABIP: { vL: "pBABIP vL", vR: "pBABIP vR" },
};

export type Split = "all" | "vL" | "vR";

export const ratingOf = (r: Record<string, number>, key: string, split: Split): number | null => {
  const v = split === "all" ? r[key] : r[SPLIT_OF[key]?.[split] ?? key] ?? r[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
};

/** The curve multiplier: 1.0 means "this card produces the league rate". */
const mult = (c: Curve, rating: number) => {
  const x = Math.log(rating / 50);
  return Math.exp(c.alpha + c.beta * x + (c.gamma ?? 0) * x * x);
};

export interface CurveInfo { key: string; rating: string; beta: number; r2: number }

export const HIT_CURVE_INFO: CurveInfo[] = (["k", "bb", "hr", "xbh", "babip"] as const).map((k) => ({
  key: k, rating: HIT_RATING[k], beta: (curves.hit[k] as Curve).beta, r2: (curves.hit[k] as Curve).r2,
}));
export const PIT_CURVE_INFO: CurveInfo[] = (["k", "bb", "hr", "babip"] as const).map((k) => ({
  key: k, rating: PIT_RATING[k], beta: (curves.pit[k] as Curve).beta, r2: (curves.pit[k] as Curve).r2,
}));

export const curveMeta = { frame: curves.frame, fittedAt: curves.generatedAt };

export interface RangeFlag { rating: string; value: number; fitted: [number, number] }

/**
 * Ratings outside the window the curve was fitted on.
 *
 * The rate curves are power laws fitted over a finite rating range (EYE, for
 * instance, on 37–204). The PT scale climbs all season, so a modern card can
 * sit well past the top of that window — Eddie Yost's 277 Eye is 36% beyond it.
 * The curve still returns a number there and the number is still the model's
 * best guess, but it is an extrapolation, not a fit, and a card whose whole
 * value rests on one such rating deserves to be read with that in mind.
 */
export function rangeFlags(
  r: Record<string, number>, kind: "hit" | "pit", split: Split = "all",
): RangeFlag[] {
  const table = kind === "hit" ? curves.hit : curves.pit;
  const names = kind === "hit" ? HIT_RATING : PIT_RATING;
  const out: RangeFlag[] = [];
  for (const [key, rating] of Object.entries(names)) {
    const c = table[key] as Curve | undefined;
    const v = ratingOf(r, rating, split);
    if (!c || v == null || !Array.isArray(c.rating_range)) continue;
    const [lo, hi] = c.rating_range as [number, number];
    if (v < lo || v > hi) out.push({ rating, value: v, fitted: [lo, hi] });
  }
  return out;
}

/**
 * A hitter's rate profile in an era. Gap moves extra-base hits as one bucket;
 * the era's own 2B/3B split divides them, so a triples era stays a triples era.
 * HBP is the environment's — no card rating touches it.
 */
export function hitterRates(r: Record<string, number>, era: EraRates, split: Split = "all"): EraRates | null {
  const g = (key: string) => ratingOf(r, key, split);
  const k = g("Avoid Ks"), eye = g("Eye"), pow = g("Power"), gap = g("Gap"), ba = g("BABIP");
  if (k == null || eye == null || pow == null || gap == null || ba == null) return null;

  const xbh = era.B2 + era.B3;
  const b3share = xbh > 0 ? era.B3 / xbh : 0;
  const xbhNew = xbh * mult(curves.hit.xbh as Curve, gap);
  return {
    K: era.K * mult(curves.hit.k as Curve, k),
    BB: era.BB * mult(curves.hit.bb as Curve, eye),
    HBP: era.HBP,
    HR: era.HR * mult(curves.hit.hr as Curve, pow),
    B2: xbhNew * (1 - b3share),
    B3: xbhNew * b3share,
    BABIP: era.BABIP * mult(curves.hit.babip as Curve, ba),
  };
}

/** A pitcher's. No curve exists for Movement, so it is not modelled — say so. */
export function pitcherRates(r: Record<string, number>, era: EraRates, split: Split = "all"): EraRates | null {
  const g = (key: string) => ratingOf(r, key, split);
  const stu = g("Stuff"), con = g("Control"), hra = g("pHR"), pba = g("pBABIP");
  if (stu == null || con == null || hra == null || pba == null) return null;
  return {
    K: era.K * mult(curves.pit.k as Curve, stu),
    BB: era.BB * mult(curves.pit.bb as Curve, con),
    HBP: era.HBP,
    HR: era.HR * mult(curves.pit.hr as Curve, hra),
    B2: era.B2,
    B3: era.B3,
    BABIP: era.BABIP * mult(curves.pit.babip as Curve, pba),
  };
}

export interface Env {
  /** NEUTRAL era rates — a card's curves scale these, then the park lands. */
  rates: EraRates;
  /** The park factors alone, so a card's own rates can be pushed through them. */
  park: ParkFactors | null;
  weights: LinearWeights;
  /** Runs per PA a league-average line produces here — the zero point. */
  leagueRunsPerPa: number;
}

/** Runs above (or, for a pitcher, saved against) league average per 700 PA. */
export function cardRuns(cardRates: EraRates, env: Env): number {
  const withPark = env.park ? applyPark(cardRates, env.park) : cardRates;
  return (runsPerPa(withPark, env.weights) - env.leagueRunsPerPa) * 700;
}

/**
 * What the ratings cannot say: how the arm is USED.
 *
 * A starter and a reliever with identical Stuff, Control, pHR and pBABIP get
 * identical rate profiles, and the run model then treats them identically. They
 * do not perform identically. Measured over 10.7M observed batters faced, with
 * the model's own prediction rescaled out first so this is role and not
 * calibration (pnpm role:effect):
 *
 *     SP   +0.82 runs per 700 BF worse than the model expects
 *     RP   -3.79
 *     CL   -4.94
 *
 * A 5.8-run gap between a closer and a starter of the same ratings. It is a step
 * at Stamina <= 25 rather than a gradient, which is what a times-through-the-
 * order effect looks like: the reliever faces a lineup once and never turns it
 * over. Stamina was the only rating in the residual screen with real independent
 * signal — 6.5% explained by the four the model already reads, against
 * Movement's 97.9%.
 *
 * Applied as runs per 700 BF, so a reliever's shorter workload still scales it
 * down wherever innings are weighted.
 */
export const ROLE_RUNS: Record<string, number> = { SP: 0.82, RP: -3.79, CL: -4.94 };

export function roleRuns(role: string | null | undefined, stamina?: number | null): number {
  if (role && role in ROLE_RUNS) return ROLE_RUNS[role];
  // no role on the card: stamina is the same signal, and the break is sharp
  if (typeof stamina === "number" && stamina > 0) return stamina <= 25 ? ROLE_RUNS.RP : ROLE_RUNS.SP;
  return 0;
}

export interface RatingValue { rating: string; runs: number; r2: number; beta: number }

/**
 * What +10 rating points buys, in runs per 700 PA, HERE.
 *
 * Computed by re-solving the whole rate profile at rating+10 rather than by
 * differentiating one event's weight, because the ratings interact: avoiding a
 * strikeout does not just dodge the K penalty (worth about a hundredth of a
 * run), it converts the plate appearance into a ball in play, where the era's
 * hits live. A linear-weight read misses that entirely and badly understates
 * K-avoidance in contact eras.
 */
export function ratingValues(
  r: Record<string, number>, env: Env, kind: "hit" | "pit", split: Split = "all", step = 10,
): RatingValue[] {
  const build = kind === "hit" ? hitterRates : pitcherRates;
  const base = build(r, env.rates, split);
  if (!base) return [];
  const baseRuns = cardRuns(base, env);
  const info = kind === "hit" ? HIT_CURVE_INFO : PIT_CURVE_INFO;
  const out: RatingValue[] = [];
  for (const c of info) {
    const cur = ratingOf(r, c.rating, split);
    if (cur == null) continue;
    const bumped = { ...r };
    bumped[c.rating] = cur + step;
    const sp = SPLIT_OF[c.rating];
    if (sp && split !== "all") bumped[sp[split]] = cur + step;
    const rates = build(bumped, env.rates, split);
    if (!rates) continue;
    const runs = cardRuns(rates, env) - baseRuns;
    out.push({ rating: c.rating, runs: kind === "pit" ? -runs : runs, r2: c.r2, beta: c.beta });
  }
  return out.sort((a, b) => b.runs - a.runs);
}

/**
 * The same question asked of the environment rather than of one card: what is
 * +10 worth to a league-average card here? This is the shopping list.
 */
export function marginalRatings(env: Env, kind: "hit" | "pit", split: Split = "all"): RatingValue[] {
  const info = kind === "hit" ? HIT_CURVE_INFO : PIT_CURVE_INFO;
  const avg: Record<string, number> = {};
  for (const c of info) avg[c.rating] = AVERAGE_RATING;
  return ratingValues(avg, env, kind, split);
}

/**
 * The rating that returns the league rate on the fitted curves. Not 50 — the
 * PT scale drifts upward all season and the curves were fitted where the
 * league actually sat.
 */
export const AVERAGE_RATING = 110;

/** League-average card, so `cardRuns` has a zero to sit at. */
export function envFor(rates: EraRates, park: ParkFactors | null, weights: LinearWeights): Env {
  const withPark = park ? applyPark(rates, park) : rates;
  return { rates, park, weights, leagueRunsPerPa: runsPerPa(withPark, weights) };
}
