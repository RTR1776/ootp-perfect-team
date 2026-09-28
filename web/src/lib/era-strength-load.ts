/**
 * Scores every card for Era Strength (lib/era-strength.ts): each era's three
 * run environments on env-fit's scorer, the same way Build scores an event,
 * but in a neutral park and with no event's rules.
 *
 * Observed play is loaded once, at the PT default, and the same shift rides
 * into every era: a card that has out-played its ratings is assumed to keep
 * doing so. Its size is fixed there (n / (n + K) × observed minus model),
 * which is what env-fit adds when it is handed the base card's model as the
 * reference. His variants are scored from their own ratings and keep the base
 * card's shift.
 *
 * Live cards (their ratings move all season) and Perfect cards (over 99) are
 * left out, as L.J. asked.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, uploads } from "@/db/schema";
import { envFitMaps, type EnvFitInput } from "@/lib/analytics/env-fit";
import { bothHands, loadObservedRuns } from "@/lib/analytics/observed-blend";
import { eraFor, eraTable, PT_DEFAULT_ENV_YEAR } from "@/lib/analytics/tournament-env";
import { gloveScale } from "@/lib/analytics/fielding";
import { formRatings } from "@/lib/card-forms";
import { ERAS, ERA_TIERS, FIELD_POS, mean, tierView, type EraCard, type FieldPos, type TierView } from "@/lib/era-strength";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";

const LIVE = 1;
const ROLE_TRUST = 0.25;

export interface EraStrengthData {
  tiers: TierView[];
  /** Each era's glove scale (fielding.ts), for the page's notes. */
  glove: number[];
  collectionDate: string | null;
  shopDate: string | null;
  cards: number;
  owned: number;
  variants: number;
}

/** The newest collection and shop list, which key the cache. */
export async function latestSources() {
  const pick = async (kind: string) => (await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads)
    .where(eq(uploads.kind, kind)).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1))[0] ?? null;
  const [collection, shop] = await Promise.all([pick("collection"), pick("shop_list")]);
  return { collection, shop };
}

