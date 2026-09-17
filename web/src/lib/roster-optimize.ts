/**
 * Local search over a filled roster.
 *
 * `fillRoster` is greedy under a Lagrangian value penalty: it stops at the
 * smallest λ that produces a COMPLETE legal roster, which is not the same as
 * the best one. Under a tight team cap that is a real cost — a λ high enough to
 * leave room for a bullpen also prices the best bat in the pool out of the
 * lineup, and greedy can never buy it back because doing so requires
 * simultaneously downgrading somewhere else.
 *
 * So: start from the λ solutions, then hill-climb. One move is "put a different
 * eligible card in this slot"; a move is taken when the roster stays legal and
 * the objective improves. Steepest ascent, run to a local optimum from every
 * distinct λ start, best result wins. Still not a proof of optimality — it is a
 * good roster found honestly, and it beats the greedy fill by construction
 * because the greedy fill is one of its starting points.
 */

import { cardEligibility, rosterSize, slotCapacityIssues, tierCode, type RosterRules } from "./roster-rules";
import { posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { isComplete, type FillCard, type FillResult, type FillShape } from "./roster-fill";

/** Which of the three groups a slot belongs to — a card may hold one of each. */
export type SlotGroup = "R" | "L" | "P";

export const groupOf = (key: string): SlotGroup =>
  key.startsWith("L:") ? "L" : key.startsWith("R:") || key.startsWith("BN") ? "R" : "P";

export interface OptimizeOptions {
  /** Higher is better. Called on complete rosters only. */
  objective: (slots: FillResult) => number;
  /** Cap on improvement passes, in case an objective is not monotone. */
  maxPasses?: number;
  /**
   * Two-slot moves, tried once single moves are exhausted.
   *
   * Under a binding cap the roster sits AT the limit, so no single upgrade is
   * ever affordable and hill-climbing stalls immediately even when an obvious
   * trade exists — buy the best bat in the pool, pay for it out of the sixth
   * reliever. `rank` orders each slot's candidates so the search can look at
   * the promising upgrades and the cheap downgrades instead of all pairs.
   */
  /** Reject a lineup card rated below this share of his own best position. */
  minDefShare?: number;
  /** Hard floor on the rating at the slot's position (see pos-floor.ts). */
  posFloor?: PosFloor;
  /**
   * Keep only the N best candidates per slot (by `pairMoves.rank`, so it
   * requires pairMoves), plus whoever is already rostered. The full search
   * over a 3,300-card collection takes 4½ minutes in node (12 λ starts, Gold
   * Rush, 2026-09-17: 179.4 runs); pruned to 120 per slot from one greedy
   * start it reaches 175.1 in 17 s, which is what lets /build run it in the
   * browser. Not the same roster — most of the gain, not all of it.
   */
  candidateLimit?: number;
  pairMoves?: {
    /** Upgrade candidates considered per slot, best-ranked first. */
    aTop: number;
    /** Downgrade candidates considered per slot, cheapest first. */
    bCheapest: number;
    rank: (key: string, c: FillCard) => number;
  };
}

export interface OptimizeResult {
  slots: FillResult;
  score: number;
  /** Moves accepted, and how much each start improved — for reporting. */
  moves: number;
  startScore: number;
}

/**
 * Every rule fillOnce enforces, checked against a whole candidate roster.
 *
 * `byId` is passed in rather than built here: the pair-move search calls this a
 * few hundred thousand times a pass, and rebuilding a 276-entry Map inside it
 * was the entire runtime.
 */
function legal(
  slots: FillResult, byId: Map<number, FillCard>, rules: RosterRules, shape: FillShape,
): boolean {
  const rx = rules.restrictions;
  const size = rosterSize(rules) ?? Infinity;
  const variantLimit = rx?.variantsAllowed === false ? 0 : rx?.variantCap ?? Infinity;

  const seen: Record<SlotGroup, Set<number>> = { R: new Set(), L: new Set(), P: new Set() };
  for (const [key, id] of Object.entries(slots)) {
    const g = groupOf(key);
    if (seen[g].has(id)) return false; // one slot per card per group
    seen[g].add(id);
  }
  const ids = new Set(Object.values(slots));
  if (ids.size > size) return false;

  const members = [...ids].map((id) => byId.get(id)).filter((c): c is FillCard => c != null);
  if (members.length !== ids.size) return false;
  if (members.filter((m) => !m.isPitcher).length > shape.bats) return false;
  if (rx?.teamCap != null && members.reduce((n, m) => n + (m.val ?? 0), 0) > rx.teamCap) return false;
  if (members.filter((m) => m.variant).length > variantLimit) return false;
  if (rx?.slots) {
    const tiers: Record<string, number> = {};
    for (const m of members) if (m.val != null) { const t = tierCode(m.val); tiers[t] = (tiers[t] ?? 0) + 1; }
    if (slotCapacityIssues(tiers, rx.slots).length) return false;
  }
  return true;
}

/**
 * Cards that could legally occupy this slot on their own merits.
 *
 * `minDefShare` is the guard the fit composite cannot provide. Defence is 17%
 * of the score, so a bat big enough will win a position it cannot play — the
 * search happily put a first baseman with a catcher rating of 11 behind the
 * plate. OOTP will punish that far harder than 17% of a composite implies, and
 * the run model prices no defence at all, so the position is simply closed to
 * anyone rated below this share of his own best position.
 */
function candidatesFor(
  key: string, pool: readonly FillCard[], rules: RosterRules, minDefShare = 0, posFloor?: PosFloor,
): FillCard[] {
  const pos = key.includes(":") ? key.split(":")[1] : key;
  const playable = (c: FillCard, p: string) => {
    const here = c.ratings[`Pos Rating ${p}`] ?? 0;
    if (here <= 0) return false;
    if (here < posFloorAt(posFloor, p)) return false;
    if (minDefShare <= 0) return true;
    let best = 0;
    for (const q of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]) best = Math.max(best, c.ratings[`Pos Rating ${q}`] ?? 0);
    return best <= 0 || here >= best * minDefShare;
  };
  return pool.filter((c) => {
    if (cardEligibility(c, rules).errors.length) return false;
    if (c.variant ? !c.variantOwned : !c.baseOwned) return false;
    if (/^SP\d+$/.test(pos)) return c.isPitcher && (c.role === "SP" || c.role == null);
    if (/^RP\d+$/.test(pos) || pos === "CL") return c.isPitcher;
    if (/^BN\d+$/.test(pos)) return !c.isPitcher;
    if (pos === "DH") return !c.isPitcher;
    return !c.isPitcher && playable(c, pos);
  });
}

