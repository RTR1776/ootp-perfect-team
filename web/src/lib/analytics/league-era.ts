/**
 * WHICH ERA IS THE LEAGUE RUNNING THIS WEEK — fitted from the week's own play.
 *
 * The run environment is NOT a constant and not the same every week. Fitted
 * across every week in the database:
 *
 *     2026-06-28  K% 19.6  HR/PA 2.54%  -> 2013
 *     2026-08-23  K% 13.3  HR/PA 2.37%  -> 1959   (theme week)
 *     2026-09-06  K% 19.3  HR/PA 2.55%  -> 2010
 *     2026-09-20  K% 14.9  HR/PA 1.97%  -> 1989   (theme week)
 *
 * Ordinary weeks sit in a 2010-2013 band; theme weeks jump somewhere else
 * entirely. So park-sweep pinned to 2010 and league-best pinned to 1989 were
 * each right for some weeks and wrong for the rest, silently — a park or a
 * roster scored in the wrong era is simply a different answer, not an error.
 *
 * METHOD. Sum the week's hitter counting stats into AVG / K% / HR-per-PA and
 * take the era whose baseline line is closest, each component scaled by about
 * what a year of drift is worth (0.010 AVG, 1.0 K point, 0.20 HR points).
 *
 * TWO LIMITS, both worth stating wherever this is printed:
 *   - It identifies the era by BEST FIT, not by reading the game's setting.
 *     Rosters are all-Perfect and hit above an average club, so the line is
 *     shifted; the components still rank the eras, and a theme week fits much
 *     harder (0.38 and 0.49 above) than an ordinary one (1.0-1.4), which is
 *     itself the signal that a theme is on.
 *   - It describes the week that was PLAYED. A snapshot is the season that
 *     just ended, so building for the week ahead means passing --year when the
 *     game has announced a theme this fit cannot know about yet.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable } from "@/lib/analytics/runenv-view";
import { rateLine, solveEnv } from "@/lib/analytics/run-env";

const asRows = <T,>(r: unknown): T[] =>
  Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []);
const n = (x: unknown) => Number(x ?? 0);

export interface EraFit {
  /** Best-fit era year, as a key into eraTable. */
  year: string;
  measured: { avg: number; kPct: number; hrPa: number; pa: number };
  distance: number;
  runnerUp: { year: string; distance: number };
  /** True when the fit is sharp enough to look like a deliberate theme week. */
  themed: boolean;
  summary: string;
}

/** How far an era baseline sits from a measured line, in "years of drift". */
const distanceTo = (year: string, m: { avg: number; kPct: number; hrPa: number }) => {
  const e = eraTable[year];
  if (!e) return Infinity;
  const l = rateLine(e.rates, solveEnv(e.rates, e.rg, null).RG);
  return (
    Math.abs(l.avg - m.avg) / 0.01 +
    Math.abs(l.kPct * 100 - m.kPct) / 1.0 +
    Math.abs(l.hrPa * 100 - m.hrPa) / 0.2
  );
};

export async function fitEraYear(on: string): Promise<EraFit | null> {
  const h = asRows<Record<string, string>>(
    await db.execute(sql`
      select sum((stats->>'PA')::numeric) pa, sum((stats->>'AB')::numeric) ab,
             sum((stats->>'H')::numeric) h, sum((stats->>'HR')::numeric) hr,
             sum((stats->>'K')::numeric) k
      from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
      where ls.captured_on = ${on} and ls.split = 'all' and not st.is_pitcher`),
  )[0];
  // Not every export carries the same stat keys; without PA there is no fit.
  if (!h || !n(h.pa) || !n(h.ab)) return null;
  const measured = {
    avg: n(h.h) / n(h.ab),
    kPct: (100 * n(h.k)) / n(h.pa),
    hrPa: (100 * n(h.hr)) / n(h.pa),
    pa: n(h.pa),
  };
  const ranked = Object.keys(eraTable)
    .map((y) => ({ year: y, distance: distanceTo(y, measured) }))
    .sort((a, b) => a.distance - b.distance);
  if (!ranked.length || !Number.isFinite(ranked[0].distance)) return null;
  const [best, next] = ranked;
  const themed = best.distance < 0.75;
  return {
    year: best.year,
    measured,
    distance: best.distance,
    runnerUp: { year: next?.year ?? "", distance: next?.distance ?? Infinity },
    themed,
    summary:
      `era ${best.year} fitted from ${on} play ` +
      `(AVG ${measured.avg.toFixed(3)} · K% ${measured.kPct.toFixed(1)} · HR/PA ${measured.hrPa.toFixed(2)}%` +
      `, fit ${best.distance.toFixed(2)} vs ${next?.year} ${next?.distance.toFixed(2)})` +
      (themed ? " — sharp fit, looks like a theme week" : " — ordinary week, era is approximate"),
  };
}
