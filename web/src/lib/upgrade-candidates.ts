/**
 * Which cards he doesn't own the Upgrades scan places (lib/upgrades-load, and
 * Buy Plan, which runs it). Pure, so it is tested on its own.
 *
 * A card with a price on file (an ask, or recent sales) always counts. Until
 * 2026-11-12 nothing else did, so a release was invisible on both pages until
 * the market priced it. That day's best adds were Ken Griffey Jr. 103 from
 * packs and the Clubhouse's Dallas Keuchel 48 and Ben Oglivie 97, and neither
 * page showed them. (L.J.: "make sure we are capturing the newest cards".)
 * Two more kinds count now, with no price:
 *
 *   fresh     - first seen within NEW_CARD_DAYS of the newest card on file,
 *               the rule behind Build's "new" badge (card-fit-load
 *               newCardIds): the market hasn't formed yet.
 *   clubhouse - bought with CS, so it may trade for PP late or never.
 *
 * An old card with no price stays out: a mission reward or a set no one sells.
 */

/** How long after the newest card on file a release still counts as new. */
export const NEW_CARD_DAYS = 7;
const DAY_MS = 86_400_000;

const time = (d: Date | number) => (typeof d === "number" ? d : d.getTime());

/**
 * The first-seen time at or after which a card is new: the newest card on file
 * less NEW_CARD_DAYS. With no cards, nothing is new.
 */
export function freshCutoff(firstSeen: Iterable<Date | number>): number {
  let newest = Number.NEGATIVE_INFINITY;
  for (const d of firstSeen) newest = Math.max(newest, time(d));
  return Number.isFinite(newest) ? newest - NEW_CARD_DAYS * DAY_MS : Number.POSITIVE_INFINITY;
}

/** First seen at or after the cutoff (freshCutoff). */
export const isFresh = (firstSeen: Date | number, cutoff: number): boolean => time(firstSeen) >= cutoff;

/** A Clubhouse card: its title starts "Clubhouse" ("Clubhouse - Baseball Reference 10 SP Sandy Koufax LAD 1963"). */
export const isClubhouseTitle = (title: string | null | undefined): boolean => /^clubhouse\b/i.test((title ?? "").trim());

export interface CandidateFacts {
  /** An ask or recent sales on file. */
  priced: boolean;
  fresh: boolean;
  clubhouse: boolean;
}

/** Worth placing: priced, or too new to be, or bought with CS. */
export const isBuyCandidate = (c: CandidateFacts): boolean => c.priced || c.fresh || c.clubhouse;
