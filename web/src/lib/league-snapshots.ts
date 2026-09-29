/**
 * Which league snapshot is the current one for each league.
 *
 * "Newest" is not enough. OOTP will export a stats view with the pitching
 * block missing and the file looks fine — the 2026-08-30 HD451 export is 473
 * rows, 4 of them pitchers, against 906 rows and 423 pitchers the week before.
 * Taken as current it strips a whole league's arms out of every percentile
 * pool that reads it, quietly and without an error anywhere.
 *
 * So a snapshot has to be COMPLETE to be current: roughly half of a real
 * export is pitchers, and anything under MIN_PITCHER_SHARE is treated as
 * truncated and skipped in favour of the previous week. One bad export then
 * costs that league a week of freshness instead of its pitching.
 *
 * It also has to be an ORDINARY week. A theme week (env_year other than 2010:
 * 2026-09-20 ran 1989) is a different run environment and a different meta,
 * so the /meta and /market pools read the league's newest 2010 week instead,
 * and say which theme week they passed over.
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leagueSnapshots, leagueStints } from "@/db/schema";
import { LEAGUE_ENV_YEAR } from "@/lib/league-week";

/** A complete export runs ~45% pitchers; 15% is far below any real one. */
export const MIN_PITCHER_SHARE = 0.15;

export interface SnapshotPick {
  id: number;
  league: string;
  split: string;
  capturedOn: string;
  teams: number;
  rows: number;
  pitcherShare: number;
}

export interface SkippedSnapshot {
  league: string;
  capturedOn: string;
  rows: number;
  pitchers: number;
  /** "truncated": the pitching block is missing; "theme": a theme week's environment. */
  reason: "truncated" | "theme";
  envYear: number;
}

/**
 * Newest complete, ordinary-week `all`-split snapshot per league, plus the
 * truncated and theme-week ones passed over on the way, so a caller can say
 * why a league reads an older week.
 */
export async function latestCompleteSnapshots(): Promise<{
  picks: Map<string, SnapshotPick>;
  skipped: SkippedSnapshot[];
}> {
  const rows = await db
    .select({
      id: leagueSnapshots.id,
      league: leagueSnapshots.league,
      split: leagueSnapshots.split,
      capturedOn: leagueSnapshots.capturedOn,
      envYear: leagueSnapshots.envYear,
      teams: leagueSnapshots.teams,
      rows: leagueSnapshots.rows,
      pitchers: sql<number>`count(*) filter (where ${leagueStints.isPitcher})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(leagueSnapshots)
    .innerJoin(leagueStints, eq(leagueStints.snapshotId, leagueSnapshots.id))
    .where(eq(leagueSnapshots.split, "all"))
    .groupBy(leagueSnapshots.id)
    .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id));

  const picks = new Map<string, SnapshotPick>();
  const skipped: SkippedSnapshot[] = [];
  for (const r of rows) {
    if (picks.has(r.league)) continue; // already have a newer complete one
    const share = r.total > 0 ? r.pitchers / r.total : 0;
    const reason = share < MIN_PITCHER_SHARE ? "truncated" : r.envYear !== LEAGUE_ENV_YEAR ? "theme" : null;
    if (reason) {
      skipped.push({
        league: r.league,
        capturedOn: r.capturedOn,
        rows: r.total,
        pitchers: r.pitchers,
        reason,
        envYear: r.envYear,
      });
      continue;
    }
    picks.set(r.league, {
      id: r.id,
      league: r.league,
      split: r.split,
      capturedOn: r.capturedOn,
      teams: r.teams,
      rows: r.rows,
      pitcherShare: share,
    });
  }
  return { picks, skipped };
}
