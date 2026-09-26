/**
 * Score the roster you actually have loaded, then list the swaps worth
 * making, biggest first — so a change mid-week is the top three moves and
 * not a rebuild.
 *
 *   pnpm roster:diff --roster my.txt --series goldweekly --year 1989 \
 *     --park "Candlestick Park" --park-year 1979 --dh --min 40 --max 89
 *
 * The roster file is one slot per line, "R:3B Hank Thompson", "L:C Mike
 * Zunino", "SP1 Jim Kaat", "CL Joe Beggs", "RP3 …", "BN2 …". Lines starting
 * with # are ignored. Names match the card table case-insensitively; when
 * you own more than one legal card of that name the higher value wins —
 * pin one with "Name 87" (or "Name (VAR)" for the variant form).
 *
 * Same environment, pool, rules, objective and search as env-roster (and
 * /build's Optimise): calibrated runs per board, the field's handedness,
 * gloves in runs, the glove floor. The search runs one accepted move at a
 * time from YOUR roster so each step's gain is printed in the order the
 * hill-climb takes them, which is steepest-first.
 */
import { readFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, seriesMeta, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { HIT_POS, rosterShape, type FillCard, type FillShape } from "@/lib/roster-fill";
import { cardEligibility, rosterSize, validateRoster, type RosterRules, type RosterSlot } from "@/lib/roster-rules";
import { LJ_FLOOR, parsePosFloor, type PosFloor } from "@/lib/pos-floor";
import { rosterObjective, LHP_SHARE_DEFAULT, RP_WEIGHT_DEFAULT, BENCH_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { bothHands, loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { optimizeRoster } from "@/lib/roster-optimize";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

const ROSTER = val("roster");
if (!ROSTER) { console.error("--roster FILE is required"); process.exit(1); }
const YEAR = num("year"), PARK = val("park") ?? null, PARK_YEAR = num("park-year"), DH = flag("dh");
/** The era correction (calibration.ts ERA_SLOPES) is on unless --no-era-correct; PT default reads as 2010. */
const ERA_YEAR: number | null = argv.includes("--no-era-correct") ? null : (YEAR ?? 2010);
const MIN = num("min"), MAX = num("max"), CAP = num("cap"), SIZE = num("size", 26)!;
const SERIES = val("series") ?? null;
const VARIANT_CAP = num("variant-cap");
const ROLE_TRUST = num("role-trust", 0.25)!;
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;
const MIN_DEF = num("min-def", 0.6)!;
const MIN_POS: PosFloor = parsePosFloor(val("min-pos")) ?? LJ_FLOOR;
const CANDIDATE_LIMIT = num("candidate-limit", 120)!;
const MAX_MOVES = num("max-moves", 30)!;
/** --card-types 2,6,7: OOTP card_type codes an event limits the pool to (see env-roster). */
const CARD_TYPES = new Set((val("card-types") ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0));
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[String(YEAR)] ?? eraTable["0"];
  const pr = parkRow(PARK, PARK_YEAR);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);
  const rules: RosterRules = {
    name: SERIES ?? "roster", dh: DH, ratingsMin: MIN, ratingsMax: MAX, cardYearMin: num("card-year-min"), cardYearMax: num("card-year-max"),
    isDraft: false, restrictions: { teamCap: CAP, cards: SIZE, variantCap: VARIANT_CAP, variantsAllowed: VARIANT_CAP !== 0 },
  };

  /* ---- the pool, exactly as env-roster builds it ---- */
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (!latest) throw new Error("no collection upload");
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  type P = FillCard & { pos: string; bats: string | null };
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

  /* ---- the field ---- */
  const [meta] = SERIES ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, SERIES)) : [];
  const LHP = num("lhp-share") ?? meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
  const LHB = meta?.lhbPaShare ?? 0.35;
  const lineupPos = DH ? [...HIT_POS, "DH"] : [...HIT_POS];

  /* ---- the roster file ---- */
  const lines = readFileSync(ROSTER!, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const slots: Record<string, number> = {};
  const unmatched: string[] = [];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  for (const l of lines) {
    const m = /^(\S+)\s+(.+)$/.exec(l); if (!m) continue;
    const key = m[1].toUpperCase().replace(/^([RL]):/, (_, h) => `${h}:`);
    let who = m[2].trim();
    const wantVar = /\(VAR\)$/i.test(who); who = who.replace(/\s*\(VAR\)$/i, "");
    const valPin = /\s(\d{2,3})$/.exec(who); if (valPin) who = who.slice(0, -valPin[0].length);
    const hits = pool.filter((c) => norm(c.name) === norm(who) && (valPin ? c.val === Number(valPin[1]) : true) && (wantVar ? c.variant : true));
    const wantPitcher = /^(SP|RP|CL)/.test(key);
    const fit = hits.filter((c) => c.isPitcher === wantPitcher);
    // Different cards of one name: the higher value is the one in play (a
    // variant shares its base's value and is already the pool's form of it).
    const pick = (fit.length ? fit : hits).sort((a, b) => (b.val ?? 0) - (a.val ?? 0))[0];
    if (!pick) { unmatched.push(l); continue; }
    slots[key] = pick.cardId;
  }
  if (unmatched.length) console.log(`!! not in your legal pool (check the name, value window, or the collection date): ${unmatched.join(" · ")}`);

  const shp = rosterShape(YEAR, lineupPos.length, rosterSize(rules) ?? SIZE, meta ? { avgBats: meta.avgBats, avgSp: meta.avgSp, avgRp: meta.avgRp } : null);
  // The shape comes from the FILE's slot keys (a name that fails to match
  // still counts as a slot), else the series' observed shape.
  const fileKeys = lines.map((l) => (/^(\S+)/.exec(l)?.[1] ?? "").toUpperCase());
  const sp = fileKeys.filter((k) => /^SP\d+$/.test(k)).length || shp.sp;
  const rp = fileKeys.filter((k) => /^(RP\d+|CL)$/.test(k)).length || shp.rp;
  const bn = fileKeys.filter((k) => /^BN\d+$/.test(k)).length;
  const bats = Math.max(lineupPos.length + bn, SIZE - sp - rp);
  const shape: FillShape = {
    lineupPos, bats,
    spKeys: Array.from({ length: sp }, (_, i) => `SP${i + 1}`),
    rpKeys: ["CL", ...Array.from({ length: rp - 1 }, (_, i) => `RP${i + 1}`)],
    benchKeys: Array.from({ length: bats - lineupPos.length }, (_, i) => `BN${i + 1}`),
  };
  const missing = [...shape.lineupPos.flatMap((p) => [`R:${p}`, `L:${p}`]), ...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys].filter((k) => slots[k] == null);
  if (missing.length) console.log(`!! slots the file did not fill (or whose card is not on record): ${missing.join(", ")} — the best available card is stood in so the rest can be scored`);

  /* ---- score ---- */
  const all = universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> }));
  const base = envFitMaps(all, { era: era.rates, park: pr, roleTrust: ROLE_TRUST, leagueLhbShare: LHB, eraYear: ERA_YEAR });
  const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id); return r == null || l == null ? null : (1 - LHP) * r + LHP * l; };
  const observed = OBS_K > 0 ? await loadObservedRuns(pool.map((c) => c.cardId), both, bothHands(base)) : undefined;
  const fits = envFitMaps(pool, { era: era.rates, park: pr, minPosRating: MIN_POS, roleTrust: ROLE_TRUST, observed, observedK: OBS_K, leagueLhbShare: LHB, eraYear: ERA_YEAR });
  const { objective, rank, defAt } = rosterObjective(pool, { shape, runsR: fits.runsR, runsL: fits.runsL, lhpShare: LHP, rpWeight: RP_WEIGHT_DEFAULT, benchWeight: BENCH_WEIGHT_DEFAULT });
  const poolById = new Map(pool.map((c) => [c.cardId, c]));
  const nameOf = (id: number | undefined) => { const c = id != null ? poolById.get(id) : undefined; return c ? `${c.name}${c.variant ? " (VAR)" : ""}` : "—"; };
  const runsAt = (key: string, id: number) => {
    const c = poolById.get(id); if (!c) return null;
    const pos = key.includes(":") ? key.split(":")[1] : "";
    const r = key.startsWith("L:") ? fits.runsL.get(id) : fits.runsR.get(id);
    return r == null ? null : r + (pos && pos !== "DH" ? defAt(id, pos) : 0);
  };

  for (const k of missing) {
    const used = new Set(Object.values(slots));
    const pos = k.includes(":") ? k.split(":")[1] : k;
    const ok = (c: P) => /^SP\d+$/.test(pos) ? c.isPitcher && c.role === "SP" : /^(RP\d+|CL)$/.test(pos) ? c.isPitcher : !c.isPitcher && (pos === "DH" || /^BN/.test(pos) || (c.ratings[`Pos Rating ${pos}`] ?? 0) >= 70);
    const best = pool.filter((c) => ok(c) && !used.has(c.cardId)).sort((a, b) => rank(k, b) - rank(k, a))[0];
    if (best) { slots[k] = best.cardId; console.log(`   ${k}: standing in ${best.name}`); }
  }
  const start = objective(slots);
  const v = validateRoster(Object.entries(slots).map(([k, cardId]): RosterSlot => {
    const [a, b] = k.split(":");
    return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false };
  }), pool, rules);
  console.log(`\n=== ${SERIES ?? "roster"} · ${YEAR ?? "PT default"} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : ""} · ${DH ? "DH" : "no DH"} · lineups ${Math.round((1 - LHP) * 100)}/${Math.round(LHP * 100)} R/L${meta ? " (field)" : " (default)"} ===`);
  console.log(`your roster as loaded: ${start.toFixed(1)} runs · ${v.ready ? "legal" : "NOT LEGAL: " + [...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  console.log(`\nweakest slots as they stand (runs on that board, glove included):`);
  const keys = [...lineupPos.flatMap((p) => [`R:${p}`, `L:${p}`]), ...shape.spKeys, ...shape.rpKeys];
  const weak = keys.map((k) => ({ k, r: runsAt(k, slots[k]) ?? 0 })).sort((a, b) => a.r - b.r).slice(0, 6);
  for (const w of weak) console.log(`  ${w.k.padEnd(6)} ${nameOf(slots[w.k]).padEnd(28)} ${f1(w.r)}`);

  /* ---- one accepted move at a time, from your roster ---- */
  let cur = { ...slots }, score = start, n = 0;
  console.log(`\nswaps in the order the search takes them (steepest first) — do the top few and stop:`);
  while (n < MAX_MOVES) {
    const r = optimizeRoster(cur, pool, rules, shape, {
      objective, minDefShare: MIN_DEF, posFloor: MIN_POS, pairMoves: { aTop: 8, bCheapest: 10, rank }, candidateLimit: CANDIDATE_LIMIT, maxPasses: 1,
    });
    if (r.moves === 0 || r.score <= score + 1e-9) break;
    n++;
    const changed = Object.keys({ ...cur, ...r.slots }).filter((k) => cur[k] !== r.slots[k]);
    const before = new Set(Object.values(cur)), after = new Set(Object.values(r.slots));
    const out = [...before].filter((id) => !after.has(id)).map(nameOf), inn = [...after].filter((id) => !before.has(id)).map(nameOf);
    const head = out.length || inn.length ? `${out.join(", ") || "—"}  →  ${inn.join(", ") || "—"}` : "re-arrange";
    console.log(`\n${String(n).padStart(2)}. ${f1(r.score - score)} runs  (${score.toFixed(1)} → ${r.score.toFixed(1)})   ${head}`);
    for (const k of changed) console.log(`      ${k.padEnd(6)} ${nameOf(cur[k])} → ${nameOf(r.slots[k])}`);
    cur = r.slots; score = r.score;
  }
  console.log(`\nafter ${n} move${n === 1 ? "" : "s"}: ${score.toFixed(1)} runs (${f1(score - start)}); value ${[...new Set(Object.values(cur))].reduce((s, id) => s + (poolById.get(id)?.val ?? 0), 0)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
