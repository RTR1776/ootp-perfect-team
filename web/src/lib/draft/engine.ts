/**
 * The live draft helper's engine: what a Perfect Draft pick is worth to the
 * team it lands on, in the event's run environment, with the rounds still to
 * come priced in. Pure, so the page runs it in the browser between picks and
 * the tests and scripts/draft-study.ts run the same code.
 *
 * A TEAM'S VALUE is the roster objective's (roster-objective.ts, Card Fit's
 * slot values), in runs over a replacement card at every slot:
 * - each lineup spot on each board: the card's runs there plus its glove at
 *   that spot (fielding.ts at the era's balls in play and glove weight) and,
 *   behind the plate, framing at the era's framing weight. The boards weigh by
 *   the field's share of left-handed pitching. A card always plays its listed
 *   position; anywhere else only at L.J.'s glove floor (pos-floor.ts). A third
 *   of the draft pool's Bronze bats rate under 60 at their own position, and
 *   the draft hands him one of them, so the floor can't apply there.
 * - the rotation and the pen at the series' measured weights and the era's
 *   team weights (card-fit armWeight), tilted to SP1 and the closer
 *   (rotationTilt, penTilt); a rotation slot takes only an SP card, the pen
 *   any arm left over;
 * - the bench at the roster objective's bench weight, and a backup catcher;
 * - with no DH, a two-way starter's bat for his share of the plate appearances
 *   (roster-objective STARTER_PA_SHARE).
 * Each board's lineup is an exact assignment (Hungarian), so a shortstop who
 * also plays second goes wherever the team gains most.
 *
 * THE ROUNDS TO COME. A pick is worth what the team it finishes with is worth.
 * Each candidate is scored on that team: the rounds left are played out in
 * expectation, each round's pick being the card whose gain to the team
 * matches the expected best of a pack of N from its pool (an order statistic,
 * exact for a uniform pack: expectedBestOfN). A second catcher round makes the
 * first catcher less urgent; a Gold round that may bring a shortstop makes a
 * Bronze one worth a little less; a deep pool can wait and a thin one can't.
 */
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { penTilt, PITCHER_BAT_RUNS, rotationTilt, STARTER_PA_SHARE, staffStaminaRuns } from "@/lib/roster-objective";
import type { Tier } from "@/lib/tiers";
import type { DraftFormat, DraftGroup, PackKind, Remaining, RoundKind } from "@/lib/draft/formats";

export const FIELD = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type FieldPos = (typeof FIELD)[number];

/** One card as the draft scores it (lib/draft/load.ts builds these on the server). */
export interface DraftCard {
  id: number;
  name: string;
  tier: Tier;
  val: number;
  group: DraftGroup;
  isPitcher: boolean;
  role: "SP" | "RP" | null;
  /** Bats for a hitter, throws for an arm. */
  hand: string | null;
  year: number | null;
  /** The player (cards.bref_id): a team holds one card per player. */
  player: string | null;
  /** Runs per 700 PA on each board for a bat; runs saved per 700 BF for an arm (runsR is the both-hands read). */
  runsR: number;
  runsL: number;
  /** Position ratings above 0. */
  pos: Partial<Record<FieldPos, number>>;
  frame?: number;
  stamina?: number;
  /** An arm's own bat on each board (two-way cards), credited when he starts with no DH. */
  batR?: number;
  batL?: number;
  /** Share of the field's full teams that drafted it (scripts/draft-study.ts). */
  share?: number;
  /**
   * Drafted by anyone in the current-format exports (scripts/draft-study.ts);
   * unset with no study, or for a card newer than the exports.
   */
  seen?: boolean;
  /** Dropped out of the draft pool: the field drafted it in the earlier runs and stopped (Engine.absent). */
  out?: boolean;
}

/** How the event pays a run at each slot. lib/draft/load.ts derives these as Build does. */
export interface DraftCtx {
  dh: boolean;
  /** Share of the field's pitching that is left-handed: the vs-LHP board's weight. */
  lhp: number;
  /** fielding.ts gloveScale for the era × the era's glove team weight. */
  glove: number;
  /** Catcher framing's team weight. */
  frm: number;
  eraYear: number;
  /** Rotation, pen and bench the team is valued at. */
  sp: number;
  rp: number;
  bench: number;
  /** One starter's / reliever's weight against a lineup slot (series weight × team weight × field staff / ours). */
  spW: number;
  rpW: number;
  /** One bench bat's weight (roster-objective: at most 0.1, and the bench's 0.33 slots shared). */
  benchW: number;
  /** Glove floor off a card's listed position; L.J.'s by default. */
  floor?: PosFloor;
}

