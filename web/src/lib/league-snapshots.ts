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
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leagueSnapshots, leagueStints } from "@/db/schema";

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
}

/**
 * Newest complete `all`-split snapshot per league, plus the truncated ones
 * that were passed over so a caller can say why a league looks stale.
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
    if (share < MIN_PITCHER_SHARE) {
      skipped.push({
        league: r.league,
        capturedOn: r.capturedOn,
        rows: r.total,
        pitchers: r.pitchers,
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
