// Lineup optimizer core. PURE TypeScript — no React imports — so the run-value
// math can be reused by a future draft engine.
//
// Currency is "runs above average per game". Hitters convert park-adjusted wOBA
// to batting runs and add fielding + baserunning; pitchers convert FIP to runs
// prevented. Everything is expressed per game so totals are comparable.

import {
  type Card,
  type HitterSplit,
  type Position,
  isPitcher,
  blendedWoba,
  blendedFip,
} from "./types";
import { applyParkToHitter, type Park } from "./parks";

// League environment — the PT-league frame the v2 projections live in.
// Defaults match projections.json pt_env; data.ts calls setRunEnv after load.
let LG_WOBA = 0.3232;
let LG_FIP = 4.055;
const WOBA_SCALE = 1.15;
const PA_PER_GAME = 4.3;
const IP_PER_START = 6.0; // innings a SP is expected to carry

export function setRunEnv(env?: { wOBA: number; FIP: number }): void {
  if (env?.wOBA) LG_WOBA = env.wOBA;
  if (env?.FIP) LG_FIP = env.FIP;
}

export type Hand = "L" | "R";

/** The 9 lineup slots in a DH league. */
export const LINEUP_POSITIONS: Position[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
];

/** Scarce positions get priority during the greedy fill so they aren't stranded. */
const SCARCITY_ORDER: Position[] = [
  "C",
  "SS",
  "CF",
  "2B",
  "3B",
  "RF",
  "LF",
  "1B",
  "DH",
];

// Lineup-spot run-expectancy weights (spots 1-9). Higher-leverage spots get more
// plate appearances over a game/season, so the best bats belong at the top.
// Roughly mirrors empirical PA-per-spot weighting; approximate by design.
const SLOT_WEIGHTS = [1.0, 1.02, 1.0, 0.99, 0.96, 0.92, 0.88, 0.85, 0.83];

export interface AssignedSlot {
  position: Position;
  card: Card;
  split: HitterSplit; // park-adjusted line used for valuation
  runValue: number; // batting + fielding + baserunning runs above avg / game
}

export interface OrderedSlot extends AssignedSlot {
  order: number; // 1-9 batting-order spot
}

export interface PitcherEntry {
  card: Card;
  runValue: number; // runs prevented above average / game (in this park, vs hand)
}

export interface LineupResult {
  vsHand: Hand;
  park: Park;
  batting: OrderedSlot[];
  bench: Card[];
  rotation: PitcherEntry[]; // SP ranked best-first
  bullpen: PitcherEntry[]; // RP/CL ranked best-first
  totalRunsAboveAvg: number; // sum of the 9 batters' run values
}

// ---------------------------------------------------------------------------
// Run-value math
// ---------------------------------------------------------------------------

/** Pick the hitter split facing a starter who throws `oppHand`. */
function hitterSplitVs(card: Card, oppHand: Hand): HitterSplit | undefined {
  return oppHand === "L"
    ? card.hitter_vL ?? card.hitter_overall
    : card.hitter_vR ?? card.hitter_overall;
}

/** Park-adjusted batting runs above average per game from a hitter line. */
export function battingRunsPerGame(split: HitterSplit): number {
  // wRAA = (wOBA - lgwOBA) / wOBA_scale * PA
  return ((split.wOBA - LG_WOBA) / WOBA_SCALE) * PA_PER_GAME;
}

/** Defensive runs/game the card provides at a given position (0 if ineligible). */
export function defenseRunsPerGame(card: Card, pos: Position): number {
  if (pos === "DH") return 0; // DH provides no fielding value
  const d = card.defense?.positions.find((p) => p.pos === pos);
  if (!d) return 0;
  return d.with_position_adj / 162;
}

/** Whether a card can field a given lineup position. DH open to any hitter. */
export function canPlay(card: Card, pos: Position): boolean {
  if (pos === "DH") return !!card.hitter_overall;
  return !!card.defense?.positions.some((p) => p.pos === pos);
}

function baserunPerGame(card: Card): number {
  return (card.baserun?.bsr_runs_per_162 ?? 0) / 162;
}

/**
 * Total run value of a hitter filling `pos` vs `oppHand` in `park`:
 * park-adjusted batting + fielding-at-position + baserunning, all per game.
 */
export function hitterRunValue(
  card: Card,
  pos: Position,
  oppHand: Hand,
  park: Park,
): { runValue: number; split: HitterSplit } | null {
  const raw = hitterSplitVs(card, oppHand);
  if (!raw) return null;
  const split = applyParkToHitter(raw, card.bats, park);
  // Evidence blend: scale the park-adjusted wOBA by the card's blend/projection
  // ratio (observed PT results shrunk by sample size — see engine/calibrate.py).
  const blend = blendedWoba(card, oppHand);
  const adj = { ...split };
  if (blend !== undefined && raw.wOBA > 0) {
    adj.wOBA = split.wOBA * (blend / raw.wOBA);
  }
  const runValue =
    battingRunsPerGame(adj) +
    defenseRunsPerGame(card, pos) +
    baserunPerGame(card);
  return { runValue, split: adj };
}

