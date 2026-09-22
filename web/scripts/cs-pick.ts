/**
 * Score a named shortlist — the clubhouse asks in CS, whose prices live only in
 * screenshots — against the bar his own roster already sets.
 *
 * Arms are shown on the same footing the archive says they are actually used:
 * roleTrust 0.25 (relievers do not get better in the pen; the RA9 gain is
 * inherited-runner accounting) and a relief inning counted at 0.31 of a
 * starter's, which is what 12,019 team-events measured, not the 0.5 the old
 * RP_WEIGHT assumed.
 *
 *   node --env-file=.env.local --import tsx scripts/cs-pick.ts \
 *     --names "J.D. Martinez,Aroldis Chapman,Armando Benitez,Freddie Lindstrom" \
 *     --park "Southwest University Park" --park-year 2026
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const YEAR = val("year", "2010")!, PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const NAMES = (val("names", "")!).split(",").map((s) => s.trim()).filter(Boolean);
const WL = 0.3, ROLE_TRUST = 0.25, RP_SHARE = 0.31;
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;   // 0 turns observed play off
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

(async () => {
  const era = eraTable[YEAR]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  const half = pr ? { avgL: 1+(pr.avgL!-1)/2, avgR: 1+(pr.avgR!-1)/2, hrL: 1+(pr.hrL!-1)/2,
                      hrR: 1+(pr.hrR!-1)/2, d2: 1+(pr.d2!-1)/2, d3: 1+(pr.d3!-1)/2 } as any : null;
  const UP = Number(asRows<any>(await db.execute(sql`select max(id) as id from uploads where kind='collection'`))[0].id);

  const owned = asRows<any>(await db.execute(sql`
    select cc.id row_id, cc.card_id, coalesce(c.name, cc.name) name, coalesce(c.card_value, cc.card_value) val,
           c.tier, c.year, c.bats, c.is_pitcher, c.pitcher_role, c.position, c.ratings, cc.ratings copy_ratings, cc.pos cpos
    from collection_cards cc left join cards c on c.card_id = cc.card_id where cc.upload_id = ${UP}`));
  const ownedIds = new Set(owned.map((r) => Number(r.card_id)));
  const shop = asRows<any>(await db.execute(sql`
    select c.card_id, c.name, c.card_value val, c.tier, c.year, c.bats, c.is_pitcher, c.pitcher_role,
           c.position, c.ratings, s.buy_order_high, s.sell_order_low, s.last10
    from cards c join card_snapshots s on s.card_id=c.card_id
     and s.upload_id=(select max(upload_id) from card_snapshots) where c.card_value >= 90`));

  const pool: any[] = [];
  for (const r of owned) {
    const isP = r.is_pitcher ?? /^(SP|RP|CL|P)$/.test(String(r.cpos ?? ""));
    pool.push({ cardId: `o${r.row_id}`, realId: Number(r.card_id), name: r.name, val: Number(r.val), tier: r.tier, year: r.year,
      bats: r.bats ?? "R", isPitcher: isP, ownedFlag: true, role: isP ? (r.pitcher_role ?? r.cpos) : (r.position ?? r.cpos),
      ratings: mergeCopyRatings(r.ratings ?? {}, r.copy_ratings ?? null, r.cpos) });
  }
  for (const c of shop) {
    if (ownedIds.has(Number(c.card_id))) continue;
    pool.push({ cardId: `s${c.card_id}`, realId: Number(c.card_id), name: c.name, val: Number(c.val), tier: c.tier, year: c.year,
      bats: c.bats ?? "R", isPitcher: c.is_pitcher, ownedFlag: false,
      role: c.is_pitcher ? c.pitcher_role : c.position, ratings: c.ratings ?? {},
      buy: c.buy_order_high, sell: c.sell_order_low, last10: c.last10 });
  }

  /**
   * OBSERVED PLAY. shop-fit and cs-pick were model-only, and the model alone
   * is not the better predictor: blended by precision at K = 2500 PA/BF a
   * held-out half is predicted at .63 (hitters) / .59 (arms) against .58 / .55
   * for the model on its own (pnpm observed:validate). It matters most for
   * exactly this question — Aroldis Chapman grades +10 on his ratings and has
   * thrown 2,448 innings at a 4.27 FIP against a 4.27 field, and a buy list
   * that cannot see that will keep recommending him.
   *
   * Two passes, as env-roster does: score the pool once with no observed term
   * to give each series its zero point, then blend. Pool ids here are synthetic
   * ("o<row>" / "s<card>") because an owned copy and a shop listing share a
   * card_id, so the observed map is re-keyed onto them.
   */
  let observed: Map<any, { runs: number; n: number }> | undefined;
  if (OBS_K > 0) {
    const byReal = new Map<number, any>();
    for (const c of pool) if (c.realId && !byReal.has(c.realId)) byReal.set(c.realId, c);
    const base = envFitMaps([...byReal.values()].map((c) => ({
      cardId: c.realId, isPitcher: c.isPitcher, bats: c.bats, ratings: c.ratings, role: c.role,
    })) as any, { era: era.rates, park: half, roleTrust: ROLE_TRUST, eraYear: Number(YEAR) });
    const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id);
      return r == null || l == null ? null : (1 - WL) * r + WL * l; };
    const byCard = await loadObservedRuns([...byReal.keys()], both);
    observed = new Map();
    let hit = 0;
    for (const c of pool) { const o = c.realId != null ? byCard.get(c.realId) : undefined;
      if (o) { observed.set(c.cardId, o); hit++; } }
    console.log(`observed play: ${hit} of ${pool.length} cards have play on record; K = ${OBS_K}`);
  }
  const fits = envFitMaps(pool as any, { era: era.rates, park: half, roleTrust: ROLE_TRUST, eraYear: Number(YEAR), observed, observedK: OBS_K } as any);
  for (const c of pool) {
    c.vL = fits.runsL.get(c.cardId) ?? null; c.vR = fits.runsR.get(c.cardId) ?? null;
    c.blend = c.vL == null ? null : c.vR * (1 - WL) + c.vL * WL;
    // A relief arm throws ~0.31 of a starter's batters, so its runs are worth that share of a roster slot.
    c.slot = c.blend == null ? null : (c.isPitcher && /RP|CL/.test(String(c.role ?? "")) ? c.blend * RP_SHARE : c.blend);
  }
  const bats = pool.filter((c) => c.ownedFlag && !c.isPitcher && c.blend != null).sort((a,b)=>b.blend-a.blend);
  const batsL = [...bats].sort((a,b)=>b.vL-a.vL);
  const arms = pool.filter((c) => c.ownedFlag && c.isPitcher && c.blend != null).sort((a,b)=>b.blend-a.blend);
  const pen  = arms.filter((c)=>/RP|CL/.test(String(c.role ?? ""))).sort((a,b)=>b.blend-a.blend);
  console.log(`\n=== ${YEAR} RE ${pr ? `· ${PARK_YEAR} ${PARK} (half)` : "· neutral"} · collection upload ${UP} · roleTrust ${ROLE_TRUST} ===`);
  console.log(`your bars — bat #9 ${f1(bats[8].blend)} (${bats[8].name}), bat #14 ${f1(bats[13].blend)}`);
  console.log(`            bat vs LHP #9 ${f1(batsL[8].vL)} (${batsL[8].name})`);
  console.log(`            arm #12 ${f1(arms[11].blend)} (${arms[11].name})`);
  console.log(`            relief arm #6 ${f1(pen[5].blend)} (${pen[5].name}), #7 ${f1(pen[6].blend)}, #8 ${f1(pen[7].blend)}`);
  console.log(`\n--- your bullpen as ranked (blend, and the same number at a relief arm's real 0.31 workload) ---`);
  for (const c of pen.slice(0, 9)) console.log(`  ${String(c.name).slice(0,22).padEnd(23)} ${String(c.val).padStart(3)} ${String(c.role).padEnd(2)} STM ${String(Math.round(c.ratings["Stamina"] ?? 0)).padStart(3)}  blend ${f1(c.blend).padStart(6)}  slot ${f1(c.slot).padStart(6)}`);
  console.log(`\n--- shortlist ---`);
  console.log(`  ${"blend".padStart(6)} ${"slot".padStart(6)} ${"vsLHP".padStart(6)} ${"vsRHP".padStart(6)} ${"val".padStart(4)} ${"name".padEnd(22)} pos  STM   PP ask`);
  for (const n of NAMES) {
    const hits = pool.filter((c) => String(c.name).toLowerCase().includes(n.toLowerCase()) && c.blend != null)
      .sort((a,b)=>b.blend-a.blend).slice(0, 3);
    if (!hits.length) { console.log(`  (no card matching "${n}")`); continue; }
    for (const c of hits) {
      const p = [c.sell, c.last10, c.buy].map(Number).filter((x)=>Number.isFinite(x)&&x>0)[0];
      console.log(`  ${f1(c.blend).padStart(6)} ${f1(c.slot).padStart(6)} ${f1(c.vL).padStart(6)} ${f1(c.vR).padStart(6)} ${String(c.val).padStart(4)} ${String(c.name).slice(0,22).padEnd(22)} ${String(c.role??"").padEnd(4)} ${String(Math.round(c.ratings["Stamina"]??0)).padStart(3)} ${c.ownedFlag ? "   OWNED" : p ? String(p).padStart(8) : "       —"}`);
    }
  }
  process.exit(0);
})();