/** A backup catcher's share of a lineup slot: he catches when the starter rests (assumed, ~1 game in 10). */
export const BACKUP_C_WEIGHT = 0.1;
/**
 * A team with no second catcher, in runs: L.J.'s rule is two catchers, always
 * (Docs/HANDOFF - read me first.md, 2026-10-04). The model would barely notice
 * a non-catcher behind the plate (no framing rating prices at zero), so the
 * rule is priced in: about a tenth of a season caught by a man with no glove
 * there. Enough that the rounds left always find one; not a hard rule.
 */
export const BACKUP_C_MISSING = 4;
/** The replacement at a slot: this quantile of the event's legal cards there. */
export const REPLACEMENT_QUANTILE = 0.05;
/** Candidates scored by a full play-out of the rounds left; the rest keep the quick read. */
export const EXACT_CANDIDATES = 24;

export interface Engine {
  ctx: DraftCtx;
  cards: DraftCard[];
  byId: Map<number, number>;
  lineup: string[];
  /** Per card, per lineup slot: runs over replacement on each board (NaN where he can't play). Empty for arms. */
  cR: Float64Array[];
  cL: Float64Array[];
  /** A bat's bench value over replacement (≥ 0). */
  benchC: Float64Array;
  /** A bat's value catching on the vs-RHP board over replacement (NaN if he can't catch). */
  catchC: Float64Array;
  /** An SP card's rotation value per start share: spW × (runs − replacement) + his bat with no DH. */
  rotKey: Float64Array;
  /** An arm's runs over a replacement reliever. */
  penC: Float64Array;
  repl: { R: Float64Array; L: Float64Array; SP: number; RP: number; bench: number };
  rotTilt: number[];
  penTilt: number[];
  /** `${tier}|${group}` → card indices. */
  pools: Map<string, number[]>;
  /** A card's own value at its listed position (both boards, glove in) or as an arm: what its pool is ranked on. */
  alone: Float64Array;
  /**
   * 1 for a card taken to be out of the draft pool (DraftCard.out). The pool
   * rotates: Bob Miller's 1954 reliever went to 84 6L teams in August and to
   * none of 486 in October. Left out of what the rounds to come can bring; still
   * on the board, flagged, and his to take if it shows up in a pack.
   */
  absent: Uint8Array;
}

