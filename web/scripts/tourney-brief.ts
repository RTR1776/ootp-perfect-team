/**
 * What a tournament series has actually rewarded — and what it would cost to
 * buy into it.
 *
 * The roster builder scores cards from ratings. This reads the other record:
 * every card that has played this exact series, what it did, whether L.J. owns
 * it, and what the shop wants for it if he doesn't. Two independent views of
 * the same question, which is the only way to catch the model being confidently
 * wrong about a card type this event happens to punish.
 *
 *   pnpm tourney:brief --series bronzeweekly [--min-pa 150] [--min-ip 40] [--top 20]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number) => { const v = val(k); return v == null ? d : Number(v); };
const SERIES = val("series")!;
const MINPA = num("min-pa", 150), MINIP = num("min-ip", 40), TOP = num("top", 20);
/** A 0 in the shop columns means "no live order", not "free". */
const money = (n: any) => (n == null || Number(n) === 0) ? "none" : Number(n).toLocaleString("en-US");

async function main() {
  const [t] = asRows<any>(await db.execute(sql`
    select * from tournaments where series = ${SERIES} order by updated_at desc limit 1`));
  if (!t) throw new Error(`no tournament row for series ${SERIES}`);

  console.log(`\n=== ${t.name} ===`);
  console.log(`  RE ${t.env_year} · ${t.stadium} · ${t.mode} · DH ${t.dh ? "on" : "off"} · ${t.entrants} teams`);
  console.log(`  cards VAL ${t.ratings_min}-${t.ratings_max}` +
    (t.card_year_min ? ` · years ${t.card_year_min}-${t.card_year_max}` : " · any year"));

  const [own] = asRows<any>(await db.execute(sql`
    select id from uploads where kind = 'collection' order by uploaded_at desc limit 1`));
  const [shop] = asRows<any>(await db.execute(sql`
    select id from uploads where kind = 'shop_list' order by uploaded_at desc limit 1`));

  /**
   * Eligibility is the event's own window. A card outside it cannot be bought
   * into this tournament however well it has played elsewhere.
   */
  const elig = sql`c.card_value between ${t.ratings_min} and ${t.ratings_max}
    ${t.card_year_min ? sql`and c.year between ${t.card_year_min} and ${t.card_year_max}` : sql``}`;

  for (const side of ["bats", "arms"] as const) {
    const isP = side === "arms";
    const rows = asRows<any>(await db.execute(sql`
      select c.card_id, c.name, c.card_value val, c.tier, c.year, c.position, c.pitcher_role,
             o.pa, o.ip, o.woba, o.fip, o.war, o.instances,
             (select count(*) from collection_cards cc
               where cc.upload_id = ${own?.id ?? 0} and cc.card_id = c.card_id) owned,
             s.buy_order_high, s.sell_order_low, s.last10
      from observed_card_stats o
      join cards c on c.card_id = o.card_id
      left join card_snapshots s on s.card_id = c.card_id and s.upload_id = ${shop?.id ?? 0}
      where o.series = ${SERIES} and o.is_pitcher = ${isP} and ${elig}
        and ${isP ? sql`o.ip >= ${MINIP}` : sql`o.pa >= ${MINPA}`}
      order by ${isP ? sql`o.fip asc` : sql`o.woba desc`}
      limit ${TOP * 3}`));

    console.log(`\n--- best ${side} this series has seen  (min ${isP ? `${MINIP} IP` : `${MINPA} PA`}) ---`);
    console.log(`      val yr   name                      ${isP ? "  IP   FIP" : "  PA  wOBA"}   WAR  runs   own   ask`);
    for (const r of rows.slice(0, TOP)) {
      const stat = isP ? `${String(Math.round(r.ip)).padStart(5)} ${Number(r.fip).toFixed(2).padStart(5)}`
                       : `${String(r.pa).padStart(5)} ${Number(r.woba).toFixed(3).padStart(5)}`;
      const per = isP ? Number(r.war) / (Number(r.ip) / 200) : Number(r.war) / (Number(r.pa) / 600);
      console.log(`  ${String(r.val).padStart(5)} ${String(r.year ?? "").padStart(4)}  ` +
        `${String(r.name).slice(0, 24).padEnd(25)} ${stat} ${Number(r.war).toFixed(1).padStart(5)} ` +
        `${per.toFixed(1).padStart(5)}   ${r.owned > 0 ? "YES" : " – "}  ` +
        `${r.owned > 0 ? "" : money(r.sell_order_low || r.last10)}`);
    }

    const buy = rows.filter((r) => Number(r.owned) === 0).slice(0, 12);
    if (buy.length) {
      console.log(`\n  >> NOT OWNED — what this series rewards and he does not have:`);
      for (const r of buy) {
        const stat = isP ? `FIP ${Number(r.fip).toFixed(2)} in ${Math.round(r.ip)} IP`
                         : `wOBA ${Number(r.woba).toFixed(3)} in ${r.pa} PA`;
        console.log(`     ${String(r.val).padStart(3)} ${String(r.year ?? "").padStart(4)} ` +
          `${String(r.name).slice(0, 22).padEnd(23)} ${stat.padEnd(26)} ` +
          `ask ${money(r.sell_order_low).padStart(9)}  ` +
          `last10 ${money(r.last10).padStart(9)}  ` +
          `${Number(r.sell_order_low) > 0 ? "buy now" : Number(r.last10) > 0 ? "bid to get it" : "not trading"}`);
      }
    }
  }
  console.log(`\n  Prices are the last shop snapshot; "ask" is the cheapest sell order.`);
  console.log(`  Observed wOBA/FIP are raw for this series — same park and era for every card in the table.\n`);
  process.exit(0);
}
main();
