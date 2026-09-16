/**
 * Finish the PTCS 6 Championship - Cap roster.
 *
 * L.J. built 20 of the 26 in-game; this fills the rest under the 1,610 team
 * cap. The 20 he has are LOCKED (their fit is boosted out of reach so every
 * greedy fill takes them), the arm pool is restricted to the arms he carries
 * so the staff cannot be re-picked behind his back, and everything else runs
 * through the SAME fill / optimiser / validator as env:roster.
 *
 *   node --env-file=.env.local --import tsx scripts/cap-finish.ts [--cut "a,b"] [--free-bats]
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import {
  HIT_POS, fillOnce, fillRoster, isComplete, type FillCard, type FillShape, type FitMaps,
} from "@/lib/roster-fill";
import { validateRoster, type RosterRules, type RosterSlot } from "@/lib/roster-rules";
import { cardEligibility } from "@/lib/roster-rules";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { hitterRates, pitcherRates, marginalRatings } from "@/lib/analytics/card-value";
import { optimizeRoster } from "@/lib/roster-optimize";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number) => { const v = val(k); return v == null ? d : Number(v); };

/* ---- the event ---------------------------------------------------------- */
const YEAR = 1935, PARK = "Wrigley Field", PARK_YEAR = 1932;
const CAP = 1610, SIZE = 26, MIN = 50, MAX = 74;
const LHP_SHARE = num("lhp-share", 0.30), RP_WEIGHT = num("rp-weight", 0.5), BENCH_WEIGHT = num("bench-weight", 0.1);
const MIN_DEF = num("min-def", 0.6);
const MIN_C = num("min-c", 0);
/** Staff shape. L.J., 2026-09-12: this berth wants 5 to 6 relievers, not 4. */
const N_SP = num("sp", 4);
const N_RP = num("rp", 4);
/** Let the model buy arms out of the collection instead of only using the ones on the board. */
const OPEN_ARMS = flag("open-arms");
/** Floor on the value of an arm the model may BUY — keeps replacement-level filler out of the pen. */
const MIN_ARM = num("min-arm-val", 0);