const quantile = (xs: number[], q: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

/** Value at a lineup slot on one board before replacement; null where the card can't play it. */
export function slotRuns(c: DraftCard, slot: string, board: "R" | "L", ctx: DraftCtx): number | null {
  if (c.isPitcher) return null;
  const runs = board === "R" ? c.runsR : c.runsL;
  if (slot === "DH") return ctx.dh ? runs : null;
  const rating = c.pos[slot as FieldPos];
  if (rating == null || rating <= 0) return null;
  if (slot !== c.group && rating < posFloorAt(ctx.floor ?? LJ_FLOOR, slot)) return null;
  return runs + ctx.glove * fieldingRuns(slot, rating) + (slot === "C" ? ctx.frm * framingRuns(c.frame, ctx.eraYear) : 0);
}

/** A two-way starter's bat over a pitcher's, per full share of the starts (0 with a DH or no bat). */
export function starterBatRuns(c: DraftCard, ctx: DraftCtx): number {
  if (ctx.dh || !c.isPitcher || c.batR == null || c.batL == null) return 0;
  return STARTER_PA_SHARE * ((1 - ctx.lhp) * (c.batR - PITCHER_BAT_RUNS) + ctx.lhp * (c.batL - PITCHER_BAT_RUNS));
}

export function makeEngine(cards: DraftCard[], ctx: DraftCtx): Engine {
  const lineup: string[] = [...FIELD, ...(ctx.dh ? ["DH"] : [])];
  const n = cards.length;
  const rawR: (Float64Array | null)[] = [], rawL: (Float64Array | null)[] = [];
  const atSlot: number[][][] = lineup.map(() => [[], []]);
  for (const c of cards) {
    if (c.isPitcher) { rawR.push(null); rawL.push(null); continue; }
    const r = new Float64Array(lineup.length), l = new Float64Array(lineup.length);
    lineup.forEach((s, k) => {
      const vr = slotRuns(c, s, "R", ctx), vl = slotRuns(c, s, "L", ctx);
      r[k] = vr ?? NaN; l[k] = vl ?? NaN;
      if (vr != null) atSlot[k][0].push(vr);
      if (vl != null) atSlot[k][1].push(vl);
    });
    rawR.push(r); rawL.push(l);
  }
  /** An arm's runs in the pen: without the staff-stamina term, as roster-objective prices a pen slot (staminaTerm). */
  const penRuns = (c: DraftCard) => c.runsR - staffStaminaRuns({ isPitcher: true, ratings: c.stamina != null ? { Stamina: c.stamina } : null });
  const repl = {
    R: Float64Array.from(atSlot.map((x) => quantile(x[0], REPLACEMENT_QUANTILE))),
    L: Float64Array.from(atSlot.map((x) => quantile(x[1], REPLACEMENT_QUANTILE))),
    SP: quantile(cards.filter((c) => c.isPitcher && c.role === "SP").map((c) => c.runsR), REPLACEMENT_QUANTILE),
    RP: quantile(cards.filter((c) => c.isPitcher).map(penRuns), REPLACEMENT_QUANTILE),
    bench: quantile(cards.filter((c) => !c.isPitcher).map((c) => c.runsR), REPLACEMENT_QUANTILE),
  };
  const cR: Float64Array[] = [], cL: Float64Array[] = [];
  const benchC = new Float64Array(n), catchC = new Float64Array(n).fill(NaN), rotKey = new Float64Array(n).fill(NaN), penC = new Float64Array(n).fill(NaN);
  cards.forEach((c, i) => {
    if (c.isPitcher) {
      cR.push(new Float64Array(0)); cL.push(new Float64Array(0));
      penC[i] = penRuns(c) - repl.RP;
      if (c.role === "SP") rotKey[i] = ctx.spW * (c.runsR - repl.SP) + starterBatRuns(c, ctx) / Math.max(ctx.sp, 1);
      return;
    }
    cR.push(rawR[i]!.map((v, k) => v - repl.R[k]));
    cL.push(rawL[i]!.map((v, k) => v - repl.L[k]));
    benchC[i] = Math.max(0, c.runsR - repl.bench);
    catchC[i] = cR[i][0];
  });
  const pools = new Map<string, number[]>();
  cards.forEach((c, i) => {
    const k = `${c.tier}|${c.group}`;
    const list = pools.get(k);
    if (list) list.push(i); else pools.set(k, [i]);
  });
  const alone = new Float64Array(n);
  cards.forEach((c, i) => {
    if (c.isPitcher) { alone[i] = c.runsR; return; }
    const k = Math.max(0, lineup.indexOf(c.group === "DH" ? (ctx.dh ? "DH" : "1B") : c.group));
    const r = rawR[i]![k], l = rawL[i]![k];
    alone[i] = Number.isNaN(r) || Number.isNaN(l) ? -Infinity : (1 - ctx.lhp) * r + ctx.lhp * l;
  });
  const absent = Uint8Array.from(cards, (c) => (c.out ? 1 : 0));
  return {
    ctx, cards, byId: new Map(cards.map((c, i) => [c.id, i])), lineup, cR, cL, benchC, catchC, rotKey, penC, repl,
    rotTilt: rotationTilt(ctx.sp), penTilt: penTilt(ctx.rp), pools, alone, absent,
  };
}

/* ---------------------------------------------------------- assignment */

const FORBID = 1e6;

/**
 * Minimum-cost assignment of every row to its own column (rows ≤ columns);
 * the column for each row. Kuhn–Munkres with potentials, O(rows² · columns).
 */
export function assign(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length, m = n ? cost[0].length : 0;
  const u = new Float64Array(n + 1), v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1), way = new Int32Array(m + 1);
  const minv = new Float64Array(m + 1), used = new Uint8Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity); used.fill(0);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j] !== 0) out[p[j] - 1] = j - 1;
  return out;
}