export async function loadEraStrength(): Promise<EraStrengthData> {
  const { collection, shop } = await latestSources();
  const [universe, coll, snaps] = await Promise.all([
    db.select({
      cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, position: cards.position, pitcherRole: cards.pitcherRole,
      isPitcher: cards.isPitcher, bats: cards.bats, year: cards.year, cardType: cards.cardType, cardSubType: cards.cardSubType,
      releasedOn: cards.releasedOn, ratings: cards.ratings,
    }).from(cards),
    collection ? db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
      .from(collectionCards).where(eq(collectionCards.uploadId, collection.id)) : Promise.resolve([]),
    shop ? db.select({ cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow, last10: cardSnapshots.last10, owned: cardSnapshots.owned })
      .from(cardSnapshots).where(eq(cardSnapshots.uploadId, shop.id)) : Promise.resolve([]),
  ]);

  // Owned: the collection's base copies, plus the shop list's count when the
  // list is newer (a card bought since the last collection export). Variants
  // come only from the collection, which is the one source that has them.
  const shopNewer = !!(shop && (!collection || shop.at > collection.at));
  const base = new Set<number>(), variant = new Map<number, Record<string, number>>();
  for (const r of coll) {
    if (r.cardId == null) continue;
    if (r.isVariant) variant.set(r.cardId, (r.ratings ?? {}) as Record<string, number>);
    else base.add(r.cardId);
  }
  const market = new Map<number, { ask: number | null; last10: number | null }>();
  for (const s of snaps) {
    if (shopNewer && s.owned > 0) base.add(s.cardId);
    market.set(s.cardId, { ask: s.ask && s.ask > 0 ? s.ask : null, last10: s.last10 && s.last10 > 0 ? s.last10 : null });
  }

  const input = (c: (typeof universe)[number], ratings: Record<string, number>, id = c.cardId): EnvFitInput =>
    ({ cardId: id, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings });

  // Observed play, once, against the whole universe at the PT default: each
  // series' level is the mean model of every card that played it.
  const ptDefault = eraFor(PT_DEFAULT_ENV_YEAR)?.row ?? eraTable["0"];
  const whole = envFitMaps(universe.map((c) => input(c, (c.ratings ?? {}) as Record<string, number>)),
    { era: ptDefault.rates, park: null, roleTrust: ROLE_TRUST, eraYear: PT_DEFAULT_ENV_YEAR });
  const observed = await loadObservedRuns(universe.map((c) => c.cardId), bothHands(whole), bothHands(whole));

  // The cards on the page: no Live, no Perfect. A variant he owns is scored
  // under the negated id so both forms sit in one pass.
  const kept = universe.filter((c) => c.cardType !== LIVE && c.cardValue <= 99);
  const pool: EnvFitInput[] = [];
  for (const c of kept) {
    const r = (c.ratings ?? {}) as Record<string, number>;
    pool.push(input(c, r));
    const v = variant.get(c.cardId);
    if (v) {
      pool.push(input(c, formRatings(r, v, c.position), -c.cardId));
      const ob = observed.get(c.cardId);
      if (ob) observed.set(-c.cardId, ob);
    }
  }

  const runs = new Map<number, number[]>();
  const glove: number[] = [];
  ERAS.forEach((era, e) => {
    const sums = new Map<number, number>();
    const scales: number[] = [];
    for (const year of era.years) {
      const row = eraFor(year)?.row;
      if (!row) continue;
      scales.push(gloveScale(row.rates));
      const fits = envFitMaps(pool, { era: row.rates, park: null, roleTrust: ROLE_TRUST, eraYear: year, observed });
      for (const p of pool) {
        const r = fits.runsR.get(p.cardId), l = fits.runsL.get(p.cardId);
        if (r == null || l == null) continue;
        sums.set(p.cardId, (sums.get(p.cardId) ?? 0) + (p.isPitcher ? r : 0.7 * r + 0.3 * l));
      }
    }
    glove[e] = mean(scales);
    for (const [id, s] of sums) {
      const xs = runs.get(id) ?? Array(ERAS.length).fill(0);
      xs[e] = s / scales.length;
      runs.set(id, xs);
    }
  });

  const out: EraCard[] = [];
  for (const c of kept) {
    const r = (c.ratings ?? {}) as Record<string, number>;
    const isP = c.isPitcher ?? false;
    const role = !isP ? null : c.pitcherRole === "SP" ? "SP" : c.pitcherRole ? "RP" : (r["Stamina"] ?? 0) <= 25 ? "RP" : "SP";
    const card = (id: number, ratings: Record<string, number>, isVariant: boolean): EraCard | null => {
      const xs = runs.get(id);
      if (!xs) return null;
      const pos: Partial<Record<FieldPos, number>> = {};
      if (!isP) for (const p of FIELD_POS) {
        const v = ratings[`Pos Rating ${p}`];
        if (v != null && v > 0 && v >= posFloorAt(LJ_FLOOR, p)) pos[p] = Math.round(v);
      }
      return {
        id: c.cardId, name: c.name, val: c.cardValue, year: c.year, set: c.cardType, le: c.cardSubType === "LE",
        released: c.releasedOn ?? null, role, owned: isVariant || base.has(c.cardId), variant: isVariant,
        runs: xs, pos, ask: market.get(c.cardId)?.ask ?? null, last10: market.get(c.cardId)?.last10 ?? null,
      };
    };
    const b = card(c.cardId, r, false);
    if (b) out.push(b);
    const v = variant.get(c.cardId);
    if (v) { const f = card(-c.cardId, formRatings(r, v, c.position), true); if (f) out.push(f); }
  }

  const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  return {
    tiers: ERA_TIERS.map((t) => tierView(out, t, glove)),
    glove: glove.map((g) => Math.round(g * 100) / 100),
    collectionDate: day(collection?.at), shopDate: day(shop?.at),
    cards: kept.length, owned: new Set(out.filter((c) => c.owned).map((c) => c.id)).size, variants: variant.size,
  };
}
