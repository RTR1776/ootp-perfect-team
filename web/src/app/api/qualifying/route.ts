/**
 * PTMS / PTWC entries (lib/qualifying-load reads them back).
 *
 *   POST /api/qualifying
 *     { kind: "finish", event: "PTCS 7", berth: "Silver", placement: "17th-32nd", on? }
 *        a PTCS or PTMS finish; replaces that event's earlier entry for the berth
 *     { kind: "league", week: "2026-10-11", league: "HD452", place: 17 }
 *        a league season's final place; replaces that week's earlier entry
 *     { kind: "live", points: 1234, on? }
 *        PT Live leaderboard points as the game shows them (counted at 1/50)
 *   DELETE /api/qualifying?id=N   remove one entry
 *
 * All rows go to ptcs_finishes: standing tournament | perfect_draft for a
 * finish, "league" or "live" for the others. Auth mirrors /api/results.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ptcsFinishes } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { leagueWeekOf } from "@/lib/league-week";
import { todayInChicago } from "@/lib/ptcs-progress";
import { BERTHS, PTWC2, ladderPoints, leaguePoints, leagueTierOf, standingOf } from "@/lib/qualifying";

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

  if (b.kind === "league") {
    const weekIn = String(b.week ?? ""), league = String(b.league ?? "").trim().toUpperCase(), place = Number(b.place);
    if (!ISO.test(weekIn)) return bad("Week must be a date (YYYY-MM-DD).");
    const [y, m, d] = weekIn.split("-").map(Number);
    const week = leagueWeekOf(new Date(y, m - 1, d));
    const tier = leagueTierOf(league);
    if (!tier) return bad("League must be PEL, HD…, LD…, HG… or LG….");
    if (!Number.isInteger(place) || place < 1 || place > 64) return bad("Place must be a whole number from 1.");
    const points = leaguePoints(tier, place);
    await db.delete(ptcsFinishes).where(and(eq(ptcsFinishes.standing, "league"), eq(ptcsFinishes.occurredOn, week)));
    const [row] = await db.insert(ptcsFinishes).values({ event: "League", occurredOn: week, berth: league, standing: "league", placement: String(place), points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  if (b.kind === "live") {
    const points = Number(b.points);
    if (!Number.isInteger(points) || points < 0) return bad("PT Live points must be a whole number.");
    const [row] = await db.insert(ptcsFinishes).values({ event: "PT Live", occurredOn: on, berth: null, standing: "live", placement: "leaderboard", points }).returning();
    return NextResponse.json({ ok: true, row });
  }

  return bad("kind must be finish, league or live.");
}

export async function DELETE(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return bad("id required");
  const gone = await db.delete(ptcsFinishes).where(eq(ptcsFinishes.id, id)).returning({ id: ptcsFinishes.id });
  if (!gone.length) return NextResponse.json({ error: "No entry with that id." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
