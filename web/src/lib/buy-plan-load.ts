/**
 * Buy Plan (lib/buy-plan for the arithmetic): where to put PP and CS across
 * every tier he plays, refreshed by each new collection and card list.
 *
 * L.J., 2026-11-08: "we have done something in the past where we look across
 * the levels (Diamond, Gold, Silver, etc) and determine where to invest some
 * resources PP and CS … Like where am I a bit short". Then: "can you put this
 * page on the app and we can update as needed when new cards come out".
 *
 *   where he plays — logged results over the last PLAY_DAYS days, drafts out,
 *     each event's entries a week; per tier, points per entry
 *   buys — the Upgrades scan (lib/upgrades-load) over exactly those events:
 *     every card he doesn't own with a price, Card Fit's one swap into the
 *     saved roster, each event's gain times his entries a week there
 *   variants — the same scan's variant reads, weighted the same way
 *   CS — the Clubhouse screenshot prices (data/clubhouse-cs.json) matched to
 *     cards, what one CS is worth in PP, and each Clubhouse card's gain per CS
 *   sells — owned cards on no saved roster for a live event in the last
 *     SELL_ROSTER_DAYS days and not on the league team, worth SELL_FLOOR+;
 *     no export marks the game's locks, so each is checked against his newest
 *     unlocked-cards export (data/unlocked-cards.json, refreshed by hand)
 *
 * One-swap gains don't add when two cards want the same spot: the Upgrades
 * page's Confirm (or pnpm upgrade:confirm) is the real rebuild.
 * Plain data, so the page can cache it. Server only.
 */
import { and, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, results, rosters, rosterSlots, tournaments } from "@/db/schema";
import { fitSources } from "@/lib/card-fit-load";
import { loadUpgrades } from "@/lib/upgrades-load";
import { buyCall, clubhouseTitleMatches, eventName, isDraftResult, netGain, ppPerCs, sellCall, tierOf, TIERS, weightedGain, type PlanTier } from "@/lib/buy-plan";
import clubhouseCs from "@/data/clubhouse-cs.json";
import leagueTeam from "@/data/league-team.json";
import unlockedCards from "@/data/unlocked-cards.json";

const unlockedKey = (name: string, val: number, variant: boolean) => `${name}|${val}|${variant ? "v" : "b"}`;
const UNLOCKED = new Set(unlockedCards.cards.map((c) => unlockedKey(c.name, c.val, c.variant)));

/** Three weeks of results: enough entries per event, recent enough to be how he plays now. */
export const PLAY_DAYS = 21;
/** A card counts as in use when a roster saved this recently for a live event carries it. */
const SELL_ROSTER_DAYS = 20;
/** Smaller sales aren't worth a line. */
const SELL_FLOOR = 15_000;
/** A weighted gain under this is noise. */
const BUY_FLOOR = 1;

export interface PlanEvent { id: number; name: string; tier: PlanTier | null; perWeek: number }

export interface TierRow {
  tier: PlanTier;
  perWeek: number;
  entries: number;
  points: number;
  ptsPerEntry: number | null;
  /** Card ids of the three best buys by weighted gain in this tier's events. */
  top: number[];
}

export interface BuyStart { eventId: number; event: string; spot: string; gain: number; perWeek: number }

export interface BuyRow {
  id: number;
  name: string;
  val: number;
  pos: string;
  tier: string | null;
  le: boolean;
  title: string;
  /** Runs a week: each event's gain times his entries a week there. */
  weighted: number;
  /** Weighted runs per 10,000 PP at the price below. */
  per10k: number | null;
  price: number | null;
  ask: number | null;
  last10: number | null;
  call: "buy" | "bid";
  target: number | null;
  /** The Clubhouse CS price, when the card is in the screenshots. */
  cs: number | null;
  starts: BuyStart[];
  /** Events whose roster already has another card of this player (the game allows one). */
  clash: string[];
}

export interface VariantRow { id: number; name: string; val: number; pos: string; weighted: number; price: number | null; per10k: number | null; events: number }

