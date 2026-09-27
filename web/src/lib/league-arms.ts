/**
 * League pitching for the Card Model (UI plan §5, Phase 1): how each arm has
 * pitched in league play, a staff built from those numbers, and what one more
 * arm adds to it.
 *
 * THE MEASURE. A pitcher's FIP-type runs per 9 innings better than the league
 * he pitched in that week:
 *   core   = (13·HR + 3·(BB + HBP) − 2·K) / IP        (FIP without its constant)
 *   edge9  = Σ IP·(league core − card core) / Σ IP     over every team-week
 * It is measured against each week's own league because leagues normalise
 * (a card's edge shrinks against the talent around it) and weeks differ (the
 * 1959 and 1989 theme weeks). Positive is better than the league. Pooled over
 * every team that rostered the card, starts and relief kept apart, and shrunk
 * toward zero with a 150-inning prior, the same prior /league's FIP* uses.
 *
 * Season runs = edge9 × the innings a rotation or bullpen slot pitches / 9.
 * Leverage is not modelled: a closer's innings count the same as a mop-up's.
 *
 * ARMS WITH LITTLE OR NO LEAGUE SAMPLE (every shop variant no team has
 * rostered) get an estimate from their ratings: k_arm × the tournament model's
 * runs saved per 9 over the league's average arm. k_arm is one slope fitted by
 * scripts/fit-arm-slope.ts on the arms with 1,000+ league innings; it is the
 * league's compression of a ratings edge, as the hitters' 0.68 is. Phase 2
 * replaces it with a full per-rating fit.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leagueSnapshots, leagueStints } from "@/db/schema";
import { isMyOrg } from "@/lib/my-team";
import { MIN_PITCHER_SHARE } from "@/lib/league-snapshots";
import { leagueFamily, type LeagueFamily } from "@/lib/analytics/league-model";
import ARM_MODEL from "@/data/league-arm-model.json";

/* ------------------------------------------------------------------ core */

export type ArmRole = "SP" | "RP";

/** One team-week line for a pitcher, as the export gives it. */
export interface ArmRow {
  snapshotId: number;
  league: string;
  capturedOn: string;
  org: string;
  isFreeAgent: boolean;
  cid: number | null;
  name: string;
  isVariant: boolean;
  pos: string;
  ip: number;
  stats: Record<string, number>;
  ratings?: Record<string, number>;
}

export interface ArmSide {
  /** FIP-type runs per 9 IP better than the week's league, pooled. */
  edge9: number;
  /** The same, shrunk toward 0 by a 150-inning prior. */
  edge9Reg: number;
  ip: number;
  /** Team-weeks the line pools. */
  teams: number;
  weeks: number;
}

export interface ArmEdge {
  key: string;
  cid: number | null;
  name: string;
  isVariant: boolean;
  asSP: ArmSide | null;
  asRP: ArmSide | null;
  /** Stamina from the newest line (league ratings: STM). */
  stamina: number | null;
}

export const ARM_PRIOR_IP = 150;
/** Innings a slot pitches when the week can't say: a full rotation turn, a busy reliever. */
export const IP_FALLBACK = { sp: 180, rp: 70 };

/** A card's identity across teams and weeks: the variant is a different card. */
export const armKey = (r: { cid: number | null; name: string; pos?: string; isVariant: boolean }) =>
  `${r.cid != null ? `c${r.cid}` : `n${r.name}|${r.pos ?? ""}`}${r.isVariant ? "v" : ""}`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
/** 13·HR + 3·(BB + HBP) − 2·K for one line (the export's pitcher columns). */
const coreSum = (s: Record<string, number>) => 13 * num(s.HRa) + 3 * (num(s.BBa) + num(s.HPa)) - 2 * num(s.Ka);

/** Started or relieved, from the line's own games: most games started makes a starter. */
export function roleOf(r: Pick<ArmRow, "pos" | "stats">): ArmRole {
  const g = num(r.stats.G_p), gs = num(r.stats.GS_p);
  if (g > 0) return gs >= 1 && gs >= 0.5 * g ? "SP" : "RP";
  return r.pos === "SP" ? "SP" : "RP";
}

const rostered = (r: ArmRow) => !r.isFreeAgent && !!r.org && r.org !== "-";

