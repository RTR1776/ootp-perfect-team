/**
 * This week in the league (L.J., 2026-10-16: "League - helping me do better
 * there, field the best lineup, see the most recent data"): his team in the
 * newest league export — runs scored and allowed, the staff's ERA and SIERA,
 * and the bats and arms doing most and least so far, each with its sample so a
 * hot week on 40 PA reads as what it is.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leagueSnapshots, leagueStints } from "@/db/schema";
import { isMyOrg } from "@/lib/my-team";

export interface WeekBat { name: string; pa: number; wraa600: number }
export interface WeekArm { name: string; ip: number; era: number; siera: number | null }
export interface LeagueWeek {
  league: string;
  on: string;
  runsFor: number;
  runsAgainst: number;
  era: number | null;
  bats: { best: WeekBat[]; worst: WeekBat[] };
  arms: { best: WeekArm[]; worst: WeekArm[] };
}

const MIN_PA = 60, MIN_IP = 10;
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

export async function loadLeagueWeek(): Promise<LeagueWeek | null> {
  const [snap] = await db.select({ id: leagueSnapshots.id, league: leagueSnapshots.league, on: leagueSnapshots.capturedOn })
    .from(leagueSnapshots).innerJoin(leagueStints, eq(leagueStints.snapshotId, leagueSnapshots.id))
    .where(and(eq(leagueSnapshots.split, "all"), sql`${leagueStints.org} ilike 'kansas city torrent%'`))
    .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id)).limit(1);
  if (!snap) return null;
  const rows = (await db.select({ org: leagueStints.org, name: leagueStints.name, isPitcher: leagueStints.isPitcher, pa: leagueStints.pa, ip: leagueStints.ip, stats: leagueStints.stats })
    .from(leagueStints).where(eq(leagueStints.snapshotId, snap.id))).filter((r) => isMyOrg(r.org));
  const st = (r: (typeof rows)[number]) => (r.stats ?? {}) as Record<string, unknown>;

  const bats = rows.filter((r) => !r.isPitcher);
  const arms = rows.filter((r) => r.isPitcher && num(r.ip) > 0);
  const runsFor = bats.reduce((s, r) => s + num(st(r).R), 0);
  const runsAgainst = arms.reduce((s, r) => s + num(st(r).Ra), 0);
  const ip = arms.reduce((s, r) => s + num(r.ip), 0), er = arms.reduce((s, r) => s + num(st(r).ER), 0);

  const qBats = bats.filter((r) => num(r.pa) >= MIN_PA)
    .map((r): WeekBat => ({ name: r.name, pa: num(r.pa), wraa600: Math.round((num(st(r).wRAA) / num(r.pa)) * 600 * 10) / 10 }))
    .sort((a, b) => b.wraa600 - a.wraa600);
  const qArms = arms.filter((r) => num(r.ip) >= MIN_IP)
    .map((r): WeekArm => ({ name: r.name, ip: Math.round(num(r.ip) * 10) / 10, era: Math.round((num(st(r).ER) * 9 / num(r.ip)) * 100) / 100, siera: st(r).SIERA != null ? num(st(r).SIERA) : null }))
    .sort((a, b) => (a.siera ?? a.era) - (b.siera ?? b.era));

  return {
    league: snap.league, on: String(snap.on).slice(0, 10), runsFor, runsAgainst,
    era: ip > 0 ? Math.round((er * 9 / ip) * 100) / 100 : null,
    bats: { best: qBats.slice(0, 3), worst: qBats.slice(-3).reverse() },
    arms: { best: qArms.slice(0, 3), worst: qArms.slice(-2).reverse() },
  };
}
