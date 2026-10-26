/**
 * The Upgrades page: for an event or a group of them (a championship's
 * brackets), what to buy next and what it is worth per PP.
 *
 * L.J., 2026-10-27, ahead of the PTCS 8 Championship price spike: "I realize
 * this is a whole page on the app probably", covering variants, LEs and cards
 * he doesn't own. The first pass was by hand (Docs/PTCS8 Championship Buy List
 * 2026-10-27.md); this is that work, read off the same numbers Card Fit uses.
 *
 * VARIANTS. Every owned base card in a starting role on the event's newest
 * saved roster, scored as is and as its variant (card-forms
 * assumedVariantRatings: the split ratings ×1.08, measured on his own 287
 * variants), in the event's run environment and park with its observed play.
 * The gain is in the roster objective's units, as Card Fit's: a lineup spot
 * by the field's share of each hand of pitching, a starter or reliever at the
 * builder's weight. A starter already on his variant is done.
 *
 * CARDS HE DOESN'T OWN. Every card legal in the group with a price (an ask, or
 * recent sales), placed by Card Fit, which holds a slots or cap event's swap
 * to a legal roster (card-fit Room).
 *
 * Both are one swap into the saved roster. Gains are per event and summed
 * over the events picked on the page; two buys don't simply add, which is
 * what the page's Confirm (lib/upgrade-confirm-server) is for.
 *
 * Plain data, so the page can cache it. Server only.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cardSnapshots, rosters, tournaments, uploads } from "@/db/schema";
import { armWeight, batAt, type Board, type LineupSpot, type ScoredForm } from "@/lib/card-fit";
import { fitCard, fitEventOf, fitRow, fitWorld, legalIn, placeIn, scoreFitEvent, type FitCard, type FitEvent, type FitRow } from "@/lib/card-fit-load";
import { VARIANT_BOOST } from "@/lib/card-forms";

export interface UpgradeGroup {
  /** The key the page's URL carries: "series:<name>", or "events:<id,id>". */
  key: string;
  label: string;
  eventIds: number[];
}

export interface UpgradeEvent extends FitEvent {
  /** The name less the group's own prefix ("Cap" for "PTCS 8 Championship - Cap"). */
  short: string;
  roster: { id: number; name: string } | null;
}

export interface VariantStart {
  eventId: number;
  /** "LF vR · LF vL", "SP", "CL". */
  where: string;
  /** Runs the variant adds there, in the objective's units. */
  gain: number;
}

export interface VariantUpgrade {
  cardId: number;
  name: string;
  val: number;
  pos: string;
  /** buy: he plays the base card. done: the saved roster already plays his variant. owned: he has the variant, but the roster plays the base. */
  state: "buy" | "done" | "owned";
  starts: VariantStart[];
  /** Recent variant sales (last 10), and the shop list it is from. */
  price: number | null;
}

export interface ShopUpgrade {
  card: FitCard;
  /** Ask, else recent sales: what a buy costs now. */
  price: number | null;
  /** Card Fit in each event where it starts, or where only the slots or cap stop it. */
  rows: FitRow[];
  /**
   * Events whose saved roster carries another card of the same player: the
   * game allows one per roster, which Card Fit's swap doesn't hold it to (the
   * confirm's rebuild does). That card would have to go.
   */
  clash: { eventId: number; name: string; val: number }[];
}