/** Best lineup on one board from these bats: card index per slot (-1 = replacement) and its total. */
function boardLineup(E: Engine, bats: readonly number[], board: "R" | "L"): { slots: number[]; total: number } {
  const S = E.lineup.length;
  const rows: number[][] = [];
  for (let k = 0; k < S; k++) {
    const row = new Array<number>(bats.length + S);
    for (let j = 0; j < bats.length; j++) {
      const v = (board === "R" ? E.cR : E.cL)[bats[j]][k];
      row[j] = Number.isNaN(v) ? FORBID : -v;
    }
    for (let j = 0; j < S; j++) row[bats.length + j] = 0;
    rows.push(row);
  }
  const pick = assign(rows);
  let total = 0;
  const slots = pick.map((j, k) => {
    if (j < 0 || j >= bats.length) return -1;
    const v = (board === "R" ? E.cR : E.cL)[bats[j]][k];
    if (Number.isNaN(v)) return -1;
    total += v;
    return bats[j];
  });
  return { slots, total };
}

/** A team as the event plays it, with what the quick gains need. */
export interface Plan {
  value: number;
  parts: { lineup: number; rotation: number; pen: number; bench: number; backup: number };
  /** Card index per lineup slot on each board (-1 = replacement). */
  R: number[];
  L: number[];
  rotation: number[];
  pen: number[];
  bench: number[];
  backup: number;
  /** Each slot's runs over replacement as filled (0 when empty). */
  incR: Float64Array;
  incL: Float64Array;
  /** What the man at each slot adds by moving to his best other spot when bumped (0 when nothing beats where they are). */
  mvR: Float64Array;
  mvL: Float64Array;
  benchMin: number;
  benchFull: boolean;
  backupContrib: number;
  rotMin: number;
  rotFull: boolean;
  rotMinIdx: number;
  penMin: number;
  penFull: boolean;
}

export function teamPlan(E: Engine, team: readonly number[]): Plan {
  const { ctx } = E;
  const bats = team.filter((i) => !E.cards[i].isPitcher);
  const arms = team.filter((i) => E.cards[i].isPitcher);
  const R = boardLineup(E, bats, "R"), L = boardLineup(E, bats, "L");
  const incR = Float64Array.from(R.slots.map((i, k) => (i < 0 ? 0 : E.cR[i][k])));
  const incL = Float64Array.from(L.slots.map((i, k) => (i < 0 ? 0 : E.cL[i][k])));
  const moves = (slots: number[], inc: Float64Array, c: Float64Array[]) => Float64Array.from(slots.map((d, k) => {
    if (d < 0) return 0;
    let best = 0;
    for (let j = 0; j < slots.length; j++) if (j !== k) { const g = c[d][j] - inc[j]; if (g > best) best = g; }
    return best;
  }));
  const mvR = moves(R.slots, incR, E.cR), mvL = moves(L.slots, incL, E.cL);
  const lineup = (1 - ctx.lhp) * R.total + ctx.lhp * L.total;

  const startsR = new Set(R.slots.filter((i) => i >= 0));
  const benchPool = bats.filter((i) => !startsR.has(i)).sort((a, b) => E.benchC[b] - E.benchC[a] || a - b);
  const bench = benchPool.slice(0, ctx.bench);
  const benchSum = bench.reduce((s, i) => s + E.benchC[i], 0);
  const benchFull = bench.length >= ctx.bench && ctx.bench > 0;
  const benchMin = benchFull ? E.benchC[bench[bench.length - 1]] : 0;

  const catcher = R.slots[0];
  let backup = -1, backupContrib = 0;
  for (const i of bats) {
    if (i === catcher) continue;
    const v = E.catchC[i];
    if (!Number.isNaN(v) && v > backupContrib) { backupContrib = v; backup = i; }
  }

  const sps = arms.filter((i) => E.cards[i].role === "SP" && E.rotKey[i] > 0).sort((a, b) => E.rotKey[b] - E.rotKey[a] || a - b);
  const rotation = sps.slice(0, ctx.sp);
  let rot = 0;
  rotation.forEach((i, s) => { rot += E.rotTilt[s] * E.rotKey[i]; });
  const inRot = new Set(rotation);
  const pen = arms.filter((i) => !inRot.has(i) && E.penC[i] > 0).sort((a, b) => E.penC[b] - E.penC[a] || a - b).slice(0, ctx.rp);
  let penV = 0;
  pen.forEach((i, s) => { penV += E.penTilt[s] * E.penC[i]; });
  penV *= ctx.rpW;

  const parts = { lineup, rotation: rot, pen: penV, bench: ctx.benchW * benchSum, backup: backup >= 0 ? BACKUP_C_WEIGHT * backupContrib : -BACKUP_C_MISSING };
  const rotFull = rotation.length >= ctx.sp;
  return {
    value: parts.lineup + parts.rotation + parts.pen + parts.bench + parts.backup,
    parts, R: R.slots, L: L.slots, rotation, pen, bench, backup,
    incR, incL, mvR, mvL, benchMin, benchFull, backupContrib,
    rotMin: rotFull ? E.rotKey[rotation[rotation.length - 1]] : 0, rotFull, rotMinIdx: rotFull ? rotation[rotation.length - 1] : -1,
    penMin: pen.length >= ctx.rp ? E.penC[pen[pen.length - 1]] : 0, penFull: pen.length >= ctx.rp,
  };
}

