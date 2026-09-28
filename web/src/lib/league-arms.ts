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
  /**
   * The card's pitching ratings in the shop's words, from the newest line
   * that has the split ratings (exports since 2026-09-26; they match the shop
   * card). What a variant no one here owns was pitched with.
   */
  ratings: Record<string, number> | null;
}

export const ARM_PRIOR_IP = 150;
/** Innings a slot pitches when the week can't say: a full rotation turn, a busy reliever. */
export const IP_FALLBACK = { sp: 180, rp: 70 };

/** A card's identity across teams and weeks: the variant is a different card. */
export const armKey = (r: { cid: number | null; name: string; pos?: string; isVariant: boolean }) =>
  `${r.cid != null ? `c${r.cid}` : `n${r.name}|${r.pos ?? ""}`}${r.isVariant ? "v" : ""}`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The export's pitching ratings and the shop's names for them. */
const LEAGUE_ARM_KEYS: Array<[league: string, shop: string]> = [
  ["STU vL", "Stuff vL"], ["STU vR", "Stuff vR"], ["CON vL", "Control vL"], ["CON vR", "Control vR"],
  ["HRA vL", "pHR vL"], ["HRA vR", "pHR vR"], ["PBAB vL", "pBABIP vL"], ["PBAB vR", "pBABIP vR"], ["STM", "Stamina"],
];
/**
 * A variant's ratings from its league line, over its base card's. A variant is
 * its base card boosted, so a league rating below the base card's is the
 * export's, not the card's (HD451's 09-27 export put the hitters' Contact in
 * the pitchers' CON columns): the base card's value stands.
 */
export function variantFace(base: Record<string, number>, league: Record<string, number>): Record<string, number> {
  return { ...base, ...Object.fromEntries(Object.entries(league).map(([k, v]) => [k, Math.max(v, base[k] ?? v)])) };
}

/** A line's ratings in the shop's words; null unless it has every split rating. */
export function leagueArmRatings(r: Record<string, number> | undefined): Record<string, number> | null {
  if (!r) return null;
  const out: Record<string, number> = {};
  for (const [league, shop] of LEAGUE_ARM_KEYS) {
    const v = r[league];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[shop] = v;
  }
  return out;
}
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
      edge: { key, cid: r.cid, name: r.name, isVariant: r.isVariant, asSP: null, asRP: null, stamina: null, ratings: null },
      sp: { num: 0, ip: 0, teams: 0, weeks: new Set<string>() }, rp: { num: 0, ip: 0, teams: 0, weeks: new Set<string>() }, newest: "",
    };
    const side = roleOf(r) === "SP" ? a.sp : a.rp;
    // IP·(league core per IP) − the card's own core sum: runs per 9 once divided by ΣIP.
    side.num += r.ip * (L.core / L.ip) - coreSum(r.stats);
    side.ip += r.ip; side.teams++; side.weeks.add(r.capturedOn);
    if (r.capturedOn >= a.newest) {
      // A newer week starts over; lines of the same week are the same card, so each rating takes the
      // highest: one export's mixed-up column (HD451 09-27's hitting Contact as CON) can't win a tie.
      if (r.capturedOn > a.newest) a.edge.ratings = null;
      a.newest = r.capturedOn;
      const stm = r.ratings?.STM;
      if (stm != null) a.edge.stamina = stm;
      const face = leagueArmRatings(r.ratings);
      if (face) {
        const had = a.edge.ratings;
        a.edge.ratings = had ? Object.fromEntries(Object.entries(face).map(([k, v]) => [k, Math.max(v, had[k] ?? v)])) : face;
      }
    }
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
export interface Staff {
  rotation: StaffSlot[];
  bullpen: StaffSlot[];
  /** Arms past the staff's size: they don't pitch. */
  out: { entry: string; label: string }[];
  total: number;
}

/** Below this Stamina an arm can't turn a lineup over (card-value roleRuns' break). */
export const STARTER_STAMINA = 25;
export const ROTATION = 5;

/**
 * The best staff from these arms: five starters, the rest in the pen, to
 * maximise season runs (edge × slot innings / 9). Every arm starts, relieves
 * or sits, and the split is solved exactly: picking the five that gain most
 * from starting is best only while every arm pitches, and once one has to sit
 * a starter with a poor relief number can hold a spot a better reliever
 * should have. `locks` pin entries to a role. An arm with no relief number
 * relieves at its starter's edge, and one with no starter number can't start.
 * `size` is how many arms pitch (the roster's pitching spots, default all of
 * them); locked relievers pitch first. `locks.at` seats a locked arm in the
 * slot it was locked to (SP2, CL, RP3); every slot of a role pitches the same
 * innings, so that moves labels, not runs.
 */
