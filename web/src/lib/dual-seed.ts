/**
 * The seeds env-roster's dual phase climbs from: the best board with one
 * two-way card (lib/two-way) put in both roles, his arm in the rotation and
 * his bat on the roster, one roster spot and one tier slot (unitOf).
 *
 * L.J., 2026-10-31: Ed Rile, "crushing bat at 1B and full on SP". The phase
 * seeded each top two-way card onto the best board and climbed. In a slots or
 * cap event that seed can break the rules outright, and the climb cannot walk
 * out of an illegal start: on Daily Silver & Friends Slots (2026-11-14) the one
 * Perfect slot was Alex Rodriguez's, so every Rile seed carried two Perfect
 * cards and the log read "no legal board" without the two-way option ever being
 * compared. The fix: when the seed breaks the cap, the tier slots or the variant
 * cap, a card holding what the rule needs gives way to one of his that fits
 * (positions re-solved around the newcomer), up to three times, and the best
 * few legal seeds are climbed.
 *
 * Pure; env-roster runs it.
 */
import { maxAssignment } from "./assign";
import { posFloorAt, type PosFloor } from "./pos-floor";
import type { FillCard, FillResult, FillShape } from "./roster-fill";
import { candidatesFor } from "./roster-optimize";
import { cardEligibility, tierCode, TIER_ORDER, type RosterRules } from "./roster-rules";
import { otherFormId, unitOf } from "./two-way";

export interface DualSeedInput {
  /** The best board so far, in the event's own shape. */
  board: FillResult;
  /** The two-way card's bat form (a pool id); his arm is its other form. */
  bat: number;
  pool: readonly FillCard[];
  rules: RosterRules;
  shape: FillShape;
  /** `shape` with one more bench slot: the roster spot one card in both roles frees. */
  dshape: FillShape;
  /** The dual shape's objective (roster-objective): its slot values place the seed, its total ranks repairs. */
  slotValue: (key: string, id: number) => number;
  objective: (slots: FillResult) => number;
  posFloor?: PosFloor;
  minDefShare?: number;
  /** Catchers / shortstops the climb requires (a repair must not leave fewer). */
  minCatchers?: number;
  minShortstops?: number;
  /** How many repaired seeds to hand back when the plain seed breaks a rule (default 2). */
  repairs?: number;
}

export interface DualSeed {
  slots: FillResult;
  /** "as seeded", or the moves that made room ("Alex Rodriguez (102) out for CJ Abrams (78)"). */
  note: string;
}

const TIERS_TOP_DOWN = [...TIER_ORDER].reverse();
const owned = (c: FillCard) => (c.variant ? c.variantOwned : c.baseOwned);

/**
 * How far a board is over the event's tier slots, value cap and variant cap,
 * a two-way card in both roles counted once: 0 when it holds. Tier slots weigh
 * most (a card over), then variants, then cap points.
 */
export function rulesExcess(slots: FillResult, byId: ReadonlyMap<number, FillCard>, rules: RosterRules): number {
  const rx = rules.restrictions;
  const units = new Map<number, FillCard>();
  for (const id of Object.values(slots)) { const c = byId.get(id); if (c && !units.has(unitOf(id))) units.set(unitOf(id), c); }
  let out = 0;
  if (rx?.slots) {
    const tiers: Record<string, number> = {};
    for (const c of units.values()) if (c.val != null) { const t = tierCode(c.val); tiers[t] = (tiers[t] ?? 0) + 1; }
    // Cards over at the worst tier, counting down from the top (lower cards may fill higher slots).
    let cards = 0, room = 0, worst = 0;
    for (const t of TIERS_TOP_DOWN) { cards += tiers[t] ?? 0; room += rx.slots[t] ?? 0; worst = Math.max(worst, cards - room); }
    out += 100_000 * worst;
  }
  const variantLimit = rx?.variantsAllowed === false ? 0 : rx?.variantCap ?? Infinity;
  const variants = [...units.values()].filter((c) => c.variant).length;
  if (variants > variantLimit) out += 1_000 * (variants - variantLimit);
  if (rx?.teamCap != null) {
    let sum = 0;
    for (const c of units.values()) sum += c.val ?? 0;
    out += Math.max(0, sum - rx.teamCap);
  }
  return out;
}