/**
 * Pool team-week lines into one edge per card and role. `rows` are pitcher
 * lines from complete snapshots of one split; each snapshot's league core is
 * read off its own rostered pitchers.
 */
export function poolArmEdges(rows: readonly ArmRow[]): Map<string, ArmEdge> {
  const lg = new Map<number, { core: number; ip: number }>();
  for (const r of rows) {
    if (!rostered(r) || !(r.ip > 0)) continue;
    const a = lg.get(r.snapshotId) ?? { core: 0, ip: 0 };
    a.core += coreSum(r.stats); a.ip += r.ip;
    lg.set(r.snapshotId, a);
  }
  type Acc = { num: number; ip: number; teams: number; weeks: Set<string> };
  const acc = new Map<string, { edge: ArmEdge; sp: Acc; rp: Acc; newest: string }>();
  for (const r of rows) {
    if (!rostered(r) || !(r.ip > 0)) continue;
    const L = lg.get(r.snapshotId);
    if (!L || !(L.ip > 0)) continue;
    const key = armKey(r);
    const a = acc.get(key) ?? {
      edge: { key, cid: r.cid, name: r.name, isVariant: r.isVariant, asSP: null, asRP: null, stamina: null },
      sp: { num: 0, ip: 0, teams: 0, weeks: new Set<string>() }, rp: { num: 0, ip: 0, teams: 0, weeks: new Set<string>() }, newest: "",
    };
    const side = roleOf(r) === "SP" ? a.sp : a.rp;
    // IP·(league core per IP) − the card's own core sum: runs per 9 once divided by ΣIP.
    side.num += r.ip * (L.core / L.ip) - coreSum(r.stats);
    side.ip += r.ip; side.teams++; side.weeks.add(r.capturedOn);
    if (r.capturedOn >= a.newest) { a.newest = r.capturedOn; const stm = r.ratings?.STM; if (stm != null) a.edge.stamina = stm; }
    acc.set(key, a);
  }
  const done = (s: Acc): ArmSide | null => {
    if (!(s.ip > 0)) return null;
    const edge9 = s.num / s.ip;
    return { edge9, edge9Reg: (edge9 * s.ip) / (s.ip + ARM_PRIOR_IP), ip: s.ip, teams: s.teams, weeks: s.weeks.size };
  };
  const out = new Map<string, ArmEdge>();
  for (const [key, a] of acc) out.set(key, { ...a.edge, asSP: done(a.sp), asRP: done(a.rp) });
  return out;
}

/**
 * Innings a rotation slot and a bullpen slot pitch in one league week: per
 * team, the five arms with the most starts are the rotation (the median of
 * their innings), the rest with 10+ innings the pen (their mean).
 */
export function ipPerSlotFrom(rows: readonly ArmRow[]): { sp: number; rp: number } {
  const byTeam = new Map<string, ArmRow[]>();
  for (const r of rows) {
    if (!rostered(r)) continue;
    const k = `${r.snapshotId}|${r.org}`;
    byTeam.set(k, [...(byTeam.get(k) ?? []), r]);
  }
  const sp: number[] = [], rp: number[] = [];
  for (const arms of byTeam.values()) {
    const sorted = [...arms].sort((a, b) => num(b.stats.GS_p) - num(a.stats.GS_p) || b.ip - a.ip);
    sorted.slice(0, 5).forEach((a) => sp.push(a.ip));
    sorted.slice(5).filter((a) => a.ip >= 10).forEach((a) => rp.push(a.ip));
  }
  sp.sort((a, b) => a - b);
  const median = sp.length ? sp[Math.floor(sp.length / 2)] : IP_FALLBACK.sp;
  const mean = rp.length ? rp.reduce((a, b) => a + b, 0) / rp.length : IP_FALLBACK.rp;
  return { sp: sp.length >= 20 ? median : IP_FALLBACK.sp, rp: rp.length >= 20 ? mean : IP_FALLBACK.rp };
}

/* ---------------------------------------------------------------- staff */

export interface StaffArm {
  entry: string;
  label: string;
  /** Edge per 9 as a starter / reliever; null when there is neither sample nor estimate. */
  sp: number | null;
  rp: number | null;
  stamina: number | null;
}
export interface StaffSlot { slot: string; entry: string; label: string; role: ArmRole; edge9: number; runs: number }
export interface Staff { rotation: StaffSlot[]; bullpen: StaffSlot[]; total: number }

