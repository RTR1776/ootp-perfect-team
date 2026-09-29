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
 * `fitEra` does the same for one file (the /upload preview's warning), and
 * `weekEnv` puts the week's env_year tag, where there is one, ahead of the fit.
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
import { LEAGUE_ENV_YEAR } from "@/lib/league-week";

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
  /**
   * Sharp AND more than 5 years from the league's 2010. A single league file
   * can fit 2012 or 2013 sharply in an ordinary week (HD450 and HD451 did on
   * 2026-08-16); every theme week so far fits decades away (1959, 1988-1989).
   * This is the flag worth warning on.
   */
  offNorm: boolean;
  summary: string;
}

/** A hitter line's counting totals: all the fit reads. */
export interface HitTotals { pa: number; ab: number; h: number; hr: number; k: number }

/** The hitter rows of parsed league stints, summed (lib/ingest/league's stat keys). */
export function hitTotalsOf(stints: Array<{ isPitcher: boolean; stats: Record<string, number> }>): HitTotals {
  const t: HitTotals = { pa: 0, ab: 0, h: 0, hr: 0, k: 0 };
  for (const s of stints) {
    if (s.isPitcher) continue;
    t.pa += s.stats.PA ?? 0;
    t.ab += s.stats.AB ?? 0;
    t.h += s.stats.H ?? 0;
    t.hr += s.stats.HR ?? 0;
    t.k += s.stats.K ?? 0;
  }
  return t;
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

/** The era closest to a hitter line; `what` names the play in the summary. Null without PA. */
export function fitEra(t: HitTotals, what: string): EraFit | null {
  // Not every export carries the same stat keys; without PA there is no fit.
  if (!n(t.pa) || !n(t.ab)) return null;
  const measured = {
    avg: n(t.h) / n(t.ab),
    kPct: (100 * n(t.k)) / n(t.pa),
    hrPa: (100 * n(t.hr)) / n(t.pa),
    pa: n(t.pa),
  };
  const ranked = Object.keys(eraTable)
    .map((y) => ({ year: y, distance: distanceTo(y, measured) }))
    .sort((a, b) => a.distance - b.distance);
  if (!ranked.length || !Number.isFinite(ranked[0].distance)) return null;
  const [best, next] = ranked;
  const themed = best.distance < 0.75;
  // Key "0" is PT's default, which leagues play as 2010.
  const bestYear = best.year === "0" ? LEAGUE_ENV_YEAR : Number(best.year);
  return {
    year: best.year,
    measured,
    distance: best.distance,
    runnerUp: { year: next?.year ?? "", distance: next?.distance ?? Infinity },
    themed,
    offNorm: themed && Math.abs(bestYear - LEAGUE_ENV_YEAR) > 5,
    summary:
      `era ${best.year} fitted from ${what} ` +
      `(AVG ${measured.avg.toFixed(3)} · K% ${measured.kPct.toFixed(1)} · HR/PA ${measured.hrPa.toFixed(2)}%` +
      `, fit ${best.distance.toFixed(2)} vs ${next?.year} ${next?.distance.toFixed(2)})` +
      (themed ? " — sharp fit, looks like a theme week" : " — ordinary week, era is approximate"),
  };
}

export async function fitEraYear(on: string): Promise<EraFit | null> {
  const h = asRows<Record<string, string>>(
    await db.execute(sql`
      select sum((stats->>'PA')::numeric) pa, sum((stats->>'AB')::numeric) ab,
             sum((stats->>'H')::numeric) h, sum((stats->>'HR')::numeric) hr,
             sum((stats->>'K')::numeric) k
      from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
      where ls.captured_on = ${on} and ls.split = 'all' and not st.is_pitcher`),
  )[0];
  if (!h) return null;
  return fitEra({ pa: n(h.pa), ab: n(h.ab), h: n(h.h), hr: n(h.hr), k: n(h.k) }, `${on} play`);
}

export interface WeekEnv {
  year: number;
  /** Not the league's 2010. */
  themed: boolean;
  /** "tag": env_year on file; "fit": untagged, but the play fits far from 2010; "default": neither. */
  source: "tag" | "fit" | "default";
  fit: EraFit | null;
  /** Worth printing: an untagged theme week, or snapshots of one week tagged differently. */
  note: string | null;
}

/**
 * The run environment a league week was played in. The tag on file
 * (league_snapshots.env_year, from /upload or `import:league --env`) wins: it
 * is what the game said. A week tagged 2010 whose play fits decades away is an
 * untagged theme week (anything imported before the tag existed), so the fit
 * stands in and the note says to tag it with `pnpm league:env`.
 */
export async function weekEnv(on: string): Promise<WeekEnv> {
  const tags = asRows<{ env_year: number; n: number }>(
    await db.execute(sql`
      select env_year, count(*)::int n from league_snapshots
      where captured_on = ${on} group by 1 order by 2 desc, 1`),
  ).map((r) => ({ year: Number(r.env_year), n: Number(r.n) }));
  const fit = await fitEraYear(on).catch(() => null);
  const set = tags.filter((t) => t.year !== LEAGUE_ENV_YEAR);
  if (set.length) {
    const mixed = tags.length > 1 ? `${on} snapshots carry ${tags.map((t) => `${t.year} (${t.n})`).join(", ")}; using ${set[0].year}` : null;
    return { year: set[0].year, themed: true, source: "tag", fit, note: mixed };
  }
  if (fit?.offNorm) {
    return {
      year: Number(fit.year), themed: true, source: "fit", fit,
      note: `${on} is tagged ${LEAGUE_ENV_YEAR} but its play fits ${fit.year} (${fit.distance.toFixed(2)}): an untagged theme week? pnpm league:env --week ${on} --env <year>`,
    };
  }
  return { year: LEAGUE_ENV_YEAR, themed: false, source: "default", fit, note: null };
}
