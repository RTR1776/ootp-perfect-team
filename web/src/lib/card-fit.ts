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
 * Where the event holds the roster to tier slots or a value cap (a Room), the
 * swap must also leave a legal 26: if the card has no slot to sit in, the
 * cheapest way to make one is paid out of the gain (a bench card off the
 * roster for free, else one starter giving way to a card of his that fits),
 * and every card it could replace is weighed, not only the weakest. PTCS 8
 * Championship Cap, 2026-10-27: Webster McDonald (90) replacing Luther Farrell
 * (66) read +13.9, but the Diamond and Perfect slots were full, and full
 * builds with him owned kept the roster as it was.
 *
 * Pure; lib/card-fit-load.ts scores the cards.
 */
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import { RP_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { slotOverflow, tierCode } from "@/lib/roster-rules";

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
  /** Catcher framing rating (fielding.ts framingRuns), when it has one. */
  frame?: number;
  val: number | null;
}

export interface FitCtx {
  /** The event's run-environment year: framing pays by era (fielding.ts framingRate). */
  eraYear?: number | null;
  dh: boolean;
  /** Share of the field's pitching that is left-handed: the vs-LHP board's weight. */
  lhp: number;
  /** fielding.ts gloveScale for the event's run environment, times the era's glove team weight. */
  glove: number;
  /** Catcher framing's team weight (calibration.ts teamWeights `frm`); 1 when absent. */
  frm?: number;
  /** The era's pitching team weight against a bat run (calibration.ts teamWeights); 1 when absent. */
  pit?: number;
  /** The starters' / pen's own team weights (teamWeights sp / rp); `pit` when absent. */
  pitSp?: number;
  pitRp?: number;
  /**
   * The series' measured starter / reliever weights (field-construction) and the
   * field's staff size they were measured at, as the builder prices arms
   * (roster-objective): each arm's weight is scaled by field count / the
   * roster's own count. Absent, a starter counts 1 and a reliever RP_WEIGHT_DEFAULT.
   */
  spWeight?: number | null;
  rpWeight?: number | null;
  fieldSp?: number | null;
  fieldRp?: number | null;
}