/**
 * What adding one card is worth to a planned team, read fast: the best spot
 * it takes on each board over the card there, with that man moving to his
 * own best other spot (one step: a shortstop bumped to DH), or the rotation
 * or pen slot it takes, the starter it bumps going to the pen.
 */
export function quickGain(E: Engine, i: number, plan: Plan): number {
  const { ctx } = E;
  const c = E.cards[i];
  if (c.isPitcher) {
    const penEntry = (runsOver: number) => ctx.rpW * Math.max(0, runsOver - (plan.penFull ? plan.penMin : 0));
    let g = penEntry(E.penC[i]);
    if (c.role === "SP" && E.rotKey[i] > 0) {
      if (!plan.rotFull) g = Math.max(g, E.rotKey[i]);
      else if (E.rotKey[i] > plan.rotMin) {
        // The starter he bumps goes to the pen.
        g = Math.max(g, E.rotKey[i] - plan.rotMin + penEntry(E.penC[plan.rotMinIdx]));
      }
    }
    return g;
  }
  const r = E.cR[i], l = E.cL[i];
  let bestR = 0, bestL = 0, atC = false;
  for (let k = 0; k < r.length; k++) {
    const gr = r[k] - plan.incR[k] + plan.mvR[k];
    if (gr > bestR) { bestR = gr; atC = k === 0; }
    const gl = l[k] - plan.incL[k] + plan.mvL[k];
    if (gl > bestL) bestL = gl;
  }
  let g = (1 - ctx.lhp) * bestR + ctx.lhp * bestL;
  if (bestR <= 0) g += ctx.benchW * Math.max(0, E.benchC[i] - (plan.benchFull ? plan.benchMin : 0));
  const cc = E.catchC[i];
  if (!Number.isNaN(cc)) {
    // A second man who can catch ends the no-backup charge, whichever of the two starts.
    if (plan.backup < 0 && plan.R[0] >= 0) g += BACKUP_C_MISSING + BACKUP_C_WEIGHT * Math.max(0, atC ? E.catchC[plan.R[0]] : cc);
    else if (!atC) g += BACKUP_C_WEIGHT * Math.max(0, cc - plan.backupContrib);
  }
  return g;
}

/* ------------------------------------------------------- the rounds left */

/**
 * The expected best of a pack of `n` cards drawn without replacement from a
 * pool whose values are `desc` (sorted high to low). The k-th best card is
 * the pack's best with probability C(P-k, n-1) / C(P, n).
 */
export function expectedBestOfN(desc: readonly number[], n: number): number {
  const P = desc.length;
  if (!P) return 0;
  if (n >= P) return desc[0];
  let p = n / P, e = 0;
  for (let k = 1; k <= P - n + 1; k++) {
    e += p * desc[k - 1];
    p *= (P - k - n + 1) / (P - k);
  }
  return e;
}

/**
 * Card indices a round of this kind can show, for one group or all of its
 * groups, leaving out players already taken and, unless asked for, the cards
 * taken to be out of the pool (Engine.absent).
 */
export function poolOf(E: Engine, tier: Tier, groups: readonly DraftGroup[], taken: ReadonlySet<string | number>, withAbsent = false): number[] {
  const out: number[] = [];
  for (const g of groups) {
    for (const i of E.pools.get(`${tier}|${g}`) ?? []) {
      const c = E.cards[i];
      if (!taken.has(c.player ?? c.id) && (withAbsent || !E.absent[i])) out.push(i);
    }
  }
  return out;
}

export interface ExpectedPick { idx: number; ev: number; group: DraftGroup }

/**
 * The card a pack from this pool is expected to give, standing in for it in
 * the rounds after. `ev` is the expected best of n gains. The stand-in comes
 * from the group holding the largest share of that expectation (each card's
 * gain × its chance of being the pack's best), nearest that group's own
 * expected best: in a mixed Gold pack a dozen cards at five positions sit
 * near the expected gain, and picking among them by a hair would move the
 * team's needs, and every round after, at random.
 */
