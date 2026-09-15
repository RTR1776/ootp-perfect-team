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
import { cardRuns, envFor, hitterRates, pitcherRates, roleRuns, type Env } from "@/lib/analytics/card-value";
import { HIT_POS, bestDef, percentileMap, type FitMaps } from "@/lib/roster-fill";
import type { ParkRow } from "@/lib/analytics/tournament-env";

export interface EnvFitInput {
  cardId: number;
  isPitcher: boolean;
  bats: string | null;
  ratings: Record<string, number>;
  /** SP / RP / CL. Relief arms beat their ratings — see roleRuns(). */
  role?: string | null;
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
  /**
   * Absolute floor on a position rating before a card may be assigned there.
   *
   * The composite prices defence as a percentile at 17% of the score, which
   * lets a big enough bat drag a genuinely unplayable glove onto the field —
   * a 28 in right, a 36 behind the plate. L.J.'s rule is simpler and better:
   * nothing below 50 plays anywhere except first base, where the position
   * asks least. DH is exempt because there is no glove involved.
   *
   * CATCHERS ARE NOT A SPECIAL CASE, checked 2026-09-15. The worry was that
   * `Pos Rating C` ignores framing and arm. It does not: across the 380
   * catchers in the catalogue, Pos Rating C = -30 + 0.50*CatcherAbil +
   * 0.50*CatcherFrame + 0.42*Catcher Arm with R² 0.981 and an rmse of 2.8
   * points. The rating IS the composite. What let a 36 behind the plate was
   * the weight on defence, and this floor is the fix for that.
   */
  minPosRating?: number;
  /**
   * How much of the measured relief role bonus to believe, 0-1 (default 1).
   *
   * ROLE_RUNS was fitted on runs allowed, and runs allowed flatters a reliever:
   * across 327 archived tournament exports, relievers inherit 195k runners and
   * 30% of them score charged to the pitcher who left them. Correcting for that
   * alone erases the whole gap. Checked the other way — the SAME card, in the
   * same format, starting and relieving (1,442 paired card-formats) — moving to
   * the pen is worth -0.19 RA9 but +0.04 FIP. The RA9 gain is the accounting;
   * the FIP says the card does not get better.
   *
   * There is also no stamina gradient above ~55, which the relShare taper in
   * league-best assumes: STM 56-65 gains 0.12 RA9, STM 91+ gains 0.19. So the
   * effect, whatever is left of it, is not times-through-the-order.
   *
   * Left at 1 the optimiser sees a ~4.6-run wall between an RP card and an SP
   * card for the same bullpen slot, which is why a starter never wins one.
   */
  roleTrust?: number;
  /**
   * Observed play, already on the model's scale (observed-blend.ts), keyed by
   * card id, and the sample size K at which it earns equal weight with the
   * model. Applied to the both-hands figure and carried to each board as a
   * shift, since the tournament export has no platoon split.
   */
  observed?: Map<number, { runs: number; n: number }>;
  observedK?: number;
  /**
   * NOTE for cap formats: env-roster's --rp-weight (a reliever's innings as a
   * fraction of a starter's) defaults to 0.5. The exports say 0.31 in Gold
   * Floor Cap and 0.24 across all 12,019 team-events with 10+ games played:
   * 89.2 batters faced per starter against 27.7 per relief arm. At 0.5 the
   * optimiser buys roughly twice the bullpen the innings justify, which in a
   * capped format is points taken off the lineup.
   */
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
      /**
       * How the arm is used, which no rating states. A reliever faces a lineup
       * once and never turns it over, and beats his ratings by ~4-5 runs per 700
       * batters faced where a starter misses by ~1 (roleRuns). cardRuns is runs
       * ALLOWED, these are runs SAVED, so the adjustment subtracts.
       */
      const role = -roleRuns(c.role, c.ratings["Stamina"]) * (o.roleTrust ?? 1);
      // A starter faces both hands; the vs-LHP board is the pure-left read.
      const blend = 0.45 * rL + 0.55 * rR;
      /**
       * A PITCHER'S SPLIT IS MOSTLY NOISE, and acting on a small one is worse
       * than not acting. Checked against 3.3M league plate appearances with the
       * vL and vR lines kept separate (pnpm split:check): where the model puts a
       * pitcher's vL-vR gap under 10 runs per 700, it names the better side 46%
       * and 41% of the time — below chance. Only past 10 runs does it get there
       * (75%, then 100% on the 15-25 band).
       *
       * Hitters are a different story and are left alone: 75% overall, rising
       * cleanly to 100% above 25 runs, and their split is 87% as reliable as
       * their level — within noise of no shrinkage at all.
       *
       * So the pitcher's split is pulled toward the both-hands read by the ratio
       * of the two correlations, 0.382 / 0.577. That keeps a genuinely large
       * platoon arm large while flattening the small calls the data says carry
       * nothing.
       */
      const SPLIT_TRUST = 0.66;
      return role + blend + SPLIT_TRUST * ((board === "L" ? rL : blend) - blend);
    }
    const env = batsLeftOn(c.bats, board) ? envLeft : envRight;
    const rates = hitterRates(c.ratings, env.rates, board === "R" ? "vR" : "vL");
    return rates ? cardRuns(rates, env) : null;
  };

  const runsR = new Map<number, number>(), runsL = new Map<number, number>();
  const K = o.observedK ?? 2500;
  for (const c of pool) {
    let r = runsOf(c, "R"), l = runsOf(c, "L");
    const ob = o.observed?.get(c.cardId);
    if (ob && ob.n > 0 && r != null && l != null) {
      // Blend on the both-hands read, then move both boards by the same amount.
      const both = 0.7 * r + 0.3 * l;
      const shift = (ob.n * ob.runs + K * both) / (ob.n + K) - both;
      r += shift; l += shift;
    }
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
        if (pos !== "DH" && pos !== "1B" && posRating < (o.minPosRating ?? 0)) continue;
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
