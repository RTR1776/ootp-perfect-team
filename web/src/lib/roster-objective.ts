/**
 * THE OBJECTIVE — what a roster is worth, in runs, the same way everywhere.
 *
 * env-roster.ts had this inline; /build's auto-fill used the percentile
 * composite and stopped at the greedy fill, so the two disagreed on what a
 * good roster was and only the CLI priced gloves in runs. This is the one
 * function both call, pure and dependency-free, so a roster scored on the
 * page and a roster scored in the terminal get the same number.
 *
 * Per board, each lineup slot contributes the card's runs on that board plus
 * his defence at the slot's position (fielding.ts, runs per 700 PA). Boards
 * are weighted by how much of the field's pitching is left-handed — measured
 * per series (series_meta.lhp_bf_share) and 0.30 when nothing is on record.
 * Starters count in full, relief arms at RP_WEIGHT (0.31: a relief arm faces
 * 0.31 of a starter's batters in the archive), bench bats at a tenth.
 *
 * The staff's innings are fixed, not per arm: a series' weights are measured
 * per starter / reliever at the field's own staff size (fieldSp / fieldRp), so
 * a roster carrying more relievers than the field splits the same bullpen
 * innings more ways (L.J. 10-11: "spending too much in bullpen"). Without the
 * field's counts each arm keeps the measured weight, as before.
 *
 * Every number the objective adds is a run on the same calibrated scale
 * (env-fit `calibrate`), which is what makes a bat-for-glove trade honest.
 */
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import type { FillCard, FillResult, FillShape } from "@/lib/roster-fill";

export const RP_WEIGHT_DEFAULT = 0.31;
export const BENCH_WEIGHT_DEFAULT = 0.1;
/**
 * A bench's PA are fixed too: across the tournament exports (penshare.mts,
 * 10-11) the bats who came off the bench took 0.33 of one lineup slot's PA a
 * team in all, 2.3 bats at 0.144 each. A bench bat counts at most
 * BENCH_WEIGHT_DEFAULT and at most its share of that total, so a seven-bat
 * bench is not credited with twice the PA a bench gets.
 */
export const BENCH_SLOTS = 0.33;
/**
 * Who throws the pen's innings: each reliever's share of the pen's batters
 * faced, best card first, by relievers who pitched (penshare.mts over the
 * tournament exports, 10-11; 127-1,442 teams a row). The tilt to the best arm
 * is mild: a five-man pen runs 0.27 to 0.15.
 */
export const PEN_SHARE: Record<number, number[]> = {
  3: [0.44, 0.30, 0.25],
  4: [0.33, 0.26, 0.22, 0.19],
  5: [0.27, 0.21, 0.20, 0.17, 0.15],
  6: [0.21, 0.18, 0.17, 0.16, 0.15, 0.13],
  7: [0.17, 0.16, 0.15, 0.15, 0.14, 0.13, 0.10],
  8: [0.15, 0.14, 0.14, 0.13, 0.12, 0.12, 0.11, 0.09],
  9: [0.13, 0.11, 0.11, 0.11, 0.11, 0.10, 0.10, 0.10, 0.08],
};
/** The pen's slots (CL first) as multiples of an average reliever's weight: mean 1. */
export function penTilt(n: number): number[] {
  if (n <= 0) return [];
  const row = PEN_SHARE[Math.min(Math.max(n, 3), 9)];
  const raw = n < 3 ? Array(n).fill(1) : Array.from({ length: n }, (_, i) => row[Math.min(i, row.length - 1)]);
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  return raw.map((x) => x / mean);
}
export const LHP_SHARE_DEFAULT = 0.3;
const FIELD_POS = /^(C|1B|2B|3B|SS|LF|CF|RF)$/;

export interface ObjectiveOptions {
  /** The event's run-environment year: framing pays by era (fielding.ts framingRate). */
  eraYear?: number | null;
  shape: FillShape;
  runsR: Map<number, number>;
  runsL: Map<number, number>;
  /** Share of plate appearances against left-handed pitching in this field. */
  lhpShare?: number;
  rpWeight?: number;
  benchWeight?: number;
  /**
   * A starter's batters faced as a multiple of a lineup slot's PA (default 1).
   * It depends on the format: in Daily All-Star Hardware Slots (Bo7, ~11
   * games a team) a starter faced 55 batters to a lineup slot's 45 PA (1.22).
   */
  spWeight?: number;
  /**
   * The field's starters / relievers per team, the staff size spWeight and
   * rpWeight were measured at (field-construction staffPerTeam). Given, each
   * slot's weight is scaled by field count / this roster's count, so the
   * rotation's and the pen's total innings stay what the field throws.
   */
  fieldSp?: number | null;
  fieldRp?: number | null;
  /** Glove runs × this: the environment's balls in play against the fit's archive (fielding.ts gloveScale). */
  gloveScale?: number;
  /** Cards the roster must carry; a missing one costs 1000 runs. */
  mustIds?: ReadonlySet<number>;
}

