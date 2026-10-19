/**
 * One event's model, from the command line: its flags, its legal pool, and
 * the objective a roster is scored on. env-roster builds with it and
 * roster-diff scores with it, so the two cannot drift apart again.
 *
 * They did: roster-diff carried its own copy of env-roster's setup from
 * 2026-09-26, and every term env-roster gained after (team weights, staff
 * weights, the glove scale, slot tiers, one card per player, the tournament
 * terms, the observed blend's series, the backup and long-man checks) was
 * missing from it. On Monday Wonky Historical Slots (2026-10-19) it scored
 * env-roster's 292.4-run optimum at 160.8 and proposed +20 runs of swaps.
 *
 * Server-only (reads the database); the flags themselves are lib/event-flags.
 */
export { readEventFlags, eventRules, type EventFlags } from "@/lib/event-flags";
import { readFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, seriesMeta, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { HIT_POS, rosterShape, type FillCard, type FillShape } from "@/lib/roster-fill";
import { cardEligibility, rosterSize, type RosterRules } from "@/lib/roster-rules";
import { describePosFloor } from "@/lib/pos-floor";
import type { EventFlags } from "@/lib/event-flags";
import { gloveScale } from "@/lib/analytics/fielding";
import { rosterObjective, LHP_SHARE_DEFAULT, RP_WEIGHT_DEFAULT, type RosterObjective } from "@/lib/roster-objective";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { loadObservedRuns } from "@/lib/analytics/observed-blend";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { eraFor } from "@/lib/analytics/tournament-env";
import { hitterRates, pitcherRates } from "@/lib/analytics/card-value";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";
import { matchEligible, readEligible } from "@/lib/ingest/eligible-pool";
import { impliedBaseCopies } from "@/lib/ingest/collection";
import { teamWeights } from "@/lib/analytics/calibration";
import { staffPerTeam, topShape, type SeriesBuild } from "@/lib/field-construction";
import { setRuleGuard } from "@/lib/set-evidence";
import { cardTypeNames } from "@/lib/card-sets";
import { loadSetEvidence } from "@/lib/set-evidence-server";
import { twoWayForm } from "@/lib/two-way";
import type { OptimizeOptions } from "@/lib/roster-optimize";
import fieldConstruction from "../data/field-construction.json";

type Log = (line: string) => void;

/**
 * The era row and park. 2010 is databotai's label for PT's default engine, so
 * it reads the default row, as /build and the catalogue do (eraFor).
 * eraTable["2010"] is MLB's 2010 (K 18.5% against the default's 22.6%).
 */
export function eventEnv(f: EventFlags) {
  const era = (f.year != null ? eraFor(f.year)?.row : undefined) ?? eraTable["0"];
  if (!era) throw new Error(`no era row for ${f.year}`);
  return { era, pr: parkRow(f.park, f.parkYear) };
}

export type EventCard = FillCard & { pos: string; tier: string; bats: string | null };
type CardRow = typeof cards.$inferSelect;

export interface EventPool {
  pool: EventCard[];
  universe: CardRow[];
  byId: Map<number, CardRow>;
}

/**
 * The legal pool: the latest collection upload (or --pool / --pool-ids), each
 * card in its best owned form, filtered by the event's rules, plus two-way
 * cards' other role. Stops the process when the set guard trips.
 */
export async function loadEventPool(f: EventFlags, rules: RosterRules, log: Log = console.log): Promise<EventPool> {
  // A series whose field plays only a few sets (or one card year) almost
  // always has a set rule the flags must repeat; stop rather than build from
  // every set. An eligible-cards export (--pool) already carries the game's filter.
  if (f.series && !f.poolCsv) {
    const stop = setRuleGuard(f.series, await loadSetEvidence(f.series), {
      cardTypes: f.cardTypes.size > 0, cardYears: f.yearMin != null || f.yearMax != null, cardYearMax: f.yearMax, anySet: f.anySet,
    });
    if (stop) { console.error(`\n!! ${stop}`); process.exit(1); }
  }
  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads)
    .where(eq(uploads.kind, "collection")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1);
  if (!latest) throw new Error("no collection upload");
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  // A variant listed without its base implies the base (ingest/collection), for
  // an upload filed before the importer added those rows itself.
  const baseSet = new Set([
    ...owned.filter((o) => !o.isVariant).map((o) => o.cardId!),
    ...impliedBaseCopies(owned, (id) => /clubhouse/i.test(byId.get(id)?.title ?? "")),
  ]);
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  /*
   * --assume-variant id[,id]: a variant he is about to buy, scored before he owns it. Its
   * ratings are his base copy's export scaled by the variant boost measured on his own
   * variants (Cliff Lee, Al Leiter, 2026-09-30: +8% on STU, CON, HRA and PBABIP, both
   * splits; hitters' BA, GAP, POW, EYE and K likewise). Never for a save: the copy isn't owned.
   */
  for (const id of f.assumeVariant) {
    const base = owned.find((o) => o.cardId === id && !o.isVariant)?.ratings as Record<string, number> | undefined;
    if (!base) { log(`!! --assume-variant ${id}: no base copy in the collection to scale`); continue; }
    const scaled: Record<string, number> = { ...base };
    for (const [k, v] of Object.entries(base)) if (typeof v === "number" && /^(STU|CON|HRA|PBABIP|BA|GAP|POW|EYE|K) v[LR]$/.test(k)) scaled[k] = Math.round(v * 1.08);
    variants.set(id, scaled);
    log(`assumed variant ${id}: base export x1.08 on the split ratings`);
  }
  for (const id of f.assumeOwned) {
    if (!byId.has(id)) { log(`!! --assume-owned ${id}: no such card`); continue; }
    baseSet.add(id);
    log(`assumed owned ${id} ${byId.get(id)!.name} ${byId.get(id)!.cardValue}: bought, not yet in the collection upload`);
  }
  if (f.poolIds.length) {
    baseSet.clear(); variants.clear();
    for (const id of f.poolIds) if (byId.has(id)) baseSet.add(id); else log(`!! --pool-ids ${id}: no such card`);
    log(`pool: exactly ${baseSet.size} listed cards (--pool-ids), base copies`);
  }
  const ownedIds = f.poolIds.length ? [...baseSet] : [...new Set([...owned.map((o) => o.cardId!), ...f.assumeOwned.filter((id) => byId.has(id))])];

  const pool: EventCard[] = [];
  if (f.poolCsv) {
    // The game already applied the event's filters to this export, so the file
    // IS the legal pool — no value window or ownership check to re-derive.
    const rows = readEligible(readFileSync(f.poolCsv, "utf8"));
    const { matched, unmatched } = matchEligible(rows, universe.map((c) => ({
      cardId: c.cardId, name: c.name, cardValue: c.cardValue, year: c.year,
      position: c.position, pitcherRole: c.pitcherRole, isPitcher: c.isPitcher,
      bats: c.bats, cardType: c.cardType, ratings: (c.ratings ?? {}) as Record<string, number>,
    })));
    // A base and its variant share a card id; keep the better (variant) form.
    const best = new Map<number, typeof matched[number]>();
    for (const m of matched) {
      const prev = best.get(m.cardId);
      if (!prev || (m.variant && !prev.variant)) best.set(m.cardId, m);
    }
    for (const m of best.values()) {
      pool.push({
        cardId: m.cardId, name: m.name, val: m.val, year: m.year, isPitcher: m.isPitcher,
        role: m.role, cardType: m.cardType, ratings: m.ratings,
        baseOwned: true, variantOwned: m.variant, variant: m.variant, player: byId.get(m.cardId)?.brefId ?? null,
        pos: byId.get(m.cardId)?.position ?? "", tier: byId.get(m.cardId)?.tier ?? "", bats: m.bats,
      });
    }
    log(`pool from export: ${rows.length} rows -> ${pool.length} distinct cards${unmatched.length ? `; UNMATCHED (${unmatched.length}): ${unmatched.map((u) => `${u.name} ${u.value}`).join(", ")}` : "; all matched"}`);
  } else
  for (const cid of ownedIds) {
    const c = byId.get(cid);
    if (!c) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const useVariant = f.variantCap !== 0 && vr != null;
    const ratings = useVariant ? formRatings(base, vr, c.position) : base;
    const card: EventCard = {
      cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher,
      role: c.pitcherRole, cardType: c.cardType, le: c.cardSubType === "LE", ratings,
      baseOwned: baseSet.has(cid), variantOwned: vr != null, player: c.brefId,
      variant: useVariant || !baseSet.has(cid), pos: c.position ?? "", tier: c.tier ?? "", bats: c.bats,
    };
    if (card.variant && !card.variantOwned) continue;
    if (f.cardTypes.size && !f.cardTypes.has(Number(c.cardType))) continue;
    if (cardEligibility(card, rules).errors.length) continue;
    pool.push(card);
  }
  if (f.ban.length) {
    const before = pool.length;
    for (let i = pool.length - 1; i >= 0; i--) if (f.ban.includes(pool[i].name.toLowerCase())) pool.splice(i, 1);
    log(`banned ${before - pool.length}: ${f.ban.join(", ")}`);
  }
  if (f.cardTypes.size) log(`card sets: ${cardTypeNames([...f.cardTypes])} only`);
  // Two-way cards (lib/two-way): each also enters in the role it isn't listed in.
  {
    const forms = pool.map((c) => { const t = twoWayForm(c); return t ? { ...t, pos: t.isPitcher ? "P" : "DH" } : null; }).filter((t): t is EventCard => t != null);
    pool.push(...forms);
    if (forms.length) log(`two-way: ${forms.length} card${forms.length === 1 ? "" : "s"} also in the other role — ${forms.map((t) => `${t.name} as ${t.isPitcher ? "arm" : "bat"}`).join(", ")}`);
  }
  const bats = pool.filter((c) => !c.isPitcher);
  log(`\npool: ${pool.length} eligible owned cards — ${bats.length} bats (${bats.filter((c) => c.bats === "L").length}L / ${bats.filter((c) => c.bats === "S").length}S / ${bats.filter((c) => c.bats === "R").length}R), ${pool.length - bats.length} arms`);
  return { pool, universe, byId };
}

