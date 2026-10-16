/**
 * Needs (L.J., 2026-10-16: "finding where I need cards and helping me identify
 * them and decide to buy at what price … something saying silver 2B is looking
 * weak"): Era Strength's gaps by tier and position, weighted by where he plays,
 * with each candidate's price over the last two weeks and a bid to place.
 *
 *   gap — runs per 700 his best card at the spot is short of the best legal
 *         card (lib/era-strength: each card once, five eras, glove included;
 *         SP and RP per slot over five starters / seven relievers)
 *   play — his entries per tier in the current PTCS period (logged results)
 *   price — the shop list's lowest ask, highest bid and last-10 average, and
 *           the last-10's low / median / high over the last 14 days of uploads
 *   bid — buy at the ask when it is at or under the two-week median last-10;
 *         else bid the two-week low (or one over the top bid, if that is
 *         higher) and wait: prices swing a lot, the low comes round again
 */

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cardSnapshots, periods, results, uploads } from "@/db/schema";
import { ERAS, ERA_TIERS, mean, type CardRef, type Rank, type Spot, type TierKey } from "@/lib/era-strength";
import type { EraStrengthData } from "@/lib/era-strength-load";

const PRICE_DAYS = 14;

export interface Price {
  ask: number | null;
  bid: number | null;
  last10: number | null;
  low: number | null;
  median: number | null;
  high: number | null;
  /** Shop uploads the range is read from. */
  days: number;
}

export interface NeedBuy {
  card: CardRef;
  /** Runs per 700 over the card it would replace, per era, and their mean (null: nothing to replace). */
  gain: (number | null)[];
  gainAvg: number | null;
  price: Price;
  /** "buy" at the ask, or "bid" at `target` and wait. */
  call: "buy" | "bid" | "none";
  target: number | null;
  /** Runs per 1,000 PP at the price paid (the ask, or the target bid). */
  perK: number | null;
}

export interface NeedSpot {
  spot: Spot;
  mine: { card: CardRef; runs: number } | null;
  best: { card: CardRef; runs: number } | null;
  gap: (number | null)[];
  gapAvg: number | null;
  buys: NeedBuy[];
}

export interface NeedTier {
  key: TierKey;
  label: string;
  /** His entries in the tier this PTCS period, and their share of his tier entries. */
  entries: number;
  share: number;
  /** Runs his best team is short of the best possible, era mean. */
  short: number;
  spots: Record<Rank, NeedSpot[]>;
}

export interface NeedsData {
  tiers: NeedTier[];
  eras: string[];
  period: string | null;
  collectionDate: string | null;
  shopDate: string | null;
}

const avgOf = (xs: readonly (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(mean(v) * 10) / 10 : null;
};
const medianOf = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Two weeks of shop prices for these cards. */
async function priceHistory(ids: number[]): Promise<Map<number, Price>> {
  const out = new Map<number, Price>();
  if (!ids.length) return out;
  const since = new Date(Date.now() - PRICE_DAYS * 86_400_000);
  const shops = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads)
    .where(and(eq(uploads.kind, "shop_list"), gte(uploads.uploadedAt, since))).orderBy(desc(uploads.uploadedAt), desc(uploads.id));
  if (!shops.length) return out;
  const newest = shops[0].id;
  const rows = await db.select({ upload: cardSnapshots.uploadId, card: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow, bid: cardSnapshots.buyOrderHigh, last10: cardSnapshots.last10 })
    .from(cardSnapshots).where(and(inArray(cardSnapshots.uploadId, shops.map((s) => s.id)), inArray(cardSnapshots.cardId, ids)));
  const by = new Map<number, typeof rows>();
  for (const r of rows) { const l = by.get(r.card) ?? []; l.push(r); by.set(r.card, l); }
  for (const id of ids) {
    const l = by.get(id) ?? [];
    const now = l.find((r) => r.upload === newest);
    const tens = l.map((r) => r.last10).filter((x): x is number => x != null && x > 0);
    out.set(id, {
      ask: now?.ask && now.ask > 0 ? now.ask : null,
      bid: now?.bid && now.bid > 0 ? now.bid : null,
      last10: now?.last10 && now.last10 > 0 ? now.last10 : null,
      low: tens.length ? Math.min(...tens) : null,
      median: medianOf(tens),
      high: tens.length ? Math.max(...tens) : null,
      days: new Set(l.map((r) => r.upload)).size,
    });
  }
  return out;
}