export interface RosterObjective {
  /** Higher is better; called on complete rosters by the optimiser. */
  objective: (slots: FillResult) => number;
  /** Runs a card would contribute in a slot — orders the pair-move search. */
  rank: (key: string, c: FillCard) => number;
  /** Defence in runs for a card at a position (0 for DH and pitchers). */
  defAt: (cardId: number, pos: string) => number;
  /**
   * What `objective` adds for this card in this slot, exactly — the lineup
   * slots with their board weight, the pen and bench at theirs. The objective
   * is the sum of these over the board (plus the must-carry penalty), which is
   * what lets the optimiser solve a board's positions as an assignment.
   */
  slotValue: (key: string, cardId: number) => number;
}

export function rosterObjective(pool: readonly FillCard[], o: ObjectiveOptions): RosterObjective {
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const lhp = o.lhpShare ?? LHP_SHARE_DEFAULT;
  const { shape, runsR, runsL } = o;
  const share = (field: number | null | undefined, ours: number) => (field != null && field > 0 && ours > 0 ? field / ours : 1);
  const rpW = (o.rpWeight ?? RP_WEIGHT_DEFAULT) * share(o.fieldRp, shape.rpKeys.length);
  const bnW = Math.min(o.benchWeight ?? BENCH_WEIGHT_DEFAULT, shape.benchKeys.length > 0 ? BENCH_SLOTS / shape.benchKeys.length : Infinity);
  const tilt = new Map(penTilt(shape.rpKeys.length).map((w, i) => [shape.rpKeys[i], w]));
  const spW = (o.spWeight ?? 1) * share(o.fieldSp, shape.spKeys.length);

  const defAt = (cardId: number, pos: string): number => {
    if (!FIELD_POS.test(pos)) return 0;
    const c = byId.get(cardId);
    if (!c || c.isPitcher) return 0;
    // Framing is not in ZR, so it is not scaled with balls in play (fielding.ts TOURNEY_FRAMING).
    return (o.gloveScale ?? 1) * fieldingRuns(pos, c.ratings[`Pos Rating ${pos}`] ?? 0) + (pos === "C" ? framingRuns(c.ratings.CatcherFrame, o.eraYear) : 0);
  };

  const spSet = new Set(shape.spKeys), rpSet = new Set(shape.rpKeys), bnSet = new Set(shape.benchKeys);
  const otherKeys = [...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys];
  const slotValue = (key: string, id: number): number => {
    if (key.startsWith("R:")) return (1 - lhp) * ((runsR.get(id) ?? 0) + defAt(id, key.slice(2)));
    if (key.startsWith("L:")) return lhp * ((runsL.get(id) ?? 0) + defAt(id, key.slice(2)));
    if (spSet.has(key)) return spW * (runsR.get(id) ?? 0);
    if (rpSet.has(key)) return rpW * (tilt.get(key) ?? 1) * (runsR.get(id) ?? 0);
    if (bnSet.has(key)) return bnW * (runsR.get(id) ?? 0);
    return 0;
  };

  const objective = (r: FillResult): number => {
    let total = 0;
    if (o.mustIds?.size) {
      const on = new Set(Object.values(r));
      for (const id of o.mustIds) if (!on.has(id)) total -= 1000;
    }
    for (const p of shape.lineupPos) {
      const a = r[`R:${p}`], b = r[`L:${p}`];
      if (a != null) total += slotValue(`R:${p}`, a);
      if (b != null) total += slotValue(`L:${p}`, b);
    }
    for (const k of otherKeys) { const c = r[k]; if (c != null) total += slotValue(k, c); }
    return total;
  };

  const rank = (key: string, c: FillCard): number => {
    const pos = key.includes(":") ? key.split(":")[1] : "";
    const d = FIELD_POS.test(pos) ? defAt(c.cardId, pos) : 0;
    return (key.startsWith("L:") ? (runsL.get(c.cardId) ?? -1e6) : (runsR.get(c.cardId) ?? -1e6)) + d;
  };

  return { objective, rank, defAt, slotValue };
}
