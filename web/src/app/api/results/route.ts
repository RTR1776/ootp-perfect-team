/**
 * The PTCS result ledger: log tournament finishes by event id.
 *
 *   POST /api/results  { text, asOf?, dryRun? }
 *     text    rows pasted from the Your Tournaments screen (see lib/result-lines)
 *     asOf    YYYY-MM-DD the screen was read - resolves "Yesterday"; default today (Central)
 *     dryRun  score and dedupe but write nothing (the preview the page shows first)
 *   DELETE /api/results?eventId=N   remove one logged event (a mis-read row)
 *
 * The event id in parentheses is THE key: `results.event_id` is unique, and the
 * insert is ON CONFLICT DO NOTHING, so a screenshot that overlaps an earlier one
 * cannot double-count no matter how many times it is pasted. Rows without an
 * id are refused rather than logged un-deduplicable. The work is in
 * lib/result-entry-server so `pnpm results:log` is the same code path.
 *
 * Auth mirrors /api/rosters: the proxy gate is optimistic, so the session is
 * re-verified here.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deleteResult, enterResults } from "@/lib/result-entry-server";

export const runtime = "nodejs";

async function authed(): Promise<boolean> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(session);
}

export async function POST(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { text?: unknown; asOf?: unknown; dryRun?: unknown } | null;
  if (!body || typeof body.text !== "string") return NextResponse.json({ error: "Paste at least one result row." }, { status: 400 });
  const outcome = await enterResults({
    text: body.text,
    asOf: typeof body.asOf === "string" ? body.asOf : null,
    dryRun: body.dryRun === true,
  });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome.value);
}

export async function DELETE(request: Request) {
  if (!(await authed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const eventId = Number(new URL(request.url).searchParams.get("eventId"));
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return NextResponse.json({ error: "eventId required" }, { status: 400 });
  const deleted = await deleteResult(eventId);
  if (!deleted) return NextResponse.json({ error: "No logged result carries that event id." }, { status: 404 });
  return NextResponse.json({ ok: true, deleted });
}
