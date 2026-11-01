/**
 * Scores Card Fit (lib/card-fit.ts): every current event, read the way Build
 * reads it, and the target cards placed in each.
 *
 * Per event: its run environment (PT default when none is recorded) and park;
 * the field's handedness off its exports (series_meta), unless they predate
 * the event's current format; the whole catalogue scored once without play,
 * which sets each series' level; then every legal card, his owned forms and
 * the targets scored with observed play blended in, exactly as Build's pool.
 * Observed play is loaded once and re-read in each environment
 * (observed-blend observedRunsFrom).
 *
 * His team there is his newest saved roster for the event, else the best team
 * his legal cards make (card-fit bestTeam). Ownership is the newest collection,
 * with a variant implying its base copy (ingest/collection impliedBaseCopies).
 *
 * The result is plain data (no Maps), so a page can cache it.
 */
import { penStaminaRuns } from "@/lib/roster-objective";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, importBatches, rosters, rosterSlots, seriesMeta, tournaments, uploads } from "@/db/schema";
import { envFitMaps, observedShift, type EnvFitInput } from "@/lib/analytics/env-fit";
import { bothHands, loadObservedBook, observedRunsFrom, type ObservedBook, type ObservedRuns } from "@/lib/analytics/observed-blend";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { gloveScale } from "@/lib/analytics/fielding";
import { rationedEvent, teamWeights } from "@/lib/analytics/calibration";
import { assumedVariantRatings, formRatings } from "@/lib/card-forms";
import { CARD_TYPE_SHORT } from "@/lib/card-sets";
import { armRole, bestTeam, FIELD_POS, fitIn, savedTeam, type Fit, type FitCtx, type Room, type ScoredForm } from "@/lib/card-fit";
import { eventGroupOf } from "@/lib/event-groups";
import { cardIdOf, formIdForSlot, isTwoWayForm, twoWayForm, twoWayId } from "@/lib/two-way";
import { impliedBaseCopies } from "@/lib/ingest/collection";
import { LHP_SHARE_DEFAULT } from "@/lib/roster-objective";
import { cardEligibility, parseCardTypeRule, type RosterRules } from "@/lib/roster-rules";
import { exportsPredate } from "@/lib/set-evidence-server";
import { staffPerTeam, type SeriesBuild } from "@/lib/field-construction";
import fieldConstruction from "@/data/field-construction.json";

const ROLE_TRUST = 0.25;
const WOBA_SCALE = 1.25;

export interface FitEvent {
  id: number;
  name: string;
  /** The picker group (Dailies — Bronze, Weeklies — Friday, …). */
  group: string;
  /** Iron / Bronze / Silver / Gold / Diamond / Open / Slots / Live: the filter chip. */
  tier: string;
  /** "1991 RE · 1991 Cleveland Stadium". */
  env: string;
  /** "40–59", or "slots". */
  window: string;
  /** Rules that can stop a one-card swap: cap, slots, variant cap, sets, years, no LE. */
  rules: string[];
  dh: boolean;
  lhp: number;
  /** Whose team the gains are measured against. */
  team: { kind: "saved"; name: string } | { kind: "best" };
  /** A cap event: the cap, and what his saved roster leaves under it (null with no saved roster). */
  cap: { cap: number; spare: number | null } | null;
}

export interface FitRow extends Fit {
  eventId: number;
  /** The form placed: his variant's where he owns it and the event takes variants. */
  variant: boolean;
  /** The card's own play in this event's series: PA (BF for an arm) and runs per 700 above that field. */
  played: { n: number; vsField: number } | null;
  /** In a cap event, the card value the top swap adds (the card in, the one it replaces out). */
  capCost: number | null;
}

export interface FitCard {
  id: number;
  name: string;
  val: number;
  tier: string | null;
  pos: string;
  role: "SP" | "RP" | null;
  hand: string | null;
  year: number | null;
  set: number | null;
  le: boolean;
  /** YYYY-MM-DD the card entered the card table (a shop list first listed it). */
  firstSeen: string;
  owned: { base: boolean; variant: boolean };
  ask: number | null;
  last10: number | null;
  last10Variant: number | null;
}