function expectedFrom(E: Engine, pool: readonly number[], plan: Plan, n: number): { idx: number; ev: number } | null {
  if (!pool.length) return null;
  const scored = pool.map((i) => ({ i, g: quickGain(E, i, plan) })).sort((a, b) => b.g - a.g || a.i - b.i);
  const P = scored.length;
  const share = new Map<DraftGroup, { gp: number; p: number }>();
  let ev = 0;
  if (n >= P) {
    ev = scored[0].g;
    share.set(E.cards[scored[0].i].group, { gp: ev, p: 1 });
  } else {
    let p = n / P;
    for (let k = 1; k <= P - n + 1; k++) {
      const s = scored[k - 1], g = E.cards[s.i].group;
      ev += p * s.g;
      const cur = share.get(g) ?? { gp: 0, p: 0 };
      cur.gp += p * s.g; cur.p += p;
      share.set(g, cur);
      p *= (P - k - n + 1) / (P - k);
    }
  }
  let best: DraftGroup | null = null;
  for (const [g, v] of share) if (!best || v.gp > share.get(best)!.gp) best = g;
  const target = best && share.get(best)!.p > 0 ? share.get(best)!.gp / share.get(best)!.p : ev;
  let pick = -1, gap = Infinity;
  for (const s of scored) {
    if (best && E.cards[s.i].group !== best) continue;
    const d = Math.abs(s.g - target);
    if (d < gap) { gap = d; pick = s.i; }
  }
  return { idx: pick >= 0 ? pick : scored[0].i, ev };
}

export interface PlayOptions {
  packSize: number;
  /** Pack kind by round key, over the format's (the page's 5L switch). */
  packKinds?: Record<string, PackKind>;
}

export const kindOf = (r: RoundKind, o: PlayOptions): PackKind => o.packKinds?.[r.key] ?? r.pack;

/** One round's expected pick for this team: a pick-a-position round takes the group with the best expected pack. */
export function expectedPick(E: Engine, r: RoundKind, plan: Plan, taken: ReadonlySet<string | number>, o: PlayOptions): ExpectedPick | null {
  if (kindOf(r, o) === "choose") {
    let best: ExpectedPick | null = null;
    for (const g of r.groups) {
      const e = expectedFrom(E, poolOf(E, r.tier, [g], taken), plan, o.packSize);
      if (e && (!best || e.ev > best.ev)) best = { ...e, group: g };
    }
    return best;
  }
  const e = expectedFrom(E, poolOf(E, r.tier, r.groups, taken), plan, o.packSize);
  return e ? { ...e, group: E.cards[e.idx].group } : null;
}

/** Players on a team, the key packs leave out. */
export const takenOf = (E: Engine, team: readonly number[]): Set<string | number> =>
  new Set(team.map((i) => E.cards[i].player ?? E.cards[i].id));

/** The rounds left in play-out order: position-locked rounds first, then the open ones (the real order is not on file). */
export function playOrder(f: DraftFormat, rem: Remaining, o: PlayOptions): RoundKind[] {
  const out: RoundKind[] = [];
  const add = (fixed: boolean) => {
    for (const r of f.rounds) if ((kindOf(r, o) === "fixed") === fixed) for (let k = 0; k < (rem[r.key] ?? 0); k++) out.push(r);
  };
  add(true); add(false);
  return out;
}

export interface Playout {
  team: number[];
  plan: Plan;
  /** The cards the rounds left are expected to bring, with the round each came from. */
  expected: { idx: number; round: string; ev: number }[];
  /**
   * The finished team's expected value: the picks made, exactly, plus each
   * round left's expected best-of-pack gain. The stand-in cards set what the
   * team still needs; their own luck (one plays a second position, one
   * doesn't) is not counted, so it can't reorder the candidates.
   */
  value: number;
}

/** The team these picks finish as, the rounds left played out in expectation. */
export function playOut(E: Engine, f: DraftFormat, team0: readonly number[], rem: Remaining, o: PlayOptions): Playout {
  const team = [...team0];
  const taken = takenOf(E, team);
  let plan = teamPlan(E, team);
  let value = plan.value;
  const expected: Playout["expected"] = [];
  for (const r of playOrder(f, rem, o)) {
    const pick = expectedPick(E, r, plan, taken, o);
    if (!pick) continue;
    value += pick.ev;
    team.push(pick.idx);
    taken.add(E.cards[pick.idx].player ?? E.cards[pick.idx].id);
    expected.push({ idx: pick.idx, round: r.key, ev: pick.ev });
    plan = teamPlan(E, team);
  }
  return { team, plan, expected, value };
}

