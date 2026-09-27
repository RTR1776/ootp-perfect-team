/**
 * League lineups and card modelling on the league model. Backs /league-card;
 * the same numbers as `pnpm league:compare` (lib/analytics/league-lineup).
 *
 *   GET  ?card=<id>  the shop card's ratings in card-face words, to prefill the
 *                    form; a pitcher also gets its league record (kind "arm")
 *   POST { roster?, locks?, park?, family?, year?, defScale?, dh?, cardId?, ratings?, arms?, armLocks? }
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
 *
 * The pitching staff (UI plan §5, lib/league-staff): each arm scored per role
 * as edge per 9 over the league's arm, from league play with a ratings
 * estimate where the sample is thin; the best five start, the rest relieve.
 * - arms: the staff, "Name" or "Name#cardId"; defaults to his pitchers in the
 *   newest league export.
 * - armLocks: { SP1: entry, CL: entry, RP2: entry, … } pins an arm to a role
 *   (starter for SPn, reliever for CL / RPn).
 * - cardId of a pitcher + ratings in card-face words (STU vL, CON vR, HRA vL,
 *   PBABIP vR, STM): the arm to model; `armAdd` is what he adds to the staff
 *   on the same number of pitching spots, and `armAdd.staff` the staff he
 *   would join. candidateRole "SP" or "RP" puts him in the rotation or the
 *   pen instead of wherever he scores best (a starter needs Stamina over 25).
 * Arms are scored in the team's league family (`family`): its own play
 * first, play in the other families scaled to it (lib/league-staff).
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily, type Board, type LeagueFamily } from "@/lib/analytics/league-model";
import { leagueLineups, type Lineup, type Locks } from "@/lib/analytics/league-lineup";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { candidateHitter, FACE_KEYS, faceRatings, loadHitterUniverse, myLeagueBats, resolveRoster, type ShopHitter } from "@/lib/league-hitters";
import { addArm, armKey, myLeagueArms, STARTER_STAMINA, staffSolve, type ArmRole } from "@/lib/league-arms";
import {
  ARM_FACE_KEYS, armFace, edgeFor, leagueArmEdges, leagueArmLines, leagueIpPerSlot, ownedVariant, resolveArms, scoreArms, sideEdge, toStaffArm, type ArmPick,
} from "@/lib/league-staff";

export const runtime = "nodejs";

const FACE = new Set(FACE_KEYS.map(([face]) => face));
const ARM_FACE = new Set(ARM_FACE_KEYS.map(([face]) => face));
const ARM_SLOT = /^(SP[1-9]|CL|RP[1-9]\d?)$/;

/** Typed card-face numbers: known keys only, 0–300, whole numbers. */
function typedFace(raw: unknown, keys: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const n = Number(v);
    if (!keys.has(k) || v === "" || v == null || !Number.isFinite(n) || n < 0 || n > 300) continue;
    out[k] = Math.round(n);
  }
  return out;
}
const SLOTS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);
const BOARDS: Board[] = ["vR", "vL"];

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("card"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "card=<id> is required." }, { status: 400 });
  const [c] = await db.select({ cardId: cards.cardId, name: cards.name, title: cards.title, value: cards.cardValue, pos: cards.position, isPitcher: cards.isPitcher, bats: cards.bats, ratings: cards.ratings, year: cards.year })
    .from(cards).where(eq(cards.cardId, id));
  if (!c) return NextResponse.json({ error: "No card with that id." }, { status: 404 });
  if (c.isPitcher) {
    const r = (c.ratings ?? {}) as Record<string, number>;
    const e = (await leagueArmEdges()).get(armKey({ cid: c.cardId, name: c.name, isVariant: false }));
    return NextResponse.json({
      kind: "arm", cardId: c.cardId, name: c.name, title: c.title, value: c.value, year: c.year, position: c.pos,
      face: armFace(r),
      // Not modelled: its parts are pHR and pBABIP.
      movement: { vL: r["Movement vL"] ?? null, vR: r["Movement vR"] ?? null },
      observed: e ? { asSP: e.asSP, asRP: e.asRP } : null,
    });
  }
  return NextResponse.json({ kind: "bat", cardId: c.cardId, name: c.name, title: c.title, value: c.value, year: c.year, bats: c.bats, position: c.pos, face: faceRatings(c as ShopHitter) });
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
  const typedArms = Array.isArray(body.arms) ? (body.arms as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 30) : null;
  const familyGiven = ["PEL", "HD", "LD"].includes(String(body.family));
  // His export fills in only what the request leaves out; the page sends both.
  const [mine, u0, mineArms] = await Promise.all([typed.length && familyGiven ? null : myLeagueBats(), loadHitterUniverse(), typedArms ? null : myLeagueArms()]);
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

  // optional card to model: a hitter joins the lineups, a pitcher the staff
  let cand: ReturnType<typeof candidateHitter> | null = null;
  let candArm: ArmPick | null = null;
  const candArmFace = new Map<string, Record<string, number>>();
  if (body.cardId != null) {
    const cardId = Number(body.cardId);
    const card = Number.isSafeInteger(cardId) ? u.shopById.get(cardId) : undefined;
    if (!card) return NextResponse.json({ error: "No card with that id." }, { status: 404 });
    if (card.isPitcher) {
      const base = (card.ratings ?? {}) as Record<string, number>;
      candArm = {
        entry: `model#${card.cardId}`, label: `${card.name} ${card.value} (model)`, cardId: card.cardId, key: armKey({ cid: card.cardId, name: card.name, isVariant: false }),
        variant: false, ratings: base, base, varRatings: ownedVariant(card.cardId, u),
      };
      candArmFace.set(candArm.entry, typedFace(body.ratings, ARM_FACE));
    } else {
      cand = { ...candidateHitter(hitters.length, card.name, card, typedFace(body.ratings, FACE)), label: `${card.name} ${card.value} (model)` };
    }
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

  // ---- the pitching staff
  const armEntries = typedArms ?? mineArms?.arms.map((x) => x.entry) ?? [];
  const [lines, edgesVL, edgesVR, ip] = await Promise.all([leagueArmLines(family), leagueArmEdges("vL"), leagueArmEdges("vR"), leagueIpPerSlot(family)]);
  const { arms: picks, warnings: armWarnings } = resolveArms(armEntries, u);
  warnings.push(...armWarnings);
  const scores = scoreArms(candArm ? [...picks, candArm] : picks, lines, candArmFace);
  const staffArms = picks.map((a) => toStaffArm(a, scores.get(a.entry)!));
  const armLocks: { SP: string[]; RP: string[]; at: Record<string, string> } = { SP: [], RP: [], at: {} };
  const armEntrySet = new Set(picks.map((a) => a.entry));
  for (const [slot, entry] of Object.entries((body.armLocks ?? {}) as Record<string, unknown>)) {
    if (!ARM_SLOT.test(slot) || typeof entry !== "string" || !entry) continue;
    if (!armEntrySet.has(entry)) { warnings.push(`${slot}: ${entry.replace(/#\d+$/, "")} is not on the staff; lock ignored`); continue; }
    if (armLocks.SP.includes(entry) || armLocks.RP.includes(entry)) return NextResponse.json({ error: `${entry.replace(/#\d+$/, "")} is locked into two staff slots.` }, { status: 400 });
    armLocks[slot.startsWith("SP") ? "SP" : "RP"].push(entry);
    armLocks.at[slot] = entry;
  }
  const staff = staffArms.length ? staffSolve(staffArms, ip, armLocks) : null;
  const sideOf = (a: ArmPick) => ({ vL: sideEdge(edgeFor(a, edgesVL))?.edge9 ?? null, vR: sideEdge(edgeFor(a, edgesVR))?.edge9 ?? null });
  const armRow = (a: ArmPick) => {
    const sc = scores.get(a.entry)!;
    return {
      entry: a.entry, label: a.label, cardId: a.cardId, sp: sc.sp, rp: sc.rp, spSource: sc.spSource, rpSource: sc.rpSource,
      spIp: sc.spIp, rpIp: sc.rpIp, spIpFamily: sc.spIpFamily, rpIpFamily: sc.rpIpFamily, stamina: sc.stamina, ...sideOf(a),
    };
  };
  // The role he was asked to pitch in, if he can: a starter needs a starter's number and Stamina over 25.
  let role: ArmRole | undefined = body.candidateRole === "SP" || body.candidateRole === "RP" ? body.candidateRole : undefined;
  const candScore = candArm ? scores.get(candArm.entry)! : null;
  if (candArm && candScore && role === "SP" && (candScore.sp == null || (candScore.stamina != null && candScore.stamina <= STARTER_STAMINA))) {
    warnings.push(`${candArm.label.replace(/ \(model\)$/, "")} can't start (Stamina ${candScore.stamina ?? "—"}); scored where he fits best`);
    role = undefined;
  }
  const armGain = candArm && candScore && staffArms.length ? addArm(staffArms, toStaffArm(candArm, candScore), ip, armLocks, role) : null;

  return NextResponse.json({
    family, year, dh, defScale, lhp: m.lhp, rpw: m.rpw, rg: m.rg,
    park: park?.row ? park.label : null, neutral,
    roster: { source: typed.length ? "your list" : mine ? `${mine.league}, week of ${mine.on}` : "—", entries },
    pool: hitters.map((h) => ({ entry: h.entry, label: h.label, ...runsOf(h.id) })),
    now: { vR: named(now.vR), vL: named(now.vL) },
    candidate: cand ? { cardId: cand.cardId, label: cand.label, title: cand.note, ...runsOf(cand.id) } : null,
    with: a ? { vR: named(a.vR), vL: named(a.vL) } : null,
    add: a ? { dR: a.dR, dL: a.dL, season: a.season, wins: a.wins, dhOnly: a.dhOnly } : null,
    staff: staff && { ...staff, ipPerSlot: { sp: ip.sp, rp: ip.rp }, week: ip.week, source: typedArms ? "your list" : mineArms ? `${mineArms.league}, week of ${mineArms.on}` : "—", entries: armEntries },
    armPool: picks.map(armRow),
    candidateArm: candArm ? armRow(candArm) : null,
    armAdd: armGain && { season: armGain.season, wins: armGain.season / m.rpw, slot: armGain.slot, replaces: armGain.replaces, sits: armGain.sits, staff: armGain.with, role: role ?? null },
    warnings: [...warnings, ...m.warnings],
  });
}
