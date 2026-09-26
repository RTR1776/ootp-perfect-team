/**
 * OBSERVED PLAY AS A FIRST-CLASS INPUT TO ROSTER SCORING.
 *
 * The rating model ranks cards at Spearman 0.54 (hitters) and 0.40 (arms)
 * against what they actually did in tournaments — measured, pnpm
 * model:validate. The archived exports hold 12M plate appearances and 12M
 * batters faced of what the cards DID, Jim-beater teams excluded. Until now
 * that reached a roster only through tourney-brief and a human remembering
 * to run it; the standing rule "when model and observed disagree at 2010,
 * believe the innings" was applied by hand. This does it in the scorer.
 *
 * Each card's observed line is turned into runs above its own series'
 * average — wOBA over the series' wOBA divided by the wOBA scale for
 * hitters, FIP under the series' FIP for arms. Normalising to the series
 * makes a 1935 line and a 2010 line poolable, which is the same move the
 * curve refit and model:validate make.
 *
 * THE TWO SCALES HAVE DIFFERENT ZEROS, and that has to be fixed before they
 * can be blended. The model's zero is a league-average card in the era's
 * rates; "above the series average" is zero at the level of THAT FIELD, and
 * a Gold-only field sits far below a Perfect-heavy one. Ed Bailey 97 is
 * +67 to the model and -3.6 against the Gold fields he plays in - both can
 * be true. So each series gets a level, M_s: the PA-weighted mean of the
 * MODEL's runs over every card that played it. A card's observed figure on
 * the model's scale is then M_s + its deviation from the series, pooled
 * over series by PA. The caller supplies the model's runs for the whole
 * universe so M_s can be built from the same numbers it is blending with.
 *
 * Then the model's runs and the observed runs are combined by precision:
 *
 *     blended = (n * observed + K * model) / (n + K)
 *
 * where n is the card's PA (or BF) on record and K is the sample at which
 * the two deserve equal weight.
 *
 * K IS MEASURED, AND IT IS NOT WHAT SAMPLING NOISE SAYS. A variance-ratio
 * argument (model residual ~17 runs; wOBA sampling SD ~280/sqrt(n) runs per
 * 700) puts the crossover near n = 300. That assumes a card's deviation
 * from its field is a fixed property plus noise. It is not: split a card's
 * series into two halves and the halves agree at only Spearman 0.52 for
 * hitters and 0.46 for arms (pnpm observed:validate, 1,119 / 930 cards) -
 * the model ALONE predicts a held-out half better (0.58 / 0.55). Opponent
 * quality, park, lineup context and the week all move the number. Blending
 * with the model, the held-out prediction peaks at K between 2,000 and
 * 3,000 - hitters 0.628, arms 0.592 - and falls off either side. So K = 2500:
 * a card with the pool's median 5,600 PA on record is ~70% observed; a card
 * with 250 PA is ~10%; a card with none is the model, untouched.
 *
 * RE-MEASURED 2026-09-17 with the model CALIBRATED (env-fit `calibrate`: the
 * curves' within-field spread scaled to what play returns, 0.51 for bats and
 * 0.48 for arms). On the calibrated scale the held-out peak moves out to
 * K = 5,000 and rises — hitters 0.641 (was 0.628 at 3,000), arms 0.613 (was
 * 0.592 at 2,000) — because a model with half the spread needs twice the
 * nominal weight to carry the same information. So K = 5000: the median
 * card with 5,600 PA on record is ~53% observed, 250 PA is ~5%.
 *
 * Which retires the rule "when model and observed disagree, believe the
 * innings" in its strong form. Believe them in proportion.
 *
 * What it does not do: it does not know the run environment of the target
 * event beyond the series normalisation, and it cannot see platoon splits
 * (the tournament export has none), so the same shift is applied to both
 * boards.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { wobaOf, fipOf } from "./league";

export interface ObservedRuns {
  /** Runs per 700 PA (or BF, as runs SAVED) above the card's series averages. */
  runs: number;
  /** Plate appearances or batters faced behind it. */
  n: number;
  series: number;
  /**
   * The base card's model runs on env-fit's both-hands read (0.7 R / 0.3 L),
   * when the caller passed `reference`. runs − model is how far play ran from
   * the ratings, and env-fit blends that deviation, so an owned variant keeps
   * its rating boost while a base card blends exactly as before. Null without
   * a reference: env-fit then blends the level, the pre-2026-09-26 behaviour.
   */
  model: number | null;
}

export { OBS_K_DEFAULT } from "./calibration";
import { OBS_K_DEFAULT } from "./calibration";
/** Runs per unit of wOBA in a modern environment; roster-fill uses the same. */
const WOBA_SCALE = 1.25;

type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const str = (v: unknown): string => String(v ?? "");

const stintLike = (counters: Record<string, number>, ip: number, pa: number) => ({
  stats: counters, ip, pa, use: pa + ip * 4.3, isPitcher: false, isFreeAgent: false, org: "",
  cid: null, name: "", pos: "", clan: null, val: null, tier: null, isVariant: false,
  cardYear: null, ratings: {}, war: 0,
});

/**
 * Observed runs above series average for every card in `cardIds`, pooled
 * across the series each one played. One query for the card lines, one for
 * the series baselines.
 */
