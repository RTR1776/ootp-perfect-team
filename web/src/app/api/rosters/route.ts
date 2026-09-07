/**
 * Saved rosters for /build. GET ?tournamentId= lists them; POST saves one
 * (name + slots) for a tournament. Auth mirrors the upload route: the proxy
 * gate is optimistic, so the session is re-verified here.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/db/client";
import { cards, collectionCards, rosters, rosterSlots, tournaments, uploads } from "@/db/schema";

import { validateRoster, type RosterRules } from "@/lib/roster-rules";
import { parseRosterInput } from "@/lib/roster-input";

export const runtime = "nodejs";

async function authed(): Promise<boolean> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(session);
}

export async function GET(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const tournamentId = Number(new URL(request.url).searchParams.get("tournamentId"));
  if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
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

export async function POST(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const parsed = parseRosterInput(await request.json().catch(()=>null));
  if (!parsed.ok) return NextResponse.json({error:parsed.error},{status:400});
  const body = parsed.value;
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id,body.tournamentId));
  if (!tournament) return NextResponse.json({error:"Tournament no longer exists."},{status:404});
  const [latest] = await db.select({id:uploads.id}).from(uploads).where(eq(uploads.kind,"collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = latest ? await db.select().from(collectionCards).where(eq(collectionCards.uploadId,latest.id)) : [];
  const ids = [...new Set(body.slots.map(s=>s.cardId))];
  const universe = await db.select().from(cards).where(inArray(cards.cardId,ids));
  const base = new Set(owned.filter(c=>!c.isVariant).map(c=>c.cardId));
  const variants = new Set(owned.filter(c=>c.isVariant).map(c=>c.cardId));
  const validation = validateRoster(body.slots,universe.map(c=>({
    cardId:c.cardId,name:c.name,val:c.cardValue,year:c.year,isPitcher:c.isPitcher,role:c.pitcherRole,
    ratings:c.ratings,cardType:c.cardType,baseOwned:base.has(c.cardId),variantOwned:variants.has(c.cardId),
  })),{...tournament,restrictions:tournament.restrictions as RosterRules["restrictions"]});
  // Drafts can be incomplete or over budget, but cannot invent cards or forms.
  const structural = validation.errors.filter(e=>["missing-card","not-owned","mixed-form","duplicate-slot","duplicate-player","lineup-hand","staff-hand","position"].includes(e.code));
  if (structural.length || (body.requireReady && !validation.ready)) return NextResponse.json({
    error:structural[0]?.message ?? "Resolve the rule checks or save this roster as a draft.",validation,
  },{status:422});
  const notes = JSON.stringify({version:1,status:validation.ready?"ready":"draft",collectionUploadId:latest?.id,checkedAt:new Date().toISOString(),validation});
  const slots = JSON.stringify(body.slots.map(s=>({card_id:s.cardId,slot:s.slot,versus_hand:s.versusHand,lineup_order:s.lineupOrder,use_variant:s.useVariant})));
  // A single statement is atomic on both Neon HTTP and ordinary Postgres.
  const saved = await db.execute(sql`
    with saved as (
      insert into rosters(name,tournament_id,notes) values(${body.name},${body.tournamentId},${notes}) returning id
    ), inserted as (
      insert into roster_slots(roster_id,card_id,slot,versus_hand,lineup_order,use_variant)
      select saved.id,s.card_id,s.slot,s.versus_hand,s.lineup_order,s.use_variant
      from saved cross join jsonb_to_recordset(${slots}::jsonb)
      as s(card_id integer,slot text,versus_hand text,lineup_order integer,use_variant boolean)
      returning roster_id
    ) select id from saved where exists(select 1 from inserted)
  `);
  const rows = Array.isArray(saved) ? saved : saved.rows;
  return NextResponse.json({ok:true,rosterId:rows[0]?.id,validation});
}