export interface CardFitData {
  events: FitEvent[];
  cards: { card: FitCard; rows: FitRow[] }[];
  collectionDate: string | null;
  shopDate: string | null;
}

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const range = (lo: number | null, hi: number | null) => (lo != null && hi != null ? `${lo}–${hi}` : lo != null ? `${lo}+` : hi != null ? `up to ${hi}` : "any");

/** The filter chip an event sits under. */
export function fitTier(t: { ratingsMax: number | null; restrictions: Record<string, unknown> | null }): string {
  const rx = t.restrictions as { slots?: unknown; cardTypes?: string[] } | null;
  if (rx?.cardTypes?.length === 1 && rx.cardTypes[0] === "Live") return "Live";
  if (t.ratingsMax == null) return rx?.slots ? "Slots" : "Open";
  if (t.ratingsMax <= 59) return "Iron";
  if (t.ratingsMax <= 69) return "Bronze";
  if (t.ratingsMax <= 79) return "Silver";
  if (t.ratingsMax <= 89) return "Gold";
  if (t.ratingsMax <= 99) return "Diamond";
  return "Open";
}

/** The newest two collection uploads and the newest shop list. */
export async function fitSources() {
  const [colls, [shop]] = await Promise.all([
    db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(2),
    db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "shop_list")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1),
  ]);
  return { collection: colls[0] ?? null, previous: colls[1] ?? null, shop: shop ?? null };
}

/**
 * What Card Fit's numbers depend on, for a cache key: the newest published
 * tournament import (observed play), collection and shop list, the
 * catalogue's rules and the saved rosters. Any change makes a new entry.
 */
export async function fitVersion(): Promise<string[]> {
  const [{ collection, shop }, [batch], [ev], [ro]] = await Promise.all([
    fitSources(),
    db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1),
    db.select({ at: sql<string>`max(${tournaments.updatedAt})::text` }).from(tournaments),
    db.select({ at: sql<string>`max(${rosters.updatedAt})::text`, n: sql<number>`count(*)::int` }).from(rosters),
  ]);
  return [batch?.id, collection?.id, shop?.id, ev?.at, ro?.at, ro?.n].map((x) => String(x ?? 0));
}

/**
 * Every tournament line (about 47,000) takes two seconds to load, and only a
 * new published import changes them: a warm server keeps them for half an hour.
 */
let bookMemo: { batch: number; at: number; book: Promise<ObservedBook> } | null = null;
async function observedBook(): Promise<ObservedBook> {
  const [batch] = await db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1);
  const id = batch?.id ?? 0;
  if (!bookMemo || bookMemo.batch !== id || Date.now() - bookMemo.at > 30 * 60_000) {
    const book = loadObservedBook();
    bookMemo = { batch: id, at: Date.now(), book };
    book.catch(() => { if (bookMemo?.book === book) bookMemo = null; });
  }
  return bookMemo.book;
}

type Owned = { base: Set<number>; variant: Map<number, Record<string, number>> };

async function ownedAt(uploadId: number, clubhouse: (id: number) => boolean): Promise<Owned> {
  const rows = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, uploadId));
  const base = new Set<number>(), variant = new Map<number, Record<string, number>>();
  for (const r of rows) {
    if (r.cardId == null) continue;
    if (r.isVariant) variant.set(r.cardId, (r.ratings ?? {}) as Record<string, number>);
    else base.add(r.cardId);
  }
  for (const id of impliedBaseCopies(rows, clubhouse)) base.add(id);
  return { base, variant };
}

/**
 * The cards worth a look after a drop: those the newest shop list added
 * (first seen within a week of the newest card on file, as Build's "new"
 * badge), and those he got since the collection before (a pulled card or a
 * new variant). `variants` is the pulled cards whose variant is what's new.
 */
export async function newCardIds(): Promise<{ shop: number[]; pulled: number[]; variants: number[] }> {
  const { collection, previous } = await fitSources();
  const universe = await db.select({ cardId: cards.cardId, firstSeenAt: cards.firstSeenAt, title: cards.title }).from(cards);
  const newest = universe.reduce((m, c) => Math.max(m, c.firstSeenAt.getTime()), 0);
  const shop = universe.filter((c) => c.firstSeenAt.getTime() >= newest - 7 * 86_400_000).map((c) => c.cardId);
  if (!collection || !previous) return { shop, pulled: [], variants: [] };
  const club = new Set(universe.filter((c) => /clubhouse/i.test(c.title)).map((c) => c.cardId));
  const [now, then] = await Promise.all([ownedAt(collection.id, (id) => club.has(id)), ownedAt(previous.id, (id) => club.has(id))]);
  const pulled = new Set<number>(), variants: number[] = [];
  for (const id of now.base) if (!then.base.has(id) && !then.variant.has(id)) pulled.add(id);
  for (const id of now.variant.keys()) if (!then.variant.has(id)) { pulled.add(id); variants.push(id); }
  return { shop, pulled: [...pulled], variants };
}

