/**
 * The owned-card pool, trimmed to what the environment model actually reads.
 *
 * /build ships the full ratings blob because it draws card faces. This page
 * only needs the five hitting and four pitching ratings that have a fitted
 * rate curve, times the three splits — so the pool goes over the wire as flat
 * number arrays and 3,500 cards cost a few hundred KB instead of megabytes.
 *
 * Ratings come from `formRatings`, so a variant's own exported boosts are used
 * rather than the base card's.
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { HIT_KEYS, PIT_KEYS, RATING_SPLITS as SPLITS, type Pool, type PoolCard } from "@/lib/analytics/pool-shape";

export type { Pool, PoolCard };

export async function ownedPool(): Promise<Pool> {
  const [latest] = await db
    .select({ id: uploads.id, at: uploads.uploadedAt })
    .from(uploads).where(eq(uploads.kind, "collection"))
    .orderBy(desc(uploads.id)).limit(1);
  if (!latest) return { cards: [], asOf: null, count: 0 };

  const owned = await db
    .select({
      cardId: collectionCards.cardId,
      isActive: collectionCards.isActive,
      isVariant: collectionCards.isVariant,
      ratings: collectionCards.ratings,
    })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));

  const base = await db
    .select({
      cardId: cards.cardId, name: cards.name, position: cards.position, pitcherRole: cards.pitcherRole,
      isPitcher: cards.isPitcher, bats: cards.bats, cardValue: cards.cardValue, year: cards.year,
      tier: cards.tier, ratings: cards.ratings,
    })
    .from(cards);
  const byId = new Map(base.map((c) => [c.cardId, c]));

  /** One row per distinct owned card; the best copy wins (variants boost). */
  const best = new Map<number, PoolCard>();
  for (const o of owned) {
    if (o.cardId == null) continue;
    const b = byId.get(o.cardId);
    if (!b) continue;
    const merged = formRatings(b.ratings, o.ratings ?? null);
    const keys = b.isPitcher ? PIT_KEYS : HIT_KEYS;
    const r: number[] = [];
    let complete = true;
    for (const k of keys) {
      const [l, rr] = SPLITS[k];
      const trio = [merged[k], merged[l], merged[rr]];
      if (trio.some((v) => typeof v !== "number" || !Number.isFinite(v) || v <= 0)) complete = false;
      r.push(...trio.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)));
    }
    if (!complete) continue;
    const row: PoolCard = {
      id: b.cardId, name: b.name, pos: b.position, role: b.pitcherRole, isP: b.isPitcher,
      bats: b.bats, value: b.cardValue, year: b.year, tier: b.tier,
      active: o.isActive ?? false, variant: o.isVariant, r,
    };
    const prev = best.get(b.cardId);
    // Prefer an active copy, then the variant (higher ratings), then whatever.
    if (!prev || (row.active && !prev.active) || (!prev.active && row.variant && !prev.variant)) best.set(b.cardId, row);
  }

  const list = [...best.values()];
  return { cards: list, asOf: latest.at.toISOString().slice(0, 10), count: list.length };
}
