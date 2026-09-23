/**
 * Best bats on ONE platoon board — the platoon-bat question.
 *
 * shop-fit blends the boards 70/30 toward vs-RHP, which is right for an
 * everyday bat and wrong for a card bought to start only against one hand.
 * This ranks purely on the board you ask for, prints the other side beside it
 * so a pure platoon card is visible as one, and marks what is already owned.
 *
 *   node --env-file=.env.local --import tsx scripts/vl-dh.ts --budget 120000 --show 25
 *   ... --board vR                 (rank vs RHP instead — the everyday-bat side)
 *   ... --set Clubhouse            (candidates restricted to one set/title prefix)
 *   ... --name "J.D. Martinez"     (score one card wherever it ranks)
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const YEAR = val("year", "2010")!, BUDGET = num("budget", 120000)!, SHOW = num("show", 25)!;
const PARK = val("park") ?? null, PARK_YEAR = num("park-year"), NAME = val("name") ?? null;
const MINVAL = num("min-value", 95)!;
/** Which platoon board ranks. vL = the board a bat plays against left-handers. */
const BOARD = /^v?R$/i.test(val("board", "vL")!) ? "R" : "L";
/** Restrict the CANDIDATE list to one set, matched on the card title prefix. */
const SET = val("set") ?? null;
const ME = BOARD === "R" ? "vsRHP" : "vsLHP";
const THEM = BOARD === "R" ? "vsLHP" : "vsRHP";
/** The board being ranked, and the other one. */
const on = (c: any) => (BOARD === "R" ? c.vR : c.vL);
const off = (c: any) => (BOARD === "R" ? c.vL : c.vR);
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

(async () => {
  const era = eraTable[YEAR]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  const half = pr ? { avgL: 1+(pr.avgL!-1)/2, avgR: 1+(pr.avgR!-1)/2, hrL: 1+(pr.hrL!-1)/2,
                      hrR: 1+(pr.hrR!-1)/2, d2: 1+(pr.d2!-1)/2, d3: 1+(pr.d3!-1)/2 } as any : null;
  const UP = Number(asRows<any>(await db.execute(sql`select max(id) as id from uploads where kind='collection'`))[0].id);

  const owned = asRows<any>(await db.execute(sql`
    select cc.id row_id, cc.card_id, coalesce(c.name, cc.name) name, coalesce(c.card_value, cc.card_value) val,
           c.tier, c.year, c.bats, c.is_pitcher, c.position, c.ratings, cc.ratings copy_ratings, cc.is_variant, cc.pos cpos
    from collection_cards cc left join cards c on c.card_id = cc.card_id where cc.upload_id = ${UP}`));
  const ownedIds = new Set(owned.map((r) => Number(r.card_id)));
  const shop = asRows<any>(await db.execute(sql`
    select c.card_id, c.name, c.card_value val, c.tier, c.year, c.bats, c.is_pitcher, c.position, c.ratings,
           c.title, s.buy_order_high, s.sell_order_low, s.last10, s.owned
    from cards c join card_snapshots s on s.card_id = c.card_id
     and s.upload_id = (select max(upload_id) from card_snapshots)
    where c.card_value >= ${MINVAL} and c.is_pitcher = false`));

  const pool: any[] = [];
  for (const r of owned) {
    if (r.is_pitcher ?? /^(SP|RP|CL|P)$/.test(String(r.cpos ?? ""))) continue;
    pool.push({ cardId: `o${r.row_id}`, name: r.name, val: Number(r.val), tier: r.tier, year: r.year,
      bats: r.bats ?? "R", isPitcher: false, ownedFlag: true, variant: r.is_variant,
      role: r.position ?? r.cpos, ratings: mergeCopyRatings(r.ratings ?? {}, r.copy_ratings ?? null, r.cpos) });
  }
  for (const c of shop) {
    if (ownedIds.has(Number(c.card_id))) continue;
    pool.push({ cardId: `s${c.card_id}`, name: c.name, val: Number(c.val), tier: c.tier, year: c.year,
      bats: c.bats ?? "R", isPitcher: false, ownedFlag: false, role: c.position, ratings: c.ratings ?? {},
      title: c.title, buy: c.buy_order_high, sell: c.sell_order_low, last10: c.last10 });
  }
  const fits = envFitMaps(pool as any, { era: era.rates, park: half, eraYear: Number(YEAR) });
  for (const c of pool) { c.vL = fits.runsL.get(c.cardId) ?? null; c.vR = fits.runsR.get(c.cardId) ?? null; }
  const price = (c: any) => { const n = [c.sell, c.last10, c.buy].map(Number).filter((x) => Number.isFinite(x) && x > 0); return n.length ? n[0] : null; };

  const bar = (c: any) => (c == null ? "n/a" : f1(on(c)));
  const ownedBats = pool.filter((c) => c.ownedFlag && on(c) != null).sort((a, b) => on(b) - on(a));
  console.log(`\n=== ${ME} board · ${YEAR} RE ${pr ? `· ${PARK_YEAR} ${PARK} (half)` : "· neutral"} · collection upload ${UP} ===`);
  console.log(`your own ${ME} bar: #1 ${ownedBats[0]?.name} ${bar(ownedBats[0])}, #5 ${bar(ownedBats[4])}, #9 ${bar(ownedBats[8])}, #14 ${bar(ownedBats[13])}`);
  const hdr = `  ${ME.padStart(6)} ${THEM.padStart(6)} ${"split".padStart(6)} ${"val".padStart(4)} ${"B"} ${"year".padStart(5)} ${"name".padEnd(24)} pos    price`;
  const line = (c: any) => { const p = price(c);
    console.log(`  ${f1(on(c)).padStart(6)} ${f1(off(c)).padStart(6)} ${f1(on(c) - off(c)).padStart(6)} ${String(c.val).padStart(4)} ${c.bats} ${String(c.year ?? "").padStart(5)} ${String(c.name).slice(0,24).padEnd(24)} ${String(c.role ?? "").padEnd(4)} ${c.ownedFlag ? "  OWNED" : p == null ? "     —" : String(p).padStart(8)}${!c.ownedFlag && p != null && p <= BUDGET ? "  YES" : ""}`); };

  if (NAME) {
    const hits = pool.filter((c) => String(c.name).toLowerCase().includes(NAME.toLowerCase()));
    const ranked = pool.filter((c) => on(c) != null).sort((a, b) => on(b) - on(a));
    console.log(`\n--- "${NAME}" ---`); console.log(hdr);
    for (const h of hits.sort((a, b) => on(b) - on(a))) { line(h); console.log(`        rank ${ranked.indexOf(h)+1} of ${ranked.length} on the ${ME} board`); }
  }
  console.log(`\n--- your 10 best owned bats ${ME} ---`); console.log(hdr); ownedBats.slice(0, 10).forEach(line);
  const inSet = (c: any) => SET == null || String(c.title ?? "").toLowerCase().startsWith(SET.toLowerCase());
  const buy = pool.filter((c) => !c.ownedFlag && on(c) != null && inSet(c) && (price(c) ?? 1e9) <= BUDGET).sort((a, b) => on(b) - on(a));
  console.log(`\n--- best UNOWNED${SET ? ` ${SET}` : ""} bats ${ME} at or under ${BUDGET.toLocaleString()} PP ---`); console.log(hdr); buy.slice(0, SHOW).forEach(line);
  process.exit(0);
})();
