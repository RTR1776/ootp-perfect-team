/**
 * League hitter model: what a card is worth on one board (vs LHP or vs RHP)
 * in LEAGUE play, where the engine normalises.
 *
 * WHY IT IS NOT THE TOURNAMENT MODEL. A league rates each card against the
 * talent rostered around it, and a card's edge shrinks accordingly. Fed the
 * tournament-calibrated runs alone, league play returns 0.68 of them, the
 * same in PEL, every HD league, LD404, vs LHP and vs RHP (4.6M PA of split play,
 * 2026-06-28 to 2026-09-20). The league also pays some ratings differently from
 * tournaments, so the fit adds a term per rating, measured against the
 * league's own average on that board.
 *
 *   runs = a + b·(app − app_lg) + Σ c_r · price_r · (ln r − mean ln r_lg)
 *
 *  - app is env-fit's calibrated runs for the card on this board, in the
 *    week's environment (neutral park).
 *  - r runs over the board's Avoid K, BABIP, Gap, Power and Eye.
 *  - _lg marks the league's PA-weighted average over rostered hitters.
 *  - price_r scales each league term to the week's run environment: +10 of
 *    the rating there over +10 in the PT default. It is 1 in an ordinary week;
 *    in the 1959 and 1989 theme weeks Avoid K was worth ~0.55 of a normal week.
 *
 * Held out: r 0.92 on cards the fit never saw and 0.85 on whole weeks, against
 * 0.85 / 0.78 for the tournament runs scaled down. Coefficients, references and
 * validation are in src/data/league-model.json. Refit: pnpm league:panel, then
 * python3 scripts/league-fit.py.
 *
 * The references come from each league family's newest ORDINARY week, so the
 * absolute level ("+6 above the league's average bat") is anchored there. Read
 * DIFFERENCES between cards (a lineup with and without a card) in any
 * environment; they do not depend on the anchor.
 */
import MODEL from "@/data/league-model.json";
import { envFor, marginalRatings } from "@/lib/analytics/card-value";
import { linearWeights, type EraRates } from "@/lib/analytics/run-env";
import { eraTable } from "@/lib/analytics/tournament-env";

export type LeagueFamily = "PEL" | "HD" | "LD";
export type Board = "vL" | "vR";
export const LEAGUE_RATINGS = ["K", "BA", "GAP", "POW", "EYE"] as const;
export type LeagueRating = (typeof LEAGUE_RATINGS)[number];
export type BoardRatings = Record<LeagueRating, number>;

interface Reference { week: string; pa: number; app: number; lK: number; lBA: number; lGAP: number; lPOW: number; lEYE: number }
interface LeagueModel {
  fittedAt: string;
  source: string;
  coef: { intercept: number; app: number } & Record<LeagueRating, number>;
  shrink: number;
  validation: { byCard: number; byWeek: number; shrinkOnlyByCard: number; shrinkOnlyByWeek: number };
  reference: Record<string, Reference>;
  lhpShare: Record<string, number>;
  ratingRange: Record<LeagueRating, [number, number]>;
}
export const LEAGUE_MODEL = MODEL as unknown as LeagueModel;

/** The shop's split-rating stem for each model rating ("Avoid K vL", "BABIP vR", …). */
const SHOP_STEM: Record<LeagueRating, string> = { K: "Avoid K", BA: "BABIP", GAP: "Gap", POW: "Power", EYE: "Eye" };
const MARGINAL_NAME: Record<LeagueRating, string> = { K: "Avoid Ks", BA: "BABIP", GAP: "Gap", POW: "Power", EYE: "Eye" };

export function leagueFamily(league: string): LeagueFamily {
  const l = league.toUpperCase();
  return l === "PEL" ? "PEL" : l.startsWith("LD") ? "LD" : "HD";
}

/** A hitter's five ratings on one board, from shop-named ratings. Null when any is missing. */
export function boardRatings(r: Record<string, number>, board: Board): BoardRatings | null {
  const out = {} as BoardRatings;
  for (const k of LEAGUE_RATINGS) {
    const v = r[`${SHOP_STEM[k]} ${board}`];
    if (!(typeof v === "number" && v > 0)) return null;
    out[k] = v;
  }
  return out;
}

const worth = (rates: EraRates): Record<string, number> => {
  const env = envFor(rates, null, linearWeights(rates));
  return Object.fromEntries(marginalRatings(env, "hit").map((v) => [v.rating, v.runs]));
};
const BASE_WORTH = worth((eraTable["0"] ?? eraTable["2010"]).rates);

/** Each rating's price in this environment relative to the PT default (1 = an ordinary week). */
export function envPrices(rates: EraRates): BoardRatings {
  const w = worth(rates);
  const out = {} as BoardRatings;
  for (const k of LEAGUE_RATINGS) {
    const b = BASE_WORTH[MARGINAL_NAME[k]];
    out[k] = b ? w[MARGINAL_NAME[k]] / b : 1;
  }
  return out;
}

/**
 * Runs per 700 PA above the league's average hitter on this board.
 * `app` is env-fit's calibrated runs for the card on the same board and environment.
 */
export function leagueHitRuns(app: number, r: BoardRatings, family: LeagueFamily, board: Board, prices?: BoardRatings): number {
  const ref = LEAGUE_MODEL.reference[`${family}|${board}`] ?? LEAGUE_MODEL.reference[`HD|${board}`];
  const c = LEAGUE_MODEL.coef;
  let v = c.intercept + c.app * (app - ref.app);
  for (const k of LEAGUE_RATINGS) {
    const mean = ref[`l${k}` as keyof Reference] as number;
    v += c[k] * (Math.log(r[k] / 50) - mean) * (prices?.[k] ?? 1);
  }
  return v;
}

/** Ratings outside what the fit saw, for a warning beside the number. */
export function outsideFit(r: BoardRatings): string[] {
  const out: string[] = [];
  for (const k of LEAGUE_RATINGS) {
    const [lo, hi] = LEAGUE_MODEL.ratingRange[k];
    if (r[k] < lo || r[k] > hi) out.push(`${SHOP_STEM[k]} ${r[k]} (fit ${lo}-${hi})`);
  }
  return out;
}

/** Share of a league's hitter PA thrown by left-handers (the vs-LHP board's weight). */
export function leagueLhpShare(family: LeagueFamily): number {
  return LEAGUE_MODEL.lhpShare[family] ?? 0.45;
}
