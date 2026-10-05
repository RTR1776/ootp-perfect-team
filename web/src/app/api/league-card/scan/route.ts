/**
 * Every owned card not on the league team, scored as an addition to it: the
 * bats against the lineups, the arms against the staff. Backs the "From your
 * collection" panel on /league-card.
 *
 * L.J., 2026-10-05: "when I get new cards use optimize? Can you do the same
 * for league?" The page already re-solves the lineups and the staff for the
 * team he lists; this says which of his other cards belong on it.
 *
 *   POST { roster, arms, locks?, armLocks?, park?, family?, year?, defScale?, minValue? }
 *
 * Same scoring as POST /api/league-card with a modelled card: a bat's worth is
 * the best lineups with him minus the best without (`season`, boards weighted
 * by the league's LHP share), a pitcher's what he adds to the staff on the same
 * number of spots (lib/league-arms addArm). Cards under `minValue` (default
 * 90) are skipped. Locks hold. Only cards that add something are returned,
 * best first.
 */
import { NextResponse, type NextRequest } from "next/server";
import { leagueFamily, type Board, type LeagueFamily } from "@/lib/analytics/league-model";
import { keptLocks, leagueLineups, solveAround, type Lineup, type Locks } from "@/lib/analytics/league-lineup";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { loadHitterUniverse, resolveRoster } from "@/lib/league-hitters";
import { addArm } from "@/lib/league-arms";
import { leagueArmLines, leagueIpPerSlot, resolveArms, scoreArms, toStaffArm } from "@/lib/league-staff";

export const runtime = "nodejs";

const BOARDS: Board[] = ["vR", "vL"];
const SLOTS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);
const ARM_SLOT = /^(SP[1-9]|CL|RP[1-9]\d?)$/;
const LIMIT = 15;
/** Runs a season below which an addition isn't listed. */
const MIN_GAIN = 0.3;