/* ---- what L.J. already has on the board (card ids from collection 65) ---- */
const ARMS: Record<string, number> = {
  "Grover Cleveland Alexander": 86477, "Jakie May": 85286, "Jim Bouton": 85698,
  "Johnny Antonelli": 85869, "Ken Sanders": 83180, "Larry Sherry": 86622,
  "Don August": 86423, "Marshall Bridges": 83181, "Earl Wilson": 85895, "Joe Krakauskas": 85829,
};
const BATS: Record<string, number> = {
  "Wade Boggs": 86260, "Ed Morgan": 85943, "Roberto Clemente": 86723, "Wes Covington": 86651,
  "Joe Dugan": 86765, "Bob Bowman": 86803, "Tim McCarver": 85833, "Billy Southworth": 86379,
  "Leo Cardenas": 85843, "Chris Cannizzaro": 85168,
};
const CUT = (val("cut") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const cutIds = new Set(CUT.map((n) => ARMS[n] ?? BATS[n]).filter(Boolean));
if (CUT.length !== cutIds.size) throw new Error(`unmatched --cut name in ${CUT.join(", ")}`);
const FREE_BATS = flag("free-bats");
/** Bats to leave UNLOCKED — still in the pool, but the model may drop them. */
const FREE = (val("free") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const freeIds = new Set(FREE.map((n) => { const id = BATS[n] ?? ARMS[n]; if (!id) throw new Error(`unknown --free ${n}`); return id; }));

const keepArms = Object.values(ARMS).filter((id) => !cutIds.has(id));
const keepBats = Object.values(BATS).filter((id) => !cutIds.has(id));
const locked = new Set([...keepArms, ...(FREE_BATS ? [] : keepBats)].filter((id) => !freeIds.has(id)));

const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[String(YEAR)]!;
  const pr = parkRow(PARK, PARK_YEAR);
  const rules: RosterRules = {
    name: "PTCS 6 Championship - Cap", dh: false, ratingsMin: MIN, ratingsMax: MAX,
    cardYearMin: 1920, cardYearMax: 1989, isDraft: false,
    restrictions: { teamCap: CAP, cards: SIZE, variantCap: null, variantsAllowed: true },
  };

  const bp35 = pr ? blendPark(pr, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp35);
  const line = rateLine(bp35 ? applyPark(era.rates, bp35) : era.rates, solved.RG);
  console.log(`\n=== PTCS 6 Championship · Cap — finishing the board ===`);
  console.log(`${YEAR} RE @ ${PARK_YEAR} ${PARK} · DH off · value ${MIN}–${MAX} · cap ${CAP} · ${SIZE} players`);
  if (pr) console.log(`park ${PARK_YEAR} ${PARK}: avgL ${pr.avgL?.toFixed(3)} / avgR ${pr.avgR?.toFixed(3)} · hrL ${pr.hrL?.toFixed(3)} / hrR ${pr.hrR?.toFixed(3)} · 2B ${pr.d2?.toFixed(3)} · 3B ${pr.d3?.toFixed(3)}`);
  console.log(`R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)}  OBP ${line.obp.toFixed(3)}  SLG ${line.slg.toFixed(3)}  K% ${(line.kPct*100).toFixed(1)}  HR/PA ${(line.hrPa*100).toFixed(2)}%  preset ${solved.preset}`);

  /* ------------------------------- the pool ------------------------------- */
  const [latest] = await db.select({ id: uploads.id }).from(uploads)
    .where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest!.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));

  type P = FillCard & { pos: string; bats: string | null };
  const pool: P[] = [];
  for (const cid of [...new Set(owned.map((o) => o.cardId!))]) {
    const c = byId.get(cid); if (!c) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const ratings = vr != null ? formRatings(base, vr, c.position) : base;
    const card: P = {
      cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher,
      role: c.pitcherRole, cardType: c.cardType, ratings,
      baseOwned: baseSet.has(cid), variantOwned: vr != null,
      variant: vr != null || !baseSet.has(cid), pos: c.position ?? "", bats: c.bats,
    };
    if (card.variant && !card.variantOwned) continue;
    if (cardEligibility(card, rules).errors.length) continue;
    if (cutIds.has(cid)) continue;                    // cards L.J. is dropping
    if (!OPEN_ARMS && card.isPitcher && !keepArms.includes(cid)) continue;
    if (card.isPitcher && !keepArms.includes(cid) && (card.val ?? 0) < MIN_ARM) continue;
    pool.push(card);
  }
  const nBats = pool.filter((c) => !c.isPitcher).length;
  console.log(`\npool: ${pool.length} cards — ${nBats} eligible bats + the ${pool.length - nBats} arms you carry`);
  const spent = [...locked].map((id) => pool.find((c) => c.cardId === id)?.val ?? 0).reduce((a, b) => a + b, 0);
  console.log(`locked: ${locked.size} cards · ${spent} of ${CAP} · ${CAP - spent} left for ${SIZE - locked.size} slots (${((CAP - spent) / (SIZE - locked.size)).toFixed(1)} each, min ${MIN})`);
  for (const id of locked) if (!pool.some((c) => c.cardId === id)) console.log(`  !! locked card ${id} is NOT in the eligible pool`);

  /* ------------------------------- the shape ------------------------------ */
  const sp = N_SP, nArms = N_SP + N_RP;
  const shape: FillShape = {
    lineupPos: [...HIT_POS], bats: SIZE - nArms,
    spKeys: Array.from({ length: sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: N_RP - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: SIZE - nArms - HIT_POS.length }, (_, i) => `BN${i + 1}`),
  };
  console.log(`shape: ${shape.bats} bats / ${sp} SP / ${N_RP} RP${OPEN_ARMS ? " · arm pool OPEN" : " · arms locked to yours"}`);

  /* --- --field: score against what the eligible field actually produces ---- */
  let scoringRates: typeof era.rates = era.rates;
  if (flag("field")) {
    const HK = ["Avoid Ks", "Eye", "Power", "Gap", "BABIP"], PK = ["Stuff", "Control", "pHR", "pBABIP"];
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
    const avgOf = (set: P[], keys: string[]) => Object.fromEntries(keys.map((k) =>
      [k, mean(set.map((c) => c.ratings[k]).filter((v) => typeof v === "number" && v > 0))]));
    // the FIELD is every eligible card, not just the arms L.J. kept
    const allBats = pool.filter((c) => !c.isPitcher);
    const allArms = universe.filter((c) => c.isPitcher && (c.cardValue ?? 0) >= MIN && (c.cardValue ?? 0) <= MAX
      && (c.year ?? 0) >= 1920 && (c.year ?? 0) <= 1989)
      .map((c) => ({ ratings: (c.ratings ?? {}) as Record<string, number> })) as P[];
    const aB = avgOf(allBats, HK), aP = avgOf(allArms, PK);
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
      console.log(`FIELD: K% ${(fl.kPct*100).toFixed(1)}  BB% ${(fl.bbPct*100).toFixed(1)}  HR/PA ${(fl.hrPa*100).toFixed(2)}%  OPS ${fl.ops.toFixed(3)}  bunt ${fenv.bunt_12_0>=0?"+":""}${fenv.bunt_12_0.toFixed(3)}  steal BE ${(fenv.sbbe0*100).toFixed(1)}%  preset ${fenv.preset}`);
    }
  }
  const fits = envFitMaps(pool, { era: scoringRates, park: pr });
  console.log(`\n+10 rating, runs/700 PA — LHB: ${marginalRatings(fits.envLeft, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                          RHB: ${marginalRatings(fits.envRight, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                         arms: ${marginalRatings(fits.envPitch, "pit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);

  /* --- fits with the locked cards boosted: only for GENERATING starts ------ */
  const bump = (m: Map<number, number>) => { const n = new Map(m); for (const id of locked) n.set(id, (n.get(id) ?? 0) + 1000); return n; };
  const fitsLock: FitMaps = {
    fitR: bump(fits.fitR), fitL: bump(fits.fitL),
    atR: Object.fromEntries(Object.entries(fits.atR).map(([k, v]) => [k, bump(v)])),
    atL: Object.fromEntries(Object.entries(fits.atL).map(([k, v]) => [k, bump(v)])),
  };

  const poolById2 = new Map(pool.map((c) => [c.cardId, c]));
  const objective = (r: Record<string, number>): number => {
    let total = 0;
    const on = new Set(Object.values(r));
    for (const id of locked) if (!on.has(id)) total -= 1000;   // never trade a locked card away
    if (MIN_C > 0) {  // a best-of-9 with one catcher is a coin flip on one card
      let c = 0; for (const id of on) { const p2 = poolById2.get(id); if (p2 && !p2.isPitcher && (p2.ratings["Pos Rating C"] ?? 0) >= 60) c++; }
      if (c < MIN_C) total -= 500 * (MIN_C - c);
    }
    for (const p of shape.lineupPos) {
      const a = r[`R:${p}`], b = r[`L:${p}`];
      if (a != null) total += (1 - LHP_SHARE) * (fits.runsR.get(a) ?? 0);
      if (b != null) total += LHP_SHARE * (fits.runsL.get(b) ?? 0);
    }
    for (const k of shape.spKeys) { const c = r[k]; if (c != null) total += fits.runsR.get(c) ?? 0; }
    for (const k of shape.rpKeys) { const c = r[k]; if (c != null) total += RP_WEIGHT * (fits.runsR.get(c) ?? 0); }
    for (const k of shape.benchKeys) { const c = r[k]; if (c != null) total += BENCH_WEIGHT * (fits.runsR.get(c) ?? 0); }
    return total;
  };

  const g = fillRoster(pool, rules, shape, fitsLock);
  if (!isComplete(g.slots, shape)) {
    console.log(`\n!! no complete roster — the cap cannot cover ${SIZE - locked.size} more cards on top of what you have.`);
  }
  const rank = (key: string, c: FillCard) => key.startsWith("L:") ? (fits.runsL.get(c.cardId) ?? -1e6) : (fits.runsR.get(c.cardId) ?? -1e6);
  const starts = new Map<string, Record<string, number>>();
  for (let i = 0; i <= num("starts", 256); i++) {
    const r = fillOnce(pool, rules, shape, fitsLock, (i / num("starts", 256)) * 8);
    if (isComplete(r, shape)) starts.set([...new Set(Object.values(r))].sort((a, b) => a - b).join(","), r);
  }
  let best = { slots: g.slots, score: objective(g.slots) };
  for (const st of starts.values()) {
    const r = optimizeRoster(st, pool, rules, shape, { objective, minDefShare: MIN_DEF, pairMoves: { aTop: 12, bCheapest: 14, rank }, maxPasses: 25 });
    if (r.score > best.score) best = { slots: r.slots, score: r.score };
  }
  // polish: wider pair search from the best roster found
  for (let i = 0; i < 3; i++) {
    const r = optimizeRoster(best.slots, pool, rules, shape, { objective, minDefShare: MIN_DEF, pairMoves: { aTop: 28, bCheapest: 32, rank }, maxPasses: 40 });
    if (r.score <= best.score + 1e-9) break;
    best = { slots: r.slots, score: r.score };
  }
  console.log(`\noptimiser: ${starts.size} starts · best ${best.score.toFixed(1)} runs`);
  const slots = best.slots;
  { // comparable across roster shapes: the lineup term alone
    let lu = 0, spR = 0, rpR = 0, bn = 0;
    for (const p of shape.lineupPos) {
      const a = slots[`R:${p}`], b = slots[`L:${p}`];
      if (a != null) lu += (1 - LHP_SHARE) * (fits.runsR.get(a) ?? 0);
      if (b != null) lu += LHP_SHARE * (fits.runsL.get(b) ?? 0);
    }
    for (const k of shape.spKeys) spR += fits.runsR.get(slots[k]) ?? 0;
    for (const k of shape.rpKeys) rpR += RP_WEIGHT * (fits.runsR.get(slots[k]) ?? 0);
    for (const k of shape.benchKeys) bn += BENCH_WEIGHT * (fits.runsR.get(slots[k]) ?? 0);
    console.log(`  breakdown: lineup ${lu.toFixed(1)} · SP ${spR.toFixed(1)} · pen ${rpR.toFixed(1)} · bench ${bn.toFixed(1)}`);
  }

  /* --------------------------------- report ------------------------------- */
  const poolById = new Map(pool.map((c) => [c.cardId, c]));
  const row = (key: string, board: "R" | "L" | null) => {
    const cid = slots[key]; const c = cid != null ? poolById.get(cid) : undefined;
    if (!c) return `${key.padEnd(7)} —`;
    const runs = board === "L" ? fits.runsL.get(c.cardId) : fits.runsR.get(c.cardId);
    const side = !c.isPitcher && board ? (batsLeftOn(c.bats, board) ? "park:L" : "park:R") : "";
    let def = "";
    if (!c.isPitcher) {
      const pos = key.split(":")[1];
      if (pos && !pos.startsWith("BN")) {
        const here = c.ratings[`Pos Rating ${pos}`] ?? 0;
        const bst = Math.max(...HIT_POS.map((p) => c.ratings[`Pos Rating ${p}`] ?? 0));
        def = ` DEF ${String(Math.round(here)).padStart(3)}/${String(Math.round(bst)).padStart(3)}`;
      }
    }
    const isNew = !locked.has(c.cardId) ? " *NEW*" : "";
    return `${key.padEnd(7)} ${(c.name + (c.variant ? " (V)" : "")).padEnd(26)} ${String(c.val).padStart(3)} ${(c.bats ?? "-").padEnd(2)} ${String(c.year ?? "").padEnd(5)} ${runs == null ? "" : f1(runs).padStart(6)}  ${side}${def}${isNew}`;
  };
  console.log(`\n--- lineup vs RHP ---`); for (const p of shape.lineupPos) console.log(row(`R:${p}`, "R"));
  console.log(`\n--- lineup vs LHP ---`); for (const p of shape.lineupPos) console.log(row(`L:${p}`, "L"));
  console.log(`\n--- rotation ---`);      for (const k of shape.spKeys) console.log(row(k, "R"));
  console.log(`\n--- bullpen ---`);       for (const k of shape.rpKeys) console.log(row(k, "R"));
  console.log(`\n--- bench ---`);         for (const k of shape.benchKeys) console.log(row(k, "R"));

  const rostered = [...new Set(Object.values(slots))].map((id) => poolById.get(id)!).filter(Boolean);
  const totalVal = rostered.reduce((n, c) => n + (c.val ?? 0), 0);
  const adds = rostered.filter((c) => !locked.has(c.cardId));
  console.log(`\nADD (${adds.length}): ${adds.map((c) => `${c.name}${c.variant ? " (V)" : ""} ${c.val} ${c.pos} ${c.bats ?? ""} [${f1(fits.runsR.get(c.cardId) ?? 0)} R / ${f1(fits.runsL.get(c.cardId) ?? 0)} L]`).join("\n     ")}`);
  if (CUT.length) console.log(`CUT (${CUT.length}): ${CUT.join(", ")}`);
  console.log(`\n${rostered.length} players · value ${totalVal} / ${CAP} (${CAP - totalVal} spare) · ${rostered.filter((c) => c.variant).length} variants`);

  const out: RosterSlot[] = Object.entries(slots).map(([k, cardId]) => {
    const [a, b] = k.split(":");
    return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? shape.lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false };
  });
  if (flag("arm-why")) {
    console.log(`\n--- what the model thinks each arm actually does, per 700 PA (field env) ---`);
    console.log(`   name                        val   K%   BB%  HR%  BABIP   runs`);
    for (const c of pool.filter((x) => x.isPitcher).sort((a, b) => (fits.runsR.get(b.cardId) ?? 0) - (fits.runsR.get(a.cardId) ?? 0)).slice(0, num("arm-top", 24))) {
      const pr2 = pitcherRates(c.ratings, scoringRates, "all");
      if (!pr2) continue;
      console.log(`   ${(c.name + (c.variant ? " (V)" : "")).padEnd(26)} ${String(c.val).padStart(3)}  ${(pr2.K * 100).toFixed(1).padStart(4)}  ${(pr2.BB * 100).toFixed(1).padStart(4)} ${(pr2.HR * 100).toFixed(2).padStart(5)}  ${pr2.BABIP.toFixed(3)}  ${f1(fits.runsR.get(c.cardId) ?? 0).padStart(6)}${locked.has(c.cardId) ? "  <-- yours" : ""}`);
    }
  }
  if (flag("arm-menu")) {
    const arms = pool.filter((c) => c.isPitcher)
      .map((c) => ({ c, s: fits.runsR.get(c.cardId) ?? 0 }))
      .sort((a, b) => b.s - a.s).slice(0, num("arm-top", 30));
    console.log(`\n--- best owned arms in this environment (runs/700 PA, +14.3 = vs the average legal arm) ---`);
    for (const { c, s: sc } of arms) {
      const r = c.ratings;
      console.log(`   ${(c.name + (c.variant ? " (V)" : "")).padEnd(26)} ${String(c.val).padStart(3)} ${(c.role ?? "").padEnd(3)} ${String(c.year ?? "").padEnd(5)} ${f1(sc).padStart(7)} (${f1(sc + 14.3).padStart(6)})  STM ${String(Math.round(r["Stamina"] ?? 0)).padStart(3)} STU ${String(Math.round(r["Stuff"] ?? 0)).padStart(3)} CON ${String(Math.round(r["Control"] ?? 0)).padStart(3)} pHR ${String(Math.round(r["pHR"] ?? 0)).padStart(3)} pBAB ${String(Math.round(r["pBABIP"] ?? 0)).padStart(3)}  vL ${f1(fits.runsL.get(c.cardId) ?? 0).padStart(6)}${locked.has(c.cardId) ? "  <-- yours" : ""}`);
    }
  }
  if (flag("menu")) {
    console.log(`\n--- best owned bats by position (0.7·vsRHP + 0.3·vsLHP), value \u2264 the slack you have ---`);
    for (const pos of HIT_POS) {
      const cand = pool.filter((c) => !c.isPitcher && (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0
        && (c.ratings[`Pos Rating ${pos}`] ?? 0) >= 0.6 * Math.max(...HIT_POS.map((q) => c.ratings[`Pos Rating ${q}`] ?? 0)))
        .map((c) => ({ c, s: 0.7 * (fits.runsR.get(c.cardId) ?? 0) + 0.3 * (fits.runsL.get(c.cardId) ?? 0) }))
        .sort((a, b) => b.s - a.s).slice(0, 12);
      console.log(`\n${pos}:`);
      for (const { c, s } of cand) console.log(`   ${(c.name + (c.variant ? " (V)" : "")).padEnd(26)} ${String(c.val).padStart(3)} ${(c.bats ?? "-").padEnd(2)} DEF ${String(Math.round(c.ratings[`Pos Rating ${pos}`] ?? 0)).padStart(3)}  ${f1(s).padStart(7)}  [R ${f1(fits.runsR.get(c.cardId) ?? 0)} / L ${f1(fits.runsL.get(c.cardId) ?? 0)}]${locked.has(c.cardId) ? "  <-- yours" : ""}`);
    }
  }
  const v = validateRoster(out, pool, rules);
  console.log(`validator: ${v.errors.length ? "ERRORS " + v.errors.join(" | ") : "clean"}`);
  process.exit(0);
}
main();
