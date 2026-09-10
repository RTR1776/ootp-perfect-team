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
 * The curves (engine/config/curves.json, fitted 2026-07-06 on the modern PT
 * league, splits pooled) are log-log:
 *
 *     rate = env_rate * exp(alpha) * (rating / 50) ^ beta
 *
 * `env_rate` is the league rate the curve was fitted against, so the multiplier
 * `exp(alpha) * (rating/50)^beta` is ~1.0 at a league-average rating (~110 on
 * the climbing scale). Transferring a card to 1935 means applying that
 * multiplier to 1935's rate, not to 2026's — the shape moves, the level does
 * not. R² is on each curve and is not uniform: K (.88) and EYE (.87) are real
 * signal, BABIP (.26) is close to noise, which is the whole reason you can buy
 * strikeout avoidance and cannot buy batting average.
 *
 * Units follow the era table: K/BB/HBP per PA, HR/2B/3B per ball-in-play,
 * BABIP per (BIP - HR). Mixing them up inflates an environment by ~30%.
 */

import CURVES from "@/data/curves.json";
import {
  applyPark, runsPerPa, type EraRates, type LinearWeights, type ParkFactors,
} from "@/lib/analytics/run-env";

interface Curve { alpha: number; beta: number; r2: number; n: number; env_rate: number; rating: string }

const curves = CURVES as unknown as {
  hit: Record<string, Curve> & { xbh_3b_share: number; hbp_rate_env: number };
  pit: Record<string, Curve> & { hbp_rate_env: number };
  frame: string;
  generatedAt: string;
};

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
const mult = (c: Curve, rating: number) => Math.exp(c.alpha) * Math.pow(rating / 50, c.beta);

export interface CurveInfo { key: string; rating: string; beta: number; r2: number }

export const HIT_CURVE_INFO: CurveInfo[] = (["k", "bb", "hr", "xbh", "babip"] as const).map((k) => ({
  key: k, rating: HIT_RATING[k], beta: (curves.hit[k] as Curve).beta, r2: (curves.hit[k] as Curve).r2,
}));
export const PIT_CURVE_INFO: CurveInfo[] = (["k", "bb", "hr", "babip"] as const).map((k) => ({
  key: k, rating: PIT_RATING[k], beta: (curves.pit[k] as Curve).beta, r2: (curves.pit[k] as Curve).r2,
}));

export const curveMeta = { frame: curves.frame, fittedAt: curves.generatedAt };

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
