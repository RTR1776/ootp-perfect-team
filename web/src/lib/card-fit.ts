/**
 * Card Fit: where a card plays for L.J. For every current event it is legal
 * in: the spot it takes on his roster there, whom it replaces, the runs it
 * adds, and where it ranks at that spot among every legal card.
 *
 * L.J., 2026-09-29: new cards come in batches (a release tonight, more in a
 * day or two), and he wants "something to analyze and be able to quickly
 * determine where the card goes", like cwhit's card explorer (per event, the
 * model's read and the card's rank at its position) "but even better". The
 * better part is his roster: cwhit ranks the card against the catalogue;
 * this also says whether it makes HIS team, in which event, over whom.
 *
 * Every number is Build's: runs per 700 PA on env-fit's scorer in the
 * event's run environment and park, observed play blended in, a glove's
 * runs at the spot scaled to the era (fielding.ts gloveScale). The gain is in
 * the roster objective's units (roster-objective.ts): a lineup spot counts on
 * each board by the field's share of right- and left-handed pitching, a
 * starter in full, a reliever at 0.31. It is one swap into his roster, so it
 * is the first move Build's Optimise would weigh, not the whole reshuffle a
 * cap or slot rule can force.
 *
 * Pure; lib/card-fit-load.ts scores the cards.
 */
import { fieldingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import { RP_WEIGHT_DEFAULT } from "@/lib/roster-objective";

export const FIELD_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type FieldPos = (typeof FIELD_POS)[number];
export type LineupSpot = FieldPos | "DH";
export type Spot = LineupSpot | "SP" | "RP";
export type Board = "R" | "L";

/** How a lineup is filled for his best team: the scarce gloves first, so a shortstop isn't spent at first base. */
const LINEUP_ORDER: LineupSpot[] = ["C", "SS", "CF", "2B", "3B", "RF", "LF", "1B", "DH"];
export const STAFF_DEPTH = { SP: 5, RP: 7 } as const;
/** A gain smaller than this is a tie with the card he plays. */
export const GAIN_FLOOR = 0.1;

/** One card form scored in one event. A variant's form has id = -cardId. */
export interface ScoredForm {
  id: number;
  cardId: number;
  name: string;
  variant: boolean;
  isPitcher: boolean;
  role: "SP" | "RP" | null;
  runsR: number;
  runsL: number;
  /** Position ratings of this form. */
  pos: Partial<Record<FieldPos, number>>;
  val: number | null;
}

export interface FitCtx {
  dh: boolean;
  /** Share of the field's pitching that is left-handed: the vs-LHP board's weight. */
  lhp: number;
  /** fielding.ts gloveScale for the event's run environment, times the era's glove team weight. */
  glove: number;
  /** The era's pitching team weight against a bat run (calibration.ts teamWeights); 1 when absent. */
  pit?: number;
}

/** An arm's role as the roster reads it: the card's own, else by stamina. */
export function armRole(pitcherRole: string | null | undefined, stamina: number | null | undefined): "SP" | "RP" {
  if (pitcherRole === "SP") return "SP";
  if (pitcherRole) return "RP";
  return (stamina ?? 0) <= 25 ? "RP" : "SP";
}

/** A bat's runs at a lineup spot on one board, glove included; null where it can't play. */
export function batAt(f: ScoredForm, spot: LineupSpot, board: Board, ctx: FitCtx): number | null {
  if (f.isPitcher) return null;
  const runs = board === "R" ? f.runsR : f.runsL;
  if (spot === "DH") return ctx.dh ? runs : null;
  const rating = f.pos[spot];
  if (rating == null || rating <= 0 || rating < posFloorAt(LJ_FLOOR, spot)) return null;
  return runs + ctx.glove * fieldingRuns(spot, rating);
}

/** The both-hands value at a spot, the read a spot's ranking uses; null where it can't play. */
export function spotValue(f: ScoredForm, spot: Spot, ctx: FitCtx): number | null {
  if (spot === "SP" || spot === "RP") return f.isPitcher && f.role === spot ? f.runsR : null;
  const r = batAt(f, spot, "R", ctx), l = batAt(f, spot, "L", ctx);
  return r == null || l == null ? null : (1 - ctx.lhp) * r + ctx.lhp * l;
}

/** The spots a form can take in this event. */
export function spotsOf(f: ScoredForm, ctx: FitCtx): Spot[] {
  if (f.isPitcher) return f.role ? [f.role] : [];
  return [...FIELD_POS, "DH" as const].filter((s) => batAt(f, s, "R", ctx) != null);
}

/** His team in one event: who plays each lineup spot on each board, his starters and his relievers. */
export interface Team {
  R: Partial<Record<LineupSpot, ScoredForm>>;
  L: Partial<Record<LineupSpot, ScoredForm>>;
  SP: ScoredForm[];
  RP: ScoredForm[];
}

/**
 * His best team from the forms he owns and may play here: each board filled
 * spot by spot (scarce gloves first, each card once), his five best starters
 * and seven best relievers. The stand-in when no roster is saved for the event.
 */
export function bestTeam(owned: readonly ScoredForm[], ctx: FitCtx): Team {
  const team: Team = { R: {}, L: {}, SP: [], RP: [] };
  for (const board of ["R", "L"] as const) {
    const used = new Set<number>();
    for (const spot of LINEUP_ORDER) {
      let best: ScoredForm | null = null, bestV = -Infinity;
      for (const f of owned) {
        if (used.has(f.cardId)) continue;
        const v = batAt(f, spot, board, ctx);
        if (v != null && v > bestV) { best = f; bestV = v; }
      }
      if (best) { used.add(best.cardId); team[board][spot] = best; }
    }
  }
  for (const role of ["SP", "RP"] as const) {
    const byCard = new Map<number, ScoredForm>();
    for (const f of owned) {
      if (!f.isPitcher || f.role !== role) continue;
      const had = byCard.get(f.cardId);
      if (!had || f.runsR > had.runsR) byCard.set(f.cardId, f);
    }
    team[role] = [...byCard.values()].sort((a, b) => b.runsR - a.runsR).slice(0, STAFF_DEPTH[role]);
  }
  return team;
}

/** A saved roster's slot, its form resolved (useVariant → the variant's form). */
export interface SavedSlot { formId: number; slot: string; versusHand: string | null }

/** His team as a saved roster has it. Bench slots are left out; CL counts with the pen. */
export function savedTeam(slots: readonly SavedSlot[], forms: ReadonlyMap<number, ScoredForm>): Team {
  const team: Team = { R: {}, L: {}, SP: [], RP: [] };
  for (const s of slots) {
    const f = forms.get(s.formId);
    if (!f) continue;
    if (/^SP\d*$/.test(s.slot)) team.SP.push(f);
    else if (/^(RP\d*|CL)$/.test(s.slot)) team.RP.push(f);
    else if ((FIELD_POS as readonly string[]).includes(s.slot) || s.slot === "DH") {
      if (s.versusHand === "R" || s.versusHand === "L") team[s.versusHand][s.slot as LineupSpot] = f;
    }
  }
  return team;
}

/** Whom a card replaces: on a board at a lineup spot, or the weakest starter or reliever. */
export interface Swap {
  board: Board | "staff";
  spot: Spot;
  /** The card it replaces (its value, for a cap); null when the spot is empty on his roster. */
  out: { name: string; variant: boolean; val: number | null } | null;
  /** Runs on that board (or per 700 BF for an arm), before the board's weight. */
  delta: number;
}

export interface Fit {
  /** Where it goes: the spot of its biggest gain, or where it ranks best. */
  spot: Spot;
  runsR: number;
  runsL: number;
  /** Both-hands value at `spot` (glove included). */
  value: number;
  /** Among every legal base card at `spot`, 1 = best. */
  rank: number;
  of: number;
  /** on: already on his roster there. start: would take a spot. bench: his cards there are better. */
  status: "on" | "start" | "bench";
  /** The roster objective's gain from the best single swap, ≥ 0. */
  gain: number;
  swaps: Swap[];
  /** "1B vR", "SP": where it plays now, for status "on". */
  on: string[];
  /** The best card of his it would have to beat at `spot`, and by how much it falls short, for status "bench". */
  short: { name: string; delta: number } | null;
}

const outOf = (f: ScoredForm): Swap["out"] => ({ name: f.name, variant: f.variant, val: f.val });

const rankAt = (target: number, pool: readonly ScoredForm[], spot: Spot, ctx: FitCtx) => {
  let above = 0, of = 0;
  for (const f of pool) {
    const v = spotValue(f, spot, ctx);
    if (v == null) continue;
    of++;
    if (v > target + 1e-9) above++;
  }
  return { rank: above + 1, of: Math.max(of, above + 1) };
};

/**
 * Where `t` fits in one event. `team` is his roster there, `pool` every legal
 * base card (the ranking field). `t` itself need not be in `pool`: an owned
 * variant is ranked against the base cards, as cwhit ranks.
 */
export function fitIn(t: ScoredForm, team: Team, pool: readonly ScoredForm[], ctx: FitCtx): Fit | null {
  const spots = spotsOf(t, ctx);
  if (!spots.length) return null;
  const on: string[] = [];
  const swaps: Swap[] = [];
  let gain = 0;
  let short: Fit["short"] = null;

  if (t.isPitcher) {
    const role = t.role!;
    const staff = team[role];
    if (staff.some((f) => f.cardId === t.cardId)) on.push(role);
    else {
      // It takes the weakest arm's place in that role (the staff's size is the roster's own).
      const weakest = staff.length ? staff.reduce((a, b) => (b.runsR < a.runsR ? b : a)) : null;
      const delta = weakest ? t.runsR - weakest.runsR : t.runsR;
      const w = (role === "SP" ? 1 : RP_WEIGHT_DEFAULT) * (ctx.pit ?? 1);
      if (delta * w >= GAIN_FLOOR) {
        gain = delta * w;
        swaps.push({ board: "staff", spot: role, out: weakest ? outOf(weakest) : null, delta });
      } else if (weakest) short = { name: weakest.name, delta };
    }
  } else {
    for (const board of ["R", "L"] as const) {
      const lineup = team[board];
      const at = (Object.entries(lineup) as [LineupSpot, ScoredForm][]).find(([, f]) => f.cardId === t.cardId);
      if (at) { on.push(`${at[0]} v${board}`); continue; }
      let best: Swap | null = null;
      for (const spot of spots as LineupSpot[]) {
        const mine = batAt(t, spot, board, ctx)!;
        const inc = lineup[spot];
        const theirs = inc ? batAt(inc, spot, board, ctx) : null;
        const delta = theirs == null ? mine : mine - theirs;
        if (!best || delta > best.delta) best = { board, spot, out: inc ? outOf(inc) : null, delta };
      }
      const w = board === "R" ? 1 - ctx.lhp : ctx.lhp;
      if (best && best.delta * w >= GAIN_FLOOR / 2) { gain += best.delta * w; swaps.push(best); }
      else if (best && best.out && (!short || best.delta > short.delta)) short = { name: best.out.name, delta: best.delta };
    }
  }

  // The spot shown: the biggest weighted swap; else where it plays now; else where it ranks best.
  const weight = (s: Swap) => s.delta * (s.board === "staff" ? (s.spot === "SP" ? 1 : RP_WEIGHT_DEFAULT) * (ctx.pit ?? 1) : s.board === "R" ? 1 - ctx.lhp : ctx.lhp);
  const top = swaps.slice().sort((a, b) => weight(b) - weight(a))[0];
  const ranked = spots.map((spot) => {
    const value = spotValue(t, spot, ctx)!;
    return { spot, value, ...rankAt(value, pool, spot, ctx) };
  });
  const onSpot = on.length ? (on[0].split(" ")[0] as Spot) : null;
  const pick = top ? ranked.find((r) => r.spot === top.spot)!
    : onSpot && ranked.some((r) => r.spot === onSpot) ? ranked.find((r) => r.spot === onSpot)!
    : ranked.slice().sort((a, b) => (a.rank - 1) / a.of - (b.rank - 1) / b.of || b.value - a.value)[0];

  return {
    spot: pick.spot, runsR: t.runsR, runsL: t.runsL, value: pick.value, rank: pick.rank, of: pick.of,
    status: on.length && !swaps.length ? "on" : swaps.length ? "start" : "bench",
    gain, swaps, on, short: swaps.length || on.length ? null : short,
  };
}
