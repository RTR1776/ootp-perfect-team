/**
 * Auto-fill — the recommended roster for an event, from a pool of owned card
 * forms. Pure: no React, no DB, so /build and the offline scripts run the SAME
 * fill and get the same answer for the same inputs.
 *
 * Scoring is the "Fit" composite /build has always used (hitters EYE·30 /
 * K-avoid·22 / POW·21 / GAP·10 / best-position defense·17; pitchers pHR·33 /
 * STU·31 / CON·28 / pBABIP·8), turned into a percentile within the pool, once
 * per hand: the vs-RHP board uses each card's vR ratings, the vs-LHP board its
 * vL ratings, pitchers a 45/55 L/R blend (they face both).
 *
 * The fill is greedy by fit, position-scarce slots first, under every rule in
 * roster-rules.ts (value window, card years, card types, slot tiers, team cap,
 * variant cap, roster size, ownership of the chosen form). Greedy is blind to a
 * TEAM CAP — it spends the budget on the first nine bats and leaves the bullpen
 * unfillable — so a capped event is filled with a value penalty λ on the fit
 * score, and λ is searched for the smallest value that yields a complete legal
 * roster. That is a Lagrangian relaxation, not an optimiser: it finds a good
 * complete roster, not the best one (Stage 3 in Docs/APP_IMPROVEMENT_PLAN.md).
 */
import { cardEligibility, rosterSize, samePlayer, slotCapacityIssues, tierCode, type RosterCard, type RosterRules } from "./roster-rules";

export const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;

/** A card in the pool, in the form (base or variant) it will be used in. */
export type FillCard = RosterCard & { variant: boolean };

export interface FillShape {
  /** Lineup positions in board order — HIT_POS plus "DH" when the event uses one. */
  lineupPos: readonly string[];
  spKeys: readonly string[];
  rpKeys: readonly string[];
  benchKeys: readonly string[];
  /** Hitters the roster carries (lineup + bench). */
  bats: number;
}

export interface FitMaps {
  /** Overall fit per hand (best-position defense) — the table's FIT column, bench ordering, pitchers. */
  fitR: Map<number, number>;
  fitL: Map<number, number>;
  /** Fit per hand AT a lineup position (defense scored at that position; DH offense-only), percentile among the cards that can play it. */
  atR: Record<string, Map<number, number>>;
  atL: Record<string, Map<number, number>>;
}

/* --------------------------------------------------------- roster shape */

/**
 * Typical staff size by run environment — L.J., 2026-09-07: "2010 to present
 * 5 SP and probably 8 RP; 1980s to 2010 5 SP, 6-7 bullpen; 1960s to 1980s
 * 4 more likely 5 SP and 5 or 6 RP; 1920s to 1950s 4 SP and 3 to 5 RP;
 * deadball 3 maybe 4 SP and 3 RP maybe 4. We don't need 9 RP in any year."
 * Where he gave a range the later half of the band takes the larger number.
 * Hitters take the rest of the roster. A series with observed exports
 * (series_meta) overrides this; the table is the fallback.
 *
 * L.J., 2026-10-04 — tournament staffs, firm:
 *   "Please stop giving 8 RP ever, never ever except league maybe"
 *   "you gave me 13 pitchers"
 *   "THERE ARE NEVER 6 SP - A rotation is 5 at most, period - now you would be
 *    dumb to only use RPs in bullpen, need some stam guys"
 * So: at most MAX_SP starters, MAX_RP in the pen, MAX_ARMS in all; arms past
 * the caps become bats. The pen's stamina guys are enforced by the optimiser
 * (minLongMen). League rosters don't use this.
 *
 * L.J., 2026-10-06 — deadball: "In 1919, you don't need that many pitchers -
 * 4 man rotation, 4 or 5 in the bullpen, thats it". The deadball row is a
 * ceiling, observed exports included: a borrowed field's 5 starters had come
 * out as 5 SP / 6 RP for Tuesday Dead Silver Walking.
 */