const universeQuery = () => db.select({
  cardId: cards.cardId, name: cards.name, tier: cards.tier, cardValue: cards.cardValue, position: cards.position, pitcherRole: cards.pitcherRole,
  isPitcher: cards.isPitcher, bats: cards.bats, throws: cards.throws, year: cards.year, cardType: cards.cardType, cardSubType: cards.cardSubType,
  ratings: cards.ratings, title: cards.title, firstSeenAt: cards.firstSeenAt, brefId: cards.brefId,
}).from(cards);
type UniverseCard = Awaited<ReturnType<typeof universeQuery>>[number];

/** Everything Card Fit reads once, for every event: the catalogue, his cards, saved rosters, observed play. */
export async function fitWorld(eventIds?: readonly number[]) {
  const { collection, shop } = await fitSources();
  const [universe, events, metas] = await Promise.all([
    universeQuery(),
    eventIds
      ? db.select().from(tournaments).where(inArray(tournaments.id, [...eventIds]))
      : db.select().from(tournaments).where(and(eq(tournaments.retired, false), eq(tournaments.isDraft, false))),
    db.select().from(seriesMeta),
  ]);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  const club = (id: number) => /clubhouse/i.test(byId.get(id)?.title ?? "");
  const owned: Owned = collection ? await ownedAt(collection.id, club) : { base: new Set(), variant: new Map() };
  const current = (eventIds ? events : events.filter((t) => eventGroupOf(t) != null)).sort((a, b) => a.name.localeCompare(b.name));

  // His newest saved roster per event.
  const saved = current.length ? await db.select().from(rosters).where(inArray(rosters.tournamentId, current.map((t) => t.id))).orderBy(desc(rosters.updatedAt), desc(rosters.id)) : [];
  const newest = new Map<number, (typeof saved)[number]>();
  for (const r of saved) if (r.tournamentId != null && !newest.has(r.tournamentId)) newest.set(r.tournamentId, r);
  const slotRows = newest.size ? await db.select().from(rosterSlots).where(inArray(rosterSlots.rosterId, [...newest.values()].map((r) => r.id))) : [];

  const metaBy = new Map(metas.map((m) => [m.series, m]));
  // The field's handedness is left out where the series' exports predate the event's current format (as Build).
  const [book, staleSeries] = await Promise.all([
    observedBook(),
    Promise.all(current.map(async (t) => {
      const since = (t.restrictions as { formatSince?: string } | null)?.formatSince;
      return t.series && since && metaBy.has(t.series) && (await exportsPredate(t.series, since)).stale ? t.id : null;
    })).then((ids) => new Set(ids.filter((id): id is number => id != null))),
  ]);

  const allInputs = universe.map((c) => inputOf(c));
  const variantRatings = new Map<number, Record<string, number>>();
  for (const [id, v] of owned.variant) { const c = byId.get(id); if (c) variantRatings.set(id, formRatings(ratingsOf(c), v, c.position)); }
  return { collection, shop, universe, byId, owned, current, newest, slotRows, metaBy, book, staleSeries, allInputs, variantRatings };
}
export type FitWorld = Awaited<ReturnType<typeof fitWorld>>;
type FitTournament = FitWorld["current"][number];

const ratingsOf = (c: UniverseCard) => (c.ratings ?? {}) as Record<string, number>;
const inputOf = (c: UniverseCard, ratings = ratingsOf(c), id = c.cardId): EnvFitInput =>
  ({ cardId: id, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings });
const legalCard = (c: UniverseCard, rules: RosterRules) => cardEligibility({
  cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher ?? false, role: c.pitcherRole,
  cardType: c.cardType, le: c.cardSubType === "LE", ratings: ratingsOf(c), baseOwned: false, variantOwned: false,
}, rules).errors.length === 0;

