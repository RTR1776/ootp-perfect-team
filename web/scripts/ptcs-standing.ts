/**
 * Where PTCS standing actually is, right now: the same numbers /ptcs shows.
 *
 * Three sources, merged the way the page merges them (lib/result-ledger).
 * `results` is what has been logged by hand from the Your Tournaments screen.
 * `my_results` is the community dump: complete for the weeks it covers but
 * only as current as the last dump. `daily_totals` is the imported PTCS 6
 * tracker. Deduping the dump against the ledger on event id is the only way
 * to a total that is both complete AND current; either alone undercounts.
 *
 * The lines and verdicts come from lib/ptcs-progress, the page's own code, so
 * the two cannot disagree on Safe at. Our line is the period's stored target
 * (`pnpm cutoff:project --write` sets it from the newest dump), cwhit's is the
 * board stored beside it in src/data/ptcs-lines.json, and Safe at is the
 * higher of the two plus SAFE_MARGIN. When the dumps on disk now project a
 * different line, the script says so.
 *
 *   node --env-file=.env.local --import tsx scripts/ptcs-standing.ts [--period 2]
 */
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyTotals, myResults, periods, results } from "@/db/schema";
import STORED_LINES from "@/data/ptcs-lines.json";
import { CATEGORIES } from "@/lib/ingest/constants";
import { SAFE_MARGIN, lastDataIndex, periodCalendar, standings, todayInChicago, verdictLabel } from "@/lib/ptcs-progress";
import { projectCutoffs, readCwhitTargets, type StoredLines } from "@/lib/ptcs-projection";
import { dumpEvent, mergeDays, type LedgerEvent } from "@/lib/result-ledger";

const argv = process.argv.slice(2);
const PERIOD = (() => { const i = argv.indexOf("--period"); return i >= 0 ? Number(argv[i + 1]) : null; })();

async function main() {
  const all = await db.select().from(periods).orderBy(desc(periods.startsOn));
  const today = todayInChicago();
  // The same pick as /ptcs: --period, else the period in play today, else the latest.
  const p = PERIOD != null
    ? all.find((x) => x.id === PERIOD)
    : all.find((x) => x.startsOn <= today && today <= x.endsOn) ?? all[0];
  if (!p) throw new Error(PERIOD != null ? `no period ${PERIOD}` : "no periods");
  const cal = periodCalendar(p.startsOn, p.endsOn);
  console.log(`\n${p.name}  ${p.startsOn} → ${p.endsOn}   day ${cal.elapsed} of ${cal.totalDays}  (${cal.daysLeft} left, today included)\n`);

  const imported = await db.select().from(dailyTotals).where(eq(dailyTotals.periodId, p.id));
  const ledger = await db.select().from(results).where(eq(results.periodId, p.id));
  const logged: LedgerEvent[] = ledger.map((r) => ({
    eventId: r.eventId, name: r.name, occurredOn: r.occurredOn, categories: r.categories,
    points: r.points, fieldSize: r.fieldSize, placement: r.placement, eliminated: r.eliminated,
  }));
  const dump = (await db.select().from(myResults))
    .filter((r) => r.categories !== "")
    .map(dumpEvent)
    .filter((e) => p.startsOn <= e.occurredOn && e.occurredOn <= p.endsOn);
  const days = mergeDays(
    cal.dates, CATEGORIES,
    imported.map((r) => ({ occurredOn: r.occurredOn, category: r.category, points: r.points, note: r.note })),
    [...logged, ...dump],
  );

  const stored = STORED_LINES as StoredLines;
  const lines = stored.period === p.name ? stored : null;
  const targets = (p.targets ?? {}) as Record<string, number>;
  const board = standings(days, CATEGORIES, {
    totalDays: cal.totalDays, daysLeft: cal.daysLeft, dayIndex: cal.elapsed,
    ourLines: targets, cwhitLines: lines?.cwhit?.lines ?? null,
  });
  const counted = days.flatMap((d) => d.events);
  const last = lastDataIndex(days);
  const thru = last >= 0 ? cal.dates[last] : null;

  const ourSrc = p.targetsAreOfficial ? "official cutoffs"
    : lines ? `dump projection from day ${lines.day} (${lines.dumpFile}, reaches ${lines.dumpReach})` : "stored estimates";
  console.log(`  our line = ${ourSrc}${lines?.cwhit ? `; cwhit = ${lines.cwhit.file}` : ""}`);
  console.log(`  data through ${thru ?? "—"}: ${logged.length} logged events, ${counted.filter((e) => e.source === "dump").length} more from the dump\n`);

  const pad = (v: string | number | null, n: number) => String(v ?? "—").padStart(n);
  console.log(`  category     events   pts  dump   ours  cwhit  safe at  to get   gap  need/d  pace/d  proj   verdict`);
  for (const r of board) {
    const n = counted.filter((e) => e.categories.includes(r.category)).length;
    console.log(
      `  ${r.category.padEnd(11)} ${pad(n, 6)} ${pad(r.total, 5)} ${pad(r.fromDump || null, 5)} ${pad(r.ourLine, 6)} ${pad(r.cwhitLine, 6)}` +
      ` ${pad(r.safeAt, 8)} ${pad(r.toSafe || null, 7)} ${pad(r.gap || null, 5)} ${pad(r.needPerDay?.toFixed(1) ?? null, 7)}` +
      ` ${pad(r.pace?.toFixed(1) ?? null, 7)} ${pad(r.projected, 5)}   ${verdictLabel(r)}`,
    );
  }
  console.log(`\n  "safe at" is the higher line plus ${Math.round(SAFE_MARGIN * 100)}%, rounded up; past it, stop feeding the category. "to get" is the points to it.`);
  console.log(`  "gap" is the points short of the higher line; "need/d" spreads it over the ${cal.daysLeft} days left, today included.`);
  console.log(`  "pace/d" runs from each category's first scoring day to the last day with data (${thru ?? "—"}); "proj" carries it to ${p.endsOn}`);
  console.log(`  once a category has three scoring days. It assumes the same entry rate and is not a result.`);

  // The stored line is what /ptcs shows. Say so when the files on disk have moved on.
  if (!p.targetsAreOfficial && !cal.finished) {
    try {
      const P = projectCutoffs({ period: { start: p.startsOn, end: p.endsOn }, dir: join(process.cwd(), "..", "Tourney Data") });
      const moved = P.lines.filter((l) => targets[l.category] !== l.projected);
      if (moved.length) {
        console.log(`\n  ⚠ the dumps on disk (day ${P.day}, ${P.binding.file}) project ${moved.map((l) => `${l.category} ${l.projected} (stored ${targets[l.category] ?? "—"})`).join(", ")}.`);
        console.log(`    Run pnpm cutoff:project --write so /ptcs and this table use it.`);
      }
    } catch {
      // No dumps on this machine: the stored line is all there is.
    }
    const cw = readCwhitTargets(join(process.cwd(), "..", "reference", "cwhit"));
    if (cw && cw.file !== lines?.cwhit?.file) console.log(`\n  ⚠ a newer cwhit board is on disk (${cw.file}); pnpm cutoff:project --write stores it.`);
  }
  console.log();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