export const MAX_SP = 5;
export const MAX_RP = 7;
export const MAX_ARMS = 12;

export function eraStaff(envYear: number | null | undefined): { sp: number; rp: number; band: string } {
  if (envYear == null) return { sp: 5, rp: 7, band: "no env year — modern default" };
  if (envYear >= 2010) return { sp: 5, rp: 7, band: "2010–present" };
  if (envYear >= 1980) return { sp: 5, rp: envYear >= 1995 ? 7 : 6, band: "1980s–2000s" };
  if (envYear >= 1960) return { sp: 5, rp: envYear >= 1970 ? 6 : 5, band: "1960s–70s" };
  if (envYear >= 1920) return { sp: 4, rp: envYear >= 1940 ? 5 : 4, band: "1920s–50s" };
  return { sp: 4, rp: envYear >= 1910 ? 5 : 4, band: "deadball" };
}

/**
 * bats / SP / RP for a roster of `total`, from observed series meta when
 * present, else the era table. The table reads the later of the run
 * environment and the event's earliest card year: arms' stamina comes from the
 * cards, so Daily Diamond 1990 Onward (1957 RE, 1990-on cards) staffs like the
 * 1990s, not like a 1957 team (4 SP / 5 RP / 17 bats).
 */
export function rosterShape(
  envYear: number | null | undefined,
  lineupSize: number,
  total: number | null,
  meta: { avgSp: number | null; avgRp: number | null; avgBats: number | null } | null | undefined,
  cardYearMin?: number | null,
): { bats: number; sp: number; rp: number; source: "observed" | "era"; band: string } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const size = total ?? 26;
  const later = envYear != null && cardYearMin != null && cardYearMin > envYear;
  const era0 = eraStaff(later ? cardYearMin : envYear);
  const era = later ? { ...era0, band: `${era0.band}, cards ${cardYearMin} on` } : era0;
  if (meta?.avgSp != null && (meta.avgBats != null || meta.avgRp != null)) {
    // --sp 4 --rp 4 alone is a complete shape: the bats are what is left.
    const bats = clamp(Math.round(meta.avgBats ?? size - meta.avgSp - (meta.avgRp ?? 0)), lineupSize, 22);
    const sp0 = clamp(Math.round(meta.avgSp), 1, 9);
    const rp0 = clamp(size - bats - sp0, 1, 12);
    if (era.band.startsWith("deadball")) {
      // A deadball staff never outgrows the era row; the arms it sheds bat.
      const sp = Math.min(sp0, era.sp), rp = Math.min(rp0, era.rp);
      return { bats: clamp(size - sp - rp, lineupSize, 22), sp, rp, source: "observed", band: era.band };
    }
    return { ...capStaff(bats, sp0, rp0), source: "observed", band: era.band };
  }
  const c = capStaff(clamp(size - era.sp - era.rp, lineupSize, 22), era.sp, era.rp);
  return { ...c, source: "era", band: era.band };
}

/** At most MAX_SP starters (extra starters go to the pen, where they are the long men), MAX_RP relievers and MAX_ARMS arms; the rest bat. */
export function capStaff(bats: number, sp: number, rp: number): { bats: number; sp: number; rp: number } {
  const spC = Math.min(sp, MAX_SP);
  const rpC = Math.min(rp + (sp - spC), MAX_RP, MAX_ARMS - spC);
  return { bats: bats + (sp + rp) - (spC + rpC), sp: spC, rp: rpC };
}

/* ------------------------------------------------------------ scoring */

export function blend(r: Record<string, number>, base: string, vl: string, vr: string, wL = 0.3): number {
  const l = r[vl], rr = r[vr];
  if (l != null && rr != null) return wL * l + (1 - wL) * rr;
  return r[base] ?? l ?? rr ?? 0;
}

export function bestDef(r: Record<string, number>): number {
  let best = 0;
  for (const p of HIT_POS) best = Math.max(best, r[`Pos Rating ${p}`] ?? 0);
  return best;
}

