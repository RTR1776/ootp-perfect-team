/**
 * League lineups and card modelling on the league model. Backs /league-card;
 * the same numbers as `pnpm league:compare` (lib/analytics/league-lineup).
 *
 *   GET  ?card=<id>  the shop card's ratings in card-face words, to prefill the form
 *   POST { roster?, locks?, park?, family?, year?, defScale?, dh?, cardId?, ratings? }
 *
 * - roster: the team's hitters, "Name" or "Name#cardId"; defaults to his bats
 *   in the newest league export.
 * - locks: { vR: { SS: entry, … }, vL: { … } } pins a roster entry to a slot.
 * - park: the home park as "1945 Fenway Park"; null or missing is neutral.
 * - cardId + ratings (optional): a card to model, in the card face's words
 *   (EYE vL, POW vR, BA vL, K vR, GAP vL, POS CF). Keys left out keep the shop
 *   card's values; a position set to 0 is one the card cannot play.
 *
 * Every lineup slot carries `entry`, the roster entry playing it (null for the
 * modelled card), so the page can tell a lock that held from one that didn't.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily, type Board, type LeagueFamily } from "@/lib/analytics/league-model";
import { leagueLineups, type Lineup, type Locks } from "@/lib/analytics/league-lineup";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { candidateHitter, FACE_KEYS, faceRatings, loadHitterUniverse, myLeagueBats, resolveRoster, type ShopHitter } from "@/lib/league-hitters";

export const runtime = "nodejs";

const FACE = new Set(FACE_KEYS.map(([face]) => face));
const SLOTS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);
const BOARDS: Board[] = ["vR", "vL"];

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

  const year = body.year == null ? 2010 : Number(body.year);
  if (!Number.isInteger(year) || !eraFor(year)) return NextResponse.json({ error: `No run environment on file for ${String(body.year)}.` }, { status: 400 });
  const defScale = body.defScale == null ? 1 : Number(body.defScale);
  if (!Number.isFinite(defScale) || defScale < 0 || defScale > 2) return NextResponse.json({ error: "Glove weight must be between 0 and 2." }, { status: 400 });
  const dh = body.dh !== false;
  const parkLabel = typeof body.park === "string" && body.park.trim() ? body.park.trim() : null;
  const park = parkLabel ? parkFor(parkLabel) : null;
  if (parkLabel && !park?.row) return NextResponse.json({ error: `No park factors on file for "${parkLabel}".` }, { status: 400 });

  const typed = Array.isArray(body.roster) ? (body.roster as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 40) : [];
  const familyGiven = ["PEL", "HD", "LD"].includes(String(body.family));
  // His export fills in only what the request leaves out; the page sends both.
  const [mine, u0] = await Promise.all([typed.length && familyGiven ? null : myLeagueBats(), loadHitterUniverse()]);
  // A card the cached shop hasn't seen: read it again once before saying there's none.
  const wanted = body.cardId != null ? Number(body.cardId) : null;
  const u = wanted != null && Number.isSafeInteger(wanted) && !u0.shopById.has(wanted) ? await loadHitterUniverse({ fresh: true }) : u0;
  const entries = typed.length ? typed : mine?.names ?? [];
  if (!entries.length) return NextResponse.json({ error: "No league roster on file; add the team's hitters." }, { status: 400 });
  const family: LeagueFamily = familyGiven ? (body.family as LeagueFamily) : leagueFamily(mine?.league ?? "HD");

  const { hitters, warnings } = resolveRoster(entries, u, false);
  if (!hitters.length) return NextResponse.json({ error: "None of those names is a hitter on file.", warnings }, { status: 400 });
  const idOf = new Map(hitters.map((h) => [h.entry, h.id]));

  // locks: slot → roster entry, per board
  const locks: Record<Board, Locks> = { vR: {}, vL: {} };
  const rawLocks = (body.locks ?? {}) as Record<string, Record<string, unknown>>;
  for (const b of BOARDS) {
    const seen = new Set<number>();
    for (const [slot, entry] of Object.entries(rawLocks[b] ?? {})) {
      if (!SLOTS.has(slot) || typeof entry !== "string" || !entry) continue;
      const id = idOf.get(entry);
      if (id == null) { warnings.push(`${b === "vR" ? "vs RHP" : "vs LHP"} ${slot}: ${entry.replace(/#\d+$/, "")} is not on the team; lock ignored`); continue; }
      if (seen.has(id)) return NextResponse.json({ error: `${entry.replace(/#\d+$/, "")} is locked into two slots ${b === "vR" ? "vs RHP" : "vs LHP"}.` }, { status: 400 });
      seen.add(id);
      locks[b][slot] = id;
    }
  }

  // optional card to model
  let cand: ReturnType<typeof candidateHitter> | null = null;
  if (body.cardId != null) {
    const cardId = Number(body.cardId);
    const card = Number.isSafeInteger(cardId) ? u.shopById.get(cardId) : undefined;
    if (!card || card.isPitcher) return NextResponse.json({ error: "No hitter with that card id." }, { status: 404 });
    const ratings: Record<string, number> = {};
    for (const [k, v] of Object.entries((body.ratings ?? {}) as Record<string, unknown>)) {
      const n = Number(v);
      if (!FACE.has(k) || !Number.isFinite(n) || n < 0 || n > 300) continue;
      ratings[k] = Math.round(n);
    }
    cand = { ...candidateHitter(hitters.length, card.name, card, ratings), label: `${card.name} ${card.value} (model)` };
  }

  const m = leagueLineups(cand ? [...hitters, cand] : hitters, { family, year, defScale, dh, park: park?.row ?? null });
  const rosterIds = hitters.map((h) => h.id);
  const now = { vR: m.solve(rosterIds, "vR", locks.vR), vL: m.solve(rosterIds, "vL", locks.vL) };
  for (const b of BOARDS) if (!now[b]) warnings.push(`${b === "vR" ? "vs RHP" : "vs LHP"}: no legal lineup with those locks (a locked player has no rating at his slot, or too few can play a position).`);
  // what the park did: the best nine with the same locks in a neutral park
  let neutral: Record<Board, number | null> | null = null;
  if (park?.row) {
    const n = leagueLineups(hitters, { family, year, defScale, dh, park: null });
    neutral = { vR: n.solve(rosterIds, "vR", locks.vR)?.total ?? null, vL: n.solve(rosterIds, "vL", locks.vL)?.total ?? null };
  }
  const runsOf = (id: number) => ({ vR: m.runs.get(id)?.vR ?? null, vL: m.runs.get(id)?.vL ?? null });
  const a = cand ? m.add(rosterIds, cand.id, now, locks) : null;
  const entryOf = new Map(hitters.map((h) => [h.id, h.entry ?? null]));
  const named = (l: Lineup | null) => l && { ...l, lineup: l.lineup.map((x) => ({ ...x, entry: entryOf.get(x.id) ?? null })) };

  return NextResponse.json({
    family, year, dh, defScale, lhp: m.lhp, rpw: m.rpw, rg: m.rg,
    park: park?.row ? park.label : null, neutral,
    roster: { source: typed.length ? "your list" : mine ? `${mine.league}, week of ${mine.on}` : "—", entries },
    pool: hitters.map((h) => ({ entry: h.entry, label: h.label, ...runsOf(h.id) })),
    now: { vR: named(now.vR), vL: named(now.vL) },
    candidate: cand ? { cardId: cand.cardId, label: cand.label, title: cand.note, ...runsOf(cand.id) } : null,
    with: a ? { vR: named(a.vR), vL: named(a.vL) } : null,
    add: a ? { dR: a.dR, dL: a.dL, season: a.season, wins: a.wins, dhOnly: a.dhOnly } : null,
    warnings: [...warnings, ...m.warnings],
  });
}