export async function loadObservedRuns(
  cardIds: readonly number[],
  modelRuns: (cardId: number) => number | null | undefined,
  /** The base card's model on env-fit's basis, 0.7 R + 0.3 L (see `ObservedRuns.model`). */
  reference?: (cardId: number) => number | null | undefined,
): Promise<Map<number, ObservedRuns>> {
  const out = new Map<number, ObservedRuns>();
  if (!cardIds.length) return out;
  const ids = sql.join(cardIds.map((id) => sql`${id}`), sql`, `);
  const lines = asRows(await db.execute(sql`
    select card_id, series, is_pitcher, pa, ip, woba, fip, counters
    from observed_card_stats where card_id in (${ids})`));
  if (!lines.length) return out;
  const seriesIn = sql.join([...new Set(lines.map((l) => str(l.series)))].map((s) => sql`${s}`), sql`, `);
  // Series baselines from the same table, so they carry the same exclusions:
  // one row per (series, side, counter) summed over every card that played it.
  const sums = asRows(await db.execute(sql`
    select series, is_pitcher, e.key k, sum((e.value)::float) v
    from observed_card_stats, jsonb_each_text(counters) e
    where series in (${seriesIn}) group by 1, 2, 3`));
  const vol = asRows(await db.execute(sql`
    select series, is_pitcher, sum(pa)::float pa, sum(ip)::float ip
    from observed_card_stats where series in (${seriesIn}) group by 1, 2`));
  const collapse = new Map<string, { h: Record<string, number>; p: Record<string, number>; ip: number; pa: number }>();
  const at = (series: string) => {
    const c = collapse.get(series) ?? { h: {}, p: {}, ip: 0, pa: 0 };
    collapse.set(series, c);
    return c;
  };
  for (const r of sums) (r.is_pitcher ? at(str(r.series)).p : at(str(r.series)).h)[str(r.k)] = num(r.v);
  for (const r of vol) { const c = at(str(r.series)); if (r.is_pitcher) c.ip += num(r.ip); else c.pa += num(r.pa); }
  const base = new Map<string, { woba: number; fip: number }>();
  for (const [series, c] of collapse) {
    base.set(series, {
      woba: wobaOf([stintLike(c.h, 0, c.pa) as never]),
      fip: fipOf([stintLike(c.p, c.ip, 0) as never]),
    });
  }
  // The level of each field on the model's scale: PA-weighted (BF for arms)
  // mean of the model's runs over every card that played the series.
  const played = asRows(await db.execute(sql`
    select series, card_id, is_pitcher, pa, (counters->>'BF')::float bf
    from observed_card_stats where series in (${seriesIn})`));
  const level = new Map<string, { h: { num: number; den: number }; p: { num: number; den: number } }>();
  for (const r of played) {
    const m = modelRuns(num(r.card_id));
    if (m == null || !Number.isFinite(m)) continue;
    const w = r.is_pitcher ? num(r.bf) : num(r.pa);
    if (!(w > 0)) continue;
    const l = level.get(str(r.series)) ?? { h: { num: 0, den: 0 }, p: { num: 0, den: 0 } };
    const side = r.is_pitcher ? l.p : l.h;
    side.num += m * w; side.den += w;
    level.set(str(r.series), l);
  }
  const levelOf = (series: string, isPitcher: boolean): number | null => {
    const l = level.get(series); const side = isPitcher ? l?.p : l?.h;
    return side && side.den > 0 ? side.num / side.den : null;
  };
  // Pool each card: sum of (level + deviation) * weight, over sum of weight.
  const acc = new Map<number, { num: number; den: number; series: Set<string> }>();
  for (const l of lines) {
    const series = str(l.series), cardId = num(l.card_id), isP = !!l.is_pitcher;
    const b = base.get(series);
    if (!b) continue;
    const a = acc.get(cardId) ?? { num: 0, den: 0, series: new Set<string>() };
    const M = levelOf(series, isP);
    if (M == null) continue;
    if (isP) {
      const bf = num((l.counters as Record<string, unknown> | null)?.BF);
      if (!(bf > 0) || l.fip == null || !(b.fip > 0)) continue;
      // FIP is runs per 9 IP; over the card's own IP; saved = negative allowed.
      const runsSaved = -((num(l.fip) - b.fip) / 9) * num(l.ip);
      a.num += runsSaved + (M / 700) * bf;   // deviation + the field's level, both in runs over the line
      a.den += bf;
    } else {
      const pa = num(l.pa);
      if (!(pa > 0) || l.woba == null || !(b.woba > 0)) continue;
      a.num += ((num(l.woba) - b.woba) / WOBA_SCALE) * pa + (M / 700) * pa;
      a.den += pa;
    }
    a.series.add(series);
    acc.set(cardId, a);
  }
  for (const [id, a] of acc) {
    if (a.den <= 0) continue;
    const m = reference?.(id);
    out.set(id, { runs: (a.num / a.den) * 700, n: a.den, series: a.series.size, model: m != null && Number.isFinite(m) ? m : null });
  }
  return out;
}

/** env-fit's both-hands read of a scored universe: the `reference` for loadObservedRuns. */
export function bothHands(fits: { runsR: Map<number, number>; runsL: Map<number, number> }) {
  return (id: number): number | null => {
    const r = fits.runsR.get(id), l = fits.runsL.get(id);
    return r == null || l == null ? null : 0.7 * r + 0.3 * l;
  };
}

/** Precision-weighted blend of a model figure with an observed one. */
export function blendRuns(model: number, obs: ObservedRuns | undefined, k = OBS_K_DEFAULT): number {
  if (!obs || !(obs.n > 0)) return model;
  return (obs.n * obs.runs + k * model) / (obs.n + k);
}