/**
 * Hitter composite. With no `pos` the defense term is the card's best
 * position (the overall Fit shown in the table). With a `pos` it is the rating
 * AT that position — a shortstop asked to play 3B is scored on his 3B rating —
 * and for "DH" it is offense only.
 */
export function hitterRaw(c: { ratings: Record<string, number> }, wL: number, pos?: string): number {
  const r = c.ratings;
  const def = pos == null ? bestDef(r) : pos === "DH" ? 0 : (r[`Pos Rating ${pos}`] ?? 0);
  return (
    0.3 * blend(r, "Eye", "Eye vL", "Eye vR", wL) +
    0.22 * blend(r, "Avoid Ks", "Avoid K vL", "Avoid K vR", wL) +
    0.21 * blend(r, "Power", "Power vL", "Power vR", wL) +
    0.1 * blend(r, "Gap", "Gap vL", "Gap vR", wL) +
    0.17 * def
  );
}

export function pitcherRaw(c: { ratings: Record<string, number> }, wL: number): number {
  const r = c.ratings;
  return (
    0.33 * blend(r, "pHR", "pHR vL", "pHR vR", wL) +
    0.31 * blend(r, "Stuff", "Stuff vL", "Stuff vR", wL) +
    0.28 * blend(r, "Control", "Control vL", "Control vR", wL) +
    0.08 * blend(r, "pBABIP", "pBABIP vL", "pBABIP vR", wL)
  );
}

/** 0–99 rank of each value within the map. */
export function percentileMap(values: Map<number, number>): Map<number, number> {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const out = new Map<number, number>();
  for (const [id, v] of values) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= v) lo = m + 1; else hi = m; }
    out.set(id, Math.round((lo / sorted.length) * 99));
  }
  return out;
}

/** Percentile fit per hand. Hitters: pure split ratings; pitchers: 45/55 L/R. */
export function fitMaps(pool: readonly { cardId: number; isPitcher: boolean; ratings: Record<string, number> }[]): FitMaps {
  const hR = new Map<number, number>(), hL = new Map<number, number>();
  const pR = new Map<number, number>(), pL = new Map<number, number>();
  for (const c of pool) {
    if (c.isPitcher) { pR.set(c.cardId, pitcherRaw(c, 0.45)); pL.set(c.cardId, pitcherRaw(c, 1)); }
    else { hR.set(c.cardId, hitterRaw(c, 0)); hL.set(c.cardId, hitterRaw(c, 1)); }
  }
  const merge = (a: Map<number, number>, b: Map<number, number>) => new Map([...percentileMap(a), ...percentileMap(b)]);
  const atR: Record<string, Map<number, number>> = {}, atL: Record<string, Map<number, number>> = {};
  for (const pos of [...HIT_POS, "DH"]) {
    const rawR = new Map<number, number>(), rawL = new Map<number, number>();
    for (const c of pool) {
      if (c.isPitcher) continue;
      if (pos !== "DH" && (c.ratings[`Pos Rating ${pos}`] ?? 0) <= 0) continue;
      rawR.set(c.cardId, hitterRaw(c, 0, pos)); rawL.set(c.cardId, hitterRaw(c, 1, pos));
    }
    atR[pos] = percentileMap(rawR); atL[pos] = percentileMap(rawL);
  }
  return { fitR: merge(hR, pR), fitL: merge(hL, pL), atR, atL };
}

/* --------------------------------------------------------------- fill */

/** Slot key → card id. "R:C", "L:DH", "SP1", "RP3", "CL", "BN2". */
export type FillResult = Record<string, number>;

const NONE: ReadonlySet<number> = new Set();

/**
 * One greedy fill. `must` are cards the board has to carry (locked on /build):
 * each is rostered before anything else, if the ones before it leave room
 * under every rule, so the greedy picks count them against the roster size,
 * the cap, the tier slots and the variants instead of being overwritten after.
 * They start only if they win a lineup spot on merit; otherwise they take the
 * first staff or bench slot. One the shape has no slot for is released and
 * the fill run again without it, so the board is never a player short.
 */
