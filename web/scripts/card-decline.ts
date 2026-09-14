/**
 * Do cards decline as the PT season runs on?
 *
 * Each weekly league export is a COMPLETE season, not a running total, so the
 * weeks are independent seasons of the same card and can be trended. Pooling
 * every league in a week (and every team that owns a copy) gives a far bigger
 * sample per card than one roster ever could, and indexing to that week's own
 * league mean removes any drift in the leagues themselves.
 *
 * A card that is genuinely declining shows a falling index against a flat
 * league. A card whose index falls only because the league got better is not
 * declining — the indexing is what separates those.
 *
 *   pnpm card:decline --team "Kansas City Torrent" --league HD453
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const TEAM = val("team", "Kansas City Torrent"), LEAGUE = val("league", "HD453"), ON = val("on", "2026-09-13");
const MIN = Number(val("min", "400"));

async function main() {
  const roster = asRows<any>(await db.execute(sql`
    select distinct st.cid, st.name, st.is_pitcher, st.pos
    from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
    where ls.league = ${LEAGUE} and ls.split='all' and ls.captured_on = ${ON} and st.org = ${TEAM}`));
  const ids = roster.map((r) => r.cid).filter(Boolean);
  if (!ids.length) throw new Error("no roster");

  const rows = asRows<any>(await db.execute(sql`
    with wk as (
      select ls.captured_on::text as wk, st.cid, st.is_pitcher,
             case when st.is_pitcher then (st.stats->>'BF')::numeric else st.pa::numeric end as w,
             case when st.is_pitcher then (st.stats->>'ER')::numeric else (st.stats->>'wRAA')::numeric end as num
      from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
      where ls.split = 'all'
    ),
    ok as (select * from wk where w > 0 and num is not null),
    lgm as (select wk, is_pitcher, sum(num)/sum(w) as mean from ok group by 1,2)
    select o.wk, o.cid, o.is_pitcher, sum(o.w) as w,
           sum((o.num/o.w - l.mean) * o.w) / nullif(sum(o.w),0) as above
    from ok o join lgm l on l.wk = o.wk and l.is_pitcher = o.is_pitcher
    where o.cid in (${sql.join(ids.map((i: number) => sql`${i}`), sql`, `)})
    group by 1,2,3 order by 2,1`));

  const weeks = [...new Set(rows.map((r) => r.wk))].sort();
  const byCard = new Map<number, Map<string, { w: number; a: number }>>();
  for (const r of rows) {
    const m = byCard.get(r.cid) ?? new Map(); 
    m.set(r.wk, { w: Number(r.w), a: Number(r.above) });
    byCard.set(r.cid, m);
  }
  const nameOf = new Map(roster.map((r) => [r.cid, r]));
  console.log(`card decline — ${TEAM}, pooled across every league and every owner, per week`);
  console.log(`each week is a complete season; the figure is runs per 700 above that week's league mean\n`);
  console.log(`  card                      pos   ${weeks.map((w) => w.slice(5)).join("    ")}    trend`);

  const out: any[] = [];
  for (const [cid, m] of byCard) {
    const meta = nameOf.get(cid); if (!meta) continue;
    const cells = weeks.map((w) => { const v = m.get(w); return v && v.w >= MIN ? v.a * 700 * (meta.is_pitcher ? -1 : 1) : null; });
    const seen = cells.map((c, i) => [i, c] as const).filter(([, c]) => c != null) as [number, number][];
    if (seen.length < 3) continue;
    // weighted least-squares slope over week index, in runs per week
    const n = seen.length, mx = seen.reduce((a, [i]) => a + i, 0) / n, my = seen.reduce((a, [, c]) => a + c, 0) / n;
    let sxy = 0, sxx = 0;
    for (const [i, c] of seen) { sxy += (i - mx) * (c - my); sxx += (i - mx) ** 2; }
    const slope = sxx > 0 ? sxy / sxx : 0;
    out.push({ meta, cells, slope, first: seen[0][1], last: seen[n - 1][1] });
  }
  out.sort((a, b) => a.slope - b.slope);
  for (const o of out) {
    const cells = o.cells.map((c: number | null) => (c == null ? "   —" : `${c >= 0 ? "+" : ""}${c.toFixed(0)}`).padStart(6)).join(" ");
    const tag = o.slope < -4 ? "  <-- declining" : o.slope > 4 ? "  <-- rising" : "";
    console.log(`  ${o.meta.name.slice(0, 22).padEnd(23)} ${o.meta.pos.padEnd(4)} ${cells}   ${o.slope >= 0 ? "+" : ""}${o.slope.toFixed(1)}/wk${tag}`);
  }
  process.exit(0);
}
main();
