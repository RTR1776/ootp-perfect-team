/**
 * The new cards as highlights (/cards/highlights). L.J., 2026-10-18: "when
 * new cards are available you could have a little highlights page showing
 * them, where they play, how strong they are … also for my new cards that I
 * get like new variants … something visual and fun … we get cards almost
 * every day".
 *
 * Reads Card Fit's rows for the new cards (lib/card-fit-load newCardIds +
 * loadCardFit) and says, per card: how many current events it starts in for
 * him, the best few with the runs it adds and the spot, or plainly why it
 * doesn't start. His new cards come first; the shop's are grouped by the day
 * a shop list first had them, newest first, so each day's drop shows. The
 * spotlight is the one with the biggest gain.
 *
 * Pure: the page passes the cached Card Fit data in.
 */
import type { CardFitData, FitCard } from "@/lib/card-fit-load";
import { pp } from "@/lib/format";
import { tierCode, TIER_NAME } from "@/lib/roster-rules";
import { isTier, type Tier } from "@/lib/tiers";

/** Low to high, the filter's order. */
export const HIGHLIGHT_TIERS: readonly Tier[] = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Perfect"];
/** How many of a card's events a tile lists. */
export const TOP_EVENTS = 3;

export type TierFilter = Tier | "All";

/** One event where the card would start for him. */
export interface TopSpot {
  eventId: number;
  /** The event's name without a leading "Daily ". */
  event: string;
  /** Runs one swap adds to his roster there. */
  gain: number;
  spot: string;
  /** His variant's form is the one placed. */
  variant: boolean;
  /** Its rank at the spot among every legal card there. */
  rank: number;
  of: number;
}

export interface Highlight {
  card: FitCard;
  tier: Tier | null;
  /** New to his collection since the collection before. */
  mine: boolean;
  /** Of his new cards: the variant is what's new. */
  newVariant: boolean;
  /** Current events it is legal in. */
  legal: number;
  /** Of those, where it would start for him. */
  starts: number;
  /** Where it's already on his saved roster. */
  on: number;
  /** The biggest gain over its events; 0 where it starts nowhere. */
  best: number;
  /** The events where it adds the most, best first, at most TOP_EVENTS. */
  top: TopSpot[];
}

export interface DayDrop {
  /** YYYY-MM-DD a shop list first had these cards. */
  day: string;
  cards: Highlight[];
  /** How many of them start somewhere for him. */
  starting: number;
}

export interface Highlights {
  /** The card with the biggest gain, his or the shop's; null when none starts anywhere. */
  spotlight: Highlight | null;
  /** His new cards and variants, strongest first. */
  yours: Highlight[];
  /** The shop's new cards he didn't just get, by the day they appeared, newest day first. */
  shop: DayDrop[];
  /** The tiers present among all the new cards (before the filter), low to high, with counts. */
  tiers: { tier: Tier; n: number }[];
  /** The biggest gain shown: the scale for each tile's meter. */
  max: number;
  /** Cards shown, and how many of them start somewhere. */
  shown: number;
  starting: number;
}

export const shortEvent = (name: string) => name.replace(/^Daily /, "");

/** The card's tier: its own when on file, else read from its value (as CardName). */
export function tierOf(card: Pick<FitCard, "tier" | "val">): Tier | null {
  if (isTier(card.tier)) return card.tier;
  if (card.val == null || !Number.isFinite(card.val)) return null;
  const t = TIER_NAME[tierCode(card.val)];
  return isTier(t) ? t : null;
}

/** Strongest first: biggest gain, then most events started, then most rosters already on, then value. */
export function byStrength(a: Highlight, b: Highlight): number {
  return b.best - a.best || b.starts - a.starts || b.on - a.on || (b.card.val ?? 0) - (a.card.val ?? 0) || a.card.name.localeCompare(b.card.name);
}

/** One card's highlight from its Card Fit rows. */
export function highlightOf(
  entry: CardFitData["cards"][number],
  eventName: (id: number) => string | undefined,
  opts: { mine?: boolean; newVariant?: boolean } = {},
): Highlight {
  const starts = entry.rows.filter((r) => r.status === "start").sort((a, b) => b.gain - a.gain);
  return {
    card: entry.card,
    tier: tierOf(entry.card),
    mine: opts.mine ?? false,
    newVariant: opts.newVariant ?? false,
    legal: entry.rows.length,
    starts: starts.length,
    on: entry.rows.filter((r) => r.status === "on").length,
    best: starts[0]?.gain ?? 0,
    top: starts.slice(0, TOP_EVENTS).map((r) => ({
      eventId: r.eventId, event: shortEvent(eventName(r.eventId) ?? `Event ${r.eventId}`), gain: r.gain,
      spot: r.spot, variant: r.variant, rank: r.rank, of: r.of,
    })),
  };
}