/**
 * Pitcher run value: runs prevented above average per game in this park vs the
 * batters' hand. We park-adjust FIP via the park's overall offense factor for
 * the relevant batter hand (lower = pitcher-friendly => more runs prevented).
 */
export function pitcherRunValue(card: Card, batterHand: Hand, park: Park): number {
  const split =
    batterHand === "L"
      ? card.pitcher_vL ?? card.pitcher_overall
      : card.pitcher_vR ?? card.pitcher_overall;
  if (!split) return 0;
  const parkFactor = batterHand === "L" ? park.avg_lhb : park.avg_rhb;
  // Evidence blend first, then gently park-adjust FIP.
  const fip = blendedFip(card, batterHand) ?? split.FIP;
  const adjFIP = fip * (1 + (parkFactor - 1) * 0.6);
  const ip = card.pos === "SP" ? IP_PER_START : 1.0;
  // FIP is runs allowed per 9 IP; runs prevented vs league per game pitched.
  return ((LG_FIP - adjFIP) / 9) * ip;
}

// ---------------------------------------------------------------------------
// Best-9 fill: scarcity-aware greedy + pairwise-swap correction pass.
// ---------------------------------------------------------------------------

function fillBestNine(
  hitters: Card[],
  oppHand: Hand,
  park: Park,
): AssignedSlot[] {
  // Precompute every (card, position) value once.
  type Cell = { card: Card; runValue: number; split: HitterSplit };
  const valueAt = new Map<Position, Cell[]>();
  for (const pos of LINEUP_POSITIONS) {
    const cells: Cell[] = [];
    for (const card of hitters) {
      if (!canPlay(card, pos)) continue;
      const v = hitterRunValue(card, pos, oppHand, park);
      if (v) cells.push({ card, runValue: v.runValue, split: v.split });
    }
    cells.sort((a, b) => b.runValue - a.runValue);
    valueAt.set(pos, cells);
  }

  // Greedy fill, scarcest positions first so C/SS/CF aren't stranded.
  const assigned: AssignedSlot[] = [];
  const used = new Set<number>();
  for (const pos of SCARCITY_ORDER) {
    const cells = valueAt.get(pos) ?? [];
    const pick = cells.find((c) => !used.has(c.card.cid));
    if (!pick) continue; // no eligible card left (rare); slot stays empty
    used.add(pick.card.cid);
    assigned.push({ position: pos, card: pick.card, split: pick.split, runValue: pick.runValue });
  }

  // Correction pass: try every pair swap (including re-evaluating each card at
  // the other's position) and keep swaps that raise total runs. Repeat until
  // stable. This rescues cases where a great bat was blocked at a scarce slot.
  const cellValue = (card: Card, pos: Position): Cell | null => {
    const v = hitterRunValue(card, pos, oppHand, park);
    return v ? { card, runValue: v.runValue, split: v.split } : null;
  };

  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i];
        const b = assigned[j];
        if (!canPlay(b.card, a.position) || !canPlay(a.card, b.position)) continue;
        const newA = cellValue(b.card, a.position);
        const newB = cellValue(a.card, b.position);
        if (!newA || !newB) continue;
        const before = a.runValue + b.runValue;
        const after = newA.runValue + newB.runValue;
        if (after > before + 1e-9) {
          assigned[i] = { position: a.position, ...newA };
          assigned[j] = { position: b.position, ...newB };
          improved = true;
        }
      }
    }
    // Also try replacing an assigned card with an unused bench bat at that slot.
    for (let i = 0; i < assigned.length; i++) {
      const slot = assigned[i];
      const cells = valueAt.get(slot.position) ?? [];
      for (const cand of cells) {
        if (used.has(cand.card.cid)) continue;
        if (cand.runValue > slot.runValue + 1e-9) {
          used.delete(slot.card.cid);
          used.add(cand.card.cid);
          assigned[i] = { position: slot.position, card: cand.card, split: cand.split, runValue: cand.runValue };
          improved = true;
          break;
        }
      }
    }
  }

  return assigned;
}

// ---------------------------------------------------------------------------
// Batting order: assign the 9 to spots 1-9 so the highest-leverage spots get
// the best run producers. We sort by on-base+slugging blend (the same drivers
// behind wOBA) and place them into the descending SLOT_WEIGHTS ordering.
// ---------------------------------------------------------------------------

