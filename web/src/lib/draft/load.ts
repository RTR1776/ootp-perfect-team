/**
 * The draft helper's data for one event, built on the server once per page
 * load: every legal card scored in the event's run environment and park
 * exactly as Card Fit and Build score them (env-fit runs, role trust 0.25,
 * the tournament terms), and the event's price of a run at each slot.
 *
 * Observed play is left out: the production blend (OBS_K 1,000,000) moves a
 * card by under 1% of the gap even with 10k PA on record.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, seriesMeta, tournaments } from "@/db/schema";
import { envFitMaps, type EnvFitInput } from "@/lib/analytics/env-fit";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { gloveScale } from "@/lib/analytics/fielding";
import { teamWeights } from "@/lib/analytics/calibration";
import { armRole } from "@/lib/card-fit";
import { cardEligibility, type RosterRules } from "@/lib/roster-rules";
import { BENCH_SLOTS, BENCH_WEIGHT_DEFAULT, LHP_SHARE_DEFAULT, RP_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { eraStaff } from "@/lib/roster-fill";
import { staffPerTeam, type SeriesBuild } from "@/lib/field-construction";
import { canHit, twoWayForm, twoWayId } from "@/lib/two-way";
import { isTier } from "@/lib/tiers";
import fieldConstruction from "@/data/field-construction.json";
import { formatFor, groupOf, type DraftFormat } from "@/lib/draft/formats";
import { FIELD, type DraftCard, type DraftCtx, type FieldPos } from "@/lib/draft/engine";
import { studyFor, type StudySeries } from "@/lib/draft/study";

const ROLE_TRUST = 0.25;

/** Where each weight came from, for the page's "how a run pays here" line. */
export interface Weights {
  tw: { def: number; frm: number; sp: number; rp: number };
  /** The series' measured BF per starter / reliever over a lineup slot's PA, and the field's staff. */
  spWeight: number;
  rpWeight: number;
  staff: { sp: number; rp: number } | null;
  source: string;
}

export interface DraftData {
  format: DraftFormat;
  env: { label: string; park: string; lhp: number; lhb: number; fieldFrom: string };
  /** The catalogue row as it stands, and each place it differs from the format's settings. */
  catalogue: { envYear: number | null; dh: boolean | null; stadium: string | null; entrants: number | null };
  differences: string[];
  ctx: DraftCtx;
  weights: Weights;
  cards: DraftCard[];
  study: StudySeries | null;
}

/** What the page sends the browser: the study without its per-card lists (each card carries its own share and seen). */
export type DraftPageData = Omit<DraftData, "study"> & { study: Omit<StudySeries, "shares" | "seen" | "out"> | null };

export function pageData(d: DraftData): DraftPageData {
  if (!d.study) return { ...d, study: null };
  const { shares: _shares, seen: _seen, out: _out, ...study } = d.study;
  void _shares; void _seen; void _out;
  return { ...d, study };
}

/**
 * The slot prices for a format, as the builder prices a roster
 * (env-roster / Card Fit): glove = balls-in-play scale × the era's glove
 * weight; one starter = the series' BF per start over a lineup slot's PA ×
 * the era's starter weight × the field's starters / ours; the same for the pen;
 * the bench at most 0.1 a bat and 0.33 in all. Staff size is L.J.'s era table
 * (roster-fill eraStaff: pre-1930 4 SP / 5 RP).
 */
export function draftCtx(f: DraftFormat, o: {
  gloveScale: number; lhp: number; spWeight: number | null; rpWeight: number | null; staff: { sp: number; rp: number } | null;
}): { ctx: DraftCtx; tw: Weights["tw"] } {
  const tw = teamWeights(f.envYear);
  const { sp, rp } = eraStaff(f.envYear);
  const lineup = 8 + (f.dh ? 1 : 0);
  const bench = Math.max(0, f.cards - lineup - sp - rp);
  const share = (field: number | undefined, ours: number) => (field != null && field > 0 && ours > 0 ? field / ours : 1);
  return {
    tw,
    ctx: {
      dh: f.dh, lhp: o.lhp, glove: o.gloveScale * tw.def, frm: tw.frm, eraYear: f.envYear, sp, rp, bench,
      spW: (o.spWeight ?? 1) * tw.sp * share(o.staff?.sp, sp),
      rpW: (o.rpWeight ?? RP_WEIGHT_DEFAULT) * tw.rp * share(o.staff?.rp, rp),
      benchW: Math.min(BENCH_WEIGHT_DEFAULT, bench > 0 ? BENCH_SLOTS / bench : BENCH_WEIGHT_DEFAULT),
    },
  };
}

/** The field as measured off the current format's exports; scripts/draft-study.ts passes its fresh read here. */
export type FieldRead = Pick<StudySeries, "files" | "lhpBfShare" | "lhbPaShare" | "spWeight" | "rpWeight" | "staff" | "seen" | "seenThrough" | "out">;