export interface UpgradesData {
  group: UpgradeGroup;
  groups: UpgradeGroup[];
  events: UpgradeEvent[];
  variants: VariantUpgrade[];
  shop: ShopUpgrade[];
  boost: number;
  collectionDate: string | null;
  shopDate: string | null;
}

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * The groups worth a scan: every series two or more current, non-draft events
 * share (a championship's brackets), newest saved roster first, so the one he
 * is building for leads.
 */
export async function upgradeGroups(): Promise<UpgradeGroup[]> {
  const events = await db.select({ id: tournaments.id, series: tournaments.series }).from(tournaments)
    .where(and(eq(tournaments.retired, false), eq(tournaments.isDraft, false)));
  const bySeries = new Map<string, number[]>();
  for (const e of events) if (e.series) bySeries.set(e.series, [...(bySeries.get(e.series) ?? []), e.id]);
  const shared = [...bySeries].filter(([, ids]) => ids.length >= 2);
  if (!shared.length) return [];
  const saved = await db.select({ t: rosters.tournamentId, at: sql<string>`max(${rosters.updatedAt})::text` }).from(rosters)
    .where(inArray(rosters.tournamentId, shared.flatMap(([, ids]) => ids))).groupBy(rosters.tournamentId);
  const newest = new Map(saved.map((s) => [s.t, s.at]));
  return shared
    .map(([series, ids]) => ({ key: `series:${series}`, label: series, eventIds: ids.sort((a, b) => a - b), at: ids.map((id) => newest.get(id) ?? "").sort().at(-1) ?? "" }))
    .filter((g) => g.at)
    .sort((a, b) => b.at.localeCompare(a.at) || a.label.localeCompare(b.label))
    .map(({ key, label, eventIds }) => ({ key, label, eventIds }));
}

/** The group a page key names; the first group when it names none. */
export async function resolveGroup(key: string | null | undefined, groups: UpgradeGroup[]): Promise<UpgradeGroup | null> {
  if (key?.startsWith("events:")) {
    const ids = key.slice(7).split(",").map(Number).filter((n) => n > 0);
    const rows = ids.length ? await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, ids)) : [];
    if (rows.length) return { key: `events:${rows.map((r) => r.id).join(",")}`, label: rows.length === 1 ? rows[0].name : `${rows.length} events`, eventIds: rows.map((r) => r.id) };
  }
  return groups.find((g) => g.key === key) ?? groups[0] ?? null;
}

/** The newest price on file for each card: its latest snapshot in any shop list. */
async function latestPrices(ids: number[]) {
  if (!ids.length) return new Map<number, { ask: number | null; last10: number | null; last10Variant: number | null }>();
  const rows = await db.selectDistinctOn([cardSnapshots.cardId], {
    cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow, last10: cardSnapshots.last10, last10Variant: cardSnapshots.last10Variant,
  }).from(cardSnapshots).innerJoin(uploads, eq(uploads.id, cardSnapshots.uploadId))
    .where(and(inArray(cardSnapshots.cardId, ids), eq(uploads.kind, "shop_list")))
    .orderBy(cardSnapshots.cardId, desc(cardSnapshots.uploadId));
  const pos = (x: number | null) => (x != null && x > 0 ? x : null);
  return new Map(rows.map((r) => [r.cardId, { ask: pos(r.ask), last10: pos(r.last10), last10Variant: pos(r.last10Variant) }]));
}

/** Where each of his starters plays on a team: lineup spots per board, or a staff role. */
function startsOn(team: ReturnType<typeof scoreFitEvent>["team"]) {
  const out = new Map<number, { form: ScoredForm; spots: { board: Board | "staff"; spot: string }[] }>();
  const add = (f: ScoredForm, board: Board | "staff", spot: string) => {
    const e = out.get(f.cardId) ?? { form: f, spots: [] };
    e.spots.push({ board, spot });
    out.set(f.cardId, e);
  };
  for (const board of ["R", "L"] as const) for (const [spot, f] of Object.entries(team[board])) if (f) add(f, board, spot);
  team.SP.forEach((f) => add(f, "staff", "SP"));
  team.RP.forEach((f) => add(f, "staff", "RP"));
  return out;
}