/* ---------------------------------------------------------- the advice */

export interface Candidate {
  idx: number;
  /** The finished team's value with this pick, the rounds left played out. */
  score: number;
  /** Against the best other candidate: + for the top pick (its lead), - for the rest (how far behind). */
  delta: number;
  /** Against the pick a typical pack of this round gives. */
  overTypical: number;
  /** Where the finished team uses him. */
  use: string;
  /** Scored by a full play-out (else the quick read, for the long tail of the board). */
  exact: boolean;
}

export interface Advice {
  round: RoundKind;
  group: DraftGroup | null;
  /** Ranked best first. */
  rows: Candidate[];
  /** The typical pick of this round and the finished team's value with it. */
  typical: { idx: number; score: number } | null;
  /** Pick-a-position rounds: each group's pack, its expected gain to the finished team and against the best group's; idx is a card like its expected best. */
  groups: { group: DraftGroup; ev: number; delta: number; idx: number }[];
  /** The finished team with the round's typical pick. */
  baseline: Playout;
}

/**
 * Where the plan uses a card: "SS vR/vL", "C vL", "SP2", "pen", "bench", "backup C", or "spare".
 * Not named use…: React Refresh would take its callers for hooks, and the worker has no refresh runtime.
 */
export function spotOf(E: Engine, plan: Plan, i: number): string {
  const r = plan.R.indexOf(i), l = plan.L.indexOf(i);
  if (r >= 0 || l >= 0) {
    if (r >= 0 && l >= 0) return E.lineup[r] === E.lineup[l] ? `${E.lineup[r]} vR/vL` : `${E.lineup[r]} vR · ${E.lineup[l]} vL`;
    return r >= 0 ? `${E.lineup[r]} vR` : `${E.lineup[l]} vL`;
  }
  const s = plan.rotation.indexOf(i);
  if (s >= 0) return `SP${s + 1}`;
  const p = plan.pen.indexOf(i);
  if (p >= 0) return p === 0 ? "closer" : "pen";
  if (plan.backup === i) return "backup C";
  if (plan.bench.includes(i)) return "bench";
  return "spare";
}

export interface AdviseInput {
  format: DraftFormat;
  /** Card indices drafted so far. */
  team: readonly number[];
  /** Rounds left, the current one included. */
  rem: Remaining;
  round: RoundKind;
  /** In a pick-a-position round, the group whose pack is open. */
  group?: DraftGroup | null;
  /** The cards in the pack, when entered; else the round's whole pool is ranked. */
  pack?: readonly number[];
  play: PlayOptions;
  exactCount?: number;
}

