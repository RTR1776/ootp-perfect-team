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
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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
   * Dump-derived lines come from `pnpm berth:lines`, which reproduces the
   * category standing from the community finish-order dump and reads off the
   * 128th-place total (championship fields are 128 per category). They are
   * exact where the category map is complete (PD Daily matched the game's
   * PTCS 6 cutoff to the point, 326) and LOW where it is not: the game's
   * actual PTCS 6 cutoffs (cwhit's board) ran 10–15% above these in every
   * tier, twice these in Open and Live. Fallback only — see CWHIT below.
   *
   * PERIOD LENGTH MATTERS. PTCS 4 and 6 ran 35 days, PTCS 5 and 7 run 28, and
   * the line scales with the days available to farm points. So the line to
   * beat in a 28-day period is PTCS 5's, not PTCS 6's.
   */
  const LINE_28: Record<string, number> = {   // PTCS 5, dump-derived (berth:lines), 28-day period
    Bronze: 95, Silver: 86, Gold: 77, Diamond: 72, Cap: 137,
    Open: 46, Iron: 94, Live: 103, "PD Daily": 265, "PD Weekly": 69,
  };
  const LINE_35: Record<string, number> = {   // PTCS 6, dump-derived under the start-date rule, 35-day period
    Bronze: 123, Silver: 107, Gold: 105, Diamond: 82, Cap: 159,
    Open: 60, Iron: 114, Live: 126, "PD Daily": 326, "PD Weekly": 92,
  };
  // scale the 35-day board to this period's length and take the softer read of
  // the two, so a period that runs hotter than PTCS 5 does not read as safe
  const scale = daysTot / 35;
  const ANCHOR: Record<string, number> = {};
  for (const k of Object.keys(LINE_35)) {
    ANCHOR[k] = Math.round(Math.max(LINE_28[k] * (daysTot / 28), LINE_35[k] * scale));
  }

  /**
   * cwhit publishes projected cutoffs for the current cycle (his "Cycle N
   * qualification targets" board: last cycle's ACTUAL cutoff, scaled to this
   * period's length, blended with the 128th player's pace and the event
   * volume). His last-cutoff column is the game's own number where ours is
   * reproduced from the dump under an incomplete category map, so where a
   * transcription exists it is the line and the dump-derived number is shown
   * beside it. Transcribe his board to reference/cwhit/<date> cycle<N>
   * targets.csv; the newest file wins.
   */
  const CWHIT = (() => {
    try {
      const dir = join(process.cwd(), "..", "reference", "cwhit");
      const f = readdirSync(dir).filter((x) => /cycle\d+ targets\.csv$/.test(x)).sort().pop();
      if (!f) return null;
      const [head, ...rows] = readFileSync(join(dir, f), "utf8").split(/\r?\n/).filter((l) => l.trim());
      const cols = head.split(",");
      const out: Record<string, { proj: number; last: number; l128: number }> = {};
      for (const r of rows) {
        const c = Object.fromEntries(cols.map((k, n) => [k, r.split(",")[n] ?? ""]));
        out[c.Category] = { proj: Number(c.ProjectedCutoff), last: Number(c.LastCutoff), l128: Number(c.Current128) };
      }
      return { file: f, lines: out };
    } catch { return null; }
  })();
  const lineFor = (cat: string): { line: number | null; src: string } =>
    CWHIT?.lines[cat] ? { line: CWHIT.lines[cat].proj, src: "cwhit" } : { line: ANCHOR[cat] ?? null, src: "dump" };

  // Two different facts, kept apart on purpose: what is BANKED against the
  // line today, and where a flat extrapolation of the pace lands. A category
  // is only safe once the first column says so.
  console.log(`  category     events    pts   line   banked?          pace/day   days to close   proj at ${end}` + (CWHIT ? "   dump line" : ""));
  type Row = { cat: string; events: string | number; pts: string | number };
  const byCat = new Map<string, Row>((rows as Row[]).map((r) => [String(r.cat), r]));
  const cats = new Set<string>([...byCat.keys(), ...Object.keys(CWHIT?.lines ?? ANCHOR)]);
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
    const dumpLine = CWHIT && ANCHOR[cat] != null ? `   ${String(ANCHOR[cat]).padStart(5)}` : "";
    console.log(`  ${cat.padEnd(11)} ${String(ev).padStart(5)} ${String(pts).padStart(6)}  ${String(anchor ?? "").padStart(5)}   ${banked.padEnd(15)}  ${(ev ? pace : 0).toFixed(1).padStart(7)}   ${close.padEnd(19)}${String(proj).padStart(5)}  ${projTag.padEnd(22)}${dumpLine}`);
  }
  if (CWHIT) console.log(`\n  Lines are cwhit's projected cutoffs (${CWHIT.file}); "dump line" is ours from berth:lines, scaled to ${daysTot} days — it undercounts wherever the category map misses events.`);
  else console.log(`\n  Lines are dump-derived (berth:lines), scaled to this period's ${daysTot} days.`);
  console.log(`\n  "banked?" is points on the board today against the line; "days to close" is at the pace so far.\n  The projection is a flat extrapolation of that pace and assumes the same entry rate — it is not a result.`);
  process.exit(0);
}
main();
