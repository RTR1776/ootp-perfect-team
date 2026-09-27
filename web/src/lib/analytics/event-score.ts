/**
 * One scorer for "how good is this card in this event" (UI plan G6), shared
 * by Build, Draft, Cards, Played and Market so a card's Runs can't differ
 * between pages.
 *
 * WHY ONE. /cards fitted only its search hits, and the observed blend's level
 * for each series is the model's runs averaged over every card that played it,
 * so each search moved the level: Hank Aaron 102 read +55.5 for "hank aaron",
 * +52.0 for "aaron", +45.6 for "ha" and +31.2 on /played (2026-09-27). Here the
 * whole card table is fitted once per event, as /build does.
 *
 * Per card: the model's runs per 700 PA (bats) or BF (arms) on each board and
 * both hands at the field's LHP share, the observed play blended in by
 * precision (base-card reference, so a variant keeps its boost), and the
 * volume behind that blend. Cached per event, shop upload and observed batch.
 */
import { unstable_cache } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, importBatches, seriesMeta, uploads } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { blendRuns, bothHands, loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraTable, parkFor, PT_DEFAULT_ENV_YEAR } from "@/lib/analytics/tournament-env";
import { LHP_SHARE_DEFAULT } from "@/lib/roster-objective";

/** What the scorer needs from a catalogue row. */
export interface EventRef {
  id: number;
  envYear: number | null;
  stadium: string | null;
  series: string | null;
  restrictions?: unknown;
}

/**
 * The era an event runs in, or null for the PT default. The catalogue lists
 * the PT default as 2010, and "Default RE" in the rules note means the same.
 */
export function tournamentEraYear(t: { envYear: number | null; restrictions?: unknown }): number | null {
  const notes = (t.restrictions as { notes?: string[] } | null | undefined)?.notes;
  const y = t.envYear ?? (notes?.includes("default RE") ? PT_DEFAULT_ENV_YEAR : null);
  return y == null || y === PT_DEFAULT_ENV_YEAR ? null : y;
}

export interface CardScore {
  /** Model runs per 700 on each board (bats: vs RHP / LHP; arms: the both-hands read / vs LHB). */
  runsR: number;
  runsL: number;
  /** Both boards at the field's LHP share. */
  model: number;
  /** The model with observed play blended in by precision. */
  blend: number;
  /** PA (bats) or BF (arms) of observed play behind the blend; 0 = model only. */
  obsN: number;
}

export interface EventScores {
  eventId: number | null;
  eraYear: number | null;
  parkLabel: string;
  lhpShare: number;
  lhbShare: number;
  get(cardId: number): CardScore | undefined;
}

type Packed = [cardId: number, runsR: number, runsL: number, model: number, blend: number, obsN: number];

/** The uncached computation, for scripts; pages use scoreCatalogForEvent. */
export async function computeEventScores(ev: EventRef | null): Promise<{ rows: Packed[]; eraYear: number | null; parkLabel: string; lhpShare: number; lhbShare: number }> {
  const eraYear = ev ? tournamentEraYear(ev) : null;
  const era = (eraYear != null ? eraTable[String(eraYear)] : null) ?? eraTable["0"];
  const park = parkFor(ev?.stadium ?? null);
  const [meta] = ev?.series ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, ev.series)) : [];
  const lhpShare = meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const lhbShare = meta?.lhbPaShare ?? 0.35;

  const universe = await db.select({
    cardId: cards.cardId, isPitcher: cards.isPitcher, bats: cards.bats, role: cards.pitcherRole, ratings: cards.ratings,
  }).from(cards);
  const fits = envFitMaps(
    universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.role, ratings: (c.ratings ?? {}) as Record<string, number> })),
    { era: era.rates, park: park.row, roleTrust: 0.25, leagueLhbShare: lhbShare, eraYear: eraYear ?? PT_DEFAULT_ENV_YEAR },
  );
  const both = (id: number) => {
    const r = fits.runsR.get(id), l = fits.runsL.get(id);
    return r == null || l == null ? null : (1 - lhpShare) * r + lhpShare * l;
  };
  const observed = await loadObservedRuns(universe.map((c) => c.cardId), both, bothHands(fits));
  const rows: Packed[] = [];
  for (const c of universe) {
    const r = fits.runsR.get(c.cardId), l = fits.runsL.get(c.cardId), m = both(c.cardId);
    if (r == null || l == null || m == null) continue;
    const o = observed.get(c.cardId);
    rows.push([c.cardId, r, l, m, blendRuns(m, o, OBS_K_DEFAULT), o?.n ?? 0]);
  }
  return { rows, eraYear, parkLabel: park.label, lhpShare, lhbShare };
}

/**
 * Score the whole card table in one event (null: the PT default, neutral
 * park). Cached for an hour per event, newest shop list and newest observed
 * batch, so a new upload or import is picked up at once.
 */
export async function scoreCatalogForEvent(ev: EventRef | null): Promise<EventScores> {
  const [shop] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "shop_list")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1);
  const [batch] = await db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1);
  // The event's environment is in the key too: a catalogue edit (a new park or era) must not wait out the hour.
  const key = ["event-score", String(ev?.id ?? 0), `${ev?.envYear ?? ""}|${ev?.stadium ?? ""}|${ev?.series ?? ""}|${tournamentEraYear(ev ?? { envYear: null })}`, String(shop?.id ?? 0), String(batch?.id ?? 0)];
  const packed = await unstable_cache(() => computeEventScores(ev), key, { revalidate: 3600, tags: ["event-score"] })();
  const byId = new Map(packed.rows.map((p) => [p[0], p]));
  return {
    eventId: ev?.id ?? null, eraYear: packed.eraYear, parkLabel: packed.parkLabel, lhpShare: packed.lhpShare, lhbShare: packed.lhbShare,
    get(cardId) {
      const p = byId.get(cardId);
      return p ? { runsR: p[1], runsL: p[2], model: p[3], blend: p[4], obsN: p[5] } : undefined;
    },
  };
}