/** The seeds to climb for this two-way card, best first; `why` says what went wrong when there are none. */
export function dualSeeds(a: DualSeedInput): { seeds: DualSeed[]; why: string | null } {
  const { board, bat, pool, rules, shape, dshape, slotValue, objective } = a;
  const arm = otherFormId(bat);
  const byId = new Map(pool.map((c) => [c.cardId, c]));
  const excess = (sl: FillResult) => rulesExcess(sl, byId, rules);
  const playable = (c: FillCard) => owned(c) && !cardEligibility(c, rules).errors.length;
  const nk = dshape.benchKeys[dshape.benchKeys.length - 1]!;
  const nameOf = (id: number) => byId.get(id)?.name ?? String(id);

  /* ------------------------------------------------ the plain seed (as before) */
  const seed: FillResult = { ...board };
  const on = new Set(Object.values(seed));
  if (!on.has(arm)) {
    if (!shape.spKeys.length) return { seeds: [], why: "no rotation to put his arm in" };
    const k = shape.spKeys.reduce((w, x) => (slotValue(x, seed[x]!) < slotValue(w, seed[w]!) ? x : w));
    seed[k] = arm;
  }
  if (!on.has(bat)) seed[nk] = bat;
  else {
    // His bat is already on the roster: the freed spot takes the best unrostered bat, one that fits the rules if any does.
    const units = new Set(Object.values(seed).map(unitOf));
    const fill = pool.filter((h) => !h.isPitcher && !units.has(unitOf(h.cardId)) && playable(h))
      .sort((x, y) => slotValue(nk, y.cardId) - slotValue(nk, x.cardId) || (x.val ?? 0) - (y.val ?? 0));
    const h = fill.find((x) => excess({ ...seed, [nk]: x.cardId }) === 0) ?? fill[0];
    if (!h) return { seeds: [], why: "no bat for the roster spot he frees" };
    seed[nk] = h.cardId;
  }
  // Over the cap or a tier's slots (Rile's 102 onto a full 1500): trade the dearest bench bats
  // down to the cheapest unrostered bats while that helps.
  for (let tries = 0; tries < 8 && excess(seed) > 0; tries++) {
    const units = new Set(Object.values(seed).map(unitOf));
    const benchKey = dshape.benchKeys.filter((k) => seed[k] != null && unitOf(seed[k]!) !== unitOf(bat))
      .sort((x, y) => (byId.get(seed[y]!)?.val ?? 0) - (byId.get(seed[x]!)?.val ?? 0))[0];
    if (!benchKey) break;
    const cheap = pool.filter((h) => !h.isPitcher && !units.has(unitOf(h.cardId)) && playable(h))
      .sort((x, y) => (x.val ?? 0) - (y.val ?? 0) || slotValue(benchKey, y.cardId) - slotValue(benchKey, x.cardId))[0];
    if (!cheap || (cheap.val ?? 0) >= (byId.get(seed[benchKey]!)?.val ?? 0)) break;
    const t = { ...seed, [benchKey]: cheap.cardId };
    if (excess(t) >= excess(seed)) break;
    Object.assign(seed, t);
  }
  if (excess(seed) === 0) return { seeds: [{ slots: seed, note: "as seeded" }], why: null };

  /* ------------------------------------------------ making room (2026-11-14) */
  const keys = [
    ...dshape.lineupPos.map((p) => `R:${p}`), ...dshape.lineupPos.map((p) => `L:${p}`),
    ...dshape.spKeys, ...dshape.rpKeys, ...dshape.benchKeys,
  ];
  const eligible = new Map(keys.map((k) => [k, new Set(candidatesFor(k, pool, rules, a.minDefShare ?? 0, a.posFloor).map((c) => c.cardId))]));
  const rRows = [...dshape.lineupPos.map((p) => `R:${p}`), ...dshape.benchKeys];
  const lRows = dshape.lineupPos.map((p) => `L:${p}`);
  /** Both boards' positions solved over the hitters on `t` (as the climb's re-solve); null when they can't all be covered. */
  const resolve = (t: FillResult): FillResult | null => {
    const hitters = [...new Set([...rRows, ...lRows].map((k) => t[k]).filter((id): id is number => id != null && byId.get(id)?.isPitcher === false))];
    const out = { ...t };
    for (const rows of [rRows, lRows]) {
      if (!rows.length) continue;
      if (rows.length > hitters.length) return null;
      const w = rows.map((k) => hitters.map((id) => (eligible.get(k)?.has(id) ? slotValue(k, id) : -Infinity)));
      const pick = maxAssignment(w);
      if (!pick || rows.some((_, i) => !Number.isFinite(w[i][pick[i]]))) return null;
      rows.forEach((k, i) => { out[k] = hitters[pick[i]]; });
    }
    return out;
  };
  const cFloor = Math.max(1, posFloorAt(a.posFloor, "C")), ssFloor = Math.max(1, posFloorAt(a.posFloor, "SS"));
  const count = (t: FillResult, pos: string, floor: number) => [...new Set(Object.values(t))].filter((id) => {
    const c = byId.get(id);
    return c && !c.isPitcher && (c.ratings[`Pos Rating ${pos}`] ?? 0) >= floor;
  }).length;
  const keepsMinimums = (t: FillResult) => count(t, "C", cFloor) >= (a.minCatchers ?? 0) && count(t, "SS", ssFloor) >= (a.minShortstops ?? 0);

  /** Every card (not him) giving way to one of his off the roster, each board kept only when it is nearer the rules. */
  const giveWay = (from: FillResult) => {
    const ex0 = excess(from);
    const onBoard = new Set(Object.values(from));
    const unitsOn = new Set([...onBoard].map(unitOf));
    const out: { slots: FillResult; ex: number; score: number; note: string }[] = [];
    for (const y of unitsOn) {
      if (y === unitOf(bat)) continue;
      const yKeys = keys.filter((k) => from[k] != null && unitOf(from[k]!) === y);
      const yId = from[yKeys[0]!]!, yCard = byId.get(yId);
      if (!yCard) continue;
      const players = new Set([...onBoard].filter((id) => unitOf(id) !== y).map((id) => byId.get(id)?.player).filter((p): p is string => !!p));
      const kind = yCard.isPitcher;
      const zs = pool.filter((z) => z.isPitcher === kind && !unitsOn.has(unitOf(z.cardId)) && playable(z) && !(z.player && players.has(z.player))
        && (!kind || yKeys.every((k) => eligible.get(k)?.has(z.cardId))));
      // Cheapest test first: the values alone must come nearer the rules.
      const valueOnly = (z: FillCard) => { const t = { ...from }; for (const k of yKeys) t[k] = z.cardId; return excess(t); };
      const est = (z: FillCard) => yKeys.reduce((s, k) => s + slotValue(eligible.get(k)?.has(z.cardId) ? k : nk, z.cardId), 0);
      let built = 0;
      for (const z of zs.filter((z) => valueOnly(z) < ex0).sort((p, q) => est(q) - est(p))) {
        if (built >= 6) break;
        let t: FillResult | null = { ...from };
        for (const k of yKeys) t[k] = z.cardId;
        if (!kind) t = resolve(t);
        if (!t || !keepsMinimums(t)) continue;
        const ex = excess(t);
        if (ex >= ex0) continue;
        built++;
        out.push({ slots: t, ex, score: objective(t), note: `${yCard.name} (${yCard.val ?? "?"}) out for ${z.name}${z.variant ? " (VAR)" : ""} (${z.val ?? "?"})` });
      }
    }
    return out;
  };

  const want = a.repairs ?? 2;
  let frontier: { slots: FillResult; note: string }[] = [{ slots: seed, note: "" }];
  for (let step = 0; step < 3; step++) {
    const next: { slots: FillResult; ex: number; score: number; note: string }[] = [];
    for (const f of frontier) for (const g of giveWay(f.slots)) next.push({ ...g, note: f.note ? `${f.note}; ${g.note}` : g.note });
    if (!next.length) break;
    const done = next.filter((n) => n.ex === 0).sort((p, q) => q.score - p.score);
    if (done.length) {
      const seen = new Set<string>();
      const seeds: DualSeed[] = [];
      for (const d of done) {
        const sig = [...new Set(Object.values(d.slots))].sort((x, y) => x - y).join(",");
        if (seen.has(sig)) continue;
        seen.add(sig);
        seeds.push({ slots: d.slots, note: d.note });
        if (seeds.length >= want) break;
      }
      return { seeds, why: null };
    }
    // Nearest the rules first, then the best: a cap a card can't clear alone takes two.
    frontier = next.sort((p, q) => p.ex - q.ex || q.score - p.score).slice(0, 2).map((n) => ({ slots: n.slots, note: n.note }));
  }
  return { seeds: [], why: `the seed breaks the event's rules and no card of his giving way (three at most) makes room for ${nameOf(bat)}` };
}