export interface EventModel extends RosterObjective {
  era: ReturnType<typeof eventEnv>["era"];
  pr: ReturnType<typeof eventEnv>["pr"];
  /** The era's rates, or the field's under --field. */
  scoringRates: ReturnType<typeof eventEnv>["era"]["rates"];
  meta: typeof seriesMeta.$inferSelect | undefined;
  shape: FillShape;
  lineupPos: string[];
  fits: ReturnType<typeof envFitMaps>;
  lhpShare: number;
  lhbShare: number;
  /** The objective's weights, after the series' staff weights and the era's team weights. */
  spWeight: number;
  rpWeight: number;
  benchWeight: number;
  glove: number;
  fieldSp: number | null;
  fieldRp: number | null;
}

/**
 * The event's shape, fit maps and objective, logged the way env-roster prints
 * them. `shapeOverride` replaces the staff counts (roster-diff reads them off
 * the roster file); otherwise --bats/--sp/--rp, then the field's best quarter,
 * then the series' average, then the era table.
 */
export async function eventModel(
  f: EventFlags, rules: RosterRules, { pool, universe }: EventPool,
  o: { log?: Log; mustIds?: ReadonlySet<number>; shapeOverride?: { bats: number; sp: number; rp: number } | null } = {},
): Promise<EventModel> {
  const log = o.log ?? console.log;
  const { era, pr } = eventEnv(f);
  const bp35 = pr ? blendPark(pr, 0.35) : null;
  const lineupPos = f.dh ? [...HIT_POS, "DH"] : [...HIT_POS];
  /*
   * --bats/--sp/--rp: the staff shape the FIELD actually runs, counted off an
   * archived export of the event rather than inferred from the era table.
   */
  const [meta] = f.series ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, f.series)) : [];
  const built = f.series ? (fieldConstruction as { series: Record<string, SeriesBuild> }).series[f.series] : undefined;
  let spWeight = f.spWeight ?? 1, rpWeight = f.rpWeight ?? RP_WEIGHT_DEFAULT;
  if (built?.spWeight != null && f.spWeight == null) spWeight = built.spWeight;
  if (built?.rpWeight != null && f.rpWeight == null) rpWeight = built.rpWeight;
  if (built) log(`staff weights from ${f.series}'s exports: SP ${spWeight}, RP ${rpWeight} (a lineup slot = 1)`);
  /* The field's staff size the weights were measured at: the rotation's and the
     pen's innings are fixed, so they are split over the arms this roster carries. */
  const fieldStaff = built ? staffPerTeam(built) : null;
  const fieldSp = f.spWeight == null && built?.spWeight != null ? fieldStaff?.sp ?? null : null;
  const fieldRp = f.rpWeight == null && built?.rpWeight != null ? fieldStaff?.rp ?? null : null;
  if (f.series && !meta) log(`!! no exports on record for series ${f.series} — shape and handedness fall back to the era table`);
  const shapeGiven = f.bats != null || f.sp != null || f.rp != null;
  const shapeMeta = shapeGiven
    ? { avgBats: f.bats, avgSp: f.sp, avgRp: f.rp }
    : topShape(built) ?? (meta ? { avgBats: meta.avgBats, avgSp: meta.avgSp, avgRp: meta.avgRp } : null);
  const lhpShare = f.lhpShare ?? meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const lhbShare = f.lhbShare ?? meta?.lhbPaShare ?? 0.35;
  if (f.lhbShare != null || f.lhpShare != null) log(`field hands set by flag: ${Math.round(lhpShare * 100)}% of batters faced thrown left-handed · ${Math.round(lhbShare * 100)}% of PA by left-handed bats`);
  if (meta) log(`field (${f.series}, ${meta.files} exports): ${Math.round(lhpShare * 100)}% of batters faced thrown left-handed · ${Math.round(lhbShare * 100)}% of PA by left-handed bats · ${meta.avgBats} bats / ${meta.avgSp} SP / ${meta.avgRp} RP per team`);
  const shp = o.shapeOverride
    ? { ...o.shapeOverride, band: "as loaded" }
    : rosterShape(f.year, lineupPos.length, rosterSize(rules) ?? f.size, shapeMeta as Parameters<typeof rosterShape>[3], f.yearMin, shapeGiven);
  const shape: FillShape = {
    lineupPos, bats: shp.bats,
    spKeys: Array.from({ length: shp.sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: shp.rp - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: shp.bats - lineupPos.length }, (_, i) => `BN${i + 1}`),
  };
  log(`shape: ${shp.bats} bats / ${shp.sp} SP / ${shp.rp} RP (${shp.band}) · out-of-position guard ${Math.round(f.minDef * 100)}% of best · glove floor ${describePosFloor(f.minPos)} · defence priced in runs (fielding.json)`);

  let scoringRates = era.rates;
  if (f.field) {
    const HK = ["Avoid Ks", "Eye", "Power", "Gap", "BABIP"], PK = ["Stuff", "Control", "pHR", "pBABIP"];
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
    const avgOf = (set: typeof pool, keys: string[]) => Object.fromEntries(keys.map((k) =>
      [k, mean(set.map((c) => c.ratings[k]).filter((v) => typeof v === "number" && v > 0))]));
    const aB = avgOf(pool.filter((c) => !c.isPitcher), HK);
    const aP = avgOf(pool.filter((c) => c.isPitcher), PK);
    const bR = hitterRates(aB, era.rates, "all"), pRt = pitcherRates(aP, era.rates, "all");
    if (bR && pRt) {
      const q = (a: number, b: number) => (b === 0 ? 1 : a / b);
      scoringRates = {
        K: era.rates.K * q(bR.K, era.rates.K) * q(pRt.K, era.rates.K),
        BB: era.rates.BB * q(bR.BB, era.rates.BB) * q(pRt.BB, era.rates.BB),
        HBP: era.rates.HBP,
        HR: era.rates.HR * q(bR.HR, era.rates.HR) * q(pRt.HR, era.rates.HR),
        B2: era.rates.B2 * q(bR.B2, era.rates.B2),
        B3: era.rates.B3 * q(bR.B3, era.rates.B3),
        BABIP: era.rates.BABIP * q(bR.BABIP, era.rates.BABIP) * q(pRt.BABIP, era.rates.BABIP),
      };
      const fl = rateLine(bp35 ? applyPark(scoringRates, bp35) : scoringRates, 0);
      const fenv = solveEnv(scoringRates, era.rg, bp35);
      log(`FIELD (unnormalized): K% ${(fl.kPct*100).toFixed(1)}  BB% ${(fl.bbPct*100).toFixed(1)}  HR/PA ${(fl.hrPa*100).toFixed(2)}%  OPS ${fl.ops.toFixed(3)}  bunt ${fenv.bunt_12_0>=0?"+":""}${fenv.bunt_12_0.toFixed(3)}  steal BE ${(fenv.sbbe0*100).toFixed(1)}%  preset ${fenv.preset}`);
      log(`  avg eligible bat: ${HK.map(k=>`${k} ${aB[k].toFixed(0)}`).join(" ")}`);
      log(`  avg eligible arm: ${PK.map(k=>`${k} ${aP[k].toFixed(0)}`).join(" ")}`);
    }
  }
  /**
   * Observed play. The level of each series is built from the model's own
   * runs over EVERY card that played it, so the universe is scored once at
   * the target environment (no observed, no floor - it is only the zero
   * point) before the pool is scored with the blend.
   */
  let observed: Map<number, { runs: number; n: number }> | undefined;
  if (f.obsK > 0) {
    const all = universe.map((c) => ({
      cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole,
      ratings: (c.ratings ?? {}) as Record<string, number>,
    }));
    const base = envFitMaps(all, { era: scoringRates, park: pr, roleTrust: f.roleTrust, leagueLhbShare: lhbShare, eraYear: f.eraYear, tournamentTerms: true });
    const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id); return r == null || l == null ? null : 0.7 * r + 0.3 * l; };
    // `both` is already env-fit's 0.7 R / 0.3 L read, so it is also the reference that lets a variant keep its boost.
    observed = await loadObservedRuns(pool.map((c) => c.cardId), both, both, f.obsExclude, { series: f.series, ratingsMax: f.max });
    const n = [...observed.values()];
    log(`observed play: ${n.length} of ${pool.length} pool cards have innings on record (median ${n.length ? Math.round(n.map((x) => x.n).sort((a, b) => a - b)[n.length >> 1]) : 0} PA/BF); K = ${f.obsK}${f.obsExclude.length ? `; left out: ${f.obsExclude.join(", ")}` : ""}`);
  }
  const fits = envFitMaps(pool, { era: scoringRates, park: pr, minPosRating: f.minPos, roleTrust: f.roleTrust, observed, observedK: f.obsK, leagueLhbShare: lhbShare, eraYear: f.eraYear, tournamentTerms: true, ...(f.pitchLhb != null ? { pitchLhbShare: f.pitchLhb } : {}) });
  let glove = f.noGloveScale ? 1 : gloveScale(scoringRates);
  log(`gloves ×${glove.toFixed(2)}: balls in play in this environment against the fit's archive (fielding.ts gloveScale)${f.noGloveScale ? " — off (--no-glove-scale)" : ""}`);
  // Team weights (calibration.ts TEAM_WEIGHTS): a glove run and a pitching run against a bat run, by era.
  if (!f.noTeamWeights) {
    const tw = teamWeights(f.year ?? 2010);
    glove *= tw.def; spWeight *= tw.sp; rpWeight *= tw.rp;
    log(`team weights (${f.year ?? 2010} band): gloves ×${tw.def}, starters ×${tw.sp}, pen ×${tw.rp} against a bat run → glove ×${glove.toFixed(2)}, SP ${spWeight.toFixed(2)}, RP ${rpWeight.toFixed(2)} (--no-team-weights to turn off)`);
  }
  if (fieldSp != null || fieldRp != null) {
    const sp = shape.spKeys.length, rp = shape.rpKeys.length;
    log(`staff innings split over the arms carried: the field runs ${fieldSp?.toFixed(1) ?? "?"} SP / ${fieldRp?.toFixed(1) ?? "?"} RP → per SP ×${fieldSp ? (fieldSp / sp).toFixed(2) : "1"} (${sp} carried), per RP ×${fieldRp ? (fieldRp / rp).toFixed(2) : "1"} (${rp} carried)`);
  }
  const obj = rosterObjective(pool, {
    eraYear: f.eraYear, shape, runsR: fits.runsR, runsL: fits.runsL, lhpShare, rpWeight, benchWeight: f.benchWeight, spWeight, fieldSp, fieldRp, gloveScale: glove, mustIds: o.mustIds,
  });
  return {
    ...obj, era, pr, scoringRates, meta, shape, lineupPos, fits, lhpShare, lhbShare,
    spWeight, rpWeight, benchWeight: f.benchWeight, glove, fieldSp, fieldRp,
  };
}

/** The hill-climb's settings, as env-roster's optimiser runs it; `maxPasses` is the caller's. */
export function climbOptions(f: EventFlags, m: EventModel): OptimizeOptions {
  return {
    objective: m.objective, slotValue: m.slotValue, minDefShare: f.minDef, posFloor: f.minPos, pairMoves: { aTop: 10, bCheapest: 12, rank: m.rank }, maxPasses: 80,
    candidateLimit: f.candidateLimit ?? undefined, minCatchers: f.minCatchers, minShortstops: f.minShortstops, minLongMen: f.minLongMen, backups: f.backups,
  };
}
