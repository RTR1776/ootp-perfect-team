/**
 * Where L.J. stands for PTMS 3 and PTWC 2 (lib/qualifying holds the rules).
 *
 * - PTCS and PTMS finishes, league places he enters and his PT Live
 *   leaderboard points are rows of `ptcs_finishes` (standing tournament |
 *   perfect_draft for finishes, "league" and "live" for the other two).
 * - Weekly leaderboard points are the PTCS periods' own day-by-day totals
 *   (lib/period-ledger, as /ptcs reads them) inside the PTWC window, without
 *   Cap and Live.
 * - A league week with no entered place is read off that week's newest full
 *   export: his place by record. That's an estimate: the top 16 settle their
 *   places in the playoffs, so an entered place wins.
 */
import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { myResults, periods, ptcsFinishes } from "@/db/schema";
import { leagueWeekOf } from "@/lib/league-week";
import { isMyOrg } from "@/lib/my-team";
import { loadPeriodLedger } from "@/lib/period-ledger";
import { todayInChicago } from "@/lib/ptcs-progress";
import {
  LIVE_DIVISOR, PTMS_FEEDS, PTWC2, PTWC_CATEGORIES, leaguePoints, leagueTierOf, nextMilestone, placeByRecord,
  type LeagueTier, type Milestone,
} from "@/lib/qualifying";

export interface LadderRow {
  id: number;
  event: string;
  on: string | null;
  berth: string | null;
  standing: string;
  placement: string;
  points: number;
}

export interface EventFinishes {
  event: string;
  rows: LadderRow[];
  tournament: number;
  draft: number;
}

export interface LeagueWeekRow {
  /** The week's Sunday. */
  week: string;
  league: string;
  tier: LeagueTier | null;
  place: number | null;
  of: number | null;
  record: string | null;
  points: number;
  source: "entered" | "record" | "none";
  inProgress: boolean;
  /** The ptcs_finishes row behind an entered place. */
  entryId: number | null;
}

export interface QualifyingData {
  today: string;
  next: Milestone | null;
  ptcs: EventFinishes[];
  ptms: EventFinishes[];
  ptms3: { tournament: number; draft: number };
  weekly: { byCategory: Record<string, number>; total: number; through: string | null };
  league: { weeks: LeagueWeekRow[]; total: number };
  live: { raw: number | null; on: string | null; points: number; entryId: number | null };
  ptwc2: { weekly: number; ptcs: number; ptms: number; league: number; live: number; total: number };
}

const day = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); };

function byEvent(names: readonly string[], rows: readonly LadderRow[]): EventFinishes[] {
  return names.map((event) => {
    const mine = rows.filter((r) => r.event === event);
    const sum = (s: string) => mine.filter((r) => r.standing === s).reduce((a, r) => a + r.points, 0);
    return { event, rows: mine, tournament: sum("tournament"), draft: sum("perfect_draft") };
  });
}