export function fillOnce(pool: readonly FillCard[], rules: RosterRules, shape: FillShape, fits: FitMaps, lambda: number, must: ReadonlySet<number> = NONE): FillResult {
  const first = fillPass(pool, rules, shape, fits, lambda, must);
  const on = new Set(Object.values(first.next));
  const placed = [...first.held].filter((id) => on.has(id));
  return placed.length === first.held.size ? first.next : fillPass(pool, rules, shape, fits, lambda, new Set(placed)).next;
}

function fillPass(pool: readonly FillCard[], rules: RosterRules, shape: FillShape, fits: FitMaps, lambda: number, must: ReadonlySet<number>): { next: FillResult; held: Set<number> } {
  const next: Record<string, number> = {};
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const rx = rules.restrictions;
  const size = rosterSize(rules) ?? Infinity;
  const variantLimit = rx?.variantsAllowed === false ? 0 : rx?.variantCap ?? Infinity;
  const minVal = Math.min(...pool.map((c) => c.val ?? 0));
  /** Fit less the value penalty — with λ = 0 this is plain fit. */
  const score = (fit: Map<number, number>, c: FillCard) => (fit.get(c.cardId) ?? 0) - lambda * ((c.val ?? 0) - minVal);
  const byScore = (fit: Map<number, number>) => (a: FillCard, b: FillCard) => score(fit, b) - score(fit, a);

  /** Must-carry cards already rostered, whether or not they hold a slot yet. */
  const held = new Set<number>();
  const canAdd = (c: FillCard): boolean => {
    if (cardEligibility(c, rules).errors.length) return false;
    if (c.variant ? !c.variantOwned : !c.baseOwned) return false;
    const ids = new Set([...Object.values(next), ...held, c.cardId]);
    const members = [...ids].map((id) => byId.get(id)!).filter(Boolean);
    if (samePlayer(members)) return false; // one card per player
    if (members.filter((m) => !m.isPitcher).length > shape.bats) return false;
    if (ids.size > size) return false;
    if (rx?.teamCap != null && members.reduce((n, m) => n + (m.val ?? 0), 0) > rx.teamCap) return false;
    if (members.filter((m) => m.variant).length > variantLimit) return false;
    if (rx?.slots) {
      const tiers: Record<string, number> = {};
      for (const m of members) if (m.val != null) { const t = tierCode(m.val); tiers[t] = (tiers[t] ?? 0) + 1; }
      if (slotCapacityIssues(tiers, rx.slots).length) return false;
    }
    return true;
  };
  for (const id of must) {
    const c = byId.get(id);
    if (c && canAdd(c)) held.add(id);
  }
  /** Must-carry cards first; the order within each group is kept. */
  const heldFirst = (a: FillCard, b: FillCard) => Number(held.has(b.cardId)) - Number(held.has(a.cardId));

  const taken = new Set<number>();
  const fillLineup = (hand: "R" | "L") => {
    const at = hand === "R" ? fits.atR : fits.atL;
    const overall = hand === "R" ? fits.fitR : fits.fitL;
    // scarce positions first, DH last
    const supply = (p: string) => (p === "DH" ? 999 : pool.filter((c) => !c.isPitcher && (c.ratings[`Pos Rating ${p}`] ?? 0) > 0).length);
    const order = [...shape.lineupPos].sort((a, b) => supply(a) - supply(b));
    for (const pos of order) {
      // rank by fit AT this position (defense scored where he would play)
      const fit = at[pos] ?? overall;
      const cand = pool
        .filter((c) => !c.isPitcher && !taken.has(c.cardId) && (pos === "DH" || (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0))
        .sort(byScore(fit))
        .find(canAdd);
      if (cand) { next[`${hand}:${pos}`] = cand.cardId; taken.add(cand.cardId); }
    }
    // both lineups share cards — free them for the other hand's picks
    if (hand === "R") for (const pos of shape.lineupPos) { const id = next[`R:${pos}`]; if (id != null) taken.delete(id); }
  };
  fillLineup("R");
  fillLineup("L");

  const usedIds = new Set(Object.values(next));
  const arms = pool.filter((c) => c.isPitcher).sort(byScore(fits.fitR)).sort(heldFirst);
  for (const key of shape.spKeys) {
    const c = arms.find((a) => a.role === "SP" && !usedIds.has(a.cardId) && canAdd(a));
    if (c) { next[key] = c.cardId; usedIds.add(c.cardId); }
  }
  const pen = arms.filter((c) => !usedIds.has(c.cardId));
  if (shape.rpKeys.includes("CL")) {
    const cl = pen.find((c) => c.role === "CL" && canAdd(c)) ?? pen.find((c) => c.role !== "SP" && canAdd(c)) ?? pen.find(canAdd);
    if (cl) { next["CL"] = cl.cardId; usedIds.add(cl.cardId); }
  }
  for (const key of shape.rpKeys.filter((k) => k !== "CL")) {
    const c = arms.find((a) => !usedIds.has(a.cardId) && canAdd(a));
    if (c) { next[key] = c.cardId; usedIds.add(c.cardId); }
  }

  // bench = the roster hitters who aren't starting vs RHP. A must-carry bat
  // with no lineup spot has nowhere else to go, so he comes first; the vs-LHP
  // starters are already rostered, so they come next.
  const startersR = new Set(shape.lineupPos.map((p) => next[`R:${p}`]).filter((v): v is number => v != null));
  const inL = (c: FillCard) => (shape.lineupPos.some((p) => next[`L:${p}`] === c.cardId) ? 1 : 0);
  const waiting = (c: FillCard) => (held.has(c.cardId) && !inL(c) ? 1 : 0);
  let i = 0;
  for (const c of pool.filter((c) => !c.isPitcher && !startersR.has(c.cardId)).sort((a, b) => (waiting(b) - waiting(a)) || (inL(b) - inL(a)) || (score(fits.fitR, b) - score(fits.fitR, a)))) {
    if (i >= shape.benchKeys.length) break;
    if (canAdd(c)) { next[shape.benchKeys[i++]] = c.cardId; }
  }
  return { next, held };
}

/** Every slot the shape asks for is filled. */
export function isComplete(result: FillResult, shape: FillShape): boolean {
  const keys = [
    ...shape.lineupPos.map((p) => `R:${p}`), ...shape.lineupPos.map((p) => `L:${p}`),
    ...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys,
  ];
  return keys.every((k) => result[k] != null);
}

/**
 * Fill the board. Uncapped events get the plain greedy fill. Capped events
 * search λ ∈ [0, 8] (bisection, ~12 fills) for the smallest penalty that still
 * completes the roster; if none does the λ = 8 attempt is returned so the rule
 * panel can say what is missing. `must`: cards the board carries (fillOnce).
 */
export function fillRoster(pool: readonly FillCard[], rules: RosterRules, shape: FillShape, fits: FitMaps, must: ReadonlySet<number> = NONE): { slots: FillResult; lambda: number } {
  const plain = fillOnce(pool, rules, shape, fits, 0, must);
  if (rules.restrictions?.teamCap == null || isComplete(plain, shape)) return { slots: plain, lambda: 0 };
  let lo = 0, hi = 8, best: FillResult | null = null, bestLambda = hi;
  const atHi = fillOnce(pool, rules, shape, fits, hi, must);
  if (!isComplete(atHi, shape)) return { slots: atHi, lambda: hi };
  best = atHi;
  for (let step = 0; step < 12; step++) {
    const mid = (lo + hi) / 2;
    const r = fillOnce(pool, rules, shape, fits, mid, must);
    if (isComplete(r, shape)) { best = r; bestLambda = mid; hi = mid; } else lo = mid;
  }
  return { slots: best, lambda: bestLambda };
}
