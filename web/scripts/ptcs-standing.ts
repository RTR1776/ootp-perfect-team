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
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todayInChicago } from "@/lib/ptcs-progress";
import { projectCutoffs, readCwhitTargets } from "@/lib/ptcs-projection";
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
     * The same window rule as computeStandings (dumps.ts): an event scores in
     * the period its start (the night it runs, Central time) falls in. The
     * dump stores start_at in UTC, so a 9:00 pm Sunday daily is Monday in
     * UTC and the date has to be taken in Chicago.
     */
    dump as (
      select event_id id, (start_at at time zone 'America/Chicago')::date d, points pts, unnest(string_to_array(categories, ',')) cat
      from my_results
      where categories <> ''
        and (start_at at time zone 'America/Chicago')::date between ${start} and ${end}
        and event_id not in (select id from logged)
    ),
    all_ev as (select * from logged union all select * from dump)
    select cat, count(*) events, sum(pts) pts, max(d) last
    from all_ev group by 1 order by 3 desc`));

  /**
   * THE LINE is the dump projection (lib/ptcs-projection.ts, `pnpm
   * cutoff:project`): the newest dump's 128th-place total, grown by how that
   * same line grew from the same day in PTCS 5 and PTCS 6. cwhit's projected
   * cutoff, where a transcription of his board exists, is printed beside it —
   * his last-cutoff column is the game's own number, so a wide gap between the
   * two is worth a look. Dump lines ran 10–15% under the game's in PTCS 6
   * while the category map had blind spots (refit 2026-09-21).
   */
  const P = projectCutoffs({ period: { start, end }, dir: join(process.cwd(), "..", "Tourney Data") });
  const PROJ: Record<string, number> = Object.fromEntries(P.lines.map((l) => [l.category, l.projected]));
  const CWHIT = readCwhitTargets(join(process.cwd(), "..", "reference", "cwhit"));
  console.log(`  line = dump projection from day ${P.day} (${P.binding.file}, reaches ${P.binding.reach})${CWHIT ? `; cwhit = ${CWHIT.file}` : ""}\n`);
  const lineFor = (cat: string): { line: number | null; src: string } =>
    PROJ[cat] != null ? { line: PROJ[cat], src: "dump" } : CWHIT?.lines[cat] != null ? { line: CWHIT.lines[cat], src: "cwhit" } : { line: null, src: "" };

  // Two different facts, kept apart on purpose: what is BANKED against the
  // line today, and where a flat extrapolation of the pace lands. A category
  // is only safe once the first column says so.
  console.log(`  category     events    pts   line   banked?          pace/day   days to close   proj at ${end}` + (CWHIT ? "        cwhit" : ""));
  type Row = { cat: string; events: string | number; pts: string | number };
  const byCat = new Map<string, Row>((rows as Row[]).map((r) => [String(r.cat), r]));
  const cats = new Set<string>([...byCat.keys(), ...Object.keys(PROJ)]);
  const ordered = [...cats].sort((a, b) => Number(byCat.get(b)?.pts ?? 0) - Number(byCat.get(a)?.pts ?? 0));
  for (const cat of ordered) {
    const r = byCat.get(cat);
    const pts = Number(r?.pts ?? 0), ev = Number(r?.events ?? 0);
    const pace = pts / daysIn, proj = Math.round(pace * daysTot);
    const { line: anchor } = lineFor(cat);
    const daysLeft = daysTot - daysIn;
    let banked = "", close = "", projTag = "";
    if (anchor != null) {
      const gap = anchor - pts;
      banked = gap <= 0 ? "CLEAR" : `${gap} short`;
      close = gap <= 0 ? "—" : pace <= 0 ? "never at this pace" : (() => { const d = Math.ceil(gap / pace); return d <= daysLeft ? `${d} of ${daysLeft} left` : `${d} (only ${daysLeft} left)`; })();
      projTag = proj >= anchor * 1.15 ? "projects clear" : proj >= anchor ? "projects on the line" : `projects ${anchor - proj} short`;
    }
    const dumpLine = CWHIT ? `   ${String(CWHIT.lines[cat] ?? "—").padStart(5)}` : "";
    console.log(`  ${cat.padEnd(11)} ${String(ev).padStart(5)} ${String(pts).padStart(6)}  ${String(anchor ?? "").padStart(5)}   ${banked.padEnd(15)}  ${(ev ? pace : 0).toFixed(1).padStart(7)}   ${close.padEnd(19)}${String(proj).padStart(5)}  ${projTag.padEnd(22)}${dumpLine}`);
  }
  console.log(`\n  "line" is where the 128th-place total is projected to END: day ${P.day}'s line from the dump, grown as PTCS 5 and 6 grew from day ${P.day}.` + (CWHIT ? `\n  "cwhit" is his projected cutoff (${CWHIT.file}), for comparison.` : ""));
  console.log(`\n  "banked?" is points on the board today against the line; "days to close" is at the pace so far.\n  The projection is a flat extrapolation of that pace and assumes the same entry rate — it is not a result.`);
  process.exit(0);
}
main();