export async function loadQualifying(): Promise<QualifyingData> {
  const today = todayInChicago();
  const [entries, allPeriods, myRows] = await Promise.all([
    db.select().from(ptcsFinishes).orderBy(desc(ptcsFinishes.occurredOn), desc(ptcsFinishes.id)),
    db.select().from(periods),
    db.select().from(myResults).orderBy(desc(myResults.startAt)),
  ]);
  const rows: LadderRow[] = entries.map((e) => ({
    id: e.id, event: e.event, on: e.occurredOn, berth: e.berth, standing: e.standing, placement: e.placement, points: e.points,
  }));
  const finishes = rows.filter((r) => r.standing === "tournament" || r.standing === "perfect_draft");
  const ptcs = byEvent(PTWC2.ptcs, finishes);
  const ptms = byEvent(PTWC2.ptms, finishes);
  const feeds3 = ptcs.filter((e) => PTMS_FEEDS["PTMS 3"].includes(e.event));
  const ptms3 = { tournament: feeds3.reduce((a, e) => a + e.tournament, 0), draft: feeds3.reduce((a, e) => a + e.draft, 0) };

  // Weekly leaderboard points: every PTCS period's days inside the window.
  const { from, to } = PTWC2.weekly;
  const byCategory: Record<string, number> = Object.fromEntries(PTWC_CATEGORIES.map((c) => [c, 0]));
  let through: string | null = null;
  const inWindow = allPeriods.filter((p) => p.endsOn >= from && p.startsOn <= to);
  for (const ledger of await Promise.all(inWindow.map((p) => loadPeriodLedger(p, myRows)))) {
    for (const d of ledger.days) {
      if (d.date < from || d.date > to || d.source === "none") continue;
      for (const c of PTWC_CATEGORIES) byCategory[c] += d.points[c] ?? 0;
      if (!through || d.date > through) through = d.date;
    }
  }
  const weeklyTotal = Object.values(byCategory).reduce((a, v) => a + v, 0);

  // League: his place each week, entered or by record off the week's newest full export.
  const thisWeek = leagueWeekOf(day(today));
  const teamRows = (await db.execute(sql`
    select s.id, s.league, s.captured_on::text "on", st.org, sum(coalesce((st.stats->>'W')::float, 0)) w, sum(coalesce((st.stats->>'L')::float, 0)) l
    from league_snapshots s join league_stints st on st.snapshot_id = s.id
    where s.split = 'all' and st.is_pitcher and not st.is_free_agent and s.captured_on >= ${PTWC2.league.from}::date - 6 and s.captured_on <= ${PTWC2.league.to}::date
    group by 1, 2, 3, 4`)).rows as { id: number; league: string; on: string; org: string; w: number; l: number }[];
  const snaps = new Map<number, { league: string; on: string; teams: { org: string; w: number; l: number }[] }>();
  for (const r of teamRows) {
    const s = snaps.get(r.id) ?? { league: r.league, on: r.on, teams: [] };
    s.teams.push({ org: r.org, w: Number(r.w), l: Number(r.l) });
    snaps.set(r.id, s);
  }
  // His league's newest export each week.
  const newest = new Map<string, { id: number; league: string; on: string; teams: { org: string; w: number; l: number }[] }>();
  for (const [id, s] of snaps) {
    if (!s.teams.some((t) => isMyOrg(t.org))) continue;
    const week = leagueWeekOf(day(s.on));
    const cur = newest.get(week);
    if (!cur || s.on > cur.on || (s.on === cur.on && id > cur.id)) newest.set(week, { id, ...s });
  }
  const entered = new Map<string, LadderRow>();
  for (const r of rows) if (r.standing === "league" && r.on && !entered.has(r.on)) entered.set(r.on, r);
  // Every week of the window so far, so a week with no export still shows (and can be entered).
  const sundays: string[] = [];
  for (let d = day(PTWC2.league.from); ; d.setDate(d.getDate() + 7)) {
    const w = leagueWeekOf(d);
    if (w > thisWeek || w > PTWC2.league.to) break;
    sundays.push(w);
  }
  const weeks = [...new Set([...sundays, ...newest.keys(), ...entered.keys()])]
    .filter((w) => w >= PTWC2.league.from && w <= PTWC2.league.to)
    .sort();
  const leagueWeeks: LeagueWeekRow[] = weeks.map((week) => {
    const e = entered.get(week), s = newest.get(week);
    const rec = s ? placeByRecord(s.teams, isMyOrg) : null;
    const inProgress = week >= thisWeek;
    const league = e?.berth ?? s?.league ?? "?";
    const tier = leagueTierOf(league);
    const record = rec ? `${rec.w}-${rec.l}` : null;
    if (e) {
      const place = Number(e.placement);
      return { week, league, tier, place: Number.isFinite(place) ? place : null, of: rec?.of ?? null, record, points: e.points, source: "entered", inProgress: false, entryId: e.id };
    }
    const place = rec?.place ?? null;
    const points = !inProgress && place != null && tier ? leaguePoints(tier, place) : 0;
    return { week, league, tier, place, of: rec?.of ?? null, record, points, source: place != null ? "record" : "none", inProgress, entryId: null };
  });
  const leagueTotal = leagueWeeks.reduce((a, w) => a + w.points, 0);

  const liveRow = rows.find((r) => r.standing === "live") ?? null;
  const live = { raw: liveRow?.points ?? null, on: liveRow?.on ?? null, points: liveRow ? Math.round((liveRow.points / LIVE_DIVISOR) * 10) / 10 : 0, entryId: liveRow?.id ?? null };

  const ptcsTotal = ptcs.reduce((a, e) => a + e.tournament + e.draft, 0);
  const ptmsTotal = ptms.reduce((a, e) => a + e.tournament + e.draft, 0);
  return {
    today, next: nextMilestone(today), ptcs, ptms, ptms3,
    weekly: { byCategory, total: weeklyTotal, through },
    league: { weeks: leagueWeeks, total: leagueTotal },
    live,
    ptwc2: {
      weekly: weeklyTotal, ptcs: ptcsTotal, ptms: ptmsTotal, league: leagueTotal, live: live.points,
      total: Math.round((weeklyTotal + ptcsTotal + ptmsTotal + leagueTotal + live.points) * 10) / 10,
    },
  };
}