/** An event's rules as roster-rules reads them, and its run environment. */
export function fitRules(t: FitTournament) {
  const rx = (t.restrictions ?? null) as RosterRules["restrictions"] & { notes?: string[]; formatSince?: string } | null;
  const rules: RosterRules = {
    name: t.name, dh: t.dh, ratingsMin: t.ratingsMin, ratingsMax: t.ratingsMax,
    cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, isDraft: t.isDraft, restrictions: rx,
  };
  const envYear = t.envYear ?? (rx?.notes?.includes("default RE") ? 2010 : null);
  return { rx, rules, envYear };
}

/** The event as the page's header shows it. */
export function fitEventOf(w: FitWorld, t: FitTournament): FitEvent {
  const { rx, envYear } = fitRules(t);
  const meta = t.series && !w.staleSeries.has(t.id) ? w.metaBy.get(t.series) ?? null : null;
  const lhp = meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const roster = w.newest.get(t.id);
  const slots = roster ? w.slotRows.filter((s) => s.rosterId === roster.id) : [];
  const tags: string[] = [];
  const types = rx?.cardTypes?.map(parseCardTypeRule);
  if (types?.length && types.every((x) => x)) tags.push((types.flat() as number[]).map((c) => CARD_TYPE_SHORT[c] ?? c).join("+"));
  if (t.cardYearMin != null || t.cardYearMax != null) tags.push(`cards ${range(t.cardYearMin, t.cardYearMax)}`);
  if (rx?.teamCap != null) tags.push(`cap ${rx.teamCap}`);
  if (rx?.slots) tags.push("slots");
  if (rx?.variantsAllowed === false || rx?.variantCap === 0) tags.push("no variants");
  else if (rx?.variantCap != null) tags.push(`variants ≤${rx.variantCap}`);
  if (rx?.noLimitedEdition) tags.push("no LE");
  const rosterValue = roster ? [...new Set(slots.map((s) => s.cardId))].reduce((sum, id) => sum + (w.byId.get(id)?.cardValue ?? 0), 0) : null;
  return {
    id: t.id, name: t.name, group: eventGroupOf(t) ?? t.name, tier: fitTier(t), window: rx?.slots && t.ratingsMax == null ? "slots" : range(t.ratingsMin, t.ratingsMax),
    env: `${envYear ?? "PT default"}${envYear ? " RE" : ""} · ${t.stadium ?? "no park listed"}`, rules: tags, dh: t.dh === true, lhp: Math.round(lhp * 100) / 100,
    team: roster ? { kind: "saved", name: roster.name } : { kind: "best" },
    cap: rx?.teamCap != null ? { cap: rx.teamCap, spare: rosterValue == null ? null : rx.teamCap - rosterValue } : null,
  };
}

/** The cards legal in an event (its value window, years, sets, LE rule). */
export function legalIn(w: FitWorld, t: FitTournament): Set<number> {
  const { rules } = fitRules(t);
  return new Set(w.universe.filter((c) => legalCard(c, rules)).map((c) => c.cardId));
}

/**
 * One event scored as Build reads it: every legal card, his forms and the
 * extra forms asked for, with observed play blended in; his team there; and
 * the room his roster has under the event's slots or cap.
 *
 * `assumeVariant`: base cards he owns, also scored as the variant he doesn't
 * have yet (form id -cardId, card-forms assumedVariantRatings), for the
 * Upgrades page. Those forms are not his: they are in `forms`, not `mine`.
 */