/** An arm's weight in this event, as the roster objective prices it, for a staff of `n` in that role. */
export function armWeight(role: "SP" | "RP", n: number, ctx: FitCtx): number {
  const base = role === "SP" ? ctx.spWeight ?? 1 : ctx.rpWeight ?? RP_WEIGHT_DEFAULT;
  const field = role === "SP" ? ctx.fieldSp : ctx.fieldRp;
  const share = field != null && field > 0 && n > 0 ? field / n : 1;
  return base * share * ((role === "SP" ? ctx.pitSp : ctx.pitRp) ?? ctx.pit ?? 1);
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
  return runs + ctx.glove * fieldingRuns(spot, rating) + (spot === "C" ? (ctx.frm ?? 1) * framingRuns(f.frame, ctx.eraYear) : 0);
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
  // A two-way card (lib/two-way) already in a lineup isn't on the staff too.
  const batting = new Set([...Object.values(team.R), ...Object.values(team.L)].map((f) => f!.cardId));
  for (const role of ["SP", "RP"] as const) {
    const byCard = new Map<number, ScoredForm>();
    for (const f of owned) {
      if (!f.isPitcher || f.role !== role || batting.has(f.cardId)) continue;
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
  /**
   * In a slots or cap event, when the card would start: the swap's gain before
   * making room (`gross`), what room costs, and how it is made. `cost` is null
   * when no single move makes the roster legal: the card can't start.
   */
  room?: { gross: number; cost: number | null; note: string } | null;
}

/**
 * The rules a roster is held to beyond one card's legality: per-tier slot
 * maximums (roster-rules slotOverflow) and a value cap, with who is on it now.
 */
export interface Room {
  slots: Record<string, number> | null;
  cap: number | null;
  /** Every card on his roster, the bench included: card id → its value and name. */
  roster: ReadonlyMap<number, { val: number; name: string }>;
  /** Every form he owns and may play here: who can step in for a starter that has to go. */
  spares: readonly ScoredForm[];
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
export function fitIn(t: ScoredForm, team: Team, pool: readonly ScoredForm[], ctx: FitCtx, room?: Room | null): Fit | null {
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
      const w = armWeight(role, staff.length, ctx);
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

  // A slots or cap event: the swap must leave a legal roster (see the header).
  let roomRead: Fit["room"] = null;
  if (swaps.length && room && (room.slots || room.cap != null) && holds([...room.roster.values()].map((r) => r.val), room)) {
    const best = bestPlan(t, team, ctx, room);
    roomRead = { gross: gain, cost: best?.room.cost ?? null, note: best?.room.note ?? "no single move makes room for it" };
    swaps.length = 0;
    gain = 0;
    if (best && best.net >= GAIN_FLOOR) {
      swaps.push(...best.swaps);
      gain = best.net;
      roomRead = { gross: best.gross, cost: best.room.cost, note: best.room.note };
    } else if (best) {
      const top = best.swaps[0];
      if (top.out) short = { name: top.out.name, delta: best.net };
    }
  }

  // The spot shown: the biggest weighted swap; else where it plays now; else where it ranks best.
  const weight = (s: Swap) => s.delta * (s.board === "staff" ? armWeight(s.spot as "SP" | "RP", team[s.spot as "SP" | "RP"].length, ctx) : s.board === "R" ? 1 - ctx.lhp : ctx.lhp);
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
    gain, swaps, on, short: swaps.length || on.length ? null : short, room: roomRead,
  };
}

/* ------------------------------------------------------------------ room */

const tierCounts = (vals: Iterable<number>) => {
  const out: Record<string, number> = {};
  for (const v of vals) { const k = tierCode(v); out[k] = (out[k] ?? 0) + 1; }
  return out;
};

/** These card values make a legal roster: under the cap, and no tier over its slots. */
export function holds(vals: readonly number[], room: Pick<Room, "slots" | "cap">): boolean {
  if (room.cap != null && vals.reduce((a, b) => a + b, 0) > room.cap) return false;
  return !room.slots || slotOverflow(tierCounts(vals), room.slots) == null;
}

type Place = { board: Board | "staff"; spot: Spot };
interface Plan { swaps: Swap[]; gross: number; outs: ScoredForm[] }

/** Each card's places on the team: lineup spots per board, or its role on the staff. */
function placesOf(team: Team): Map<number, { form: ScoredForm; places: Place[] }> {
  const out = new Map<number, { form: ScoredForm; places: Place[] }>();
  const add = (f: ScoredForm, p: Place) => { const e = out.get(f.cardId) ?? { form: f, places: [] }; e.places.push(p); out.set(f.cardId, e); };
  for (const board of ["R", "L"] as const) for (const [spot, f] of Object.entries(team[board]) as [LineupSpot, ScoredForm][]) add(f, { board, spot });
  for (const role of ["SP", "RP"] as const) for (const f of team[role]) add(f, { board: "staff", spot: role });
  return out;
}

const boardWeight = (b: Board, ctx: FitCtx) => (b === "R" ? 1 - ctx.lhp : ctx.lhp);

/** Every way the card could start: an arm in place of each arm in its role; a bat at its two best spots on each board, alone or together. */
function plansFor(t: ScoredForm, team: Team, ctx: FitCtx): Plan[] {
  const plans: Plan[] = [];
  if (t.isPitcher) {
    const role = t.role!;
    const w = armWeight(role, team[role].length, ctx);
    for (const f of team[role]) {
      const delta = t.runsR - f.runsR;
      if (delta * w >= GAIN_FLOOR) plans.push({ swaps: [{ board: "staff", spot: role, out: outOf(f), delta }], gross: delta * w, outs: [f] });
    }
    return plans;
  }
  const options = (["R", "L"] as const).map((board) => {
    const lineup = team[board];
    const opts: { swap: Swap; inc: ScoredForm | undefined }[] = [];
    for (const spot of spotsOf(t, ctx) as LineupSpot[]) {
      const inc = lineup[spot];
      const theirs = inc ? batAt(inc, spot, board, ctx) : null;
      const delta = batAt(t, spot, board, ctx)! - (theirs ?? 0);
      if (delta * boardWeight(board, ctx) >= GAIN_FLOOR / 2) opts.push({ swap: { board, spot, out: inc ? outOf(inc) : null, delta }, inc });
    }
    return [null, ...opts.sort((a, b) => b.swap.delta - a.swap.delta).slice(0, 2)];
  });
  for (const r of options[0]) for (const l of options[1]) {
    const picked = [r, l].filter((x): x is NonNullable<typeof x> => x != null);
    if (!picked.length) continue;
    plans.push({
      swaps: picked.map((x) => x.swap),
      gross: picked.reduce((s, x) => s + x.swap.delta * boardWeight(x.swap.board as Board, ctx), 0),
      outs: picked.flatMap((x) => (x.inc ? [x.inc] : [])),
    });
  }
  return plans;
}

/**
 * What one starter giving way costs, for every card of his that could take
 * all his places, cheapest first. Cached per team and room: it doesn't depend
 * on the card being placed.
 */
const stepInCache = new WeakMap<Team, WeakMap<Room, Map<number, { z: ScoredForm; loss: number }[]>>>();
function stepIns(team: Team, room: Room, ctx: FitCtx): Map<number, { z: ScoredForm; loss: number }[]> {
  let byRoom = stepInCache.get(team);
  if (!byRoom) stepInCache.set(team, (byRoom = new WeakMap()));
  const hit = byRoom.get(room);
  if (hit) return hit;
  const places = placesOf(team);
  const out = new Map<number, { z: ScoredForm; loss: number }[]>();
  for (const [yId, { form: y, places: ps }] of places) {
    const list: { z: ScoredForm; loss: number }[] = [];
    for (const z of room.spares) {
      // The card stepping in starts nowhere now (the bench, or off the roster): one that already plays is spoken for.
      if (z.cardId === yId || places.has(z.cardId)) continue;
      let loss = 0;
      for (const p of ps) {
        if (p.board === "staff") {
          if (!z.isPitcher || z.role !== p.spot) { loss = Infinity; break; }
          loss += (y.runsR - z.runsR) * armWeight(p.spot as "SP" | "RP", team[p.spot as "SP" | "RP"].length, ctx);
        } else {
          const mine = batAt(y, p.spot as LineupSpot, p.board, ctx), theirs = batAt(z, p.spot as LineupSpot, p.board, ctx);
          if (mine == null || theirs == null) { loss = Infinity; break; }
          loss += (mine - theirs) * boardWeight(p.board, ctx);
        }
      }
      if (Number.isFinite(loss)) list.push({ z, loss });
    }
    out.set(yId, list.sort((a, b) => a.loss - b.loss));
  }
  byRoom.set(room, out);
  return out;
}

/**
 * The cheapest move that leaves a legal roster once `t` starts by `plan`:
 * a card that starts nowhere off the roster (free), else one starter giving
 * way to a card of his that starts nowhere (off the roster or on the bench)
 * and fits. Null when no single move does.
 */
function roomFor(t: ScoredForm, plan: Plan, team: Team, ctx: FitCtx, room: Room): { cost: number; note: string } | null {
  const size = room.roster.size;
  const set = new Map([...room.roster].map(([id, r]) => [id, r.val]));
  set.set(t.cardId, t.val ?? 0);
  // After the plan: whom it replaced may start nowhere, and then sits on the bench.
  const places = placesOf(team);
  const outIds = new Set(plan.outs.map((f) => f.cardId));
  const replaced = (id: number, p: Place) => (p.board === "staff" ? outIds.has(id) && plan.swaps.some((s) => s.spot === p.spot) : plan.swaps.some((s) => s.board === p.board && s.spot === p.spot));
  const after = new Map([...places].map(([id, e]) => [id, e.places.filter((p) => !replaced(id, p))]));
  const idle = () => [...set.keys()].filter((id) => id !== t.cardId && !(after.get(id)?.length));
  const nameOf = (id: number) => room.roster.get(id)?.name ?? places.get(id)?.form.name ?? "?";
  const valsWithout = (s: Map<number, number>, id: number | null) => [...s].filter(([k]) => k !== id).map(([, v]) => v);
  /** Whom to send off the roster so it holds, when it is one over; undefined when it already holds, null when no one will do. */
  const leaver = (s: Map<number, number>, pool: number[]): number | null | undefined => {
    if (s.size <= size) return holds([...s.values()], room) ? undefined : null;
    return pool.find((id) => s.has(id) && holds(valsWithout(s, id), room)) ?? null;
  };
  const free = leaver(set, idle());
  if (free !== null) return { cost: 0, note: free === undefined ? "fits as it is" : `${nameOf(free)} off the roster` };

  let best: { cost: number; note: string } | null = null;
  const lists = stepIns(team, room, ctx);
  for (const [yId, list] of lists) {
    if (yId === t.cardId || outIds.has(yId) || !(after.get(yId)?.length)) continue;
    const tried = new Set<string>();
    for (const { z, loss } of list) {
      if (best && loss >= best.cost) break;
      if (z.cardId === t.cardId) continue;
      const key = `${set.has(z.cardId) ? "on" : "off"}:${room.cap != null ? z.val : tierCode(z.val ?? 0)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const s2 = new Map(set);
      s2.delete(yId);
      s2.set(z.cardId, z.val ?? 0);
      const pool = idle().filter((id) => id !== z.cardId);
      const l = leaver(s2, pool);
      if (l === null) continue;
      best = { cost: Math.max(0, loss), note: `${nameOf(yId)} (${room.roster.get(yId)?.val ?? "?"}) out for ${z.name}${z.variant ? " (VAR)" : ""} (${z.val ?? "?"})${l != null ? `, ${nameOf(l)} off the roster` : ""}` };
      break;
    }
  }
  return best;
}

/** The plan that adds the most once room is paid for. */
function bestPlan(t: ScoredForm, team: Team, ctx: FitCtx, room: Room) {
  let best: { swaps: Swap[]; gross: number; net: number; room: { cost: number; note: string } } | null = null;
  for (const plan of plansFor(t, team, ctx).sort((a, b) => b.gross - a.gross)) {
    if (best && plan.gross <= best.net) break;
    const r = roomFor(t, plan, team, ctx, room);
    if (!r) continue;
    const net = plan.gross - r.cost;
    if (!best || net > best.net) best = { swaps: plan.swaps, gross: plan.gross, net, room: r };
  }
  return best;
}