export async function loadUpgrades(group: UpgradeGroup, groups: UpgradeGroup[]): Promise<UpgradesData> {
  const w = await fitWorld(group.eventIds);
  const events = w.current.filter((t) => !t.isDraft);
  const prefix = (() => {
    const names = events.map((t) => t.name);
    if (names.length < 2) return "";
    let p = names[0];
    for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
    return p.replace(/[\s-–—:]*$/, "").length > 3 ? p : "";
  })();

  const outEvents: UpgradeEvent[] = [];
  const variantBy = new Map<number, VariantUpgrade>();
  const shopRows = new Map<number, FitRow[]>();
  const clashes = new Map<number, ShopUpgrade["clash"]>();

  // The cards he might buy: not his, and with a price on file.
  const notMine = w.universe.filter((c) => !w.owned.base.has(c.cardId) && !w.owned.variant.has(c.cardId)).map((c) => c.cardId);
  const legalBy = new Map(events.map((t) => [t.id, legalIn(w, t)]));
  const legalAnywhere = notMine.filter((id) => [...legalBy.values()].some((l) => l.has(id)));
  const prices = await latestPrices(legalAnywhere);
  const candidates = legalAnywhere.filter((id) => prices.get(id)?.ask != null || prices.get(id)?.last10 != null);

  for (const t of events) {
    const roster = w.newest.get(t.id);
    outEvents.push({ ...fitEventOf(w, t), short: prefix ? t.name.slice(prefix.length).replace(/^[\s-–—:]+/, "") || t.name : t.name, roster: roster ? { id: roster.id, name: roster.name } : null });
    const legal = legalBy.get(t.id)!;

    // Every owned base card that starts, scored again as its variant.
    const base = scoreFitEvent(w, t, legal);
    const starters = startsOn(base.team);
    const toBoost = [...starters.values()].filter((s) => !s.form.variant && !w.owned.variant.has(s.form.cardId)).map((s) => s.form.cardId);
    const sc = toBoost.length ? scoreFitEvent(w, t, legal, { assumeVariant: toBoost }) : base;
    const team = startsOn(sc.team);
    for (const { form, spots } of team.values()) {
      const id = form.cardId;
      const v = variantBy.get(id) ?? {
        cardId: id, name: form.name, val: form.val ?? 0, pos: w.byId.get(id)?.position ?? "?",
        state: "buy" as VariantUpgrade["state"], starts: [], price: null,
      };
      if (form.variant) { v.state = "done"; v.starts.push({ eventId: t.id, where: spots.map((s) => (s.board === "staff" ? s.spot : `${s.spot} v${s.board}`)).join(" · "), gain: 0 }); variantBy.set(id, v); continue; }
      if (w.owned.variant.has(id)) { if (v.state === "buy") v.state = "owned"; v.starts.push({ eventId: t.id, where: spots.map((s) => (s.board === "staff" ? s.spot : `${s.spot} v${s.board}`)).join(" · "), gain: 0 }); variantBy.set(id, v); continue; }
      const boosted = sc.forms.get(-form.id);
      if (!boosted) continue;
      let gain = 0;
      for (const s of spots) {
        if (s.board === "staff") {
          const role = s.spot as "SP" | "RP";
          gain += (boosted.runsR - form.runsR) * armWeight(role, sc.team[role].length, sc.ctx);
        } else {
          const a = batAt(boosted, s.spot as LineupSpot, s.board, sc.ctx), b = batAt(form, s.spot as LineupSpot, s.board, sc.ctx);
          if (a != null && b != null) gain += (a - b) * (s.board === "R" ? 1 - sc.ctx.lhp : sc.ctx.lhp);
        }
      }
      v.starts.push({ eventId: t.id, where: spots.map((s) => (s.board === "staff" ? s.spot : `${s.spot} v${s.board}`)).join(" · "), gain: r1(gain) });
      variantBy.set(id, v);
    }

    // Cards he doesn't own, placed by Card Fit (slots and cap included).
    const players = new Map<string, number>();
    for (const s of base.slots) { const b = w.byId.get(s.cardId)?.brefId; if (b) players.set(b, s.cardId); }
    for (const id of candidates) {
      if (!legal.has(id)) continue;
      const placed = placeIn(base, id);
      if (!placed) continue;
      if (placed.fit.status !== "start" && !placed.fit.room) continue;
      shopRows.set(id, [...(shopRows.get(id) ?? []), fitRow(w, t, base, id, placed)]);
      const other = players.get(w.byId.get(id)?.brefId ?? "");
      if (other != null && other !== id) clashes.set(id, [...(clashes.get(id) ?? []), { eventId: t.id, name: w.byId.get(other)!.name, val: w.byId.get(other)!.cardValue }]);
    }
  }

  const vPrices = await latestPrices([...variantBy.keys()]);
  const variants = [...variantBy.values()].map((v) => ({ ...v, price: vPrices.get(v.cardId)?.last10Variant ?? null }));
  const shop: ShopUpgrade[] = [...shopRows].map(([id, rows]) => {
    const p = prices.get(id);
    return { card: fitCard(w, id, p ?? undefined)!, price: p?.ask ?? p?.last10 ?? null, rows: rows.sort((a, b) => b.gain - a.gain), clash: clashes.get(id) ?? [] };
  }).filter((s) => s.card);

  return {
    group, groups, events: outEvents, variants, shop, boost: VARIANT_BOOST,
    collectionDate: day(w.collection?.at), shopDate: day(w.shop?.at),
  };
}