/** The spotlight: the biggest gain; ties go to more events started, then the higher value. Null when none starts. */
export function pickSpotlight(cards: readonly Highlight[]): Highlight | null {
  const starting = cards.filter((h) => h.starts > 0);
  return starting.length ? [...starting].sort(byStrength)[0] : null;
}

/** The shop's cards by the day they first appeared, newest day first, strongest first within a day. */
export function groupByDay(cards: readonly Highlight[]): DayDrop[] {
  const by = new Map<string, Highlight[]>();
  for (const h of cards) by.set(h.card.firstSeen, [...(by.get(h.card.firstSeen) ?? []), h]);
  return [...by.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, xs]) => {
      const sorted = [...xs].sort(byStrength);
      return { day, cards: sorted, starting: sorted.filter((h) => h.starts > 0).length };
    });
}

export function buildHighlights(
  input: { data: CardFitData; pulled: readonly number[]; variants?: readonly number[] },
  tier: TierFilter = "All",
): Highlights {
  const names = new Map(input.data.events.map((e) => [e.id, e.name]));
  const mine = new Set(input.pulled), fresh = new Set(input.variants ?? []);
  const all = input.data.cards.map((c) =>
    highlightOf(c, (id) => names.get(id), { mine: mine.has(c.card.id), newVariant: mine.has(c.card.id) && fresh.has(c.card.id) }));
  const tiers = HIGHLIGHT_TIERS.map((t) => ({ tier: t, n: all.filter((h) => h.tier === t).length })).filter((x) => x.n > 0);
  const shown = all.filter((h) => tier === "All" || h.tier === tier);
  const spotlight = pickSpotlight(shown);
  return {
    spotlight,
    yours: shown.filter((h) => h.mine).sort(byStrength),
    shop: groupByDay(shown.filter((h) => !h.mine)),
    tiers,
    max: spotlight?.best ?? 0,
    shown: shown.length,
    starting: shown.filter((h) => h.starts > 0).length,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The tile's headline, plainly: where it starts, or why it doesn't. */
export function standing(h: Pick<Highlight, "starts" | "legal" | "on">): string {
  if (h.starts > 0) return `Starts in ${h.starts} of ${plural(h.legal, "event")}`;
  if (h.on > 0) return `Already on ${plural(h.on, "roster")}`;
  if (h.legal > 0) return `Doesn't start anywhere yet (legal in ${h.legal})`;
  return "Not legal in any current event";
}

/** A second line when it starts somewhere and is already on rosters too. */
export function alsoOn(h: Pick<Highlight, "starts" | "on">): string | null {
  return h.starts > 0 && h.on > 0 ? `already on ${plural(h.on, "roster")}` : null;
}

/** The meter's fill, 0–1: this card's best gain against the biggest shown. */
export function meter(best: number, max: number): number {
  if (!(max > 0) || !(best > 0)) return 0;
  return Math.min(1, best / max);
}

/** What a shop tile says about price: his, the lowest ask, the last-10 average, or nothing listed. */
export function priceOf(card: Pick<FitCard, "owned" | "ask" | "last10">): { text: string; kind: "yours" | "ask" | "last10" | "none"; title?: string } {
  if (card.owned.variant) return { text: "yours (variant)", kind: "yours" };
  if (card.owned.base) return { text: "yours", kind: "yours" };
  if (card.ask != null) {
    return { text: pp(card.ask), kind: "ask", title: `Lowest ask ${card.ask.toLocaleString("en-US")} · last 10 ${card.last10 != null ? card.last10.toLocaleString("en-US") : "none"}` };
  }
  if (card.last10 != null) return { text: `L10 ${pp(card.last10)}`, kind: "last10", title: "No ask listed: the last 10 sales' average" };
  return { text: "not listed", kind: "none" };
}

/** What his new card sells for: the last 10 sales of the form he got (the variant's for a new variant). */
export function worthOf(card: Pick<FitCard, "last10" | "last10Variant">, variant: boolean): number | null {
  return variant ? card.last10Variant ?? null : card.last10 ?? null;
}
