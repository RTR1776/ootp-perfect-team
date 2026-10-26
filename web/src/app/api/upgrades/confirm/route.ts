/**
 * Confirm a buy (the Upgrades page): POST { eventId, variants: id[], owned: id[] }
 * runs the seeded rebuild for the event without and with the cards assumed his
 * (lib/upgrade-confirm-server) and returns the objective's change and the cards
 * that move. About a minute per event. Where the server can't spawn the CLI
 * (Vercel) it answers 501 with the command to run on the Mac instead.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { canSpawnBuilds, confirmBuy, confirmCommand } from "@/lib/upgrade-confirm-server";

export const runtime = "nodejs";
// Vercel answers at once (it can't spawn the CLI); the Mac's dev server has no limit.
export const maxDuration = 60;

const ids = (v: unknown): number[] | null =>
  Array.isArray(v) && v.length <= 20 && v.every((x) => Number.isSafeInteger(x) && x > 0) ? (v as number[]) : null;

export async function POST(request: Request) {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { eventId?: unknown; variants?: unknown; owned?: unknown } | null;
  const eventId = Number(body?.eventId);
  const variants = ids(body?.variants ?? []), owned = ids(body?.owned ?? []);
  if (!Number.isSafeInteger(eventId) || eventId <= 0 || !variants || !owned || !(variants.length + owned.length)) {
    return NextResponse.json({ error: "eventId and at least one card id (variants / owned) required" }, { status: 400 });
  }
  if (!canSpawnBuilds()) {
    return NextResponse.json({ error: "The rebuild runs the env-roster CLI, which this server can't. Run it on the Mac:", command: confirmCommand([eventId], variants, owned) }, { status: 501 });
  }
  return NextResponse.json(await confirmBuy(eventId, variants, owned));
}