export function staffSolve(arms: readonly StaffArm[], ip: { sp: number; rp: number }, locks: StaffLocks = {}, size = arms.length): Staff {
  const lockSP = new Set(locks.SP ?? []), lockRP = new Set(locks.RP ?? []);
  const rpOf = (a: StaffArm) => a.rp ?? a.sp ?? 0;
  const canStart = (a: StaffArm) => a.sp != null && (a.stamina == null || a.stamina > STARTER_STAMINA);
  const forced = (a: StaffArm) => lockSP.has(a.entry) && a.sp != null;
  const mayStart = (a: StaffArm) => forced(a) || (!lockSP.has(a.entry) && !lockRP.has(a.entry) && canStart(a));
  // Five start, or more if more are locked there; never more than the staff has spots for (locks aside).
  const lockedStarters = arms.filter(forced).length;
  const starters = Math.min(Math.max(ROTATION, lockedStarters), arms.filter(mayStart).length, Math.max(size, lockedStarters));
  const relievers = Math.min(Math.max(0, size - starters), arms.length - starters);
  const lockedPen = arms.filter((a) => lockRP.has(a.entry)).length;
  type Role = ArmRole | "out";
  const roles = (a: StaffArm): Role[] => {
    if (forced(a)) return ["SP"];
    if (lockRP.has(a.entry)) return lockedPen <= relievers ? ["RP"] : ["RP", "out"];
    return mayStart(a) ? ["SP", "RP", "out"] : ["RP", "out"];
  };
  const runs = (a: StaffArm, r: Role) => (r === "SP" ? (a.sp! * ip.sp) / 9 : r === "RP" ? (rpOf(a) * ip.rp) / 9 : 0);
  // Best total for each (starters, relievers) count so far; at most 7 × 31 states.
  let best = new Map<string, { total: number; picks: Role[] }>([["0,0", { total: 0, picks: [] }]]);
  for (const a of arms) {
    const next = new Map<string, { total: number; picks: Role[] }>();
    for (const [key, cur] of best) {
      const [sp, rp] = key.split(",").map(Number);
      for (const r of roles(a)) {
        const s2 = sp + Number(r === "SP"), r2 = rp + Number(r === "RP");
        if (s2 > starters || r2 > relievers) continue;
        const total = cur.total + runs(a, r), k = `${s2},${r2}`, had = next.get(k);
        if (!had || total > had.total + 1e-12) next.set(k, { total, picks: [...cur.picks, r] });
      }
    }
    best = next;
  }
  const picks = best.get(`${starters},${relievers}`)?.picks ?? arms.map((): Role => "out");
  const as = (r: Role) => arms.filter((_, i) => picks[i] === r);
  const rotation = as("SP")
    .sort((a, b) => b.sp! - a.sp!)
    .map((a, i): StaffSlot => ({ slot: `SP${i + 1}`, entry: a.entry, label: a.label, role: "SP", edge9: a.sp!, runs: runs(a, "SP") }));
  const bullpen = as("RP")
    .sort((a, b) => rpOf(b) - rpOf(a))
    .map((a, i): StaffSlot => ({ slot: i === 0 ? "CL" : `RP${i}`, entry: a.entry, label: a.label, role: "RP", edge9: rpOf(a), runs: runs(a, "RP") }));
  const out = as("out").sort((a, b) => rpOf(b) - rpOf(a)).map((a) => ({ entry: a.entry, label: a.label }));
  const at = new Map(Object.entries(locks.at ?? {}));
  return {
    rotation: seat(rotation, at, (i) => `SP${i + 1}`), bullpen: seat(bullpen, at, (i) => (i === 0 ? "CL" : `RP${i}`)),
    out, total: [...rotation, ...bullpen].reduce((s, x) => s + x.runs, 0),
  };
}

/** Pins arms to a role (SP / RP), and optionally to a slot within it. */
export interface StaffLocks { SP?: string[]; RP?: string[]; at?: Record<string, string> }

/** Locked arms into the slots they were locked to; the rest keep their order around them. */
function seat(group: StaffSlot[], at: Map<string, string>, name: (i: number) => string): StaffSlot[] {
  if (!at.size) return group;
  const out: (StaffSlot | undefined)[] = group.map(() => undefined);
  const placed = new Set<string>();
  group.forEach((_, i) => {
    const s = group.find((g) => g.entry === at.get(name(i)));
    if (s && !placed.has(s.entry)) { out[i] = s; placed.add(s.entry); }
  });
  const rest = group.filter((g) => !placed.has(g.entry));
  return out.map((s, i) => ({ ...(s ?? rest.shift()!), slot: name(i) }));
}

/**
 * What one more arm adds on the same number of pitching spots: the staff
 * with him (the weakest arm then sits) minus the staff without him. `role`
 * puts him in the rotation or the pen instead of wherever he scores best,
 * unless that would take a spot a locked arm holds or add one (all five
 * rotation slots locked, or every pen spot): then `refused` names the role
 * and he goes where he scores best.
 */