const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, n) : []);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  const year = body.year == null ? 2010 : Number(body.year);
  if (!Number.isInteger(year) || !eraFor(year)) return NextResponse.json({ error: `No run environment on file for ${String(body.year)}.` }, { status: 400 });
  const defScale = body.defScale == null ? 1 : Number(body.defScale);
  if (!Number.isFinite(defScale) || defScale < 0 || defScale > 2) return NextResponse.json({ error: "Glove weight must be between 0 and 2." }, { status: 400 });
  const parkLabel = typeof body.park === "string" && body.park.trim() ? body.park.trim() : null;
  const park = parkLabel ? parkFor(parkLabel) : null;
  if (parkLabel && !park?.row) return NextResponse.json({ error: `No park factors on file for "${parkLabel}".` }, { status: 400 });
  const family: LeagueFamily = ["PEL", "HD", "LD"].includes(String(body.family)) ? (body.family as LeagueFamily) : leagueFamily("HD");
  const minValue = body.minValue == null ? 90 : Number(body.minValue);
  const roster = list(body.roster, 40), armEntries = list(body.arms, 30);
  if (!roster.length) return NextResponse.json({ error: "Add the team's hitters first." }, { status: 400 });

  const u = await loadHitterUniverse();
  const isArm = (cardId: number) => !!u.shopById.get(cardId)?.isPitcher;
  // One entry per owned card at or over the value line, pinned by id.
  const owned = new Map<number, string>();
  for (const o of u.owned) {
    if (o.cardId == null || (o.cardValue ?? 0) < minValue || owned.has(o.cardId)) continue;
    const c = u.shopById.get(o.cardId);
    if (c) owned.set(o.cardId, `${c.name}#${c.cardId}`);
  }

  // ---- bats
  const { hitters: team } = resolveRoster(roster, u, false);
  const onTeam = new Set(team.map((h) => h.cardId));
  const batEntries = [...owned].filter(([id]) => !isArm(id) && !onTeam.has(id)).map(([, e]) => e);
  const { hitters: all } = resolveRoster([...roster, ...batEntries], u, false);
  const m = leagueLineups(all, { family, year, defScale, dh: body.dh !== false, park: park?.row ?? null });
  const rosterIds = all.slice(0, team.length).map((h) => h.id);
  const idOf = new Map(all.slice(0, team.length).map((h) => [h.entry, h.id]));
  const locks: Record<Board, Locks> = { vR: {}, vL: {} };
  const rawLocks = (body.locks ?? {}) as Record<string, Record<string, unknown>>;
  for (const b of BOARDS) for (const [slot, entry] of Object.entries(rawLocks[b] ?? {})) {
    const id = typeof entry === "string" ? idOf.get(entry) : undefined;
    if (SLOTS.has(slot) && id != null) locks[b][slot] = id;
  }
  const tried = { vR: solveAround(m.solve, rosterIds, "vR", locks.vR), vL: solveAround(m.solve, rosterIds, "vL", locks.vL) };
  const now = { vR: tried.vR.lineup, vL: tried.vL.lineup };
  const used = { vR: keptLocks(locks.vR, tried.vR.dropped), vL: keptLocks(locks.vL, tried.vL.dropped) };
  const labelOf = new Map(all.map((h) => [h.id, h.label]));
  const out = (before: Lineup | null, after: Lineup | null) => {
    const kept = new Set(after?.lineup.map((x) => x.id) ?? []);
    return (before?.lineup ?? []).filter((x) => !kept.has(x.id)).map((x) => labelOf.get(x.id) ?? "");
  };
  const bats = all.slice(team.length).map((h) => {
    const a = m.add(rosterIds, h.id, now, used);
    const at = (l: Lineup | null) => l?.lineup.find((x) => x.id === h.id)?.slot ?? null;
    return {
      entry: h.entry!, label: h.label, cardId: h.cardId, season: a.season, wins: a.wins, dR: a.dR, dL: a.dL,
      vR: at(a.vR), vL: at(a.vL), sitsR: out(now.vR, a.vR), sitsL: out(now.vL, a.vL),
    };
  }).filter((x) => x.season >= MIN_GAIN).sort((a, b) => b.season - a.season).slice(0, LIMIT);

  // ---- arms
  const { arms: staffPicks } = resolveArms(armEntries, u);
  const onStaff = new Set(staffPicks.map((a) => a.cardId));
  const { arms: candPicks } = resolveArms([...owned].filter(([id]) => isArm(id) && !onStaff.has(id)).map(([, e]) => e), u);
  const [lines, ip] = await Promise.all([leagueArmLines(family), leagueIpPerSlot(family)]);
  const scores = scoreArms([...staffPicks, ...candPicks], lines);
  const staffArms = staffPicks.map((a) => toStaffArm(a, scores.get(a.entry)!));
  const armLocks: { SP: string[]; RP: string[]; at: Record<string, string> } = { SP: [], RP: [], at: {} };
  const staffEntries = new Set(staffPicks.map((a) => a.entry));
  for (const [slot, entry] of Object.entries((body.armLocks ?? {}) as Record<string, unknown>)) {
    if (!ARM_SLOT.test(slot) || typeof entry !== "string" || !staffEntries.has(entry)) continue;
    armLocks[slot.startsWith("SP") ? "SP" : "RP"].push(entry);
    armLocks.at[slot] = entry;
  }
  const arms = staffArms.length ? candPicks.flatMap((c) => {
    const sc = scores.get(c.entry)!;
    if (sc.sp == null && sc.rp == null) return [];
    const g = addArm(staffArms, toStaffArm(c, sc), ip, armLocks);
    return [{ entry: c.entry, label: c.label, cardId: c.cardId, season: g.season, wins: g.season / m.rpw, slot: g.slot?.slot ?? null, replaces: g.replaces, sits: g.sits }];
  }).filter((x) => x.season >= MIN_GAIN).sort((a, b) => b.season - a.season).slice(0, LIMIT) : [];

  return NextResponse.json({
    minValue, collectionOn: u.collectionOn, park: park?.row ? park.label : null,
    scanned: { bats: batEntries.length, arms: candPicks.length }, bats, arms,
  });
}
