/**
 * League — the league-data workbench.
 *
 * League exports ONLY (never tournament stats — leagues normalise to the
 * rostered talent around a card, tournaments don't). Server side picks the
 * snapshots for the requested week / league scope / split, pools stints into
 * one line per card (across teams and, for "all weeks", across seasons), and
 * hands the lines to the client board, which does the sorting and filtering.
 *
 *   ?week=latest | all | YYYY-MM-DD      default latest
 *   ?league=all | HD | LD | PEL | HD450  default all
 *   ?split=all | vL | vR                 default all
 *
 * "Latest" respects the newest-COMPLETE rule from lib/league-snapshots: an
 * export missing its pitching block is passed over for the previous week.
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leagueSnapshots, leagueStints } from "@/db/schema";
import { MIN_PITCHER_SHARE } from "@/lib/league-snapshots";
import { leagueTier } from "@/lib/analytics/league";
import { hitterLines, metaSummary, pitcherLines, withRegression, type BoardStint } from "@/lib/analytics/league-board";
import { MY_ORG } from "@/lib/my-team";
import { LeagueBoard } from "@/components/league-board";
import { Placeholder } from "@/components/placeholder";

export const dynamic = "force-dynamic";

interface SnapRow { id: number; league: string; split: string; capturedOn: string; teams: number; rows: number; pitchers: number; total: number }

function inScope(league: string, scope: string): boolean {
  if (scope === "all") return true;
  if (scope === "HD" || scope === "LD" || scope === "PEL") return leagueTier(league) === scope;
  return league === scope;
}

export default async function LeaguePage({ searchParams }: { searchParams: Promise<{ week?: string; league?: string; split?: string }> }) {
  const sp = await searchParams;
  const week = sp.week ?? "latest";
  const scope = sp.league ?? "all";
  const split = ["vL", "vR"].includes(sp.split ?? "") ? sp.split! : "all";

  const snaps = (await db
    .select({
      id: leagueSnapshots.id, league: leagueSnapshots.league, split: leagueSnapshots.split, capturedOn: leagueSnapshots.capturedOn,
      teams: leagueSnapshots.teams, rows: leagueSnapshots.rows,
      pitchers: sql<number>`count(*) filter (where ${leagueStints.isPitcher})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(leagueSnapshots)
    .innerJoin(leagueStints, eq(leagueStints.snapshotId, leagueSnapshots.id))
    .groupBy(leagueSnapshots.id)) as SnapRow[];

  if (!snaps.length) {
    return <Placeholder icon="tournaments" title="League" description="Import a league week (pnpm import:league <folder>) and this becomes the league workbench." />;
  }

  const complete = (s: SnapRow) => s.total > 0 && s.pitchers / s.total >= MIN_PITCHER_SHARE;
  const weeks = [...new Set(snaps.map((s) => s.capturedOn))].sort().reverse();
  const leagues = [...new Set(snaps.map((s) => s.league))].sort();

  // snapshot selection
  const ofSplit = snaps.filter((s) => s.split === split && inScope(s.league, scope));
  let chosen: SnapRow[];
  if (week === "all") chosen = ofSplit.filter(complete);
  else if (week === "latest") {
    chosen = [];
    for (const lg of new Set(ofSplit.map((s) => s.league))) {
      const c = ofSplit.filter((s) => s.league === lg && complete(s)).sort((a, b) => (a.capturedOn < b.capturedOn ? 1 : -1))[0];
      if (c) chosen.push(c);
    }
  } else chosen = ofSplit.filter((s) => s.capturedOn === week && complete(s));

  const ids = chosen.map((s) => s.id);
  const byId = new Map(chosen.map((s) => [s.id, s]));
  const raw = ids.length
    ? await db.select({
        snapshotId: leagueStints.snapshotId, cid: leagueStints.cid, name: leagueStints.name, pos: leagueStints.pos, org: leagueStints.org,
        clan: leagueStints.clan, isFreeAgent: leagueStints.isFreeAgent, isPitcher: leagueStints.isPitcher, val: leagueStints.val, tier: leagueStints.tier,
        isVariant: leagueStints.isVariant, cardYear: leagueStints.cardYear, pa: leagueStints.pa, ip: leagueStints.ip, use: leagueStints.use, war: leagueStints.war,
        ratings: leagueStints.ratings, stats: leagueStints.stats,
      }).from(leagueStints).where(inArray(leagueStints.snapshotId, ids))
    : [];
  const stints: BoardStint[] = raw.map((r) => { const s = byId.get(r.snapshotId)!; return { ...r, league: s.league, split: s.split, capturedOn: s.capturedOn }; });

  const nWeeks = Math.max(1, ...[...new Set(chosen.map((s) => s.league))].map((lg) => new Set(chosen.filter((s) => s.league === lg).map((s) => s.capturedOn)).size));
  const { hit, pit, meanWoba, meanFip } = withRegression(hitterLines(stints), pitcherLines(stints));
  const mineStints = stints.filter((s) => s.org === MY_ORG);
  // the Torrent copies get the same shrinkage toward the same pool means
  const mineHit = hitterLines(mineStints).map((h) => ({ ...h, wobaReg: (h.woba * h.pa + meanWoba * 600) / (h.pa + 600) }));
  const minePit = pitcherLines(mineStints).map((p) => ({ ...p, fipReg: (p.fip * p.ip + meanFip * 150) / (p.ip + 150) }));
  const meta = metaSummary(hit, pit, mineHit, minePit, split, nWeeks);
  const myLeague = [...new Set(mineStints.map((s) => s.league))];

  return (
    <LeagueBoard
      hitters={hit} pitchers={pit} mineHitters={mineHit} minePitchers={minePit} meta={meta}
      filters={{ week, scope, split }} weeks={weeks} leagues={leagues}
      scopeInfo={{ snapshots: chosen.map((s) => ({ league: s.league, capturedOn: s.capturedOn, teams: s.teams })), nWeeks, myLeague }}
    />
  );
}
