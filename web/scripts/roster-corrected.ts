/**
 * A roster build priced with the era correction `pnpm era:slopes` measured.
 *
 *   pnpm roster:corrected --series diamondvariety --year 1975 --park "Metropolitan Stadium" \
 *     --park-year 1981 --min 40 --max 99 --card-types 2,6,7 --min-pos "70,1B:0,LF:50,C:65" \
 *     [--roster start.txt] [--no-correct]
 *
 * Same pool, rules, field handedness, gloves, observed blend and search as
 * env-roster / roster-diff. The one difference: before the observed blend,
 * each bat's model runs are moved by what play in this era band returned per
 * rating point ABOVE what the calibrated model pays — the within-series
 * slopes from era-slopes (BABIP under-priced 2–3× everywhere, Power and
 * Avoid Ks under-priced before 1994, Eye and Gap about right). Arms are not
 * corrected; era-slopes has no pitcher panel yet. Pass --no-correct to get
 * the plain model for comparison.
 *
 * The table it prints first is the evidence: every bat's model runs, its
 * corrected runs, the blend the roster is ranked on, and — when the series
 * has exports — what the card did IN THIS SERIES against this field.
 */
import { readFileSync } from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, seriesMeta, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { HIT_POS, rosterShape, type FillCard, type FillShape } from "@/lib/roster-fill";
import { cardEligibility, rosterSize, validateRoster, type RosterRules, type RosterSlot } from "@/lib/roster-rules";
import { LJ_FLOOR, parsePosFloor, posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { rosterObjective, LHP_SHARE_DEFAULT, RP_WEIGHT_DEFAULT, BENCH_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { marginalRatings } from "@/lib/analytics/card-value";
import { calibrationSlope } from "@/lib/analytics/calibration";
import { loadObservedRuns, blendRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { optimizeRoster } from "@/lib/roster-optimize";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

const YEAR = num("year"), PARK = val("park") ?? null, PARK_YEAR = num("park-year"), DH = flag("dh");
const MIN = num("min"), MAX = num("max"), CAP = num("cap"), SIZE = num("size", 26)!;
const SERIES = val("series") ?? null;
const VARIANT_CAP = num("variant-cap");
const ROLE_TRUST = num("role-trust", 0.25)!;
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;
const MIN_DEF = num("min-def", 0.6)!;
const MIN_POS: PosFloor = parsePosFloor(val("min-pos")) ?? LJ_FLOOR;
const CANDIDATE_LIMIT = num("candidate-limit", 120)!;
const MAX_PASSES = num("max-passes", 40)!;
const CARD_TYPES = new Set((val("card-types") ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0));
const CORRECT = !flag("no-correct");
const ROSTER = val("roster");
const f1 = (n: number | null | undefined) => (n == null ? "    —" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}`.padStart(5));

/**
 * Observed runs per 700 PA per +10 rating, within series, by era band
 * (`pnpm era:slopes`, 2026-09-19, series fixed effects, 57 series). The
 * correction is the gap between these and the model's own calibrated line
 * for the event's environment, applied per rating point from the curves'
 * average rating (110).
 */
const OBSERVED: [string, number, number, Record<string, number>][] = [
  ["Deadball", 0, 1920, { Power: 0.89, Eye: 1.09, "Avoid Ks": 1.02, BABIP: 3.66, Gap: 0.96 }],
  ["Live Ball", 1921, 1945, { Power: 2.88, Eye: 0.92, "Avoid Ks": 1.02, BABIP: 2.51, Gap: 0.34 }],
  ["Integration", 1946, 1960, { Power: 2.84, Eye: 0.96, "Avoid Ks": 1.18, BABIP: 3.24, Gap: 0.83 }],
  ["Expansion", 1961, 1976, { Power: 2.13, Eye: 0.61, "Avoid Ks": 1.37, BABIP: 2.05, Gap: 0.32 }],
  ["Free Agency", 1977, 1993, { Power: 2.38, Eye: 0.72, "Avoid Ks": 1.21, BABIP: 2.77, Gap: 0.81 }],
  ["Steroid", 1994, 2009, { Power: 2.18, Eye: 0.67, "Avoid Ks": 0.48, BABIP: 1.24, Gap: 0.60 }],
  ["Modern", 2010, 3000, { Power: 2.53, Eye: 0.58, "Avoid Ks": 1.44, BABIP: 2.02, Gap: 0.63 }],
];
const SPLIT_KEY: Record<string, string> = { Power: "Power", Eye: "Eye", "Avoid Ks": "Avoid K", BABIP: "BABIP", Gap: "Gap" };
const AVERAGE_RATING = 110;

async function main() {
  const era = eraTable[String(YEAR)] ?? eraTable["0"];
  const pr = parkRow(PARK, PARK_YEAR);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);
  const rules: RosterRules = {
    name: SERIES ?? "roster", dh: DH, ratingsMin: MIN, ratingsMax: MAX, cardYearMin: num("card-year-min"), cardYearMax: num("card-year-max"),
    isDraft: false, restrictions: { teamCap: CAP, cards: SIZE, variantCap: VARIANT_CAP, variantsAllowed: VARIANT_CAP !== 0 },
  };

  /* ---- pool ---- */
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (!latest) throw new Error("no collection upload");
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  type P = FillCard & { pos: string; bats: string | null; cardType: number | null };
  const pool: P[] = [];
  for (const cid of new Set(owned.map((o) => o.cardId!))) {
    const c = byId.get(cid); if (!c) continue;
    if (CARD_TYPES.size && !CARD_TYPES.has(Number(c.cardType))) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const useVariant = VARIANT_CAP !== 0 && vr != null;
    const card: P = {
      cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher, role: c.pitcherRole, cardType: c.cardType,
      ratings: useVariant ? formRatings(base, vr, c.position) : base,
      baseOwned: baseSet.has(cid), variantOwned: vr != null, variant: useVariant || !baseSet.has(cid), pos: c.position ?? "", bats: c.bats,
    };
    if (card.variant && !card.variantOwned) continue;
    if (cardEligibility(card, rules).errors.length) continue;
    pool.push(card);
  }

  /* ---- field ---- */
  const [meta] = SERIES ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, SERIES)) : [];
  const LHP = num("lhp-share") ?? meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const LHB = meta?.lhbPaShare ?? 0.35;
  const lineupPos = DH ? [...HIT_POS, "DH"] : [...HIT_POS];
  const shp = rosterShape(YEAR, lineupPos.length, rosterSize(rules) ?? SIZE, meta ? { avgBats: meta.avgBats, avgSp: meta.avgSp, avgRp: meta.avgRp } : null);
  const shape: FillShape = {
    lineupPos, bats: SIZE - shp.sp - shp.rp,
    spKeys: Array.from({ length: shp.sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: shp.rp - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: SIZE - shp.sp - shp.rp - lineupPos.length }, (_, i) => `BN${i + 1}`),
  };

  /* ---- pricing: model → era correction → observed blend ---- */
  const base = envFitMaps(pool, { era: era.rates, park: pr, roleTrust: ROLE_TRUST, leagueLhbShare: LHB });
  const k = calibrationSlope("hit");
  const band = OBSERVED.find(([, lo, hi]) => (YEAR ?? 2010) >= lo && (YEAR ?? 2010) <= hi)!;
  const modelLine = (env: typeof base.envRight) => Object.fromEntries(marginalRatings(env, "hit").map((v) => [v.rating, v.runs * k]));
  const lineR = modelLine(base.envRight), lineL = modelLine(base.envLeft);
  const perPoint = (line: Record<string, number>) => Object.fromEntries(Object.keys(band[3]).map((r) => [r, (band[3][r] - (line[r] ?? 0)) / 10]));
  const ppR = perPoint(lineR), ppL = perPoint(lineL);
  const correction = (c: P, board: "R" | "L"): number => {
    if (!CORRECT || c.isPitcher) return 0;
    const pp = board === "R" ? ppR : ppL;
    let d = 0;
    for (const r of Object.keys(pp)) {
      const v = c.ratings[`${SPLIT_KEY[r]} v${board}`] ?? c.ratings[r];
      if (v != null) d += pp[r] * (v - AVERAGE_RATING);
    }
    return d;
  };
  const adjR = new Map<number, number>(), adjL = new Map<number, number>();
  for (const c of pool) {
    const r = base.runsR.get(c.cardId), l = base.runsL.get(c.cardId);
    if (r != null) adjR.set(c.cardId, r + correction(c, "R"));
    if (l != null) adjL.set(c.cardId, l + correction(c, "L"));
  }
  const both = (id: number) => { const r = adjR.get(id), l = adjL.get(id); return r == null || l == null ? null : (1 - LHP) * r + LHP * l; };
  const observed = OBS_K > 0 ? await loadObservedRuns(pool.map((c) => c.cardId), both) : new Map();
  const runsR = new Map<number, number>(), runsL = new Map<number, number>();
  for (const c of pool) {
    const b = both(c.cardId); if (b == null) continue;
    const shift = blendRuns(b, observed.get(c.cardId), OBS_K) - b;
    runsR.set(c.cardId, adjR.get(c.cardId)! + shift); runsL.set(c.cardId, adjL.get(c.cardId)! + shift);
  }
  const { objective, rank, defAt } = rosterObjective(pool, { shape, runsR, runsL, lhpShare: LHP, rpWeight: RP_WEIGHT_DEFAULT, benchWeight: BENCH_WEIGHT_DEFAULT });

  /* ---- what the card did in THIS series ---- */
  type Obs = { card_id: number; pa: number; ip: number; woba: number | null; fip: number | null; instances: number };
  const inSeries = new Map<number, Obs>();
  let fieldW = 0, fieldF = 0;
  if (SERIES) {
    const rows = (await db.execute(sql`select card_id, pa, ip, woba, fip, instances from observed_card_stats where series = ${SERIES}`)) as unknown as { rows?: Obs[] } | Obs[];
    for (const o of Array.isArray(rows) ? rows : rows.rows ?? []) inSeries.set(Number(o.card_id), { ...o, pa: Number(o.pa), ip: Number(o.ip), woba: o.woba == null ? null : Number(o.woba), fip: o.fip == null ? null : Number(o.fip), instances: Number(o.instances) });
    const f = (await db.execute(sql`select sum(woba*pa)/nullif(sum(pa),0) w, (select sum(fip*ip)/nullif(sum(ip),0) from observed_card_stats where series = ${SERIES} and is_pitcher) f from observed_card_stats where series = ${SERIES} and not is_pitcher`)) as unknown as { rows?: { w: number; f: number }[] } | { w: number; f: number }[];
    const fr = (Array.isArray(f) ? f : f.rows ?? [])[0]; fieldW = Number(fr?.w ?? 0); fieldF = Number(fr?.f ?? 0);
  }

  console.log(`\n=== ${SERIES ?? "roster"} · ${YEAR} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : " (neutral)"} · ${DH ? "DH" : "no DH"} · ${MIN}–${MAX}${CARD_TYPES.size ? ` · card types ${[...CARD_TYPES].join(",")}` : ""} · ${SIZE} cards ===`);
  console.log(`pool ${pool.length} (${pool.filter((c) => !c.isPitcher).length} bats, ${pool.filter((c) => c.isPitcher).length} arms) · field ${Math.round(LHP * 100)}% LHP / ${Math.round(LHB * 100)}% LHB · shape ${shape.bats} bats / ${shape.spKeys.length} SP / ${shape.rpKeys.length} RP · K = ${OBS_K}`);
  console.log(`pricing: ${CORRECT ? `era correction ON (${band[0]} band)` : "plain model"} · per +10 rating, calibrated model (RHB board) vs play in this era:`);
  for (const r of Object.keys(band[3])) console.log(`   ${r.padEnd(9)} model ${lineR[r].toFixed(2)}  play ${band[3][r].toFixed(2)}  → ${CORRECT ? `${(ppR[r] * 10 >= 0 ? "+" : "")}${(ppR[r] * 10).toFixed(2)} per +10 applied` : "not applied"}`);
  if (SERIES && inSeries.size) console.log(`this series' field: bats wOBA ${fieldW.toFixed(3)}, arms FIP ${fieldF.toFixed(2)} (${inSeries.size} card lines)`);

  /* ---- evidence table ---- */
  const bothFinal = (id: number) => { const r = runsR.get(id), l = runsL.get(id); return r == null || l == null ? null : (1 - LHP) * r + LHP * l; };
  const bats = pool.filter((c) => !c.isPitcher && bothFinal(c.cardId) != null).sort((a, b) => bothFinal(b.cardId)! - bothFinal(a.cardId)!).slice(0, 36);
  console.log(`\n--- top bats by the runs the search ranks on (both-hands, before gloves) ---`);
  console.log(`${"name".padEnd(24)} val B pos  model  corr  blend    vR    vL   play(n)         here: PA  wOBA  vs field`);
  for (const c of bats) {
    const mR = base.runsR.get(c.cardId)!, mL = base.runsL.get(c.cardId)!; const m = (1 - LHP) * mR + LHP * mL;
    const o = observed.get(c.cardId), h = inSeries.get(c.cardId);
    console.log(`${(c.name + (c.variant ? " (VAR)" : "")).padEnd(24)} ${String(c.val).padStart(3)} ${(c.bats ?? "?").padEnd(1)} ${c.pos.padEnd(3)} ${f1(m)} ${f1(both(c.cardId))} ${f1(bothFinal(c.cardId))} ${f1(runsR.get(c.cardId))} ${f1(runsL.get(c.cardId))}   ${o ? `${f1(o.runs)} (${String(o.n).padStart(5)})` : "      —      "}   ${h ? `${String(h.pa).padStart(5)} ${h.woba?.toFixed(3).replace(/^0/, "") ?? "—"}  ${h.woba != null ? f1((h.woba - fieldW) * 1000 / 1.25 * 0.7).padStart(5) : ""}` : ""}`);
  }
  const arms = pool.filter((c) => c.isPitcher && bothFinal(c.cardId) != null).sort((a, b) => bothFinal(b.cardId)! - bothFinal(a.cardId)!).slice(0, 24);
  console.log(`\n--- top arms (runs saved per 700 BF; here: IP, FIP vs field) ---`);
  for (const c of arms) {
    const o = observed.get(c.cardId), h = inSeries.get(c.cardId);
    console.log(`${(c.name + (c.variant ? " (VAR)" : "")).padEnd(24)} ${String(c.val).padStart(3)} ${(c.role ?? "?").padEnd(2)} STM ${String(c.ratings.Stamina ?? "").padStart(3)}  ${f1(bothFinal(c.cardId))}   ${o ? `play ${f1(o.runs)} (${String(o.n).padStart(6)})` : "no play        "}   ${h ? `here ${String(Math.round(h.ip)).padStart(4)} ip  FIP ${h.fip?.toFixed(2)}  ${f1(((fieldF - (h.fip ?? fieldF)) / 9) * 700 / 4.3 * 0.8)}` : ""}`);
  }
  console.log(`("vs field" here is a rough runs-per-700 read of the card's own line in this series against its field, for the eye only; the search uses the blend)`);

  /* ---- who else could play each slot ---- */
  const ALT = num("alternatives", 0)!;
  if (ALT > 0) {
    console.log(`\n--- alternatives per slot (runs on that board + glove runs; glove floor applied) ---`);
    for (const board of ["R", "L"] as const) for (const pos of lineupPos) {
      const runs = board === "R" ? runsR : runsL;
      const cands = pool.filter((c) => !c.isPitcher && runs.has(c.cardId) && (pos === "DH" || (c.ratings[`Pos Rating ${pos}`] ?? 0) >= posFloorAt(MIN_POS, pos)))
        .map((c) => ({ c, r: runs.get(c.cardId)! + (pos === "DH" ? 0 : defAt(c.cardId, pos)) })).sort((a, b) => b.r - a.r).slice(0, ALT);
      console.log(`${board}:${pos.padEnd(3)} ` + cands.map(({ c, r }) => `${c.name}${c.variant ? "*" : ""} ${c.val} ${f1(r).trim()}${pos !== "DH" ? `(${c.ratings[`Pos Rating ${pos}`]})` : ""}`).join(" · "));
    }
  }

  /* ---- start roster ---- */
  const poolById = new Map(pool.map((c) => [c.cardId, c]));
  const slots: Record<string, number> = {};
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  if (ROSTER) {
    const lines = readFileSync(ROSTER, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    for (const l of lines) {
      const m = /^(\S+)\s+(.+)$/.exec(l); if (!m) continue;
      const key = m[1].toUpperCase(); let who = m[2].trim();
      const wantVar = /\(VAR\)$/i.test(who); who = who.replace(/\s*\(VAR\)$/i, "");
      const wantPitcher = /^(SP|RP|CL)/.test(key);
      const hits = pool.filter((c) => norm(c.name) === norm(who) && (wantVar ? c.variant : true) && c.isPitcher === wantPitcher).sort((a, b) => (b.val ?? 0) - (a.val ?? 0));
      if (hits[0]) slots[key] = hits[0].cardId; else console.log(`!! start roster: ${l} not in the legal pool`);
    }
  }
  const allKeys = [...lineupPos.flatMap((p) => [`R:${p}`, `L:${p}`]), ...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys];
  for (const key of allKeys) {
    if (slots[key] != null) continue;
    const used = new Set(Object.values(slots));
    const pos = key.includes(":") ? key.split(":")[1] : key;
    const ok = (c: P) => /^SP\d+$/.test(pos) ? c.isPitcher && c.role === "SP" : /^(RP\d+|CL)$/.test(pos) ? c.isPitcher : !c.isPitcher && (pos === "DH" || /^BN/.test(pos) || (c.ratings[`Pos Rating ${pos}`] ?? 0) >= 70);
    const best = pool.filter((c) => ok(c) && !used.has(c.cardId)).sort((a, b) => rank(key, b) - rank(key, a))[0];
    if (best) slots[key] = best.cardId;
  }
  const start = objective(slots);

  /* ---- search ---- */
  const r = MAX_PASSES > 0
    ? optimizeRoster(slots, pool, rules, shape, { objective, minDefShare: MIN_DEF, posFloor: MIN_POS, pairMoves: { aTop: 8, bCheapest: 10, rank }, candidateLimit: CANDIDATE_LIMIT, maxPasses: MAX_PASSES })
    : { slots: { ...slots }, score: start, moves: 0 };
  const cur = r.slots;
  const nameOf = (id: number | undefined) => { const c = id != null ? poolById.get(id) : undefined; return c ? `${c.name}${c.variant ? " (VAR)" : ""}` : "—"; };
  const before = new Set(Object.values(slots)), after = new Set(Object.values(cur));
  console.log(`\nsearch: ${start.toFixed(1)} → ${r.score.toFixed(1)} weighted runs (${r.moves} moves)${ROSTER ? ` from ${ROSTER}` : " from a greedy fill"}`);
  const out = [...before].filter((id) => !after.has(id)).map(nameOf), inn = [...after].filter((id) => !before.has(id)).map(nameOf);
  if (out.length || inn.length) console.log(`   out: ${out.join(", ") || "—"}\n   in:  ${inn.join(", ") || "—"}`);

  const line = (key: string) => {
    const id = cur[key]; const c = poolById.get(id)!; const pos = key.includes(":") ? key.split(":")[1] : "";
    const board = key.startsWith("L:") ? "L" : "R";
    const runs = c.isPitcher ? bothFinal(id) : (board === "L" ? runsL.get(id) : runsR.get(id));
    const pr_ = pos && pos !== "DH" ? c.ratings[`Pos Rating ${pos}`] ?? 0 : null;
    const d = pos && pos !== "DH" ? defAt(id, pos) : 0;
    const h = inSeries.get(id);
    return `${key.padEnd(6)} ${nameOf(id).padEnd(28)} ${String(c.val).padStart(3)}  ${(c.isPitcher ? (c.ratings.Stamina != null ? `STM ${c.ratings.Stamina}` : "") : (c.bats ?? "?")).padEnd(7)} ${f1(runs)}${pr_ != null ? `  DEF ${String(pr_).padStart(3)} ${f1(d)}` : ""}${h ? `   here ${c.isPitcher ? `${Math.round(h.ip)} ip FIP ${h.fip?.toFixed(2)}` : `${h.pa} PA ${h.woba?.toFixed(3).replace(/^0/, "")}`}` : ""}`;
  };
  console.log(`\n--- lineup vs RHP ---`); for (const p of lineupPos) console.log(line(`R:${p}`));
  console.log(`\n--- lineup vs LHP ---`); for (const p of lineupPos) console.log(line(`L:${p}`));
  console.log(`\n--- rotation ---`); for (const key of shape.spKeys) console.log(line(key));
  console.log(`\n--- bullpen ---`); for (const key of shape.rpKeys) console.log(line(key));
  console.log(`\n--- bench ---`); for (const key of shape.benchKeys) console.log(line(key));
  const ids = [...new Set(Object.values(cur))];
  const v = validateRoster(Object.entries(cur).map(([key, cardId]): RosterSlot => { const [a, b] = key.split(":"); return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false }; }), pool, rules);
  console.log(`\n${ids.length} players · value ${ids.reduce((s, id) => s + (poolById.get(id)?.val ?? 0), 0)} · ${ids.filter((id) => poolById.get(id)?.variant).length} variants · ${v.ready ? "LEGAL" : "NOT LEGAL: " + [...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