export interface ClubRow { id: number | null; name: string; val: number; pos: string; set: string; cs: number; discount: number | null; pp: number | null; weighted: number; perCs: number | null; owned: boolean }

export interface SellRow {
  id: number;
  name: string;
  val: number;
  title: string;
  variant: boolean;
  bid: number | null;
  ask: number | null;
  last10: number | null;
  call: "take" | "list";
  target: number | null;
  /** Not on his newest unlocked-cards list: locked by a mission, or bought since that list. */
  locked: boolean;
}

export interface BuyPlanData {
  since: string;
  collectionDate: string | null;
  shopDate: string | null;
  events: PlanEvent[];
  tiers: TierRow[];
  buys: BuyRow[];
  variants: VariantRow[];
  clubhouse: { asOf: string; note: string; ppPerCs: number | null; rows: ClubRow[] };
  sells: SellRow[];
  /** The date of the unlocked-cards list the sells are checked against. */
  unlockedAsOf: string;
}

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const r1 = (x: number) => Math.round(x * 10) / 10;
const posOrNull = (x: number | null | undefined) => (x != null && x > 0 ? x : null);

/** His entries per event and per tier since `since`, drafts left out. */
async function playedEvents(since: string) {
  const rows = await db.select({ name: results.name, categories: results.categories, points: results.points })
    .from(results).where(gte(results.occurredOn, since));
  const weeks = PLAY_DAYS / 7;
  const byName = new Map<string, { n: number; tier: PlanTier | null }>();
  const byTier = new Map<PlanTier, { entries: number; points: number }>();
  for (const r of rows) {
    const cats = r.categories ?? [];
    if (isDraftResult(cats)) continue;
    const name = eventName(r.name), tier = tierOf(cats);
    const e = byName.get(name) ?? { n: 0, tier };
    e.n++;
    byName.set(name, e);
    if (tier) {
      const t = byTier.get(tier) ?? { entries: 0, points: 0 };
      t.entries++; t.points += r.points;
      byTier.set(tier, t);
    }
  }
  const live = await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments)
    .where(and(eq(tournaments.retired, false), eq(tournaments.isDraft, false)));
  const events: PlanEvent[] = [];
  for (const t of live) {
    const e = byName.get(t.name.trim());
    if (e) events.push({ id: t.id, name: t.name, tier: e.tier, perWeek: e.n / weeks });
  }
  return { events, byTier, weeks };
}

