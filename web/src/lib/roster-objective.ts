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
 * Every number the objective adds is a run on the same calibrated scale
 * (env-fit `calibrate`), which is what makes a bat-for-glove trade honest.
 */
import { fieldingRuns } from "@/lib/analytics/fielding";
import type { FillCard, FillResult, FillShape } from "@/lib/roster-fill";

export const RP_WEIGHT_DEFAULT = 0.31;
export const BENCH_WEIGHT_DEFAULT = 0.1;
export const LHP_SHARE_DEFAULT = 0.3;
const FIELD_POS = /^(C|1B|2B|3B|SS|LF|CF|RF)$/;

export interface ObjectiveOptions {
  shape: FillShape;
  runsR: Map<number, number>;
  runsL: Map<number, number>;
  /** Share of plate appearances against left-handed pitching in this field. */
  lhpShare?: number;
  rpWeight?: number;
  benchWeight?: number;
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
}

export function rosterObjective(pool: readonly FillCard[], o: ObjectiveOptions): RosterObjective {
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const lhp = o.lhpShare ?? LHP_SHARE_DEFAULT;
  const rpW = o.rpWeight ?? RP_WEIGHT_DEFAULT;
  const bnW = o.benchWeight ?? BENCH_WEIGHT_DEFAULT;
  const { shape, runsR, runsL } = o;

  const defAt = (cardId: number, pos: string): number => {
    if (!FIELD_POS.test(pos)) return 0;
    const c = byId.get(cardId);
    if (!c || c.isPitcher) return 0;
    return fieldingRuns(pos, c.ratings[`Pos Rating ${pos}`] ?? 0);
  };

  const objective = (r: FillResult): number => {
    let total = 0;
    if (o.mustIds?.size) {
      const on = new Set(Object.values(r));
      for (const id of o.mustIds) if (!on.has(id)) total -= 1000;
    }
    for (const p of shape.lineupPos) {
      const a = r[`R:${p}`], b = r[`L:${p}`];
      if (a != null) total += (1 - lhp) * ((runsR.get(a) ?? 0) + defAt(a, p));
      if (b != null) total += lhp * ((runsL.get(b) ?? 0) + defAt(b, p));
    }
    for (const k of shape.spKeys) { const c = r[k]; if (c != null) total += runsR.get(c) ?? 0; }
    for (const k of shape.rpKeys) { const c = r[k]; if (c != null) total += rpW * (runsR.get(c) ?? 0); }
    for (const k of shape.benchKeys) { const c = r[k]; if (c != null) total += bnW * (runsR.get(c) ?? 0); }
    return total;
  };

  const rank = (key: string, c: FillCard): number => {
    const pos = key.includes(":") ? key.split(":")[1] : "";
    const d = FIELD_POS.test(pos) ? defAt(c.cardId, pos) : 0;
    return (key.startsWith("L:") ? (runsL.get(c.cardId) ?? -1e6) : (runsR.get(c.cardId) ?? -1e6)) + d;
  };

  return { objective, rank, defAt };
}
