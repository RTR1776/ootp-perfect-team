/**
 * Where PTCS standing actually is, right now.
 *
 * Two sources and they are not interchangeable. `my_results` is the community
 * dump — complete for the weeks it covers but only as current as the last dump.
 * `results` is what has been logged by hand since, from the Your Tournaments
 * screen. Combining them and deduping on event id is the only way to get a
 * total that is both complete AND current; using either alone undercounts.
 *
 *   pnpm ptcs:standing [--period 2]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const PERIOD = Number((() => { const i = argv.indexOf("--period"); return i >= 0 ? argv[i + 1] : "2"; })());

async function main() {
  const [p] = asRows<any>(await db.execute(sql`select * from periods where id = ${PERIOD}`));
  const start = String(p.starts_on ?? p.start_date).slice(0, 10), end = String(p.ends_on ?? p.end_date).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const daysIn = Math.round((Date.parse(today) - Date.parse(start)) / 864e5) + 1;
  const daysTot = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;
  console.log(`\n${p.name}  ${start} → ${end}   day ${daysIn} of ${daysTot}  (${daysTot - daysIn} left)\n`);

  const rows = asRows<any>(await db.execute(sql`
    with logged as (
      select event_id::text id, occurred_on d, points pts, cat
      from results, lateral jsonb_array_elements_text(categories) cat
      where period_id = ${PERIOD}
    ),
    dump as (
      select event_id id, start_at::date d, points pts, categories cat
      from my_results
      where start_at::date between ${start} and ${end}
        and event_id not in (select id from logged)
    ),
    all_ev as (select * from logged union all select * from dump)
    select cat, count(*) events, sum(pts) pts, max(d) last
    from all_ev group by 1 order by 3 desc`));

  /**
   * The `standings` table is EMPTY — the community dump's per-category ranking
   * has never been imported — so there is no berth line to measure against and
   * this deliberately does not invent one. The only anchor available is the one
   * figure carried forward from PTCS 6: PD Daily closed needing about 347.
   */
  const [{ n: standingsRows }] = asRows<any>(await db.execute(sql`select count(*) n from standings`));
  const ANCHOR: Record<string, number> = { "PD Daily": 347 };

  console.log(`  category     events    pts   pts/event   pace/day   proj at ${end}`);
  for (const r of rows) {
    const pts = Number(r.pts), ev = Number(r.events);
    const pace = pts / daysIn, proj = Math.round(pace * daysTot);
    const anchor = ANCHOR[r.cat];
    const tag = anchor == null ? "" : `   vs ~${anchor} last period — ${proj >= anchor * 1.15 ? "clear" : proj >= anchor ? "on pace" : `${anchor - proj} short`}`;
    console.log(`  ${String(r.cat).padEnd(11)} ${String(ev).padStart(5)} ${String(pts).padStart(6)}   ${(pts / ev).toFixed(1).padStart(7)}   ${pace.toFixed(1).padStart(7)}   ${String(proj).padStart(9)}${tag}`);
  }
  if (Number(standingsRows) === 0) {
    console.log(`\n  !! No berth lines available: the standings table is empty, so the community dump's`);
    console.log(`     per-category ranking has never been imported. Everything above is pace and`);
    console.log(`     projection only — there is no "are you in" answer until that lands.`);
  }
  console.log(`\n  Projection is a flat extrapolation of the pace so far and assumes the same entry rate.`);
  process.exit(0);
}
main();
