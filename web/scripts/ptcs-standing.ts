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
import { todayInChicago } from "@/lib/ptcs-progress";
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const PERIOD = Number((() => { const i = argv.indexOf("--period"); return i >= 0 ? argv[i + 1] : "2"; })());

async function main() {
  const [p] = asRows<any>(await db.execute(sql`select * from periods where id = ${PERIOD}`));
  const start = String(p.starts_on ?? p.start_date).slice(0, 10), end = String(p.ends_on ?? p.end_date).slice(0, 10);
  const today = todayInChicago();
  const daysIn = Math.round((Date.parse(today) - Date.parse(start)) / 864e5) + 1;
  const daysTot = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;
  console.log(`\n${p.name}  ${start} → ${end}   day ${daysIn} of ${daysTot}  (${daysTot - daysIn} left)\n`);

  const rows = asRows<any>(await db.execute(sql`
    with logged as (
      select event_id::text id, occurred_on d, points pts, cat
      from results, lateral jsonb_array_elements_text(categories) cat
      where period_id = ${PERIOD}
    ),
    /*
     * The same window rule as computeStandings (dumps.ts), which is the one
     * validated against the six PTCS 6 berths: an event belongs to the period
     * it FINISHES in — a weekly finishes seven days after it starts, a daily
     * the next day — and a daily must also start inside the period. A Sunday
     * weekly from the last day of PTCS 6 therefore scores in PTCS 7, which is
     * where the game puts it; filtering on start date alone dropped them.
     */
    dump as (
      select event_id id, start_at::date d, points pts, unnest(string_to_array(categories, ',')) cat
      from my_results
      where categories <> ''
        and (case when name ~ '^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day'
                  then (start_at + interval '7 days')::date between ${start} and ${end}
                  else start_at::date between ${start} and ${end} end)
        and event_id not in (select id from logged)
    ),
    all_ev as (select * from logged union all select * from dump)
    select cat, count(*) events, sum(pts) pts, max(d) last
    from all_ev group by 1 order by 3 desc`));

  /**
   * Berth lines come from `pnpm berth:lines`, which reproduces the official
   * category standing from the community finish-order dump and reads off the
   * 128th-place total (championship fields are 128 per category). Validated on
   * PTCS 6: it names exactly the six berths L.J. actually won.
   *
   * PERIOD LENGTH MATTERS. PTCS 4 and 6 ran 35 days, PTCS 5 and 7 run 28, and
   * the line scales with the days available to farm points. So the line to
   * beat in a 28-day period is PTCS 5's, not PTCS 6's.
   */
  const LINE_28: Record<string, number> = {   // PTCS 5 actual, 28-day period
    Bronze: 95, Silver: 86, Gold: 77, Diamond: 72, Cap: 137,
    Open: 46, Iron: 94, Live: 103, "PD Daily": 265, "PD Weekly": 69,
  };
  const LINE_35: Record<string, number> = {   // PTCS 6 actual, 35-day period
    Bronze: 125, Silver: 106, Gold: 97, Diamond: 81, Cap: 154,
    Open: 50, Iron: 112, Live: 122, "PD Daily": 318, "PD Weekly": 89,
  };
  // scale the 35-day board to this period's length and take the softer read of
  // the two, so a period that runs hotter than PTCS 5 does not read as safe
  const scale = daysTot / 35;
  const ANCHOR: Record<string, number> = {};
  for (const k of Object.keys(LINE_35)) {
    ANCHOR[k] = Math.round(Math.max(LINE_28[k] * (daysTot / 28), LINE_35[k] * scale));
  }

  // Two different facts, kept apart on purpose: what is BANKED against the
  // line today, and where a flat extrapolation of the pace lands. A category
  // is only safe once the first column says so.
  console.log(`  category     events    pts   line   banked?          pace/day   days to close   proj at ${end}`);
  for (const r of rows) {
    const pts = Number(r.pts), ev = Number(r.events);
    const pace = pts / daysIn, proj = Math.round(pace * daysTot);
    const anchor = ANCHOR[r.cat];
    const daysLeft = daysTot - daysIn;
    let banked = "", close = "", projTag = "";
    if (anchor != null) {
      const gap = anchor - pts;
      banked = gap <= 0 ? "CLEAR" : `${gap} short`;
      close = gap <= 0 ? "—" : pace <= 0 ? "never at this pace" : (() => { const d = Math.ceil(gap / pace); return d <= daysLeft ? `${d} of ${daysLeft} left` : `${d} (only ${daysLeft} left)`; })();
      projTag = proj >= anchor * 1.15 ? "projects clear" : proj >= anchor ? "projects on the line" : `projects ${anchor - proj} short`;
    }
    console.log(`  ${String(r.cat).padEnd(11)} ${String(ev).padStart(5)} ${String(pts).padStart(6)}  ${String(anchor ?? "").padStart(5)}   ${banked.padEnd(15)}  ${pace.toFixed(1).padStart(7)}   ${close.padEnd(19)}${String(proj).padStart(5)}  ${projTag}`);
  }
  console.log(`\n  Lines are dump-derived (berth:lines), scaled to this period's ${daysTot} days.`);
  console.log(`\n  "banked?" is points on the board today against the line; "days to close" is at the pace so far.\n  The projection is a flat extrapolation of that pace and assumes the same entry rate — it is not a result.`);
  process.exit(0);
}
main();