/** Owned cards no current roster uses and the league team doesn't carry, worth listing. */
async function sellList(collectionId: number, shopId: number | null): Promise<SellRow[]> {
  const cutoff = new Date(Date.now() - SELL_ROSTER_DAYS * 86_400_000);
  const used = await db.select({ cardId: rosterSlots.cardId, variant: rosterSlots.useVariant })
    .from(rosterSlots).innerJoin(rosters, eq(rosters.id, rosterSlots.rosterId)).innerJoin(tournaments, eq(tournaments.id, rosters.tournamentId))
    .where(and(gte(rosters.updatedAt, cutoff), eq(tournaments.retired, false)));
  const usedBase = new Set(used.map((u) => u.cardId));
  const usedVariant = new Set(used.filter((u) => u.variant).map((u) => u.cardId));
  const league = new Set([...leagueTeam.bats, ...leagueTeam.arms].map((s) => Number(s.split("#")[1])));
  const owned = await db.select({ cardId: collectionCards.cardId, variant: collectionCards.isVariant, name: collectionCards.name, val: collectionCards.cardValue, title: cards.title })
    .from(collectionCards).leftJoin(cards, eq(cards.cardId, collectionCards.cardId))
    .where(eq(collectionCards.uploadId, collectionId));
  const ids = [...new Set(owned.map((o) => o.cardId).filter((x): x is number => x != null))];
  const snaps = shopId == null || !ids.length ? [] : await db.select({ cardId: cardSnapshots.cardId, bid: cardSnapshots.buyOrderHigh, ask: cardSnapshots.sellOrderLow, last10: cardSnapshots.last10, last10Variant: cardSnapshots.last10Variant })
    .from(cardSnapshots).where(and(eq(cardSnapshots.uploadId, shopId), inArray(cardSnapshots.cardId, ids)));
  const price = new Map(snaps.map((s) => [s.cardId, s]));
  const out: SellRow[] = [];
  const seen = new Set<string>();
  for (const o of owned) {
    if (o.cardId == null || league.has(o.cardId)) continue;
    if (o.variant ? usedVariant.has(o.cardId) : usedBase.has(o.cardId)) continue;
    const key = `${o.cardId}${o.variant ? "v" : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = price.get(o.cardId);
    const last10 = posOrNull(o.variant ? p?.last10Variant : p?.last10);
    if ((last10 ?? 0) < SELL_FLOOR) continue;
    const bid = o.variant ? null : posOrNull(p?.bid), ask = o.variant ? null : posOrNull(p?.ask);
    out.push({
      id: o.cardId, name: o.name, val: o.val ?? 0, title: o.title ?? "", variant: o.variant, bid, ask, last10, ...sellCall(bid, ask, last10),
      locked: !UNLOCKED.has(unlockedKey(o.name, o.val ?? 0, o.variant)),
    });
  }
  return out.sort((a, b) => (b.last10 ?? 0) - (a.last10 ?? 0));
}

/** The Clubhouse screenshot rows, matched to cards and priced in PP. */
async function clubhouse(collectionId: number, shopId: number | null, weightedById: Map<number, number>) {
  const club = await db.select({ cardId: cards.cardId, name: cards.name, val: cards.cardValue, title: cards.title })
    .from(cards).where(ilike(cards.title, "Clubhouse%"));
  const ids = club.map((c) => c.cardId);
  const [snaps, mine] = await Promise.all([
    shopId == null || !ids.length ? [] : db.select({ cardId: cardSnapshots.cardId, last10: cardSnapshots.last10, ask: cardSnapshots.sellOrderLow })
      .from(cardSnapshots).where(and(eq(cardSnapshots.uploadId, shopId), inArray(cardSnapshots.cardId, ids))),
    ids.length ? db.select({ cardId: collectionCards.cardId }).from(collectionCards).where(and(eq(collectionCards.uploadId, collectionId), inArray(collectionCards.cardId, ids))) : [],
  ]);
  const pp = new Map(snaps.map((s) => [s.cardId, posOrNull(s.last10) ?? posOrNull(s.ask)]));
  const owned = new Set(mine.map((m) => m.cardId));
  const rows: ClubRow[] = clubhouseCs.cards.map((r) => {
    const c = club.find((x) => x.name === r.name && x.val === r.value && clubhouseTitleMatches(x.title, r));
    const weighted = c ? weightedById.get(c.cardId) ?? 0 : 0;
    return {
      id: c?.cardId ?? null, name: r.name, val: r.value, pos: r.pos, set: r.set, cs: r.cs, discount: r.discount,
      pp: c ? pp.get(c.cardId) ?? null : null, weighted: r1(weighted), perCs: weighted > 0 ? r1((weighted / r.cs) * 10) : null,
      owned: c ? owned.has(c.cardId) : false,
    };
  });
  return { asOf: clubhouseCs.asOf, note: clubhouseCs.from, ppPerCs: ppPerCs(rows.map((r) => ({ cs: r.cs, pp: r.pp }))), rows };
}

export async function loadBuyPlan(): Promise<BuyPlanData> {
  const since = new Date(Date.now() - PLAY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { events, byTier, weeks } = await playedEvents(since);
  const perWeek = new Map(events.map((e) => [e.id, e.perWeek]));
  const eventTier = new Map(events.map((e) => [e.id, e.tier]));
  const { collection, shop } = await fitSources();

  const scan = events.length
    ? await loadUpgrades({ key: `events:${events.map((e) => e.id).join(",")}`, label: "Events you play", eventIds: events.map((e) => e.id) }, [])
    : null;
  const names = new Map((scan?.events ?? []).map((e) => [e.id, e.short]));

  const shopIds = (scan?.shop ?? []).map((s) => s.card.id);
  const titles = shopIds.length ? new Map((await db.select({ id: cards.cardId, title: cards.title }).from(cards).where(inArray(cards.cardId, shopIds))).map((r) => [r.id, r.title])) : new Map<number, string>();

  const buys: BuyRow[] = [];
  for (const s of scan?.shop ?? []) {
    const starts: BuyStart[] = s.rows
      .map((r) => ({ eventId: r.eventId, event: names.get(r.eventId) ?? String(r.eventId), spot: r.spot, gain: r1(netGain(r)), perWeek: r1(perWeek.get(r.eventId) ?? 0) }))
      .filter((r) => r.gain >= 0.5)
      .sort((a, b) => b.gain * Math.max(b.perWeek, 0.1) - a.gain * Math.max(a.perWeek, 0.1));
    const weighted = weightedGain(starts, perWeek);
    if (weighted < BUY_FLOOR) continue;
    const price = s.price;
    buys.push({
      id: s.card.id, name: s.card.name, val: s.card.val, pos: s.card.pos, tier: s.card.tier, le: s.card.le, title: titles.get(s.card.id) ?? "",
      weighted: r1(weighted), per10k: price ? r1((weighted / price) * 10_000) : null,
      price, ask: s.card.ask, last10: s.card.last10, ...buyCall(s.card.ask, s.card.last10), cs: null,
      starts, clash: [...new Set(s.clash.map((c) => names.get(c.eventId) ?? String(c.eventId)))],
    });
  }
  buys.sort((a, b) => b.weighted - a.weighted);

  const variants: VariantRow[] = (scan?.variants ?? [])
    .filter((v) => v.state === "buy")
    .map((v) => {
      const weighted = weightedGain(v.starts, perWeek);
      return { id: v.cardId, name: v.name, val: v.val, pos: v.pos, weighted: r1(weighted), price: v.price, per10k: v.price ? r1((weighted / v.price) * 10_000) : null, events: v.starts.filter((s) => s.gain > 0).length };
    })
    .filter((v) => v.weighted >= BUY_FLOOR)
    .sort((a, b) => b.weighted - a.weighted);

  const club = collection ? await clubhouse(collection.id, shop?.id ?? null, new Map(buys.map((b) => [b.id, b.weighted]))) : { asOf: clubhouseCs.asOf, note: clubhouseCs.from, ppPerCs: null, rows: [] };
  const csById = new Map(club.rows.filter((r) => r.id != null).map((r) => [r.id!, r.cs]));
  for (const b of buys) b.cs = csById.get(b.id) ?? null;

  const tiers: TierRow[] = TIERS.flatMap((tier) => {
    const t = byTier.get(tier);
    if (!t) return [];
    const ids = new Set(events.filter((e) => eventTier.get(e.id) === tier).map((e) => e.id));
    const inTier = buys
      .map((b) => ({ id: b.id, w: b.starts.filter((s) => ids.has(s.eventId)).reduce((s, r) => s + r.gain * r.perWeek, 0) }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w);
    return [{ tier, perWeek: r1(t.entries / weeks), entries: t.entries, points: t.points, ptsPerEntry: t.entries ? Math.round((t.points / t.entries) * 10) / 10 : null, top: inTier.slice(0, 3).map((x) => x.id) }];
  });

  const sells = collection ? await sellList(collection.id, shop?.id ?? null) : [];

  return {
    since, collectionDate: day(collection?.at), shopDate: day(shop?.at),
    events: events.sort((a, b) => b.perWeek - a.perWeek).map((e) => ({ ...e, perWeek: r1(e.perWeek), name: names.get(e.id) ?? e.name })),
    tiers, buys, variants, clubhouse: club, sells, unlockedAsOf: unlockedCards.asOf,
  };
}

/** The newest result id: a new result changes his entries a week, so it is part of the cache key. */
export async function newestResult(): Promise<string> {
  const [r] = await db.select({ id: sql<number>`max(${results.id})` }).from(results);
  return String(r?.id ?? 0);
}
