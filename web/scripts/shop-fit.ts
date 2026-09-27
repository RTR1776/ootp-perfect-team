/**
 * What is worth BUYING — scores every card in the universe (owned or not) in
 * the same environment as the collection, then joins the shop snapshot so the
 * answer is runs per PP / per CS rather than runs in the abstract.
 *
 *   node --env-file=.env.local --import tsx scripts/shop-fit.ts \
 *     --year 2010 --budget 75000 --show 30 [--upload <collection upload id>]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { bothHands, loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const YEAR = val("year", "2010")!, UPLOAD_ARG = num("upload");
const PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const BUDGET = num("budget", 75000)!, SHOW = num("show", 30)!, MINVAL = num("min-value", 95)!;
const WL = 0.3;
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;   // 0 turns observed play off
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[YEAR]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  const half = pr ? { avgL: 1 + (pr.avgL! - 1) / 2, avgR: 1 + (pr.avgR! - 1) / 2,
    hrL: 1 + (pr.hrL! - 1) / 2, hrR: 1 + (pr.hrR! - 1) / 2,
    d2: 1 + (pr.d2! - 1) / 2, d3: 1 + (pr.d3! - 1) / 2 } as any : null;

  // The newest collection unless --upload names another (it used to default to #135, the 09-20 one).
  const UPLOAD = UPLOAD_ARG ?? Number(asRows<{ id: number | string }>(await db.execute(sql`select max(id) as id from uploads where kind = 'collection'`))[0].id);
  const owned = asRows<any>(await db.execute(sql`
    select cc.id row_id, cc.card_id, coalesce(c.name, cc.name) name, coalesce(c.card_value, cc.card_value) val,
           c.tier, c.year, c.bats, c.is_pitcher, c.pitcher_role, c.position,
           c.ratings ratings, cc.ratings copy_ratings, cc.is_variant, cc.pos cpos
    from collection_cards cc left join cards c on c.card_id = cc.card_id
    where cc.upload_id = ${UPLOAD}`));
  const ownedIds = new Set(owned.map((r) => Number(r.card_id)));

  /* Latest shop snapshot: price and whether he already holds a copy. */
  const shop = asRows<any>(await db.execute(sql`
    select c.card_id, c.name, c.card_value val, c.tier, c.year, c.bats, c.is_pitcher,
           c.pitcher_role, c.position, c.ratings,
           s.buy_order_high, s.sell_order_low, s.last10, s.owned
    from cards c
    join card_snapshots s on s.card_id = c.card_id
     and s.upload_id = (select id from uploads where kind = 'shop_list' order by uploaded_at desc, id desc limit 1)
    where c.card_value >= ${MINVAL}`));

  const pool: any[] = [];
  for (const r of owned) {
    const isP = r.is_pitcher ?? /^(SP|RP|CL|P)$/.test(String(r.cpos ?? ""));
    pool.push({ cardId: `o${r.row_id}`, realId: Number(r.card_id), name: r.name, val: Number(r.val),
      tier: r.tier, year: r.year, bats: r.bats ?? "R", isPitcher: isP, ownedFlag: true,
      role: isP ? (r.pitcher_role ?? r.cpos) : (r.position ?? r.cpos),
      ratings: mergeCopyRatings(r.ratings ?? {}, r.copy_ratings ?? null), baseRatings: r.ratings ?? undefined });
  }
  for (const c of shop) {
    if (ownedIds.has(Number(c.card_id))) continue;
    pool.push({ cardId: `s${c.card_id}`, realId: Number(c.card_id), name: c.name, val: Number(c.val),
      tier: c.tier, year: c.year, bats: c.bats ?? "R", isPitcher: c.is_pitcher, ownedFlag: false,
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
   *
   * The zero point is scored on the BASE card's ratings, and passed as the
   * reference, so an owned variant keeps its rating boost: the blend moves a
   * copy by how far the card's play ran from the base card's model, not to the
   * base card's level (observed-blend.ts, 2026-09-26).
   */
  let observed: Map<any, { runs: number; n: number; model: number | null }> | undefined;
  if (OBS_K > 0) {
    const byReal = new Map<number, any>();
    for (const c of pool) if (c.realId && !byReal.has(c.realId)) byReal.set(c.realId, c);
    const base = envFitMaps([...byReal.values()].map((c) => ({
      cardId: c.realId, isPitcher: c.isPitcher, bats: c.bats, ratings: c.baseRatings ?? c.ratings, role: c.role,
    })) as any, { era: era.rates, park: half, eraYear: Number(YEAR) });
    const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id);
      return r == null || l == null ? null : (1 - WL) * r + WL * l; };
    const byCard = await loadObservedRuns([...byReal.keys()], both, bothHands(base));
    observed = new Map();
    let hit = 0;
    for (const c of pool) { const o = c.realId != null ? byCard.get(c.realId) : undefined;
      if (o) { observed.set(c.cardId, o); hit++; } }
    console.log(`observed play: ${hit} of ${pool.length} cards have play on record; K = ${OBS_K}`);
  }
  const fits = envFitMaps(pool as any, { era: era.rates, park: half, eraYear: Number(YEAR), observed, observedK: OBS_K } as any);
  const score = (c: any) => {
    const r = fits.runsR.get(c.cardId), l = fits.runsL.get(c.cardId);
    return r == null || l == null ? -1e6 : r * (1 - WL) + l * WL;
  };
  for (const c of pool) c.s = score(c);

  const ownedBats = pool.filter((c) => c.ownedFlag && !c.isPitcher).sort((a, b) => b.s - a.s);
  const ownedArms = pool.filter((c) => c.ownedFlag && c.isPitcher).sort((a, b) => b.s - a.s);
  console.log(`\n=== shop fit · ${YEAR} RE ${pr ? `· ${PARK_YEAR} ${PARK}` : "· neutral"} ===`);
  console.log(`his own bar — bat #14 ${f1(ownedBats[13]?.s)} (${ownedBats[13]?.name}), bat #10 ${f1(ownedBats[9]?.s)}, bat #5 ${f1(ownedBats[4]?.s)}`);
  console.log(`              arm #12 ${f1(ownedArms[11]?.s)} (${ownedArms[11]?.name}), arm #8 ${f1(ownedArms[7]?.s)}, arm #5 ${f1(ownedArms[4]?.s)}`);

  const price = (c: any) => {
    const n = [c.sell, c.last10, c.buy].map(Number).filter((x) => Number.isFinite(x) && x > 0);
    return n.length ? n[0] : null;
  };
  for (const [lbl, list] of [["BATS", pool.filter((c) => !c.ownedFlag && !c.isPitcher)],
                             ["ARMS", pool.filter((c) => !c.ownedFlag && c.isPitcher)]] as const) {
    const rows = (list as any[]).filter((c) => c.s > -1e5).sort((a, b) => b.s - a.s).slice(0, SHOW);
    console.log(`\n--- best UNOWNED ${lbl} at ${YEAR} (price = sell-order low, else last-10) ---`);
    console.log(`  runs  val tier    year name                      pos    price  affordable`);
    for (const c of rows) {
      const p = price(c);
      const aff = p == null ? "?" : p <= BUDGET ? "YES" : "";
      console.log(`  ${f1(c.s).padStart(6)} ${String(c.val).padStart(4)} ${String(c.tier ?? "").padEnd(8)}${String(c.year ?? "").padStart(5)} ${String(c.name).slice(0, 24).padEnd(25)}${String(c.role ?? "").padEnd(4)} ${p == null ? "     —" : String(p).padStart(8)}  ${aff}`);
    }
  }
  process.exit(0);
}
main();