export function scoreFitEvent(w: FitWorld, t: FitTournament, legal: Set<number>, opts: { assumeVariant?: Iterable<number> } = {}) {
  const { rx, envYear } = fitRules(t);
  const era = eraFor(envYear)?.row ?? eraTable["0"];
  const parkPick = parkFor(t.stadium);
  const meta = t.series && !w.staleSeries.has(t.id) ? w.metaBy.get(t.series) ?? null : null;
  const lhp = meta?.lhpBfShare ?? LHP_SHARE_DEFAULT, lhb = meta?.lhbPaShare ?? 0.35;
  const opts2 = { era: era.rates, park: parkPick.row, roleTrust: ROLE_TRUST, leagueLhbShare: lhb, eraYear: envYear ?? 2010, runsOnly: true, tournamentTerms: true };
  const roster = w.newest.get(t.id);
  const slots = roster ? w.slotRows.filter((s) => s.rosterId === roster.id) : [];

  const base = envFitMaps(w.allInputs, opts2);
  const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id); return r == null || l == null ? null : (1 - lhp) * r + lhp * l; };
  const observed = observedRunsFrom(w.book, both, bothHands(base), { series: t.series, ratingsMax: t.ratingsMax });

  // The forms read with play blended in: every legal base card, his legal variants, the targets and his saved roster.
  const variantsOk = rx?.variantsAllowed !== false && rx?.variantCap !== 0;
  const want = new Set<number>(legal);
  const variantForms = new Set<number>();
  if (variantsOk) for (const id of w.variantRatings.keys()) if (legal.has(id)) variantForms.add(id);
  for (const s of slots) { if (s.useVariant && w.variantRatings.has(s.cardId)) variantForms.add(s.cardId); else want.add(s.cardId); }
  const assumed = new Set<number>();
  if (variantsOk) for (const id of opts.assumeVariant ?? []) if (legal.has(id) && !variantForms.has(id) && w.byId.has(id)) assumed.add(id);
  const inputs: EnvFitInput[] = [];
  const obs = new Map<number, ObservedRuns>();
  for (const id of want) { const c = w.byId.get(id); if (!c) continue; inputs.push(inputOf(c)); const o = observed.get(id); if (o) obs.set(id, o); }
  for (const id of variantForms) { const c = w.byId.get(id)!; inputs.push(inputOf(c, w.variantRatings.get(id), -id)); const o = observed.get(id); if (o) obs.set(-id, o); }
  for (const id of assumed) { const c = w.byId.get(id)!; inputs.push(inputOf(c, assumedVariantRatings(ratingsOf(c)), -id)); const o = observed.get(id); if (o) obs.set(-id, o); }
  // Two-way cards (lib/two-way): each form also in the role it isn't listed in (no observed line).
  for (const inp of [...inputs]) { const f = twoWayForm(inp); if (f) inputs.push(f); }
  // A base card reads as the catalogue pass read it, with its play blended in; only variants
  // and two-way forms need scoring again.
  const rescored = envFitMaps(inputs.filter((inp) => inp.cardId < 0 || isTwoWayForm(inp.cardId)), { ...opts2, observed: obs });
  const runsOf = (id: number): [number, number] | null => {
    const m = id < 0 || isTwoWayForm(id) ? rescored : base;
    const r = m.runsR.get(id), l = m.runsL.get(id);
    if (r == null || l == null) return null;
    const o = m === base ? obs.get(id) : undefined;
    const shift = o ? observedShift(r, l, o) : 0;
    return [r + shift, l + shift];
  };

  const forms = new Map<number, ScoredForm>();
  for (const inp of inputs) {
    const runs = runsOf(inp.cardId);
    if (!runs) continue;
    const c = w.byId.get(cardIdOf(inp.cardId))!;
    const role = inp.isPitcher ? armRole(isTwoWayForm(inp.cardId) ? null : c.pitcherRole, inp.ratings["Stamina"]) : null;
    // A reliever is priced as the pen slots price him: without the starters' stamina term (roster-objective penStaminaRuns).
    const pen = role === "RP" ? penStaminaRuns(inp.ratings["Stamina"]) : 0;
    const [r, l] = [runs[0] - pen, runs[1] - pen];
    const pos: ScoredForm["pos"] = {};
    if (!inp.isPitcher) for (const p of FIELD_POS) { const v = inp.ratings[`Pos Rating ${p}`]; if (v != null && v > 0) pos[p] = v; }
    const frame = inp.isPitcher ? undefined : inp.ratings.CatcherFrame;
    forms.set(inp.cardId, {
      id: inp.cardId, cardId: c.cardId, name: c.name, variant: inp.cardId < 0, isPitcher: inp.isPitcher,
      role, runsR: r, runsL: l, pos, ...(frame != null ? { frame } : {}), val: c.cardValue,
    });
  }
  const tw = teamWeights(envYear ?? 2010, { rationed: rationedEvent(t.restrictions as { teamCap?: number | null; slots?: Record<string, number> | null } | null) });
  // Arms priced as the builder prices them: the series' measured weights, split over the staff carried.
  const built = t.series && !w.staleSeries.has(t.id) ? (fieldConstruction as { series: Record<string, SeriesBuild> }).series[t.series] : undefined;
  const staff = staffPerTeam(built);
  const ctx: FitCtx = {
    eraYear: envYear ?? 2010,
    dh: t.dh === true, lhp, glove: gloveScale(era.rates) * tw.def, frm: tw.frm, pit: tw.pit, pitSp: tw.sp, pitRp: tw.rp,
    spWeight: built?.spWeight ?? null, rpWeight: built?.rpWeight ?? null,
    fieldSp: built?.spWeight != null ? staff?.sp ?? null : null, fieldRp: built?.rpWeight != null ? staff?.rp ?? null : null,
  };
  const pool = [...legal].flatMap((id) => [forms.get(id), forms.get(twoWayId(id))]).filter((f): f is ScoredForm => !!f);
  const mine = [
    ...pool.filter((f) => w.owned.base.has(f.cardId)),
    ...[...variantForms].filter((id) => legal.has(id)).flatMap((id) => [forms.get(-id), forms.get(-twoWayId(id))]).filter((f): f is ScoredForm => !!f),
  ];
  // A saved slot holds the card id: the variant's form when saved as one, and a two-way card's other form in the other role.
  const slotForm = (s: (typeof slots)[number]) => {
    const sign = s.useVariant && w.variantRatings.has(s.cardId) ? -1 : 1;
    return sign * formIdForSlot(s.cardId, s.slot, (id) => forms.get(sign * id));
  };
  const team = roster
    ? savedTeam(slots.map((s) => ({ formId: slotForm(s), slot: s.slot, versusHand: s.versusHand })), forms)
    : bestTeam(mine, ctx);

  // With no saved roster, his best team is built from his cards, so a card he owns is in it by
  // construction: it is placed against the team he would field without it.
  const inTeam = (id: number) => [...Object.values(team.R), ...Object.values(team.L), ...team.SP, ...team.RP].some((f) => f?.cardId === id);
  const teamFor = (id: number) => (!roster && inTeam(id) ? bestTeam(mine.filter((f) => f.cardId !== id), ctx) : team);

  // A slots or cap event holds the whole saved 26 (bench included) to its rules: Card Fit's swap must leave room.
  const room: Room | null = roster && (rx?.slots || rx?.teamCap != null) ? {
    slots: rx?.slots ?? null, cap: rx?.teamCap ?? null,
    roster: new Map(slots.map((s) => [s.cardId, { val: w.byId.get(s.cardId)?.cardValue ?? 0, name: w.byId.get(s.cardId)?.name ?? "?" }])),
    spares: mine,
  } : null;
  return { roster, slots, forms, pool, mine, team, teamFor, ctx, room, variantForms, assumed, meta, rx };
}
export type EventScore = ReturnType<typeof scoreFitEvent>;