export async function loadDraft(series: string, field?: FieldRead): Promise<DraftData | null> {
  const format = formatFor(series);
  if (!format) return null;
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, format.eventId));
  if (!t) return null;
  const [meta] = await db.select().from(seriesMeta).where(eq(seriesMeta.series, series));
  const saved = studyFor(series);
  const study = field ?? saved;

  const differences: string[] = [];
  if (t.envYear !== format.envYear) differences.push(`run environment ${t.envYear ?? "none"} in the catalogue, ${format.envYear} here`);
  if ((t.dh ?? false) !== format.dh) differences.push(`DH ${t.dh ? "on" : "off"} in the catalogue, ${format.dh ? "on" : "off"} here`);
  if (t.entrants != null && t.entrants !== format.teams) differences.push(`${t.entrants} teams in the catalogue, ${format.teams} here`);

  const era = eraFor(format.envYear)?.row ?? eraTable["0"];
  const park = parkFor(t.stadium);
  // The field's hands off the current format's exports (the study) before the importer's older read.
  const lhp = study?.lhpBfShare ?? meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const lhb = study?.lhbPaShare ?? meta?.lhbPaShare ?? 0.35;
  const fieldFrom = study?.lhpBfShare != null ? `the ${study.files.length} current-format exports` : meta?.lhpBfShare != null ? "series_meta" : "defaults";

  const built = (fieldConstruction as { series: Record<string, SeriesBuild> }).series[series];
  const spWeight = study?.spWeight ?? built?.spWeight ?? null;
  const rpWeight = study?.rpWeight ?? built?.rpWeight ?? null;
  const staff = study?.staff ?? staffPerTeam(built);
  const { ctx, tw } = draftCtx(format, { gloveScale: gloveScale(era.rates), lhp, spWeight, rpWeight, staff });
  const weights: Weights = {
    tw, spWeight: spWeight ?? 1, rpWeight: rpWeight ?? RP_WEIGHT_DEFAULT, staff,
    source: study?.spWeight != null ? "current-format exports" : built?.spWeight != null ? "field-construction.json" : "defaults",
  };

  const rules: RosterRules = {
    name: t.name, dh: format.dh, ratingsMin: t.ratingsMin, ratingsMax: t.ratingsMax,
    cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, isDraft: true,
    restrictions: (t.restrictions ?? {}) as RosterRules["restrictions"],
  };
  const universe = await db.select({
    cardId: cards.cardId, name: cards.name, tier: cards.tier, cardValue: cards.cardValue, position: cards.position,
    pitcherRole: cards.pitcherRole, isPitcher: cards.isPitcher, bats: cards.bats, throws: cards.throws, year: cards.year,
    cardType: cards.cardType, cardSubType: cards.cardSubType, brefId: cards.brefId, ratings: cards.ratings, firstSeenAt: cards.firstSeenAt,
  }).from(cards);
  const legal = universe.filter((c) => isTier(c.tier) && cardEligibility({
    cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher, role: c.pitcherRole,
    cardType: c.cardType, le: c.cardSubType === "LE", ratings: c.ratings, baseOwned: false, variantOwned: false,
  }, rules).errors.length === 0);

  const inputs: EnvFitInput[] = legal.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole, ratings: c.ratings }));
  // With no DH a pitcher bats: score the bat of every arm that can hit (lib/two-way).
  if (!format.dh) for (const inp of [...inputs]) if (inp.isPitcher && canHit(inp.ratings)) { const f = twoWayForm(inp); if (f) inputs.push(f); }
  const fit = envFitMaps(inputs, {
    era: era.rates, park: park.row, roleTrust: ROLE_TRUST, leagueLhbShare: lhb, eraYear: format.envYear, runsOnly: true, tournamentTerms: true,
  });

  // What the field drafted lately: a card nobody took may be out of the rotating pool (engine.ts Engine.absent).
  const seen = study?.seen?.length ? new Set(study.seen) : null;
  const dropped = new Set(study?.out ?? []);
  const through = study?.seenThrough ? Date.parse(`${study.seenThrough}T00:00:00Z`) : null;
  const out: DraftCard[] = [];
  for (const c of legal) {
    const runsR = fit.runsR.get(c.cardId), runsL = fit.runsL.get(c.cardId);
    if (runsR == null || runsL == null) continue;
    const r = c.ratings;
    const role = c.isPitcher ? armRole(c.pitcherRole, r["Stamina"]) : null;
    const group = groupOf({ isPitcher: c.isPitcher, position: c.position, role });
    if (!group) continue;
    const pos: DraftCard["pos"] = {};
    if (!c.isPitcher) for (const p of FIELD) { const v = r[`Pos Rating ${p}`]; if (v != null && v > 0) pos[p as FieldPos] = v; }
    const card: DraftCard = {
      id: c.cardId, name: c.name, tier: c.tier as DraftCard["tier"], val: c.cardValue, group, isPitcher: c.isPitcher, role,
      hand: c.isPitcher ? c.throws : c.bats, year: c.year, player: c.brefId, runsR, runsL, pos,
    };
    if (!c.isPitcher && r.CatcherFrame != null) card.frame = r.CatcherFrame;
    if (c.isPitcher && r.Stamina != null) card.stamina = r.Stamina;
    if (c.isPitcher && !format.dh) {
      const br = fit.runsR.get(twoWayId(c.cardId)), bl = fit.runsL.get(twoWayId(c.cardId));
      if (br != null && bl != null) { card.batR = br; card.batL = bl; }
    }
    const s = saved?.shares[String(c.cardId)];
    if (s != null) card.share = s;
    if (seen) {
      if (seen.has(c.cardId)) card.seen = true;
      else if (through == null || c.firstSeenAt.getTime() < through) card.seen = false;
    }
    if (dropped.has(c.cardId)) card.out = true;
    out.push(card);
  }
  out.sort((a, b) => b.val - a.val || a.name.localeCompare(b.name));

  return {
    format,
    env: {
      label: `${format.envYear} run environment`,
      park: park.label,
      lhp, lhb, fieldFrom,
    },
    catalogue: { envYear: t.envYear, dh: t.dh, stadium: t.stadium, entrants: t.entrants },
    differences,
    ctx, weights, cards: out, study: saved,
  };
}