/** Below this Stamina an arm can't turn a lineup over (card-value roleRuns' break). */
export const STARTER_STAMINA = 25;
export const ROTATION = 5;

/**
 * The best staff from these arms: five starters, the rest in the pen, to
 * maximise season runs (edge × slot innings / 9). Picking the rotation is
 * picking the five arms that gain most from starting over relieving. `locks`
 * pin entries to a role. An arm with no relief number relieves at its
 * starter's edge, and one with no starter number can't start.
 */
export function staffSolve(arms: readonly StaffArm[], ip: { sp: number; rp: number }, locks: { SP?: string[]; RP?: string[] } = {}): Staff {
  const lockSP = new Set(locks.SP ?? []), lockRP = new Set(locks.RP ?? []);
  const rpOf = (a: StaffArm) => a.rp ?? a.sp ?? 0;
  const canStart = (a: StaffArm) => a.sp != null && (a.stamina == null || a.stamina > STARTER_STAMINA);
  const gain = (a: StaffArm) => (a.sp! * ip.sp - rpOf(a) * ip.rp) / 9;
  const forced = arms.filter((a) => lockSP.has(a.entry) && a.sp != null);
  const open = arms.filter((a) => !lockSP.has(a.entry) && !lockRP.has(a.entry) && canStart(a)).sort((a, b) => gain(b) - gain(a));
  const rotationArms = [...forced, ...open].slice(0, Math.max(ROTATION, forced.length));
  const inRotation = new Set(rotationArms.map((a) => a.entry));
  const rotation = rotationArms
    .sort((a, b) => b.sp! - a.sp!)
    .map((a, i): StaffSlot => ({ slot: `SP${i + 1}`, entry: a.entry, label: a.label, role: "SP", edge9: a.sp!, runs: (a.sp! * ip.sp) / 9 }));
  const bullpen = arms.filter((a) => !inRotation.has(a.entry))
    .sort((a, b) => rpOf(b) - rpOf(a))
    .map((a, i): StaffSlot => ({ slot: i === 0 ? "CL" : `RP${i}`, entry: a.entry, label: a.label, role: "RP", edge9: rpOf(a), runs: (rpOf(a) * ip.rp) / 9 }));
  return { rotation, bullpen, total: [...rotation, ...bullpen].reduce((s, x) => s + x.runs, 0) };
}

/** What one more arm adds: the staff with him minus the staff without him. */
export function addArm(arms: readonly StaffArm[], candidate: StaffArm, ip: { sp: number; rp: number }, locks: { SP?: string[]; RP?: string[] } = {}) {
  const without = staffSolve(arms, ip, locks);
  const withIt = staffSolve([...arms, candidate], ip, locks);
  const slot = [...withIt.rotation, ...withIt.bullpen].find((s) => s.entry === candidate.entry) ?? null;
  const gone = [...without.rotation].filter((s) => !withIt.rotation.some((w) => w.entry === s.entry)).map((s) => s.label);
  return { without, with: withIt, season: withIt.total - without.total, slot, replaces: gone };
}

/* ------------------------------------------------------------- estimate */

interface ArmModel {
  fittedAt: string | null; source: string;
  /** League edge9 per tournament-model run saved per 9, and the fit's intercept. */
  k: number; intercept: number;
  /** The tournament model's runs saved per 9 for the league's average arm (IP-weighted). */
  app9League: number;
  n: number; r: number | null; minIp: number;
  /** League batters faced per inning, for converting per-700-BF runs to per 9. */
  bfPerIp: number;
}
export const ARM_MODEL_FIT = ARM_MODEL as ArmModel;

/** The league edge per 9 a card's ratings predict: `app9` is its tournament-model runs saved per 9. */
export const estimateEdge9 = (app9: number) => ARM_MODEL_FIT.intercept + ARM_MODEL_FIT.k * (app9 - ARM_MODEL_FIT.app9League);

/** env-fit's runs saved per 700 batters faced, as runs per 9 innings at the league's BF per inning. */
export const per9 = (runs700: number) => (runs700 * ARM_MODEL_FIT.bfPerIp * 9) / 700;

/* -------------------------------------------------------------- loaders */

/**
 * Pitcher lines from the complete snapshots of one league family (or all
 * of them) and one split. A snapshot missing its pitching block (under
 * MIN_PITCHER_SHARE pitchers) is left out.
 */