export function optimizeRoster(
  start: FillResult, pool: readonly FillCard[], rules: RosterRules, shape: FillShape, o: OptimizeOptions,
): OptimizeResult {
  const keys = [
    ...shape.lineupPos.map((p) => `R:${p}`), ...shape.lineupPos.map((p) => `L:${p}`),
    ...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys,
  ];
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const rostered = new Set(Object.values(start));
  const cands = new Map(keys.map((k) => {
    let list = candidatesFor(k, pool, rules, o.minDefShare ?? 0, o.posFloor);
    if (o.candidateLimit && o.pairMoves && list.length > o.candidateLimit) {
      const rank = o.pairMoves.rank;
      const top = [...list].sort((a, b) => rank(k, b) - rank(k, a)).slice(0, o.candidateLimit);
      const keep = new Set(top.map((c) => c.cardId));
      list = list.filter((c) => keep.has(c.cardId) || rostered.has(c.cardId));
    }
    return [k, list];
  }));
  let slots = { ...start };
  let score = o.objective(slots);
  const startScore = score;
  let moves = 0;

  const pm = o.pairMoves;
  const upgrades = pm
    ? new Map(keys.map((k) => [k, [...(cands.get(k) ?? [])].sort((a, b) => pm.rank(k, b) - pm.rank(k, a)).slice(0, pm.aTop)]))
    : null;
  const downgrades = pm
    ? new Map(keys.map((k) => [k, [...(cands.get(k) ?? [])].sort((a, b) => (a.val ?? 0) - (b.val ?? 0)).slice(0, pm.bCheapest)]))
    : null;

  /**
   * Put `c` in `key`. A card often holds more than one slot — a platoon
   * catcher starts vs LHP and sits on the bench, a switch-hitter starts on
   * both boards — and swapping him out of one slot alone leaves him in the
   * others, so the roster grows to 27 and the move is rejected as illegal.
   * That is how Zunino (+42.6 vs LHP) stayed off a roster carrying Campanella
   * (+21.8) at L:C and BN4 (2026-09-16). So the displaced card's other slots
   * are refilled too: with the incoming card where he is eligible, else with
   * the best already-rostered card eligible there.
   */
  const place = (from: FillResult, key: string, c: FillCard): FillResult => {
    const cur = from[key];
    const t: FillResult = { ...from, [key]: c.cardId };
    if (cur == null) return t;
    const rostered = new Set(Object.values(t));
    for (const k2 of keys) {
      if (k2 === key || t[k2] !== cur) continue;
      const elig = cands.get(k2) ?? [];
      let pick: number | null = elig.some((x) => x.cardId === c.cardId) ? c.cardId : null;
      if (pick == null) {
        let bestR = -Infinity;
        for (const x of elig) {
          if (x.cardId === cur || !rostered.has(x.cardId)) continue;
          const r = pm ? pm.rank(k2, x) : 0;
          if (r > bestR) { bestR = r; pick = x.cardId; }
        }
      }
      if (pick != null) t[k2] = pick;
    }
    return t;
  };

  for (let pass = 0; pass < (o.maxPasses ?? 40); pass++) {
    let bestKey: string | null = null, bestId = 0, bestScore = score;
    let bestSlots: FillResult | null = null;
    let bestPair: { a: string; ai: number; b: string; bi: number } | null = null;

    for (const key of keys) {
      const current = slots[key];
      for (const c of cands.get(key) ?? []) {
        if (c.cardId === current) continue;
        const trial = place(slots, key, c);
        if (!isComplete(trial, shape)) continue;
        if (!legal(trial, byId, rules, shape)) continue;
        const s = o.objective(trial);
        if (s > bestScore + 1e-9) { bestScore = s; bestKey = key; bestId = c.cardId; bestSlots = trial; }
      }
    }

    // Only when no single move helps: pay for an upgrade with a downgrade.
    if (!bestKey && pm && upgrades && downgrades) {
      for (const a of keys) {
        for (const ca of upgrades.get(a) ?? []) {
          if (ca.cardId === slots[a]) continue;
          const t1 = place(slots, a, ca);
          if (!isComplete(t1, shape)) continue;
          for (const b of keys) {
            if (b === a) continue;
            for (const cb of downgrades.get(b) ?? []) {
              if (cb.cardId === slots[b]) continue;
              const t2 = place(t1, b, cb);
              if (!isComplete(t2, shape)) continue;
              if (!legal(t2, byId, rules, shape)) continue;
              const s = o.objective(t2);
              if (s > bestScore + 1e-9) { bestScore = s; bestPair = { a, ai: ca.cardId, b, bi: cb.cardId }; }
            }
          }
        }
      }
    }

    if (bestKey && bestSlots) { slots = bestSlots; void bestId; }
    else if (bestPair) { slots = place(place(slots, bestPair.a, byId.get(bestPair.ai)!), bestPair.b, byId.get(bestPair.bi)!); }
    else break;
    score = bestScore;
    moves++;
  }
  return { slots, score, moves, startScore };
}
