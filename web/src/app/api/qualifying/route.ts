/**
 * PTMS / PTWC entries (lib/qualifying-load reads them back).
 *
 *   POST /api/qualifying
 *     { kind: "finish", event: "PTCS 7", berth: "Silver", placement: "17th-32nd", on? }
 *        a PTCS or PTMS finish; replaces that event's earlier entry for the berth
 *     { kind: "total", event: "PTCS 6", points: 13 }
 *        an event's points when the brackets behind them aren't known
 *        (standing "unsplit": counts for the PTWC, not in either PTMS standing)
 *     { kind: "league", week: "2026-10-11", league: "HD452", band: "17th-last" }
 *        how a league season ended (lib/qualifying LEAGUE_BANDS), or `place`: 17;
 *        replaces that week's earlier entry
 *     { kind: "live", month: "2026-10", points: 4978 }
 *        one month's PT Live leaderboard points (counted at 1/50); replaces that month
 *   DELETE /api/qualifying?id=N   remove one entry
 *
 * All rows go to ptcs_finishes: standing tournament | perfect_draft | unsplit
 * for an event, "league" or "live" for the others. Auth mirrors /api/results.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ptcsFinishes } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { leagueWeekOf } from "@/lib/league-week";
import { todayInChicago } from "@/lib/ptcs-progress";
import { BERTHS, LIVE_MONTHS, PTWC2, ladderPoints, leagueBand, leaguePoints, leagueTierOf, standingOf } from "@/lib/qualifying";

export const runtime = "nodejs";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EVENTS = new Set<string>([...PTWC2.ptcs, ...PTWC2.ptms]);
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

async function authed(): Promise<boolean> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(session);
}

export async function POST(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return bad("Send a JSON body.");
  const on = typeof b.on === "string" && ISO.test(b.on) ? b.on : todayInChicago();

  if (b.kind === "finish") {
    const event = String(b.event ?? ""), berth = String(b.berth ?? ""), placement = String(b.placement ?? "");
    if (!EVENTS.has(event)) return bad(`Event must be one of ${[...EVENTS].join(", ")}.`);
    if (!(BERTHS as readonly string[]).includes(berth)) return bad(`Berth must be one of ${BERTHS.join(", ")}.`);
    const points = ladderPoints(placement);
    if (points == null) return bad("Pick a placement from 1st to 65th-128th.");
    const standing = standingOf(berth);
    await db.delete(ptcsFinishes).where(and(eq(ptcsFinishes.event, event), eq(ptcsFinishes.berth, berth), eq(ptcsFinishes.standing, standing)));
    const [row] = await db.insert(ptcsFinishes).values({ event, occurredOn: on, berth, standing, placement, points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  if (b.kind === "total") {
    const event = String(b.event ?? ""), points = Number(b.points);
    if (!EVENTS.has(event)) return bad(`Event must be one of ${[...EVENTS].join(", ")}.`);
    if (!Number.isInteger(points) || points < 0) return bad("Points must be a whole number.");
    await db.delete(ptcsFinishes).where(and(eq(ptcsFinishes.event, event), eq(ptcsFinishes.standing, "unsplit")));
    const [row] = await db.insert(ptcsFinishes).values({ event, occurredOn: on, berth: "All brackets", standing: "unsplit", placement: "total", points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  if (b.kind === "league") {
    const weekIn = String(b.week ?? ""), league = String(b.league ?? "").trim().toUpperCase();
    if (!ISO.test(weekIn)) return bad("Week must be a date (YYYY-MM-DD).");
    const [y, m, d] = weekIn.split("-").map(Number);
    const week = leagueWeekOf(new Date(y, m - 1, d));
    const tier = leagueTierOf(league);
    if (!tier) return bad("League must be PEL, HD…, LD…, HG… or LG….");
    // An outcome band (what the team history shows), or a place.
    const band = b.band != null ? leagueBand(String(b.band)) : null;
    const place = band ? band.place : Number(b.place);
    if (b.band != null && !band) return bad("Pick how the season ended.");
    if (!Number.isInteger(place) || place < 1 || place > 64) return bad("Place must be a whole number from 1.");
    const points = leaguePoints(tier, place);
    await db.delete(ptcsFinishes).where(and(eq(ptcsFinishes.standing, "league"), eq(ptcsFinishes.occurredOn, week)));
    const [row] = await db.insert(ptcsFinishes).values({ event: "League", occurredOn: week, berth: league, standing: "league", placement: band?.band ?? String(place), points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  if (b.kind === "live") {
    const points = Number(b.points), month = String(b.month ?? "");
    if (!LIVE_MONTHS.some((x) => x.month === month)) return bad(`Month must be one of ${LIVE_MONTHS.map((x) => x.month).join(", ")}.`);
    if (!Number.isInteger(points) || points < 0) return bad("PT Live points must be a whole number.");
    await db.delete(ptcsFinishes).where(and(eq(ptcsFinishes.standing, "live"), eq(ptcsFinishes.berth, month)));
    const [row] = await db.insert(ptcsFinishes).values({ event: "PT Live", occurredOn: `${month}-01`, berth: month, standing: "live", placement: "month", points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  return bad("kind must be finish, total, league or live.");
}

export async function DELETE(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return bad("id required");
  const gone = await db.delete(ptcsFinishes).where(eq(ptcsFinishes.id, id)).returning({ id: ptcsFinishes.id });
  if (!gone.length) return NextResponse.json({ error: "No entry with that id." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
