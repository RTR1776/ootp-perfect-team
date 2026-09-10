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
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { marginalRatings, rangeFlags } from "@/lib/analytics/card-value";
import { optimizeRoster } from "@/lib/roster-optimize";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";

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
const OPTIMIZE = flag("optimize");
const MIN_DEF = num("min-def", 0.6)!;

const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[String(YEAR)] ?? eraTable["0"];
  if (!era) throw new Error(`no era row for ${YEAR}`);
  const pr = parkRow(PARK, PARK_YEAR);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);

  const rules: RosterRules = {
    name: NAME, dh: DH, ratingsMin: MIN, ratingsMax: MAX,
    cardYearMin: YEAR_MIN, cardYearMax: YEAR_MAX, isDraft: false,
    restrictions: { teamCap: CAP, cards: SIZE, variantCap: VARIANT_CAP, variantsAllowed: VARIANT_CAP !== 0 },
  };

  /* -------------------------------- the environment ------------------------ */
  const bp35 = pr ? blendPark(pr, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp35);
  const line = rateLine(bp35 ? applyPark(era.rates, bp35) : era.rates, solved.RG);
  console.log(`\n=== ${NAME} ===`);
  console.log(`${YEAR ?? "PT default"} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : " (neutral park)"} · DH ${DH ? "on" : "off"} · value ${MIN ?? "—"}–${MAX ?? "—"} · cap ${CAP ?? "none"} · ${SIZE} players`);
  console.log(`R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)}  OBP ${line.obp.toFixed(3)}  SLG ${line.slg.toFixed(3)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%  preset ${solved.preset}`);
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
  for (const cid of ownedIds) {
    const c = byId.get(cid);
    if (!c) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const useVariant = VARIANT_CAP !== 0 && vr != null;
    const ratings = useVariant ? formRatings(base, vr) : base;
    const card: P = {
      cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher,
      role: c.pitcherRole, cardType: c.cardType, ratings,
      baseOwned: baseSet.has(cid), variantOwned: vr != null,
      variant: useVariant || !baseSet.has(cid), pos: c.position ?? "", tier: c.tier ?? "", bats: c.bats,
    };
    if (card.variant && !card.variantOwned) continue;
    if (cardEligibility(card, rules).errors.length) continue;
    pool.push(card);
  }
  const bats = pool.filter((c) => !c.isPitcher);
  console.log(`\npool: ${pool.length} eligible owned cards — ${bats.length} bats (${bats.filter((c) => c.bats === "L").length}L / ${bats.filter((c) => c.bats === "S").length}S / ${bats.filter((c) => c.bats === "R").length}R), ${pool.length - bats.length} arms`);

  /* --------------------------------- the shape ----------------------------- */
  const lineupPos = DH ? [...HIT_POS, "DH"] : [...HIT_POS];
  const shp = rosterShape(YEAR, lineupPos.length, rosterSize(rules) ?? SIZE, null);
  const shape: FillShape = {
    lineupPos, bats: shp.bats,
    spKeys: Array.from({ length: shp.sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: shp.rp - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: shp.bats - lineupPos.length }, (_, i) => `BN${i + 1}`),
  };
  console.log(`shape: ${shp.bats} bats / ${shp.sp} SP / ${shp.rp} RP (${shp.band}) · out-of-position guard ${Math.round(MIN_DEF * 100)}% of best`);

  const fits = envFitMaps(pool, { era: era.rates, park: pr });
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
  const objective = (r: Record<string, number>): number => {
    let total = 0;
    for (const p of lineupPos) {
      const a = r[`R:${p}`], b = r[`L:${p}`];
      if (a != null) total += 0.7 * (fits.runsR.get(a) ?? 0);
      if (b != null) total += 0.3 * (fits.runsL.get(b) ?? 0);
    }
    for (const k of shape.spKeys) { const c = r[k]; if (c != null) total += fits.runsR.get(c) ?? 0; }
    for (const k of shape.rpKeys) { const c = r[k]; if (c != null) total += 0.5 * (fits.runsR.get(c) ?? 0); }
    for (const k of shape.benchKeys) { const c = r[k]; if (c != null) total += 0.1 * (fits.runsR.get(c) ?? 0); }
    return total;
  };

  let { slots, lambda } = fillRoster(pool, rules, shape, fits);
  const greedyScore = objective(slots);
  if (OPTIMIZE) {
    /** Distinct complete rosters across the λ range, as hill-climb starts. */
    const starts = new Map<string, { slots: Record<string, number>; lambda: number }>();
    for (let i = 0; i <= 64; i++) {
      const lam = (i / 64) * 8;
      const r = fillOnce(pool, rules, shape, fits, lam);
      if (!isComplete(r, shape)) continue;
      starts.set([...new Set(Object.values(r))].sort((a, b) => a - b).join(","), { slots: r, lambda: lam });
    }
    /** Rank a card for a slot by the runs it would contribute there. */
    const rank = (key: string, c: FillCard) =>
      key.startsWith("L:") ? (fits.runsL.get(c.cardId) ?? -1e6) : (fits.runsR.get(c.cardId) ?? -1e6);

    let best = { slots, score: greedyScore, from: lambda, moves: 0 };
    for (const [, st] of starts) {
      const r = optimizeRoster(st.slots, pool, rules, shape, {
        objective, minDefShare: MIN_DEF, pairMoves: { aTop: 10, bCheapest: 12, rank }, maxPasses: 25,
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
        def = ` DEF ${String(Math.round(here)).padStart(3)}/${String(Math.round(best)).padStart(3)}${here < best * 0.6 ? " <-- out of position" : ""}`;
      }
    }
    return `${key.padEnd(7)} ${(c.name + (c.variant ? " (VAR)" : "")).padEnd(26)} ${String(c.val).padStart(3)}  ${(c.bats ?? "-").padEnd(2)} ${String(c.year ?? "").padEnd(5)} ${runs == null ? "" : f1(runs).padStart(6)}  ${side}${def}`;
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
  console.log(v.ready ? "LEGAL — every rule check passes" : `NOT READY: ${[...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  const spend = rostered.filter((c) => (prices.get(c.cardId) ?? 0) > 0).length;
  if (spend) console.log(`(${spend} of ${rostered.length} have a live ask in the last shop snapshot)`);
  console.log(`objective: ${objective(slots).toFixed(1)} weighted runs (bats 70/30 R/L, SP full, RP half, bench a tenth)`);

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
