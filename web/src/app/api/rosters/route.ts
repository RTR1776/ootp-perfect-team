/**
 * Saved rosters for /build. GET ?tournamentId= lists them; POST saves one
 * (name + slots) for a tournament. Auth mirrors the upload route: the proxy
 * gate is optimistic, so the session is re-verified here.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/db/client";
import { rosters, rosterSlots } from "@/db/schema";

export const runtime = "nodejs";

async function authed(): Promise<boolean> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(session);
}

export async function GET(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const tournamentId = Number(new URL(request.url).searchParams.get("tournamentId"));
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }
  const list = await db.select().from(rosters).where(eq(rosters.tournamentId, tournamentId));
  const slots = list.length
    ? await db.select().from(rosterSlots).where(inArray(rosterSlots.rosterId, list.map((r) => r.id)))
    : [];
  return NextResponse.json({
    rosters: list.map((r) => ({
      id: r.id,
      name: r.name,
      slots: slots.filter((s) => s.rosterId === r.id),
    })),
  });
}

interface SlotIn {
  cardId: number;
  slot: string;
  versusHand: string | null;
  lineupOrder: number | null;
}

export async function POST(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { tournamentId?: number; name?: string; slots?: SlotIn[] }
    | null;
  if (!body?.name || !Number.isFinite(body.tournamentId) || !Array.isArray(body.slots) || body.slots.length === 0) {
    return NextResponse.json({ error: "name, tournamentId and slots are required" }, { status: 400 });
  }
  if (body.slots.length > 60) {
    return NextResponse.json({ error: "too many slots" }, { status: 400 });
  }
  const [roster] = await db
    .insert(rosters)
    .values({ name: body.name.slice(0, 120), tournamentId: body.tournamentId!, notes: null })
    .returning();
  await db.insert(rosterSlots).values(
    body.slots.map((s) => ({
      rosterId: roster.id,
      cardId: s.cardId,
      slot: String(s.slot).slice(0, 12),
      versusHand: s.versusHand ? String(s.versusHand).slice(0, 6) : null,
      lineupOrder: s.lineupOrder ?? null,
      useVariant: false,
    })),
  );
  return NextResponse.json({ ok: true, rosterId: roster.id });
}
