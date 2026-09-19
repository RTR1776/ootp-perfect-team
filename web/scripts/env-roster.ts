/**
 * Build a roster for an event that is not in the catalogue, scored by the
 * /runenv model rather than the fixed league composite.
 *
 * Uses the SAME fill (lib/roster-fill), rules and validator as /build and
 * champ:rosters — only the fit maps change (lib/analytics/env-fit), so the cap
 * search, slot tiers, ownership and legality all behave identically.
 *
 *   pnpm env:roster --year 1979 --park "Louisville Slugger Field" --park-year 2026 \
 *     --dh --min 90 --max 100 --cap 2444 --size 26 --name "Cwhit Cap Challenge 5"
 *
 * --compare also prints what the old league-composite fit would have picked.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import {
  HIT_POS, fillOnce, fillRoster, fitMaps, isComplete, rosterShape, type FillCard, type FillShape,
} from "@/lib/roster-fill";
import { rosterSize, validateRoster, type RosterRules, type RosterSlot } from "@/lib/roster-rules";
import { cardEligibility } from "@/lib/roster-rules";
import { LJ_FLOOR, describePosFloor, parsePosFloor, posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { rosterObjective, LHP_SHARE_DEFAULT, RP_WEIGHT_DEFAULT, BENCH_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { seriesMeta } from "@/db/schema";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { hitterRates, marginalRatings, pitcherRates, rangeFlags } from "@/lib/analytics/card-value";
import { optimizeRoster } from "@/lib/roster-optimize";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";
import { matchEligible, readEligible } from "@/lib/ingest/eligible-pool";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

const YEAR = num("year");
const PARK = val("park") ?? null;
const PARK_YEAR = num("park-year");
const DH = flag("dh");
const MIN = num("min");
const MAX = num("max");
const CAP = num("cap");
const SIZE = num("size", 26)!;
const NAME = val("name", "ad-hoc event")!;
const VARIANT_CAP = num("variant-cap");
const YEAR_MIN = num("card-year-min");
const YEAR_MAX = num("card-year-max");
const COMPARE = flag("compare");
/** Path to an "eligible cards" export — replaces the DB collection snapshot. */
const POOL_CSV = val("pool") ?? null;
/**
 * Cards the roster must carry, by name. A missing one costs the objective
 * enough to dominate everything else, so hill-climbing pulls it in and then
 * repairs around it — which is also how you find out what it costs, since the
 * score difference against the free run IS the price of the conviction.
 */