/** Where card `id` fits in one scored event: its best form (his variant's where he has one), in whichever role helps more. */
export function placeIn(sc: EventScore, id: number, pool = sc.pool): { f: ScoredForm; fit: Fit } | null {
  // A two-way card is placed in whichever role it helps more (lib/two-way).
  return [id, twoWayId(id)]
    .map((fid) => (sc.variantForms.has(id) ? sc.forms.get(-fid) : null) ?? sc.forms.get(fid))
    .filter((g): g is ScoredForm => !!g)
    .map((g) => ({ f: g, fit: fitIn(g, sc.teamFor(id), pool, sc.ctx, sc.room) }))
    .filter((x): x is { f: ScoredForm; fit: Fit } => x.fit != null)
    .sort((a, b) => b.fit.gain - a.fit.gain || (a.fit.rank - 1) / a.fit.of - (b.fit.rank - 1) / b.fit.of)[0] ?? null;
}

export async function loadCardFit(targetIds: readonly number[]): Promise<CardFitData> {
  const w = await fitWorld();
  const targets = [...new Set(targetIds)];
  const snaps = w.shop && targets.length
    ? await db.select({ cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow, last10: cardSnapshots.last10, last10Variant: cardSnapshots.last10Variant })
      .from(cardSnapshots).where(and(eq(cardSnapshots.uploadId, w.shop.id), inArray(cardSnapshots.cardId, targets)))
    : [];

  const outEvents: FitEvent[] = [];
  const rowsBy = new Map<number, FitRow[]>(targets.map((id) => [id, []]));

  for (const t of w.current) {
    outEvents.push(fitEventOf(w, t));
    // Scoring an event is most of the cost (about 0.1 s each): none where no target is legal.
    const legal = legalIn(w, t);
    if (!targets.some((id) => legal.has(id))) continue;
    const sc = scoreFitEvent(w, t, legal);
    for (const id of targets) {
      if (!legal.has(id)) continue;
      const placed = placeIn(sc, id);
      if (!placed) continue;
      rowsBy.get(id)!.push(fitRow(w, t, sc, id, placed));
    }
  }

  const price = new Map(snaps.map((s) => [s.cardId, s]));
  const out: CardFitData["cards"] = [];
  for (const id of targets) {
    const card = fitCard(w, id, price.get(id));
    if (card) out.push({ card, rows: (rowsBy.get(id) ?? []).sort((a, b) => b.gain - a.gain || (a.rank - 1) / a.of - (b.rank - 1) / b.of) });
  }
  return { events: outEvents, cards: out, collectionDate: day(w.collection?.at), shopDate: day(w.shop?.at) };
}

