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
import { cardSnapshots, uploads } from "@/db/schema";
import { HIT_POS, fillOnce, fillRoster, fitMaps, isComplete } from "@/lib/roster-fill";
import { validateRoster, type RosterSlot } from "@/lib/roster-rules";
import { posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import { batsLeftOn } from "@/lib/analytics/env-fit";
import { PT_DEFAULT_ENV_YEAR } from "@/lib/analytics/tournament-env";
import { hitterRates, marginalRatings, rangeFlags } from "@/lib/analytics/card-value";
import { optimizeRoster } from "@/lib/roster-optimize";
import { runSearch, toPlainFits, type SearchBest } from "@/lib/roster-search";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";
import { readFileSync } from "node:fs";
import { bestOrder, orderEnv, paLine, pitcherLine, shrink } from "@/lib/batting-order";
import { calibrationSlope } from "@/lib/analytics/calibration";
import fieldConstruction from "../src/data/field-construction.json";
import { auditRoster, orderStaff } from "../src/lib/roster-audit";
import { DEF_SUB_RUNS, depthChart, type DepthCard } from "../src/lib/depth-chart";
import { climbOptions, eventEnv, eventModel, eventRules, loadEventPool, readEventFlags } from "@/lib/event-model";
import { cardIdOf, formIdForSlot, isTwoWayForm } from "@/lib/two-way";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

/*
 * The flags that set the pool and the objective are read by lib/event-model
 * (readEventFlags), which roster-diff shares; their notes stay here with the
 * rest, so some below have no constant of their own.
 */
const F = readEventFlags(argv);
const YEAR = F.year;
/** The era correction (calibration.ts ERA_SLOPES) is on unless --no-era-correct; PT default reads as 2010. */
const ERA_YEAR = F.eraYear;
const PARK = F.park;
const PARK_YEAR = F.parkYear;
const DH = F.dh;
const MIN = F.min;
const MAX = F.max;
const CAP = F.cap;
const SIZE = F.size;
const NAME = F.name;
const COMPARE = flag("compare");
/** --pool FILE: an "eligible cards" export — replaces the DB collection snapshot. */
/**
 * Cards the roster must carry, by name. A missing one costs the objective
 * enough to dominate everything else, so hill-climbing pulls it in and then
 * repairs around it — which is also how you find out what it costs, since the
 * score difference against the free run IS the price of the conviction.
 */
/** --assume-owned id[,id]: base cards he has bought but not yet uploaded, scored as owned. Never for a save. */
/**
 * --pool-ids id[,id]: score and arrange exactly these cards, owned or not (a
 * drafted roster: L.J.'s PTCS 7 Championship PD drafts, 2026-10-10). Replaces
 * the collection; each card plays as its base copy.
 */
const MUST = (val("must") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
/** --show "Name,Name": print the model's runs for these owned cards in this event, whether or not they make the roster. */
const SHOW = (val("show") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
/** Cards to exclude outright — for testing whether a headline card earns its points. */
/**
 * --no-le: the event's rules line says "No LE" (Friday Nightmare Cap from
 * 2026-10-02). Limited Edition cards (card_sub_type "LE") stay out of the pool.
 *
 * --card-types 2,6,7: restrict the pool to OOTP's own card_type codes, for an
 * event that limits which KINDS of card may be used rather than their value.
 * With --series, a field that plays three sets or fewer (or one card year)
 * stops the run until --card-types / --card-year-min/max or --any-set is given.
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
const OPTIMIZE = flag("optimize");
/** --compare-search: also run /build's Optimise and Search longer (lib/roster-search) on the same inputs and print their scores. */
const COMPARE_SEARCH = flag("compare-search") || flag("compare-only");
/** --compare-only: /build's searches only, without the CLI's own λ climbs (its score was measured already). */
const COMPARE_ONLY = flag("compare-only");
/** Catchers the optimiser must carry. L.J. always carries two, and /build defaults to it; --min-catchers 0 turns it off. */
const MIN_CATCHERS = F.minCatchers;
/**
 * Shortstops the optimiser must carry (L.J. 2026-10-04: a backup SS). Off by default since 10-17: the
 * backups check now asks for a true backup at every position, SS included, and a utility card can be
 * it (L.J.: "I know we have two SS ... I don't want to be that restrictive"). --min-ss 2 turns it on.
 */
const MIN_SS = F.minShortstops;
/** Long men (pen arms with stamina ≥ 45) the optimiser must carry (L.J. 2026-10-04); --min-long 0 turns it off. */
const MIN_LONG = F.minLongMen;
/** A backup at every fielding position (L.J. 2026-10-04); --no-backups turns it off. */
const BACKUPS = F.backups;
/**
 * --seed <load file>: hill-climb from this roster too (a saved roster's load
 * file: "R:C Name #id" / "SP1 Name #id" / "BN1 Name #id" lines). When new cards
 * arrive the best roster is usually the saved one plus a swap or two, so one
 * climb from it finds what a dozen λ starts from scratch do, in a fraction of
 * the time (L.J. 10-08: "how can we more quickly update rosters when cards
 * come out"). Cards no longer in the pool are dropped and the board refilled
 * around the rest. Pair it with a small --starts as a cross-check.
 */
const SEED = val("seed") ?? null;
/** The λ a seeded start reports (it was not filled at any λ). */
const SEED_LAMBDA = -1;
/**
 * --candidate-limit N: prune each slot to its N best candidates by runs
 * before hill-climbing (what /build does with 30, so the search finishes in
 * seconds in the browser). Unset = the full pool, as before.
 */
/**
 * --field: score against the environment the FIELD will actually produce, not
 * the era's baseline. Tournaments do not normalize, so what plays is the era
 * rates pushed through the average eligible bat and the average eligible arm.
 * In a value-capped event those two do not cancel — cap the value at 100 and
 * you exclude the best bats while keeping excellent arms, so the field
 * suppresses the era and contact gains on power.
 */
/**
 * --min-pos: hard floor on a position rating. Defaults to L.J.'s rule (pos-
 * floor.ts): 70 everywhere, 50 in left, none at first or DH. A bare number is
 * that floor everywhere but first; "70,1B:0,LF:50" sets it per position.
 */
const MIN_POS: PosFloor = F.minPos;
/**
 * --role-trust: how much of the relief role bonus to believe. 1 is the fitted
 * constant; the archived exports say most of it is inherited-runner accounting
 * (see env-fit's roleTrust). Drop it and SP cards can win bullpen slots.
 */
/**
 * --obs-k: how many PA (or BF) of observed play it takes to count as much as
 * the model. 5000 is where held-out prediction peaks on the calibrated scale
 * (observed-blend.ts, pnpm observed:validate). 0 turns observed play off.
 */
/**
 * --obs-exclude "bronzeweekly": series left out of every card's observed play.
 * For an event whose format just changed: its own exports on file describe the
 * old format, so they should not count even as play elsewhere.
 */
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
/** --lhb-share: share of the field's PA taken by left-handed bats, for an event with no exports (default: the series' own, else 0.35). */
/** --pitch-lhb: share of a pitcher's batters who hit left, for blending his vL/vR lines (default 0.45). */
/**
 * --rp-weight / --sp-weight: a reliever's / starter's batters faced as a
 * multiple of a lineup slot's PA (roster-objective). With --series they
 * default to what that series measured (src/data/field-construction.json,
 * written by import:observed), else 0.31 / 1.0.
 */
/** --no-glove-scale: price gloves at the archive average whatever the era's balls in play. */
/**
 * --series slug: read the field off its exports (series_meta) — the staff
 * shape teams actually run, the share of innings thrown left-handed (the
 * vs-LHP lineup's weight) and the share of PA taken by left-handed bats (an
 * arm's park blend). --lhp-share, --bats/--sp/--rp still override.
 */
const SERIES = F.series;

const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const { era, pr } = eventEnv(F);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);
  const rules = eventRules(F);

  /* -------------------------------- the environment ------------------------ */
  const bp35 = pr ? blendPark(pr, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp35);
  const line = rateLine(bp35 ? applyPark(era.rates, bp35) : era.rates, solved.RG);
  console.log(`\n=== ${NAME} ===`);
  console.log(`${YEAR == null ? "PT default" : YEAR === PT_DEFAULT_ENV_YEAR ? "PT default (2010)" : YEAR} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : " (neutral park)"} · DH ${DH ? "on" : "off"} · value ${MIN ?? "—"}–${MAX ?? "—"} · cap ${CAP ?? "none"} · ${SIZE} players`);
  console.log(`R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)}  OBP ${line.obp.toFixed(3)}  SLG ${line.slg.toFixed(3)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%  preset ${solved.preset}`);
  console.log(`sac bunt (1st & 2nd, 0 out) ${solved.bunt_12_0 >= 0 ? "+" : ""}${solved.bunt_12_0.toFixed(3)} runs · steal break-even ${(solved.sbbe0 * 100).toFixed(1)}% (0 out) / ${(solved.sbbe1 * 100).toFixed(1)}% (1 out)`);
  if (pr) {
    const rgL = solveEnv(era.rates, era.rg, blendPark(pr, 1)).RG;
    const rgR = solveEnv(era.rates, era.rg, blendPark(pr, 0)).RG;
    console.log(`park: all-LHB lineup ${rgL.toFixed(2)} R/G vs all-RHB ${rgR.toFixed(2)} — ${Math.abs(rgL - rgR).toFixed(2)} R/G swing toward ${rgL > rgR ? "LEFT" : "RIGHT"}-handed bats`);
  }

  /* ----------------------------------- the pool ---------------------------- */
  const ev = await loadEventPool(F, rules);
  const { pool } = ev;
  const [shop] = await db.select({ id: uploads.id }).from(uploads)
    .where(eq(uploads.kind, "shop_list")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1);
  const prices = shop
    ? new Map((await db.select({ cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow })
        .from(cardSnapshots).where(eq(cardSnapshots.uploadId, shop.id))).map((p) => [p.cardId, p.ask]))
    : new Map<number, number | null>();

  /**
   * `fillRoster` searches λ for the SMALLEST penalty that still completes the
   * roster — it stops at legal, not at best. With --optimize we sweep λ, keep
   * every complete legal roster, and score each on expected runs: hitters at
   * 70% vs RHP / 30% vs LHP, starters full, relievers half (fewer innings).
   * Bench bats are counted at a tenth — they are insurance, not production.
   */
  const mustIds = new Set(
    // "#84648" pins a card id, for a name that matches more than one owned card (a Live base and an FLF variant).
    MUST.map((n) => pool.find((c) => (/^#\d+$/.test(n) ? c.cardId === Number(n.slice(1)) : c.name.toLowerCase() === n.toLowerCase()))?.cardId)
      .filter((x): x is number => x != null),
  );
  if (MUST.length) console.log(`must carry: ${MUST.join(", ")} -> ${mustIds.size} matched`);

  /* ------------------------- the shape, the fit and the objective ---------- */
  // lib/event-model: the field's shape, observed play, the fit maps, and the
  // objective with every weight (series staff weights, the glove scale, the
  // era's team weights). roster-diff scores on the same one.
  const model = await eventModel(F, rules, ev, { mustIds });
  const { shape, lineupPos, scoringRates, fits, lhpShare: LHP_SHARE, spWeight: SP_WEIGHT, rpWeight: RP_WEIGHT, benchWeight: BENCH_WEIGHT, glove: GLOVE, fieldSp: FIELD_SP, fieldRp: FIELD_RP } = model;
  const { objective } = model;
  if (SHOW.length) {
    console.log("--- shown ---   (runs/700 PA or BF in this event; pitchers: one number)");
    for (const c of pool.filter((x) => SHOW.some((n) => x.name.toLowerCase().includes(n))).sort((a, b) => (fits.runsR.get(b.cardId) ?? 0) - (fits.runsR.get(a.cardId) ?? 0))) {
      const r = fits.runsR.get(c.cardId), l = fits.runsL.get(c.cardId);
      console.log(`  ${c.name.padEnd(22)} ${String(c.val).padStart(3)} ${c.isPitcher ? "P" : "B"} ${c.bats ?? "-"}  ${c.isPitcher ? (r ?? 0).toFixed(1) : `vR ${(r ?? 0).toFixed(1)}  vL ${(l ?? 0).toFixed(1)}`}`);
    }
  }
  console.log(`\n+10 rating, runs/700 PA — LHB: ${marginalRatings(fits.envLeft, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                          RHB: ${marginalRatings(fits.envRight, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                         arms: ${marginalRatings(fits.envPitch, "pit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);

  /**
   * The --seed roster as a hill-climb start: its own slots when every card is
   * still in the pool and every slot of this shape is filled, else a fill that
   * must carry the seed's surviving cards (the climb then sorts out where they
   * go). Null, with the reason printed, when neither gives a complete board.
   */
  function seedStart(path: string): Record<string, number> | null {
    const lines = readFileSync(path, "utf8").split("\n").map((l) => /^(\S+)\s.*#(\d+)\s*$/.exec(l.trim())).filter((m): m is RegExpExecArray => m != null && !m[1]!.startsWith("#"));
    const byIdSeed = new Map(pool.map((c) => [c.cardId, c]));
    // A saved slot holds the card id; a two-way card's arm (or bat) slot means its other form.
    for (const m of lines) m[2] = String(formIdForSlot(Number(m[2]), m[1]!, (id) => byIdSeed.get(id)));
    const kept = lines.filter((m) => byIdSeed.has(Number(m[2])));
    const gone = lines.length - kept.length;
    // A Live card's ratings move: a seed slot the card can no longer play
    // (Tatis Jr. lost 3B in the 10-14 update) would start the climb from an
    // illegal board it cannot leave. Refill around it instead, keeping the card.
    const misplaced = kept.filter((m) => {
      const pos = m[1]!.includes(":") ? m[1]!.split(":")[1] : m[1]!;
      return HIT_POS.includes(pos as (typeof HIT_POS)[number]) && (byIdSeed.get(Number(m[2]))?.ratings[`Pos Rating ${pos}`] ?? 0) <= 0;
    }).length;
    const direct = Object.fromEntries(kept.map((m) => [m[1]!, Number(m[2])]));
    if (!gone && !misplaced && isComplete(direct, shape)) { console.log(`seed: ${path.split("/").pop()} as is (${new Set(Object.values(direct)).size} cards)`); return direct; }
    if (misplaced) console.log(`seed: ${misplaced} slot${misplaced === 1 ? "" : "s"} now held by a card that can no longer play there (a ratings update); refilling`);
    const must = new Set(kept.map((m) => Number(m[2])));
    for (const lam of [0, 0.5, 1, 2, 4, 8]) {
      const r = fillOnce(pool, rules, shape, fits, lam, must);
      if (isComplete(r, shape)) {
        console.log(`seed: ${path.split("/").pop()} refilled at λ ${lam} (${gone} card${gone === 1 ? "" : "s"} no longer in the pool; shape ${isComplete(direct, shape) ? "matches" : "differs"})`);
        return r;
      }
    }
    console.log(`!! seed: ${path.split("/").pop()} could not be completed for this shape; λ starts only`);
    return null;
  }

  let { slots, lambda } = fillRoster(pool, rules, shape, fits);
  const greedyScore = objective(slots);
  if (OPTIMIZE) {
    /** Distinct complete rosters across the λ range, as hill-climb starts. */
    const starts = new Map<string, { slots: Record<string, number>; lambda: number }>();
    // --starts N: how finely to sample λ (default 64 steps over 0..8). Fewer
    // starts is the lever when a run has to fit a time budget.
    const N_STARTS = num("starts", 64)!;
    for (let i = 0; i <= N_STARTS; i++) {
      const lam = N_STARTS > 0 ? (i / N_STARTS) * 8 : 0;
      const r = fillOnce(pool, rules, shape, fits, lam);
      if (!isComplete(r, shape)) continue;
      starts.set([...new Set(Object.values(r))].sort((a, b) => a - b).join(","), { slots: r, lambda: lam });
    }
    if (SEED) {
      const seed = seedStart(SEED);
      if (seed) starts.set("seed", { slots: seed, lambda: SEED_LAMBDA });
    }

    let best = { slots, score: greedyScore, from: lambda, moves: 0 };
    let seedScore: number | null = null;
    for (const [, st] of COMPARE_ONLY ? [] : starts) {
      const r = optimizeRoster(st.slots, pool, rules, shape, climbOptions(F, model));
      if (st.lambda === SEED_LAMBDA) seedScore = r.score;
      if (r.score > best.score) best = { slots: r.slots, score: r.score, from: st.lambda, moves: r.moves };
    }
    let deepBoard: Record<string, number> | null = null;
    if (COMPARE_SEARCH) {
      /* /build's own search (roster-search: Optimise = quick, Search longer = deep) on these same
         inputs, from the greedy fill as "your board", scored on the same objective. */
      for (const mode of ["quick", "deep"] as const) {
        const t0 = Date.now();
        let done: SearchBest | null = null;
        runSearch({ mode, board: slots, pool, rules, shape, fits: toPlainFits(fits), runsR: [...fits.runsR], runsL: [...fits.runsL],
          lhpShare: LHP_SHARE, spWeight: SP_WEIGHT, rpWeight: RP_WEIGHT, fieldSp: FIELD_SP, fieldRp: FIELD_RP, gloveScale: GLOVE, locks: [], minCatchers: MIN_CATCHERS, minShortstops: MIN_SS, minLongMen: MIN_LONG, backups: BACKUPS },
          (m) => { if (m.type === "done") done = m.best; }, () => Date.now());
        const b = done as SearchBest | null;
        if (mode === "deep" && b) deepBoard = b.slots;
        console.log(`compare-search: /build ${mode === "quick" ? "Optimise" : "Search longer"} ${b ? objective(b.slots).toFixed(1) : "none"} runs (from ${b?.from ?? "-"}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
    console.log(`\noptimiser: ${starts.size} ${starts.has("seed") ? "starts (λ + seed)" : "λ starts"} hill-climbed; best ${best.score.toFixed(1)} runs vs ${greedyScore.toFixed(1)} greedy (+${(best.score - greedyScore).toFixed(1)}), ${best.moves} moves from ${best.from === SEED_LAMBDA ? "the seed" : `λ ${best.from.toFixed(2)}`}${seedScore != null && best.from !== SEED_LAMBDA ? ` (the seed's climb: ${seedScore.toFixed(1)})` : ""}`);
    slots = best.slots; lambda = best.from;
    if (deepBoard) {
      // Which cards /build's Search longer board has that the CLI's doesn't, and back.
      const nameOf = (id: number) => pool.find((c) => c.cardId === id)?.name ?? String(id);
      const cli = new Set(Object.values(best.slots)), deep = new Set(Object.values(deepBoard));
      const only = (a: Set<number>, b: Set<number>) => [...a].filter((id) => !b.has(id)).map(nameOf).join(", ") || "-";
      console.log(only(deep, cli) === "-" && only(cli, deep) === "-"
        ? "compare-search: Search longer picks the same 26 cards as the CLI"
        : `compare-search: Search longer differs - /build only: ${only(deep, cli)}; CLI only: ${only(cli, deep)}`);
    }
  }
  // Rotation and pen best-first: the game starts SP1 most and closes with CL.
  slots = orderStaff(slots, (id) => fits.runsR.get(id) ?? -Infinity);
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
        const dr = GLOVE * fieldingRuns(pos, here) + (pos === "C" ? framingRuns(c.ratings.CatcherFrame, ERA_YEAR) : 0);
        def = ` DEF ${String(Math.round(here)).padStart(3)}/${String(Math.round(best)).padStart(3)} ${(dr >= 0 ? "+" : "") + dr.toFixed(1)}${here < best * 0.6 ? " <-- out of position" : ""}${here < posFloorAt(MIN_POS, pos) ? " <-- under floor" : ""}`;
      }
    }
    // An arm shows its label and stamina: a bullpen slot filled by an SP card
    // is the whole point of --role-trust, and it has to be visible at a glance.
    const arm = c.isPitcher
      ? ` ${String(c.role ?? "").padEnd(2)} STM ${String(Math.round(c.ratings["Stamina"] ?? 0)).padStart(3)}`
      : "";
    const twoWay = isTwoWayForm(c.cardId) ? ` two-way (${c.isPitcher ? "pitching" : "hitting"})` : "";
    return `${key.padEnd(7)} ${(c.name + (c.variant ? " (VAR)" : "")).padEnd(26)} ${String(c.val).padStart(3)}  ${(c.bats ?? "-").padEnd(2)} ${String(c.year ?? "").padEnd(5)} ${runs == null ? "" : f1(runs).padStart(6)}  ${side}${def}${arm}${twoWay}  #${cardIdOf(c.cardId)}`;
  };

  console.log(`\n--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)`);
  for (const p of lineupPos) console.log(row(`R:${p}`, "R"));
  console.log(`\n--- lineup vs LHP ---`);
  for (const p of lineupPos) console.log(row(`L:${p}`, "L"));
  /* Batting order, the way /build's board shows it (lib/batting-order): each
     lineup played through nine innings on the event's base/out chain, every
     batter on his own odds against that hand; with no DH the pitcher bats ninth. */
  {
    const chain = orderEnv(scoringRates);
    const s = calibrationSlope("hit");
    for (const hand of ["R", "L"] as const) {
      const ids = lineupPos.map((p) => slots[`${hand}:${p}`]);
      if (ids.some((id) => id == null || !poolById.has(id))) continue;
      const lines = ids.map((id) => {
        const c = poolById.get(id!)!;
        const side = batsLeftOn(c.bats, hand) ? fits.envLeft : fits.envRight;
        const league = paLine(side.rates, side.park);
        const r = hitterRates(c.ratings, side.rates, hand === "R" ? "vR" : "vL");
        return r ? shrink(paLine(r, side.park), league, s) : league;
      });
      if (!DH) lines.push(pitcherLine(scoringRates));
      const res = bestOrder(lines, chain, DH ? [] : [lineupPos.length]);
      const nm = (i: number) => (i < ids.length ? `${poolById.get(ids[i]!)!.name}${poolById.get(ids[i]!)!.variant ? " (VAR)" : ""} ${lineupPos[i]}` : "Pitcher");
      console.log(`\n--- batting order vs ${hand}HP --- (${res.runs.toFixed(2)} runs/game; The Book's order ${res.bookRuns.toFixed(2)})`);
      res.order.forEach((i, k) => console.log(`  ${k + 1}. ${nm(i)}`));
    }
  }
  console.log(`\n--- rotation ---`);
  for (const k of shape.spKeys) console.log(row(k, "R"));
  console.log(`\n--- bullpen ---`);
  for (const k of shape.rpKeys) console.log(row(k, "R"));
  console.log(`\n--- bench ---`);
  for (const k of shape.benchKeys) console.log(row(k, "R"));
  /* The game's depth chart (lib/depth-chart): utility men and a defensive sub per position, pinch hitters and runners. */
  for (const hand of ["R", "L"] as const) {
    const nm = (c: { cardId: number; name: string }) => `${c.name}${poolById.get(c.cardId)?.variant ? " (VAR)" : ""}`;
    const dc = depthChart({
      slots, cards: poolById as unknown as ReadonlyMap<number, DepthCard>, lineupPos, hand, name: nm,
      bat: (id) => (hand === "R" ? fits.runsR : fits.runsL).get(id) ?? 0,
      glove: (pos, c) => GLOVE * fieldingRuns(pos, c.ratings[`Pos Rating ${pos}`]) + (pos === "C" ? framingRuns(c.ratings.CatcherFrame, ERA_YEAR) : 0),
      floor: (pos) => posFloorAt(MIN_POS, pos),
    });
    console.log(`\n--- depth chart vs ${hand}HP --- (Utility 1 / Utility 2 off the bench; a defensive sub where his glove is ${DEF_SUB_RUNS}+ runs a season better)`);
    for (const r of dc.rows) console.log(`  ${r.pos.padEnd(3)} ${(r.starter ?? "-").padEnd(26)} U1 ${(r.utility[0] ? `${r.utility[0].name} ${r.utility[0].rating}` : "NONE").padEnd(28)} U2 ${(r.utility[1] ? `${r.utility[1].name} ${r.utility[1].rating}` : "-").padEnd(28)}${r.defSub ? ` def sub ${r.defSub.name} (+${r.defSub.runs})` : ""}`);
    console.log(`  pinch hitters: ${dc.pinchHit.join(", ") || "-"} · pinch runners: ${dc.pinchRun.join(", ") || "-"}`);
  }

  const rostered = [...new Set(Object.values(slots))].map((id) => poolById.get(id)!).filter(Boolean);
  const totalVal = rostered.reduce((n, c) => n + (c.val ?? 0), 0);
  const lhbStarters = lineupPos.filter((p) => { const c = poolById.get(slots[`R:${p}`]); return c && batsLeftOn(c.bats, "R"); }).length;
  console.log(`\n${rostered.length} players · value ${totalVal}${CAP ? ` / ${CAP} (${CAP - totalVal} spare)` : ""} · ${lambda === SEED_LAMBDA ? "from seed" : `λ ${lambda.toFixed(3)}`} · ${rostered.filter((c) => c.variant).length} variants`);
  console.log(`vs RHP lineup gets the friendly park side in ${lhbStarters} of ${lineupPos.length} spots`);
  const bats2 = rostered.filter((c) => !c.isPitcher);
  console.log(`\n--- order inputs (rostered bats) ---`);
  for (const c of bats2.sort((a, b) => (fits.runsR.get(b.cardId) ?? 0) - (fits.runsR.get(a.cardId) ?? 0))) {
    const r = c.ratings;
    const g = (k: string) => Math.round(r[k] ?? 0);
    console.log(`  ${c.name.padEnd(22)} ${(c.bats ?? "-")} EYE ${String(g("Eye")).padStart(3)} (${g("Eye vL")}/${g("Eye vR")})  POW ${String(g("Power")).padStart(3)} (${g("Power vL")}/${g("Power vR")})  K ${String(g("Avoid Ks")).padStart(3)}  BABIP ${String(g("BABIP")).padStart(3)}  GAP ${String(g("Gap")).padStart(3)}  SPE ${String(g("Speed")).padStart(3)}`);
  }
  console.log(v.ready ? "LEGAL — every rule check passes" : `NOT READY: ${[...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  {
    // The baseball checks (lib/roster-audit): staff caps beside the field's best quarter, starters' stamina, long men, a backup at every position.
    const top = (fieldConstruction as any).series?.[SERIES ?? ""]?.groups?.find((g: any) => g.key === "top");
    const sum = (k: string) => top ? Object.values(top.tiers as Record<string, Record<string, number>>).reduce((n, t) => n + (t[k] ?? 0), 0) : 0;
    const field = top ? { sp: sum("sp"), rp: sum("rp"), bats: sum("bats") + sum("bench"), label: `field's best quarter (${top.n} teams)` } : null;
    console.log("\n--- roster check ---");
    for (const l of auditRoster({ slots, cards: poolById as any, lineupPos, envYear: YEAR, posFloor: MIN_POS, field })) console.log(`  ${l.ok ? "✓" : "✗"} ${l.text}`);
  }
  const spend = rostered.filter((c) => (prices.get(cardIdOf(c.cardId)) ?? 0) > 0).length;
  if (spend) console.log(`(${spend} of ${rostered.length} have a live ask in the last shop snapshot)`);
  console.log(`objective: ${objective(slots).toFixed(1)} weighted runs (bats ${Math.round((1-LHP_SHARE)*100)}/${Math.round(LHP_SHARE*100)} R/L, SP ${SP_WEIGHT}, RP ${RP_WEIGHT}, bench ${BENCH_WEIGHT})`);
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