const MUST = (val("must") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
/** Cards to exclude outright — for testing whether a headline card earns its points. */
const BAN = (val("ban") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
/**
 * --card-types 2,6,7: restrict the pool to OOTP's own card_type codes, for an
 * event that limits which KINDS of card may be used rather than their value.
 *
 * Saturday Diamond Variety is the case this exists for: "Only Negro League
 * Star+Future Legend+Snapshot may be used". Do not try to read the kind out of
 * the title — a Snapshot card is titled after its SET, so the field is full of
 * cards reading "Baseball Reference", "World Baseball Classic" and "Super
 * Utility" that are all card_type 7. Verified against the 121-team run 26
 * export: all 247 cards that played were type 2, 6 or 7 and nothing else.
 *
 *   2 Negro League Star · 6 Future Legend · 7 Snapshot
 */
const CARD_TYPES = new Set((val("card-types") ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0));
const OPTIMIZE = flag("optimize");
/**
 * --candidate-limit N: prune each slot to its N best candidates by runs
 * before hill-climbing (what /build does with 30, so the search finishes in
 * seconds in the browser). Unset = the full pool, as before.
 */
const CANDIDATE_LIMIT = num("candidate-limit");
/**
 * --field: score against the environment the FIELD will actually produce, not
 * the era's baseline. Tournaments do not normalize, so what plays is the era
 * rates pushed through the average eligible bat and the average eligible arm.
 * In a value-capped event those two do not cancel — cap the value at 100 and
 * you exclude the best bats while keeping excellent arms, so the field
 * suppresses the era and contact gains on power.
 */
const FIELD = flag("field");
const MIN_DEF = num("min-def", 0.6)!;
/**
 * --min-pos: hard floor on a position rating. Defaults to L.J.'s rule (pos-
 * floor.ts): 70 everywhere, 50 in left, none at first or DH. A bare number is
 * that floor everywhere but first; "70,1B:0,LF:50" sets it per position.
 */
const MIN_POS: PosFloor = parsePosFloor(val("min-pos")) ?? LJ_FLOOR;
/**
 * --role-trust: how much of the relief role bonus to believe. 1 is the fitted
 * constant; the archived exports say most of it is inherited-runner accounting
 * (see env-fit's roleTrust). Drop it and SP cards can win bullpen slots.
 */
const ROLE_TRUST = num("role-trust", 1)!;
/**
 * --obs-k: how many PA (or BF) of observed play it takes to count as much as
 * the model. 5000 is where held-out prediction peaks on the calibrated scale
 * (observed-blend.ts, pnpm observed:validate). 0 turns observed play off.
 */
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;
/**
 * --slots "G13,I13" — a slots event's per-tier maximums, as tier codes
 * P/D/G/S/B/I. A lower-tier card may fill a higher-tier slot, which is what
 * tierFitsSlots and slotCapacityIssues already implement, so this only has to
 * hand the shape over.
 *
 * Read off the field, not guessed: in Monday Wonky Historical Slots every team
 * that filled its roster carried exactly 13 cards at VAL 60+ and the rest Iron
 * (37 of 41), so the event is 13 high slots and 13 Iron slots.
 */
const SLOTS: Record<string, number> | null = (() => {
  const v = val("slots");
  if (!v) return null;
  const out: Record<string, number> = {};
  for (const part of v.split(/[,\s]+/).filter(Boolean)) {
    const m = /^([PDGSBI])(\d+)$/i.exec(part.trim());
    if (!m) throw new Error(`--slots: could not read "${part}" (want e.g. G13,I13)`);
    out[m[1].toUpperCase()] = Number(m[2]);
  }
  return out;
})();
/**
 * Playing-time weights for the objective. Defaults are the generic ones; both
 * are event-dependent and L.J. was right to push on them.
 *
 * --lhp-share: the share of plate appearances taken against left-handed
 *   pitching. 0.30 is the ordinary figure, but in a park that pays left-handed
 *   bats a run a game every roster in the field stacks lefties, and the
 *   counter to that is left-handed pitching — so the share faced climbs.
 * --rp-weight: a reliever's innings as a fraction of a starter's. MEASURED,
 *   not assumed: across 12,019 archived team-events with 10+ games, a starter
 *   faces 106.6 batters to a relief arm's 25.1 (0.24); in Gold Floor Cap
 *   specifically 89.2 to 27.7 (0.31). The old default of 0.5 bought roughly
 *   twice the bullpen the innings justify, which in a capped format is points
 *   taken off the lineup. 0.31 is the modern-era figure; pass 0.24 for a
 *   deadball or 1960s environment where starters go deeper still.
 */
const LHP_SHARE_FLAG = num("lhp-share");
const RP_WEIGHT = num("rp-weight", RP_WEIGHT_DEFAULT)!;
const BENCH_WEIGHT = num("bench-weight", BENCH_WEIGHT_DEFAULT)!;
/**
 * --series slug: read the field off its exports (series_meta) — the staff
 * shape teams actually run, the share of innings thrown left-handed (the
 * vs-LHP lineup's weight) and the share of PA taken by left-handed bats (an
 * arm's park blend). --lhp-share, --bats/--sp/--rp still override.
 */
const SERIES = val("series") ?? null;

const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[String(YEAR)] ?? eraTable["0"];
  if (!era) throw new Error(`no era row for ${YEAR}`);
  const pr = parkRow(PARK, PARK_YEAR);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);

  const rules: RosterRules = {
    name: NAME, dh: DH, ratingsMin: MIN, ratingsMax: MAX,
    cardYearMin: YEAR_MIN, cardYearMax: YEAR_MAX, isDraft: false,
    restrictions: { teamCap: CAP, cards: SIZE, variantCap: VARIANT_CAP, variantsAllowed: VARIANT_CAP !== 0, slots: SLOTS },
  };

  /* -------------------------------- the environment ------------------------ */
  const bp35 = pr ? blendPark(pr, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp35);
  const line = rateLine(bp35 ? applyPark(era.rates, bp35) : era.rates, solved.RG);
  console.log(`\n=== ${NAME} ===`);
  console.log(`${YEAR ?? "PT default"} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : " (neutral park)"} · DH ${DH ? "on" : "off"} · value ${MIN ?? "—"}–${MAX ?? "—"} · cap ${CAP ?? "none"} · ${SIZE} players`);
  console.log(`R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)}  OBP ${line.obp.toFixed(3)}  SLG ${line.slg.toFixed(3)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%  preset ${solved.preset}`);
  console.log(`sac bunt (1st & 2nd, 0 out) ${solved.bunt_12_0 >= 0 ? "+" : ""}${solved.bunt_12_0.toFixed(3)} runs · steal break-even ${(solved.sbbe0 * 100).toFixed(1)}% (0 out) / ${(solved.sbbe1 * 100).toFixed(1)}% (1 out)`);
  if (pr) {
    const rgL = solveEnv(era.rates, era.rg, blendPark(pr, 1)).RG;
    const rgR = solveEnv(era.rates, era.rg, blendPark(pr, 0)).RG;
    console.log(`park: all-LHB lineup ${rgL.toFixed(2)} R/G vs all-RHB ${rgR.toFixed(2)} — ${Math.abs(rgL - rgR).toFixed(2)} R/G swing toward ${rgL > rgR ? "LEFT" : "RIGHT"}-handed bats`);
  }

  /* ----------------------------------- the pool ---------------------------- */
  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads)
    .where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (!latest) throw new Error("no collection upload");
  const [shop] = await db.select({ id: uploads.id }).from(uploads)
    .where(eq(uploads.kind, "shop_list")).orderBy(desc(uploads.id)).limit(1);
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const ownedIds = [...new Set(owned.map((o) => o.cardId!))];
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  const prices = shop
    ? new Map((await db.select({ cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow })
        .from(cardSnapshots).where(eq(cardSnapshots.uploadId, shop.id))).map((p) => [p.cardId, p.ask]))
    : new Map<number, number | null>();

  type P = FillCard & { pos: string; tier: string; bats: string | null };
  const pool: P[] = [];

  if (POOL_CSV) {
    // The game already applied the event's filters to this export, so the file
    // IS the legal pool — no value window or ownership check to re-derive.
    const rows = readEligible(readFileSync(POOL_CSV, "utf8"));
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
        baseOwned: true, variantOwned: m.variant, variant: m.variant,
        pos: byId.get(m.cardId)?.position ?? "", tier: byId.get(m.cardId)?.tier ?? "", bats: m.bats,
      });
    }
    console.log(`pool from export: ${rows.length} rows -> ${pool.length} distinct cards${unmatched.length ? `; UNMATCHED (${unmatched.length}): ${unmatched.map((u) => `${u.name} ${u.value}`).join(", ")}` : "; all matched"}`);
  } else
  for (const cid of ownedIds) {
    const c = byId.get(cid);
    if (!c) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const useVariant = VARIANT_CAP !== 0 && vr != null;
    const ratings = useVariant ? formRatings(base, vr, c.position) : base;
    const card: P = {
      cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher,
      role: c.pitcherRole, cardType: c.cardType, ratings,
      baseOwned: baseSet.has(cid), variantOwned: vr != null,
      variant: useVariant || !baseSet.has(cid), pos: c.position ?? "", tier: c.tier ?? "", bats: c.bats,
    };
    if (card.variant && !card.variantOwned) continue;
    if (CARD_TYPES.size && !CARD_TYPES.has(Number(c.cardType))) continue;
    if (cardEligibility(card, rules).errors.length) continue;
    pool.push(card);
  }
  if (BAN.length) {
    const before = pool.length;
    for (let i = pool.length - 1; i >= 0; i--) if (BAN.includes(pool[i].name.toLowerCase())) pool.splice(i, 1);
    console.log(`banned ${before - pool.length}: ${BAN.join(", ")}`);
  }
  if (CARD_TYPES.size) console.log(`card types: restricted to ${[...CARD_TYPES].sort().join(", ")} (2 Negro League Star, 6 Future Legend, 7 Snapshot)`);
  const bats = pool.filter((c) => !c.isPitcher);
  console.log(`\npool: ${pool.length} eligible owned cards — ${bats.length} bats (${bats.filter((c) => c.bats === "L").length}L / ${bats.filter((c) => c.bats === "S").length}S / ${bats.filter((c) => c.bats === "R").length}R), ${pool.length - bats.length} arms`);

  /* --------------------------------- the shape ----------------------------- */
  const lineupPos = DH ? [...HIT_POS, "DH"] : [...HIT_POS];
  /**
   * --bats/--sp/--rp: the staff shape the FIELD actually runs, counted off an
   * archived export of the event rather than inferred from the era table. The
   * era table is a good prior and wrong at the edges: Monday Wonky is a 1945
   * environment, which says 4 starters, but the field runs 5 SP and 4 relief
   * because half the roster is Iron and an Iron arm throws real innings while
   * an Iron bench bat never comes off the bench.
   */
  const [meta] = SERIES ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, SERIES)) : [];
  if (SERIES && !meta) console.log(`!! no exports on record for series ${SERIES} — shape and handedness fall back to the era table`);
  const shapeMeta = (num("bats") != null || num("sp") != null || num("rp") != null)
    ? { avgBats: num("bats"), avgSp: num("sp"), avgRp: num("rp") }
    : meta ? { avgBats: meta.avgBats, avgSp: meta.avgSp, avgRp: meta.avgRp } : null;
  const LHP_SHARE = LHP_SHARE_FLAG ?? meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const LHB_SHARE = meta?.lhbPaShare ?? 0.35;
  if (meta) console.log(`field (${SERIES}, ${meta.files} exports): ${Math.round(LHP_SHARE * 100)}% of batters faced thrown left-handed · ${Math.round(LHB_SHARE * 100)}% of PA by left-handed bats · ${meta.avgBats} bats / ${meta.avgSp} SP / ${meta.avgRp} RP per team`);
  const shp = rosterShape(YEAR, lineupPos.length, rosterSize(rules) ?? SIZE, shapeMeta as any);
  const shape: FillShape = {
    lineupPos, bats: shp.bats,
    spKeys: Array.from({ length: shp.sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: shp.rp - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: shp.bats - lineupPos.length }, (_, i) => `BN${i + 1}`),
  };
  console.log(`shape: ${shp.bats} bats / ${shp.sp} SP / ${shp.rp} RP (${shp.band}) · out-of-position guard ${Math.round(MIN_DEF * 100)}% of best · glove floor ${describePosFloor(MIN_POS)} · defence priced in runs (fielding.json)`);

  let scoringRates = era.rates;
  if (FIELD) {
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
      console.log(`FIELD (unnormalized): K% ${(fl.kPct*100).toFixed(1)}  BB% ${(fl.bbPct*100).toFixed(1)}  HR/PA ${(fl.hrPa*100).toFixed(2)}%  OPS ${fl.ops.toFixed(3)}  bunt ${fenv.bunt_12_0>=0?"+":""}${fenv.bunt_12_0.toFixed(3)}  steal BE ${(fenv.sbbe0*100).toFixed(1)}%  preset ${fenv.preset}`);
      console.log(`  avg eligible bat: ${HK.map(k=>`${k} ${aB[k].toFixed(0)}`).join(" ")}`);
      console.log(`  avg eligible arm: ${PK.map(k=>`${k} ${aP[k].toFixed(0)}`).join(" ")}`);
    }
  }
  /**
   * Observed play. The level of each series is built from the model's own
   * runs over EVERY card that played it, so the universe is scored once at
   * the target environment (no observed, no floor - it is only the zero
   * point) before the pool is scored with the blend.
   */
  let observed: Map<number, { runs: number; n: number }> | undefined;
  if (OBS_K > 0) {
    const all = universe.map((c) => ({
      cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole,
      ratings: (c.ratings ?? {}) as Record<string, number>,
    }));
    const base = envFitMaps(all, { era: scoringRates, park: pr, roleTrust: ROLE_TRUST, leagueLhbShare: LHB_SHARE });
    const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id); return r == null || l == null ? null : 0.7 * r + 0.3 * l; };
    observed = await loadObservedRuns(pool.map((c) => c.cardId), both);
    const n = [...observed.values()];
    console.log(`observed play: ${n.length} of ${pool.length} pool cards have innings on record (median ${n.length ? Math.round(n.map((x) => x.n).sort((a, b) => a - b)[n.length >> 1]) : 0} PA/BF); K = ${OBS_K}`);
  }
  const fits = envFitMaps(pool, { era: scoringRates, park: pr, minPosRating: MIN_POS, roleTrust: ROLE_TRUST, observed, observedK: OBS_K, leagueLhbShare: LHB_SHARE });
  console.log(`\n+10 rating, runs/700 PA — LHB: ${marginalRatings(fits.envLeft, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                          RHB: ${marginalRatings(fits.envRight, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                         arms: ${marginalRatings(fits.envPitch, "pit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);

  /* ---------------------------------- the fill ----------------------------- */
  /**
   * `fillRoster` searches λ for the SMALLEST penalty that still completes the
   * roster — it stops at legal, not at best. With --optimize we sweep λ, keep
   * every complete legal roster, and score each on expected runs: hitters at
   * 70% vs RHP / 30% vs LHP, starters full, relievers half (fewer innings).
   * Bench bats are counted at a tenth — they are insurance, not production.
   */
  const mustIds = new Set(
    MUST.map((n) => pool.find((c) => c.name.toLowerCase() === n.toLowerCase())?.cardId).filter((x): x is number => x != null),
  );
  if (MUST.length) console.log(`must carry: ${MUST.join(", ")} -> ${mustIds.size} matched`);

  /**
   * Defence in runs, per 700 PA, from the card's rating at the slot's position
   * (fielding.ts: measured on the archive, ≈0.155 runs per point at 2B, 0.138
   * at SS, 0.133 at 3B, 0.125 at 1B, 0.086 RF, 0.079 LF, 0.057 CF, 0.032 C).
   * Until 2026-09-16 the optimiser priced gloves at zero and gated them only
   * by the floor, so a +9 bat beat a +38 glove at second every time.
   */
  const { objective, rank, defAt } = rosterObjective(pool, {
    shape, runsR: fits.runsR, runsL: fits.runsL, lhpShare: LHP_SHARE, rpWeight: RP_WEIGHT, benchWeight: BENCH_WEIGHT, mustIds,
  });
  void defAt;

  let { slots, lambda } = fillRoster(pool, rules, shape, fits);
  const greedyScore = objective(slots);
  if (OPTIMIZE) {
    /** Distinct complete rosters across the λ range, as hill-climb starts. */
    const starts = new Map<string, { slots: Record<string, number>; lambda: number }>();
    // --starts N: how finely to sample λ (default 64 steps over 0..8). Fewer
    // starts is the lever when a run has to fit a time budget.
    const N_STARTS = num("starts", 64)!;
    for (let i = 0; i <= N_STARTS; i++) {
      const lam = (i / N_STARTS) * 8;
      const r = fillOnce(pool, rules, shape, fits, lam);
      if (!isComplete(r, shape)) continue;
      starts.set([...new Set(Object.values(r))].sort((a, b) => a - b).join(","), { slots: r, lambda: lam });
    }

    let best = { slots, score: greedyScore, from: lambda, moves: 0 };
    for (const [, st] of starts) {
      const r = optimizeRoster(st.slots, pool, rules, shape, {
        objective, minDefShare: MIN_DEF, posFloor: MIN_POS, pairMoves: { aTop: 10, bCheapest: 12, rank }, maxPasses: 80,
        candidateLimit: CANDIDATE_LIMIT ?? undefined,
      });
      if (r.score > best.score) best = { slots: r.slots, score: r.score, from: st.lambda, moves: r.moves };
    }
    console.log(`\noptimiser: ${starts.size} λ starts hill-climbed; best ${best.score.toFixed(1)} runs vs ${greedyScore.toFixed(1)} greedy (+${(best.score - greedyScore).toFixed(1)}), ${best.moves} moves from λ ${best.from.toFixed(2)}`);
    slots = best.slots; lambda = best.from;
  }
  const poolById = new Map(pool.map((c) => [c.cardId, c]));
  const out: RosterSlot[] = Object.entries(slots).map(([k, cardId]) => {
    const [a, b] = k.split(":");
    return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false };
  });
  const v = validateRoster(out, pool, rules);

  /**
   * Defence is only 17% of the fit, so a huge bat can win a slot he has no
   * business playing. The DEF column is the card's rating AT the slot beside
   * his best rating anywhere, and it is flagged when the gap is ugly — the
   * model does not price a butchered position, so that call stays with L.J.
   */
  const row = (key: string, board: "R" | "L" | null) => {
    const cid = slots[key];
    const c = cid != null ? poolById.get(cid) : undefined;
    if (!c) return `${key.padEnd(7)} —`;
    const runs = board === "L" ? fits.runsL.get(c.cardId) : fits.runsR.get(c.cardId);
    const side = !c.isPitcher && board ? (batsLeftOn(c.bats, board) ? "park:L" : "park:R") : "";
    let def = "";
    if (!c.isPitcher) {
      const pos = key.split(":")[1];
      if (pos && pos !== "DH" && !pos.startsWith("BN")) {
        const here = c.ratings[`Pos Rating ${pos}`] ?? 0;
        const best = Math.max(...HIT_POS.map((p) => c.ratings[`Pos Rating ${p}`] ?? 0));
        const dr = fieldingRuns(pos, here);
        def = ` DEF ${String(Math.round(here)).padStart(3)}/${String(Math.round(best)).padStart(3)} ${(dr >= 0 ? "+" : "") + dr.toFixed(1)}${here < best * 0.6 ? " <-- out of position" : ""}${here < posFloorAt(MIN_POS, pos) ? " <-- under floor" : ""}`;
      }
    }
    // An arm shows its label and stamina: a bullpen slot filled by an SP card
    // is the whole point of --role-trust, and it has to be visible at a glance.
    const arm = c.isPitcher
      ? ` ${String(c.role ?? "").padEnd(2)} STM ${String(Math.round(c.ratings["Stamina"] ?? 0)).padStart(3)}`
      : "";
    return `${key.padEnd(7)} ${(c.name + (c.variant ? " (VAR)" : "")).padEnd(26)} ${String(c.val).padStart(3)}  ${(c.bats ?? "-").padEnd(2)} ${String(c.year ?? "").padEnd(5)} ${runs == null ? "" : f1(runs).padStart(6)}  ${side}${def}${arm}`;
  };

  console.log(`\n--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)`);
  for (const p of lineupPos) console.log(row(`R:${p}`, "R"));
  console.log(`\n--- lineup vs LHP ---`);
  for (const p of lineupPos) console.log(row(`L:${p}`, "L"));
  console.log(`\n--- rotation ---`);
  for (const k of shape.spKeys) console.log(row(k, "R"));
  console.log(`\n--- bullpen ---`);
  for (const k of shape.rpKeys) console.log(row(k, "R"));
  console.log(`\n--- bench ---`);
  for (const k of shape.benchKeys) console.log(row(k, "R"));

  const rostered = [...new Set(Object.values(slots))].map((id) => poolById.get(id)!).filter(Boolean);
  const totalVal = rostered.reduce((n, c) => n + (c.val ?? 0), 0);
  const lhbStarters = lineupPos.filter((p) => { const c = poolById.get(slots[`R:${p}`]); return c && batsLeftOn(c.bats, "R"); }).length;
  console.log(`\n${rostered.length} players · value ${totalVal}${CAP ? ` / ${CAP} (${CAP - totalVal} spare)` : ""} · λ ${lambda.toFixed(3)} · ${rostered.filter((c) => c.variant).length} variants`);
  console.log(`vs RHP lineup gets the friendly park side in ${lhbStarters} of ${lineupPos.length} spots`);
  const bats2 = rostered.filter((c) => !c.isPitcher);
  console.log(`\n--- order inputs (rostered bats) ---`);
  for (const c of bats2.sort((a, b) => (fits.runsR.get(b.cardId) ?? 0) - (fits.runsR.get(a.cardId) ?? 0))) {
    const r = c.ratings;
    const g = (k: string) => Math.round(r[k] ?? 0);
    console.log(`  ${c.name.padEnd(22)} ${(c.bats ?? "-")} EYE ${String(g("Eye")).padStart(3)} (${g("Eye vL")}/${g("Eye vR")})  POW ${String(g("Power")).padStart(3)} (${g("Power vL")}/${g("Power vR")})  K ${String(g("Avoid Ks")).padStart(3)}  BABIP ${String(g("BABIP")).padStart(3)}  GAP ${String(g("Gap")).padStart(3)}  SPE ${String(g("Speed")).padStart(3)}`);
  }
  console.log(v.ready ? "LEGAL — every rule check passes" : `NOT READY: ${[...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  const spend = rostered.filter((c) => (prices.get(c.cardId) ?? 0) > 0).length;
  if (spend) console.log(`(${spend} of ${rostered.length} have a live ask in the last shop snapshot)`);
  console.log(`objective: ${objective(slots).toFixed(1)} weighted runs (bats ${Math.round((1-LHP_SHARE)*100)}/${Math.round(LHP_SHARE*100)} R/L, SP 1.0, RP ${RP_WEIGHT}, bench ${BENCH_WEIGHT})`);
  const group = (keys: string[]) => keys.map((k) => poolById.get(slots[k])).filter(Boolean).reduce((n, c) => n + (c!.val ?? 0), 0);
  const lineupIds = new Set(lineupPos.flatMap((p) => [slots[`R:${p}`], slots[`L:${p}`]]).filter((x) => x != null));
  const lineupVal = [...lineupIds].map((id) => poolById.get(id)?.val ?? 0).reduce((a, b) => a + b, 0);
  console.log(`points: lineup(both boards, ${lineupIds.size} bats) ${lineupVal} · rotation ${group([...shape.spKeys])} · bullpen ${group([...shape.rpKeys])} · bench-only ${totalVal - lineupVal - group([...shape.spKeys]) - group([...shape.rpKeys])}`);

  /* --------------------------- extrapolation warnings ---------------------- */
  const flagged = rostered
    .map((c) => ({ c, f: rangeFlags(c.ratings, c.isPitcher ? "pit" : "hit") }))
    .filter((x) => x.f.length > 0);
  if (flagged.length) {
    console.log(`\n!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:`);
    for (const { c, f } of flagged)
      console.log(`   ${c.name.padEnd(24)} ${f.map((x) => `${x.rating} ${x.value} (fitted ${x.fitted[0]}–${x.fitted[1]})`).join(", ")}`);
  }

  /* ------------------------------- the comparison -------------------------- */
  if (COMPARE) {
    const old = fillRoster(pool, rules, shape, fitMaps(pool));
    const oldIds = new Set(Object.values(old.slots)), newIds = new Set(Object.values(slots));
    const added = [...newIds].filter((i) => !oldIds.has(i)).map((i) => poolById.get(i)!);
    const dropped = [...oldIds].filter((i) => !newIds.has(i)).map((i) => poolById.get(i)!);
    console.log(`\n--- vs the old league-composite fit ---`);
    console.log(`in : ${added.map((c) => `${c.name} (${c.bats ?? "-"}, ${c.val})`).join(", ") || "—"}`);
    console.log(`out: ${dropped.map((c) => `${c.name} (${c.bats ?? "-"}, ${c.val})`).join(", ") || "—"}`);
  }
}

main().then(() => process.exit(0));