/** A placed card as a row: its play in the series and, in a cap event, the value its top swap adds. */
export function fitRow(w: FitWorld, t: FitTournament, sc: EventScore, id: number, { f, fit }: { f: ScoredForm; fit: Fit }): FitRow {
  const outVal = fit.swaps.slice().sort((a, b) => b.delta - a.delta)[0]?.out?.val ?? null;
  return round({
    ...fit, eventId: t.id, variant: f.variant, played: t.series && sc.meta ? playedIn(w.book, id, t.series) : null,
    capCost: sc.rx?.teamCap != null && fit.status === "start" && f.val != null ? f.val - (outVal ?? 0) : null,
  });
}

/** The card's header facts: who it is, whether he owns it, what it costs. */
export function fitCard(w: FitWorld, id: number, p?: { ask: number | null; last10: number | null; last10Variant: number | null }): FitCard | null {
  const c = w.byId.get(id);
  if (!c) return null;
  const isP = c.isPitcher ?? false;
  return {
    id, name: c.name, val: c.cardValue, tier: c.tier, pos: c.position ?? "?", role: isP ? armRole(c.pitcherRole, ratingsOf(c)["Stamina"]) : null,
    hand: isP ? c.throws : c.bats, year: c.year, set: c.cardType, le: c.cardSubType === "LE", firstSeen: day(c.firstSeenAt)!,
    owned: { base: w.owned.base.has(id), variant: w.owned.variant.has(id) },
    ask: p?.ask && p.ask > 0 ? p.ask : null, last10: p?.last10 && p.last10 > 0 ? p.last10 : null,
    last10Variant: p?.last10Variant && p.last10Variant > 0 ? p.last10Variant : null,
  };
}

/** Every number to one decimal: the page shows no more, and the cached payload is a third the size. */
function round(r: FitRow): FitRow {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    ...r, runsR: r1(r.runsR), runsL: r1(r.runsL), value: r1(r.value), gain: r1(r.gain),
    swaps: r.swaps.map((s) => ({ ...s, delta: r1(s.delta) })),
    short: r.short ? { ...r.short, delta: r1(r.short.delta) } : null,
    room: r.room ? { ...r.room, gross: r1(r.room.gross), cost: r.room.cost == null ? null : r1(r.room.cost) } : null,
    played: r.played ? { n: Math.round(r.played.n), vsField: r1(r.played.vsField) } : null,
  };
}

/** A card's own line in one series: PA or BF, and runs per 700 above that series' field. */
function playedIn(book: ObservedBook, cardId: number, series: string): FitRow["played"] {
  const b = book.base.get(series);
  if (!b) return null;
  for (const l of book.lines) {
    if (Number(l.card_id) !== cardId || String(l.series) !== series) continue;
    if (l.is_pitcher) {
      const bf = Number(l.bf ?? 0), ip = Number(l.ip ?? 0);
      if (!(bf > 0) || l.fip == null || !(b.fip > 0)) return null;
      return { n: bf, vsField: (-((Number(l.fip) - b.fip) / 9) * ip / bf) * 700 };
    }
    const pa = Number(l.pa ?? 0);
    if (!(pa > 0) || l.woba == null || !(b.woba > 0)) return null;
    return { n: pa, vsField: ((Number(l.woba) - b.woba) / WOBA_SCALE) * 700 };
  }
  return null;
}