export async function loadArmRows(opts: { family?: LeagueFamily | "all"; split?: "all" | "vL" | "vR"; weeks?: string[] } = {}): Promise<ArmRow[]> {
  const split = opts.split ?? "all";
  const snaps = await db.select({
    id: leagueSnapshots.id, league: leagueSnapshots.league, on: leagueSnapshots.capturedOn,
    pitchers: sql<number>`count(*) filter (where ${leagueStints.isPitcher})`.mapWith(Number),
    total: sql<number>`count(*)`.mapWith(Number),
  }).from(leagueSnapshots).innerJoin(leagueStints, eq(leagueStints.snapshotId, leagueSnapshots.id))
    .where(eq(leagueSnapshots.split, split)).groupBy(leagueSnapshots.id);
  const ok = snaps.filter((s) => s.total > 0 && s.pitchers / s.total >= MIN_PITCHER_SHARE
    && (!opts.family || opts.family === "all" || leagueFamily(s.league) === opts.family)
    && (!opts.weeks || opts.weeks.includes(String(s.on).slice(0, 10))));
  if (!ok.length) return [];
  const meta = new Map(ok.map((s) => [s.id, s]));
  const rows = await db.select({
    snapshotId: leagueStints.snapshotId, org: leagueStints.org, isFreeAgent: leagueStints.isFreeAgent, cid: leagueStints.cid,
    name: leagueStints.name, isVariant: leagueStints.isVariant, pos: leagueStints.pos, ip: leagueStints.ip, stats: leagueStints.stats, ratings: leagueStints.ratings,
  }).from(leagueStints).where(and(eq(leagueStints.isPitcher, true), inArray(leagueStints.snapshotId, ok.map((s) => s.id))));
  return rows.map((r) => {
    const s = meta.get(r.snapshotId)!;
    return { ...r, league: s.league, capturedOn: String(s.on).slice(0, 10) };
  });
}

/** Slot innings from a family's newest complete week, falling back to the defaults. */
export async function ipPerSlot(family: LeagueFamily | "all"): Promise<{ sp: number; rp: number; week: string | null }> {
  const rows = await loadArmRows({ family });
  const newest = rows.reduce((m, r) => (r.capturedOn > m ? r.capturedOn : m), "");
  if (!newest) return { ...IP_FALLBACK, week: null };
  return { ...ipPerSlotFrom(rows.filter((r) => r.capturedOn === newest)), week: newest };
}

/**
 * L.J.'s pitchers in the newest league week his team appears in, as
 * "Name#cardId" entries with the role and innings they had that week.
 */
export async function myLeagueArms(): Promise<{ league: string; on: string; arms: { entry: string; name: string; cid: number | null; isVariant: boolean; role: ArmRole; gs: number; ip: number; stamina: number | null }[] } | null> {
  const rows = await db.select({
    id: leagueSnapshots.id, league: leagueSnapshots.league, on: leagueSnapshots.capturedOn, org: leagueStints.org, name: leagueStints.name,
    cid: leagueStints.cid, isVariant: leagueStints.isVariant, pos: leagueStints.pos, ip: leagueStints.ip, stats: leagueStints.stats, ratings: leagueStints.ratings,
  }).from(leagueStints).innerJoin(leagueSnapshots, eq(leagueSnapshots.id, leagueStints.snapshotId))
    .where(and(eq(leagueSnapshots.split, "all"), eq(leagueStints.isPitcher, true), sql`${leagueStints.org} ilike 'kansas city torrent%'`))
    .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id));
  const mine = rows.filter((r) => isMyOrg(r.org));
  if (!mine.length) return null;
  const newest = mine[0].id;
  const seen = new Set<string>();
  const arms = mine.filter((r) => r.id === newest).flatMap((r) => {
    const entry = r.cid != null ? `${r.name}#${r.cid}` : r.name;
    if (seen.has(entry)) return [];
    seen.add(entry);
    return [{ entry, name: r.name, cid: r.cid, isVariant: r.isVariant, role: roleOf(r), gs: num(r.stats.GS_p), ip: r.ip, stamina: r.ratings?.STM ?? null }];
  });
  return { league: mine[0].league, on: String(mine[0].on).slice(0, 10), arms };
}