/** The buy call: the ask when it's at or under the two-week median, else a bid at the low. */
export function buyCall(p: Price, gainAvg: number | null): Pick<NeedBuy, "call" | "target" | "perK"> {
  if (gainAvg == null || gainAvg <= 0) return { call: "none", target: null, perK: null };
  if (p.ask != null && (p.median == null || p.ask <= p.median)) return { call: "buy", target: p.ask, perK: Math.round((gainAvg / (p.ask / 1000)) * 100) / 100 };
  const floor = p.low ?? p.last10 ?? p.ask;
  if (floor == null) return { call: "none", target: null, perK: null };
  const target = Math.max(floor, p.bid != null ? p.bid + 1 : 0);
  return { call: "bid", target, perK: Math.round((gainAvg / (target / 1000)) * 100) / 100 };
}

/** His tier entries this PTCS period, from the logged results' categories. */
async function playByTier(): Promise<{ period: string | null; counts: Record<TierKey, number> }> {
  const counts = { bronze: 0, silver: 0, gold: 0, diamond: 0 } as Record<TierKey, number>;
  const [p] = await db.select({ id: periods.id, name: periods.name }).from(periods).orderBy(desc(periods.startsOn)).limit(1);
  if (!p) return { period: null, counts };
  const rows = await db.select({ cats: results.categories }).from(results).where(eq(results.periodId, p.id));
  for (const r of rows) for (const c of r.cats ?? []) {
    const k = String(c).toLowerCase() as TierKey;
    if (k in counts) counts[k] += 1;
  }
  return { period: p.name, counts };
}

export async function loadNeeds(era: EraStrengthData): Promise<NeedsData> {
  const ids = new Set<number>();
  for (const t of era.tiers) for (const rank of ["avg", "worst"] as const) for (const b of t.buys[rank]) ids.add(b.card.id);
  const [prices, play] = await Promise.all([priceHistory([...ids]), playByTier()]);
  const totalPlay = Object.values(play.counts).reduce((a, b) => a + b, 0);

  const tiers: NeedTier[] = era.tiers.map((t) => {
    const meta = ERA_TIERS.find((x) => x.key === t.tier)!;
    const spotsFor = (rank: Rank): NeedSpot[] => t.spots[rank].map((s) => {
      const buys = t.buys[rank].filter((b) => b.spot === s.spot).map((b): NeedBuy => {
        const gainAvg = avgOf(b.gain);
        const price = prices.get(b.card.id) ?? { ask: b.card.ask, bid: null, last10: b.card.last10, low: null, median: null, high: null, days: 0 };
        return { card: b.card, gain: b.gain, gainAvg, price, ...buyCall(price, gainAvg) };
      });
      return {
        spot: s.spot,
        mine: s.mine ? { card: s.mine.card, runs: avgOf(s.mine.runs) ?? 0 } : null,
        best: s.best ? { card: s.best.card, runs: avgOf(s.best.runs) ?? 0 } : null,
        gap: s.gap,
        gapAvg: avgOf(s.gap),
        buys,
      };
    });
    return {
      key: t.tier, label: meta.label,
      entries: play.counts[t.tier], share: totalPlay ? play.counts[t.tier] / totalPlay : 0,
      short: Math.round(mean(t.grid.short) * 10) / 10,
      spots: { avg: spotsFor("avg"), worst: spotsFor("worst") },
    };
  });

  return { tiers, eras: ERAS.map((e) => e.short), period: play.period, collectionDate: era.collectionDate, shopDate: era.shopDate };
}