export function advise(E: Engine, a: AdviseInput): Advice {
  const { round, play } = a;
  const remAfter: Remaining = { ...a.rem, [round.key]: Math.max(0, (a.rem[round.key] ?? 0) - 1) };
  const taken = takenOf(E, a.team);
  const score = (idx: number) => {
    const p = playOut(E, a.format, [...a.team, idx], remAfter, play);
    return { score: p.value, playout: p };
  };

  // The finished team without this round's pick, to read each card's quick gain against.
  const rest = playOut(E, a.format, a.team, remAfter, play);
  const groupsOpen = a.group ? [a.group] : round.groups;
  const pool = a.pack?.length ? [...a.pack] : poolOf(E, round.tier, groupsOpen, taken, true);

  // What a typical pack of this round gives (in a pick-a-position round, from the best group to open).
  const typicalPick = a.group
    ? (() => { const e = expectedFrom(E, poolOf(E, round.tier, [a.group], taken), rest.plan, play.packSize); return e ? { ...e, group: a.group } : null; })()
    : expectedPick(E, round, rest.plan, taken, play);

  const quick = pool.map((i) => ({ i, g: quickGain(E, i, rest.plan) })).sort((x, y) => y.g - x.g || x.i - y.i);
  const exactN = a.pack?.length ? quick.length : Math.min(quick.length, a.exactCount ?? EXACT_CANDIDATES);
  const scored = new Map<number, { score: number; playout: Playout }>();
  for (const q of quick.slice(0, exactN)) scored.set(q.i, score(q.i));
  if (typicalPick && !scored.has(typicalPick.idx)) scored.set(typicalPick.idx, score(typicalPick.idx));
  const typical = typicalPick ? { idx: typicalPick.idx, score: scored.get(typicalPick.idx)!.score } : null;
  const baseline = typicalPick ? scored.get(typicalPick.idx)!.playout : rest;

  // The long tail keeps its quick read, on the same scale: the baseline team plus its gain.
  const rows: Candidate[] = quick.map((q) => {
    const s = scored.get(q.i);
    const plan = s?.playout.plan;
    return {
      idx: q.i, score: s ? s.score : rest.value + q.g, delta: 0, overTypical: 0,
      use: plan ? spotOf(E, plan, q.i) : "", exact: !!s,
    };
  });
  rows.sort((x, y) => y.score - x.score || x.idx - y.idx);
  const top = rows[0]?.score ?? 0, second = rows[1]?.score ?? top;
  for (const [k, r] of rows.entries()) {
    r.delta = k === 0 ? top - second : r.score - top;
    r.overTypical = typical ? r.score - typical.score : 0;
  }

  /*
   * Pick-a-position: what each group's pack is expected to add, before it is
   * seen: the expected best of N gains over the finished team the other rounds
   * are expected to bring. An expectation over the whole pack, not one card's
   * play-out, so a lucky or unlucky stand-in card can't reorder the groups.
   */
  const groups: Advice["groups"] = [];
  if (kindOf(round, play) === "choose" && !a.group) {
    for (const g of round.groups) {
      const e = expectedFrom(E, poolOf(E, round.tier, [g], taken), rest.plan, play.packSize);
      if (e) groups.push({ group: g, ev: e.ev, delta: 0, idx: e.idx });
    }
    groups.sort((x, y) => y.ev - x.ev);
    for (const g of groups) g.delta = g.ev - (groups[0]?.ev ?? 0);
  }

  return { round, group: a.group ?? null, rows, typical, groups, baseline };
}

/* ------------------------------------------------- what the page shows */

/** A plan as the page draws it: card indices only (-1 = nobody), no typed arrays. */
export interface PlanView {
  value: number;
  parts: Plan["parts"];
  R: number[];
  L: number[];
  rotation: number[];
  pen: number[];
  bench: number[];
  backup: number;
}

export interface DraftView {
  /** The round advised on, or null when only the finish was asked for. */
  round: string | null;
  rows: Candidate[];
  typical: Advice["typical"];
  groups: Advice["groups"];
  /** The team these picks finish as, the rounds left played out: its plan and the cards expected to fill it. */
  finish: { value: number; plan: PlanView; expected: Playout["expected"] };
  ms: number;
}

export interface ViewInput {
  format: DraftFormat;
  team: number[];
  rem: Remaining;
  /** The round kind on screen; null to play out the finish alone. */
  round: string | null;
  group: DraftGroup | null;
  pack: number[];
  play: PlayOptions;
  /** Board rows kept for the page (pack rows are always kept). */
  keep?: number;
}

const planView = (p: Plan): PlanView => ({
  value: p.value, parts: p.parts, R: [...p.R], L: [...p.L], rotation: [...p.rotation], pen: [...p.pen], bench: [...p.bench], backup: p.backup,
});

/** Everything the live page shows for one state of a draft. Pure; the worker and the fallback both call it. */
export function draftView(E: Engine, v: ViewInput, now: () => number = () => Date.now()): DraftView {
  const t0 = now();
  const round = v.round ? v.format.rounds.find((r) => r.key === v.round && (v.rem[r.key] ?? 0) > 0) ?? null : null;
  if (!round) {
    const p = playOut(E, v.format, v.team, v.rem, v.play);
    return { round: null, rows: [], typical: null, groups: [], finish: { value: p.value, plan: planView(p.plan), expected: p.expected }, ms: now() - t0 };
  }
  const a = advise(E, { format: v.format, team: v.team, rem: v.rem, round, group: v.group, pack: v.pack, play: v.play });
  // The finish shown is the one with the round's typical pick still to come: the picks so far, the rest expected.
  const p = playOut(E, v.format, v.team, v.rem, v.play);
  return {
    round: round.key, rows: v.pack.length ? a.rows : a.rows.slice(0, v.keep ?? 40), typical: a.typical, groups: a.groups,
    finish: { value: p.value, plan: planView(p.plan), expected: p.expected }, ms: now() - t0,
  };
}
