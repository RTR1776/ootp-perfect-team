/**
 * Model one card for league play: its runs per board on the league model and
 * what it adds to L.J.'s league lineups. Backs /league-card; the same numbers
 * as `pnpm league:compare` (lib/analytics/league-lineup).
 *
 *   GET  ?card=<id>  the shop card's ratings in card-face words, to prefill the form
 *   POST { cardId, ratings, family?, year?, defScale?, dh?, roster? }
 *
 * `ratings` uses the card face's words (EYE vL, POW vR, BA vL, K vR, GAP vL,
 * POS CF); keys left out keep the shop card's values, and a position set to 0
 * is one the card cannot play. `roster` is the team's hitters by name and
 * defaults to his team's bats in the newest league export.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily, type LeagueFamily } from "@/lib/analytics/league-model";
import { leagueLineups } from "@/lib/analytics/league-lineup";
import { eraFor } from "@/lib/analytics/tournament-env";
import { candidateHitter, FACE_KEYS, faceRatings, loadHitterUniverse, myLeagueBats, resolveRoster, type ShopHitter } from "@/lib/league-hitters";

export const runtime = "nodejs";

const FACE = new Set(FACE_KEYS.map(([face]) => face));

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("card"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "card=<id> is required." }, { status: 400 });
  const [c] = await db.select({ cardId: cards.cardId, name: cards.name, title: cards.title, value: cards.cardValue, pos: cards.position, isPitcher: cards.isPitcher, bats: cards.bats, ratings: cards.ratings, year: cards.year })
    .from(cards).where(eq(cards.cardId, id));
  if (!c || c.isPitcher) return NextResponse.json({ error: "No hitter with that card id." }, { status: 404 });
  return NextResponse.json({ cardId: c.cardId, name: c.name, title: c.title, value: c.value, year: c.year, bats: c.bats, position: c.pos, face: faceRatings(c as ShopHitter) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  const cardId = Number(body.cardId);
  if (!Number.isSafeInteger(cardId) || cardId <= 0) return NextResponse.json({ error: "Pick a card." }, { status: 400 });

  const ratings: Record<string, number> = {};
  for (const [k, v] of Object.entries((body.ratings ?? {}) as Record<string, unknown>)) {
    const n = Number(v);
    if (!FACE.has(k) || !Number.isFinite(n) || n < 0 || n > 300) continue;
    ratings[k] = Math.round(n);
  }
  const year = body.year == null ? 2010 : Number(body.year);
  if (!Number.isInteger(year) || !eraFor(year)) return NextResponse.json({ error: `No run environment on file for ${String(body.year)}.` }, { status: 400 });
  const defScale = body.defScale == null ? 1 : Number(body.defScale);
  if (!Number.isFinite(defScale) || defScale < 0 || defScale > 2) return NextResponse.json({ error: "Glove weight must be between 0 and 2." }, { status: 400 });
  const dh = body.dh !== false;

  const typed = Array.isArray(body.roster) ? (body.roster as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 40) : [];
  const mine = await myLeagueBats();
  const names = typed.length ? typed : mine?.names ?? [];
  if (!names.length) return NextResponse.json({ error: "No league roster on file; list the team's hitters." }, { status: 400 });
  const family: LeagueFamily = ["PEL", "HD", "LD"].includes(String(body.family)) ? (body.family as LeagueFamily) : leagueFamily(mine?.league ?? "HD");

  const u = await loadHitterUniverse();
  const card = u.shopById.get(cardId);
  if (!card || card.isPitcher) return NextResponse.json({ error: "No hitter with that card id." }, { status: 404 });
  const { hitters, warnings } = resolveRoster(names, u, false);
  if (!hitters.length) return NextResponse.json({ error: "None of those names is a hitter on file.", warnings }, { status: 400 });
  const cand = { ...candidateHitter(hitters.length, card.name, card, ratings), label: `${card.name} ${card.value} (model)` };
  const m = leagueLineups([...hitters, cand], { family, year, defScale, dh });
  const rosterIds = hitters.map((h) => h.id);
  const now = { vR: m.solve(rosterIds, "vR"), vL: m.solve(rosterIds, "vL") };
  const a = m.add(rosterIds, cand.id, now);
  const runsOf = (id: number) => ({ vR: m.runs.get(id)?.vR ?? null, vL: m.runs.get(id)?.vL ?? null });

  return NextResponse.json({
    family, year, dh, defScale, lhp: m.lhp, rpw: m.rpw, rg: m.rg,
    roster: { source: typed.length ? "names entered" : mine ? `${mine.league}, week of ${mine.on}` : "—", names },
    candidate: { label: cand.label, title: card.title, ...runsOf(cand.id) },
    bats: hitters.map((h) => ({ label: h.label, ...runsOf(h.id) })),
    now, with: { vR: a.vR, vL: a.vL },
    add: { dR: a.dR, dL: a.dL, season: a.season, wins: a.wins, dhOnly: a.dhOnly },
    warnings: [...warnings, ...m.warnings],
  });
}