export function addArm(arms: readonly StaffArm[], candidate: StaffArm, ip: { sp: number; rp: number }, locks: StaffLocks = {}, role?: ArmRole) {
  const size = arms.length;
  const without = staffSolve(arms, ip, locks, size);
  const best = staffSolve([...arms, candidate], ip, locks, size);
  let withIt = best, refused: ArmRole | null = null;
  if (role) {
    const pinned = staffSolve([...arms, candidate], ip, { ...locks, [role]: [...(locks[role] ?? []), candidate.entry] }, size);
    const on = (st: Staff) => new Set([...st.rotation, ...st.bullpen].map((x) => x.entry));
    const bestOn = on(best), pinnedOn = on(pinned);
    const locked = [...(locks.SP ?? []), ...(locks.RP ?? [])];
    const bumps = locked.some((e) => bestOn.has(e) && !pinnedOn.has(e));
    const grows = pinned.rotation.length + pinned.bullpen.length > best.rotation.length + best.bullpen.length
      || pinned.rotation.length > Math.max(ROTATION, (locks.SP ?? []).length);
    if (bumps || grows || !pinnedOn.has(candidate.entry)) refused = role;
    else withIt = pinned;
  }
  const slot = [...withIt.rotation, ...withIt.bullpen].find((s) => s.entry === candidate.entry) ?? null;
  const pitching = new Set([...withIt.rotation, ...withIt.bullpen].map((s) => s.entry));
  const leftRotation = without.rotation.filter((s) => !withIt.rotation.some((w) => w.entry === s.entry)).map((s) => s.label);
  const sits = [...without.rotation, ...without.bullpen].filter((s) => !pitching.has(s.entry)).map((s) => s.label);
  return { without, with: withIt, season: withIt.total - without.total, slot, replaces: leftRotation, sits, refused };
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
  families?: Partial<Record<LeagueFamily, FamilyFit>>;
}
export const ARM_MODEL_FIT = ARM_MODEL as ArmModel;

/** How a card's edge in one league family follows its edge in the others (scripts/fit-arm-slope.ts). */
export interface FamilyFit {
  /** Edge in the family ≈ a + b × edge elsewhere: a stronger league compresses edges. */
  a: number; b: number;
  /** Innings of the family's own play that the other leagues' line is worth. */
  w: number;
  n: number;
}
/** A family too thin to fit reads as the others do. */
const AS_ELSEWHERE: FamilyFit = { a: 0, b: 1, w: 1000, n: 0 };
export const familyFit = (f: LeagueFamily): FamilyFit => ARM_MODEL_FIT.families?.[f] ?? AS_ELSEWHERE;

/**
 * One version of a card in a role (the base card, or its variant): its line
 * in the family scored for and in the other families, and `shift`, what the
 * ratings scored change over the ones it pitched with (k × the model's runs
 * per 9, in the other leagues' terms).
 */
export interface ArmLine { fam: ArmSide | null; other: ArmSide | null; shift: number }

/**
 * An arm's edge per 9 in one role and league family, from every line of the
 * card and its ratings:
 *   elsewhere = the other families' lines, each moved by its shift, pooled by IP
 *   prior     = a + b × (IP·elsewhere + 150·est) / (IP + 150)
 *   score     = (IP_f·family + w·prior) / (IP_f + w), the family's lines moved by b × shift
 * so play in the family leads once it has a few thousand innings, play
 * elsewhere counts through the family's slope, and the ratings estimate
 * (`est`, in the other leagues' terms) fills in where both are thin.
 */
export function blendArm(lines: readonly ArmLine[], est: number, fit: FamilyFit): { score: number; ipFam: number; ipOther: number; estShare: number } {
  const pool = (where: "fam" | "other", scale: number) => {
    let sum = 0, ip = 0;
    for (const l of lines) {
      const x = l[where];
      if (x && x.ip > 0) { sum += x.ip * (x.edge9 + scale * l.shift); ip += x.ip; }
    }
    return { edge: ip > 0 ? sum / ip : 0, ip };
  };
  const other = pool("other", 1), fam = pool("fam", fit.b);
  const prior = fit.a + fit.b * ((other.ip * other.edge + ARM_PRIOR_IP * est) / (other.ip + ARM_PRIOR_IP));
  // How much of the score is the ratings estimate: its weight in the prior, times the prior's.
  const estShare = (fit.w / (fam.ip + fit.w)) * (ARM_PRIOR_IP / (other.ip + ARM_PRIOR_IP));
  return { score: (fam.ip * fam.edge + fit.w * prior) / (fam.ip + fit.w), ipFam: fam.ip, ipOther: other.ip, estShare };
}

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