function orderLineup(assigned: AssignedSlot[]): OrderedSlot[] {
  // Rank hitters by overall offensive merit (park-adjusted batting runs only,
  // excluding glove — order is about producing runs, not fielding).
  const ranked = [...assigned].sort(
    (a, b) => battingRunsPerGame(b.split) - battingRunsPerGame(a.split),
  );
  // Map the descending SLOT_WEIGHTS to spot numbers, best hitter -> heaviest spot.
  const spotsByWeight = SLOT_WEIGHTS.map((w, idx) => ({ spot: idx + 1, w }))
    .sort((x, y) => y.w - x.w);
  const result: OrderedSlot[] = ranked.map((slot, i) => ({
    ...slot,
    order: spotsByWeight[i].spot,
  }));
  return result.sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Top-level optimize
// ---------------------------------------------------------------------------

export function optimize(pool: Card[], oppHand: Hand, park: Park): LineupResult {
  const hitters = pool.filter((c) => !isPitcher(c) && c.hitter_overall);
  const pitchers = pool.filter((c) => isPitcher(c));

  const assigned = fillBestNine(hitters, oppHand, park);
  const batting = orderLineup(assigned);

  const assignedIds = new Set(assigned.map((a) => a.card.cid));
  const bench = hitters
    .filter((c) => !assignedIds.has(c.cid))
    .sort((a, b) => {
      const va = hitterRunValue(a, "DH", oppHand, park)?.runValue ?? -Infinity;
      const vb = hitterRunValue(b, "DH", oppHand, park)?.runValue ?? -Infinity;
      return vb - va;
    });

  // Pitchers face batters of the OPPOSITE hand from how they throw, but the
  // requested oppHand here is the lineup's perspective (opponent SP hand). For
  // our own pitchers we value them against an average mix; use both batter hands
  // averaged so rankings are stable regardless of the lineup tab.
  const valuePitcher = (c: Card) =>
    (pitcherRunValue(c, "L", park) + pitcherRunValue(c, "R", park)) / 2;
  const rotation = pitchers
    .filter((c) => c.pos === "SP")
    .map((c) => ({ card: c, runValue: valuePitcher(c) }))
    .sort((a, b) => b.runValue - a.runValue);
  const bullpen = pitchers
    .filter((c) => c.pos === "RP" || c.pos === "CL")
    .map((c) => ({ card: c, runValue: valuePitcher(c) }))
    .sort((a, b) => b.runValue - a.runValue);

  const totalRunsAboveAvg = batting.reduce((s, b) => s + b.runValue, 0);

  return { vsHand: oppHand, park, batting, bench, rotation, bullpen, totalRunsAboveAvg };
}

/** Runs the optimized lineup gains over the baseline lineup (offense only). */
export function runDelta(optimized: LineupResult, baseline: LineupResult): number {
  return optimized.totalRunsAboveAvg - baseline.totalRunsAboveAvg;
}

// ---------------------------------------------------------------------------
// Suggested upgrades: which non-baseline card replaces which baseline starter.
// Built by diffing the two lineups position-by-position and pairing departures
// with arrivals so the UI can render "swap X -> Y gains N runs".
// ---------------------------------------------------------------------------

export interface Upgrade {
  position: Position;
  out: Card; // baseline starter no longer in the optimized 9
  in: Card; // card that took the spot
  isVariant: boolean;
  runsGained: number;
}

export function suggestedUpgrades(
  optimized: LineupResult,
  baseline: LineupResult,
): Upgrade[] {
  const baseByPos = new Map(baseline.batting.map((b) => [b.position, b]));
  const baselineIds = new Set(baseline.batting.map((b) => b.card.cid));
  const upgrades: Upgrade[] = [];
  for (const slot of optimized.batting) {
    if (baselineIds.has(slot.card.cid)) continue; // same player still starting
    const old = baseByPos.get(slot.position);
    if (!old) continue;
    upgrades.push({
      position: slot.position,
      out: old.card,
      in: slot.card,
      isVariant: slot.card.var === "Y",
      runsGained: slot.runValue - old.runValue,
    });
  }
  return upgrades.sort((a, b) => b.runsGained - a.runsGained);
}

// ---------------------------------------------------------------------------
// Comparison helper: optimize the baseline (active 26) and an expanded pool,
// returning both results plus the deltas the page renders.
// ---------------------------------------------------------------------------

export interface Comparison {
  baseline: LineupResult;
  optimized: LineupResult;
  runsGained: number;
  upgrades: Upgrade[];
}

export function compareLineups(
  activePool: Card[],
  expandedPool: Card[],
  oppHand: Hand,
  park: Park,
): Comparison {
  const baseline = optimize(activePool, oppHand, park);
  const optimized = optimize(expandedPool, oppHand, park);
  return {
    baseline,
    optimized,
    runsGained: runDelta(optimized, baseline),
    upgrades: suggestedUpgrades(optimized, baseline),
  };
}
