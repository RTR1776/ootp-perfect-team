/**
 * Environment-aware fit maps — the same `FitMaps` shape `roster-fill.ts`
 * consumes, but with the offence term coming from the /runenv model instead of
 * the fixed league composite.
 *
 * WHY. `fitMaps()` scores hitters EYE·30 / K-avoid·22 / POW·21 / GAP·10 /
 * DEF·17. Those weights came from the August league study — one run environment
 * (2010, neutral park) — and they do not move when the event does. In a 1935
 * event there are no strikeouts left to avoid; in a homer park power is worth
 * half again as much. This module re-derives the offence half per event and
 * leaves the 17% defence term exactly where it was, so the fill, the cap search
 * and every rule check stay identical.
 *
 * THE HANDEDNESS POINT. A ballpark's factors are chosen by the BATTER's hand,
 * not the pitcher's, and that is a different axis from the vL/vR split ratings:
 *   vs-RHP board — L and S bat left, R bats right
 *   vs-LHP board — L bats left, S and R bat right
 * A switch hitter therefore gets the friendly side of a platoon park on the
 * board that matters most. At 2026 Louisville Slugger Field that is worth about
 * a run a game across the lineup, which is more than any rating on the card.
 */

import {
  applyPark, blendPark, linearWeights, type EraRates, type ParkFactors,
} from "@/lib/analytics/run-env";
import { cardRuns, envFor, hitterRates, pitcherRates, type Env } from "@/lib/analytics/card-value";
import { HIT_POS, bestDef, percentileMap, type FitMaps } from "@/lib/roster-fill";
import type { ParkRow } from "@/lib/analytics/tournament-env";

export interface EnvFitInput {
  cardId: number;
  isPitcher: boolean;
  bats: string | null;
  ratings: Record<string, number>;
}

export interface EnvFitOptions {
  /** Neutral era rates for the event's run environment. */
  era: EraRates;
  /** The event's ballpark, unblended — the L/R split is applied per batter. */
  park: ParkRow | null;
  /** Defence weight, matching roster-fill's composite. */
  defWeight?: number;
  /** Share of opposing bats that hit left, used for the park a pitcher works in. */
  leagueLhbShare?: number;
}

export interface EnvFits extends FitMaps {
  /** Modelled runs per 700 PA on each board, for reporting and sanity checks. */
  runsR: Map<number, number>;
  runsL: Map<number, number>;
  /** The three environments solved, so a caller can print the park read. */
  envLeft: Env; envRight: Env; envPitch: Env;
}

/** Which side of the park a batter stands on, per board. */
export const batsLeftOn = (bats: string | null, board: "R" | "L"): boolean =>
  board === "R" ? bats === "L" || bats === "S" : bats === "L";

const solveSide = (era: EraRates, park: ParkRow | null, lhbShare: number): Env => {
  const f: ParkFactors | null = park ? blendPark(park, lhbShare) : null;
  return envFor(era, f, linearWeights(f ? applyPark(era, f) : era));
};

/** Blend a percentile pair, then re-rank. Both inputs are already 0–99. */
const composite = (
  off: Map<number, number>, def: Map<number, number>, defWeight: number,
): Map<number, number> => {
  const raw = new Map<number, number>();
  for (const [id, o] of off) raw.set(id, (1 - defWeight) * o + defWeight * (def.get(id) ?? 0));
  return percentileMap(raw);
};

export function envFitMaps(pool: readonly EnvFitInput[], o: EnvFitOptions): EnvFits {
  const defWeight = o.defWeight ?? 0.17;
  const envLeft = solveSide(o.era, o.park, 1);
  const envRight = solveSide(o.era, o.park, 0);
  const envPitch = solveSide(o.era, o.park, o.leagueLhbShare ?? 0.35);

  /** Runs above a league-average card per 700 PA, on one board. */
  const runsOf = (c: EnvFitInput, board: "R" | "L"): number | null => {
    if (c.isPitcher) {
      const vL = pitcherRates(c.ratings, envPitch.rates, "vL");
      const vR = pitcherRates(c.ratings, envPitch.rates, "vR");
      if (!vL || !vR) return null;
      const rL = -cardRuns(vL, envPitch), rR = -cardRuns(vR, envPitch);
      // A starter faces both hands; the vs-LHP board is the pure-left read.
      return board === "L" ? rL : 0.45 * rL + 0.55 * rR;
    }
    const env = batsLeftOn(c.bats, board) ? envLeft : envRight;
    const rates = hitterRates(c.ratings, env.rates, board === "R" ? "vR" : "vL");
    return rates ? cardRuns(rates, env) : null;
  };

  const runsR = new Map<number, number>(), runsL = new Map<number, number>();
  for (const c of pool) {
    const r = runsOf(c, "R"), l = runsOf(c, "L");
    if (r != null) runsR.set(c.cardId, r);
    if (l != null) runsL.set(c.cardId, l);
  }

  /** Hitters and pitchers are ranked in their own populations, then merged. */
  const board = (runs: Map<number, number>): Map<number, number> => {
    const hit = new Map<number, number>(), pit = new Map<number, number>();
    for (const c of pool) {
      const v = runs.get(c.cardId);
      if (v == null) continue;
      (c.isPitcher ? pit : hit).set(c.cardId, v);
    }
    const defAll = new Map<number, number>();
    for (const c of pool) if (!c.isPitcher && hit.has(c.cardId)) defAll.set(c.cardId, bestDef(c.ratings));
    const hitPct = composite(percentileMap(hit), percentileMap(defAll), defWeight);
    return new Map([...hitPct, ...percentileMap(pit)]);
  };

  const at = (runs: Map<number, number>): Record<string, Map<number, number>> => {
    const out: Record<string, Map<number, number>> = {};
    for (const pos of [...HIT_POS, "DH"]) {
      const off = new Map<number, number>(), def = new Map<number, number>();
      for (const c of pool) {
        if (c.isPitcher) continue;
        const v = runs.get(c.cardId);
        if (v == null) continue;
        const posRating = c.ratings[`Pos Rating ${pos}`] ?? 0;
        if (pos !== "DH" && posRating <= 0) continue;
        off.set(c.cardId, v);
        def.set(c.cardId, pos === "DH" ? 0 : posRating);
      }
      // DH is offence only, exactly as roster-fill scores it.
      out[pos] = pos === "DH"
        ? percentileMap(off)
        : composite(percentileMap(off), percentileMap(def), defWeight);
    }
    return out;
  };

  return {
    fitR: board(runsR), fitL: board(runsL),
    atR: at(runsR), atL: at(runsL),
    runsR, runsL, envLeft, envRight, envPitch,
  };
}
