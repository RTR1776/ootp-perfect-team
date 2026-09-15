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
}

export const OBS_K_DEFAULT = 2500;
/** Runs per unit of wOBA in a modern environment; roster-fill uses the same. */
const WOBA_SCALE = 1.25;

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);

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
): Promise<Map<number, ObservedRuns>> {
  const out = new Map<number, ObservedRuns>();
  if (!cardIds.length) return out;
  const ids = sql.join(cardIds.map((id) => sql`${id}`), sql`, `);
  const lines = asRows<any>(await db.execute(sql`
    select card_id, series, is_pitcher, pa, ip, woba, fip, counters
    from observed_card_stats where card_id in (${ids})`));
  if (!lines.length) return out;
  const seriesIn = sql.join([...new Set(lines.map((l) => l.series as string))].map((s) => sql`${s}`), sql`, `);
  // Series baselines from the same table, so they carry the same exclusions:
  // one row per (series, side, counter) summed over every card that played it.
  const sums = asRows<any>(await db.execute(sql`
    select series, is_pitcher, e.key k, sum((e.value)::float) v
    from observed_card_stats, jsonb_each_text(counters) e
    where series in (${seriesIn}) group by 1, 2, 3`));
  const vol = asRows<any>(await db.execute(sql`
    select series, is_pitcher, sum(pa)::float pa, sum(ip)::float ip
    from observed_card_stats where series in (${seriesIn}) group by 1, 2`));
  const collapse = new Map<string, { h: Record<string, number>; p: Record<string, number>; ip: number; pa: number }>();
  const at = (series: string) => {
    const c = collapse.get(series) ?? { h: {}, p: {}, ip: 0, pa: 0 };
    collapse.set(series, c);
    return c;
  };
  for (const r of sums) (r.is_pitcher ? at(r.series).p : at(r.series).h)[r.k] = Number(r.v);
  for (const r of vol) { const c = at(r.series); if (r.is_pitcher) c.ip += Number(r.ip); else c.pa += Number(r.pa); }
  const base = new Map<string, { woba: number; fip: number }>();
  for (const [series, c] of collapse) {
    base.set(series, {
      woba: wobaOf([stintLike(c.h, 0, c.pa) as never]),
      fip: fipOf([stintLike(c.p, c.ip, 0) as never]),
    });
  }
  // The level of each field on the model's scale: PA-weighted (BF for arms)
  // mean of the model's runs over every card that played the series.
  const played = asRows<any>(await db.execute(sql`
    select series, card_id, is_pitcher, pa, (counters->>'BF')::float bf
    from observed_card_stats where series in (${seriesIn})`));
  const level = new Map<string, { h: { num: number; den: number }; p: { num: number; den: number } }>();
  for (const r of played) {
    const m = modelRuns(r.card_id);
    if (m == null || !Number.isFinite(m)) continue;
    const w = r.is_pitcher ? Number(r.bf ?? 0) : Number(r.pa ?? 0);
    if (!(w > 0)) continue;
    const l = level.get(r.series) ?? { h: { num: 0, den: 0 }, p: { num: 0, den: 0 } };
    const side = r.is_pitcher ? l.p : l.h;
    side.num += m * w; side.den += w;
    level.set(r.series, l);
  }
  const levelOf = (series: string, isPitcher: boolean): number | null => {
    const l = level.get(series); const side = isPitcher ? l?.p : l?.h;
    return side && side.den > 0 ? side.num / side.den : null;
  };
  // Pool each card: sum of (level + deviation) * weight, over sum of weight.
  const acc = new Map<number, { num: number; den: number; series: Set<string> }>();
  for (const l of lines) {
    const b = base.get(l.series);
    if (!b) continue;
    const a = acc.get(l.card_id) ?? { num: 0, den: 0, series: new Set() };
    const M = levelOf(l.series, !!l.is_pitcher);
    if (M == null) continue;
    if (l.is_pitcher) {
      const bf = Number(l.counters?.BF ?? 0);
      if (!(bf > 0) || l.fip == null || !(b.fip > 0)) continue;
      // FIP is runs per 9 IP; over the card's own IP; saved = negative allowed.
      const runsSaved = -((Number(l.fip) - b.fip) / 9) * Number(l.ip);
      a.num += runsSaved + (M / 700) * bf;   // deviation + the field's level, both in runs over the line
      a.den += bf;
    } else {
      const pa = Number(l.pa ?? 0);
      if (!(pa > 0) || l.woba == null || !(b.woba > 0)) continue;
      a.num += ((Number(l.woba) - b.woba) / WOBA_SCALE) * pa + (M / 700) * pa;
      a.den += pa;
    }
    a.series.add(l.series);
    acc.set(l.card_id, a);
  }
  for (const [id, a] of acc) {
    if (a.den <= 0) continue;
    out.set(id, { runs: (a.num / a.den) * 700, n: a.den, series: a.series.size });
  }
  return out;
}

/** Precision-weighted blend of a model figure with an observed one. */
export function blendRuns(model: number, obs: ObservedRuns | undefined, k = OBS_K_DEFAULT): number {
  if (!obs || !(obs.n > 0)) return model;
  return (obs.n * obs.runs + k * model) / (obs.n + k);
}
