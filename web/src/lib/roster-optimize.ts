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

import { cardEligibility, rosterSize, samePlayer, slotCapacityIssues, tierCode, type RosterRules } from "./roster-rules";
import { LONG_MAN_STAMINA } from "./roster-audit";
import { posFloorAt, type PosFloor } from "@/lib/pos-floor";
import { isComplete, type FillCard, type FillResult, type FillShape } from "./roster-fill";
import { maxAssignment } from "./assign";
import { dualUseOk, unitOf } from "./two-way";

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
  /**
   * The objective's exact per-slot value (RosterObjective.slotValue). With it,
   * the search also re-solves both boards' positions as an assignment
   * (assign.ts): at the start, after every accepted move, and after every
   * single move that brings a new hitter onto the roster. Swap moves change
   * one or two slots, so a board needing a three-way reshuffle — the best bat
   * on the bench because moving him in means moving two others — was a local
   * optimum they could not leave (Negro Leagues Slots, 2026-09-26: Josh
   * Gibson benched vs RHP at +39.5; the same cards reassigned score higher).
   */
  slotValue?: (key: string, cardId: number) => number;
  /**
   * Cards that survive `candidateLimit` pruning in every slot they can play —
   * the ones the user locked onto the roster. A locked bat outside each slot's
   * top N by rank was invisible to the pruned search (Pete Incaviglia,
   * Saturday Bronze Cap 2026-09-26: the full pool found him, the pruned one
   * could not), so the must-carry penalty had nothing it could act on.
   */
  keep?: ReadonlySet<number>;
  /**
   * Carry at least this many catchers (hitters rated at or above the C floor),
   * wherever they sit. Not a game rule — L.J. always carries two so a catcher
   * can come off the bench (2026-09-26), and without it the search happily
   * fills every bench seat with a better bat.
   */
  minCatchers?: number;
  /**
   * Carry at least this many shortstops (hitters rated at or above the SS
   * floor): a backup SS, so the starter can rest. L.J., 2026-10-04: "no back
   * up SS ... literally Banks never rests."
   */
  minShortstops?: number;
  /**
   * Pen arms (CL/RP slots) with stamina at or above LONG_MAN_STAMINA the
   * roster must carry. L.J., 2026-10-04: "you would be dumb to only use RPs
   * in bullpen, need some stam guys."
   */
  minLongMen?: number;
  /**
   * A true backup at every fielding position, against each hand: a hitter who
   * doesn't start in the field on that board (missingBackups), wherever the
   * pool has two who can play it. L.J., 2026-10-04: "you have to know ...
   * backups, etc."; 2026-10-17: "a ton of backup outfield, but not infield".
   * Scored as a penalty (BACKUP_PENALTY a missing position and hand) rather
   * than a legality rule, so a board missing backups can still climb to one
   * missing none a swap at a time.
   */
  backups?: boolean;
  /**
   * When the climb stops, try the staff tier before giving up: the staff re-solved (who starts,
   * who relieves, in what order) around a new arm, and the cross-role moves only that makes
   * possible (staffTier below). Needs slotValue. Off by default: it is a polish for a search's
   * best boards. Every start climbing on through it found the same best board on Saturday Bronze
   * Cap (2026-11-07) for 36% more CPU; env-roster's polish of its best 3 costs about 11%.
   */
  staffTier?: boolean;
  /**
   * The start is already where the plain moves stop (env-roster's polish climbs its own climbs'
   * boards again, with the same moves): the first pass goes straight to the staff tier instead of
   * searching every single move and pair again for nothing.
   */
  atOptimum?: boolean;
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
  /** Whether the start and the result pass every rule the search enforces. */
  startLegal: boolean;
  legal: boolean;
  /** Positions and hands ("2B vR") still without a bench backup when `backups` was asked for (the pool had two who could play it). */
  missingBackups: string[];
}

/** Runs the search gives up to carry a backup at a position — more than any bench bat is worth. */
export const BACKUP_PENALTY = 25;
const FIELD_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export interface BackupPosition { pos: string; floor: number; can: FillCard[] }

const usable = (c: FillCard, rules: RosterRules) => (c.variant ? c.variantOwned : c.baseOwned) && !cardEligibility(c, rules).errors.length;

/**
 * The glove a backup needs in a cap event: 60, not the starter's floor.
 * L.J., 2026-10-31 (Early Years Cap held three 46-47 bench cards only because
 * a backup had to clear SS 85 / CF 90 / 2B 85): "you generally want to find a
 * low value backup IF and backup OF that covers multiple positions". Measured
 * the same day over 1,770 teams in 11 cap series (Tourney Data/Cap Exports):
 * the best quarter carries a backup C, an IF utility man and an OF utility man
 * more often than the rest, each at a median of +1 over the floor value, rated
 * 60+ at the spots they cover. A backup plays a game or two; the cap he would
 * cost to clear a starter's floor buys a starter.
 */
export const CAP_BACKUP_FLOOR = 60;

/** The glove floor a backup at `pos` must clear: the starter's floor, capped at CAP_BACKUP_FLOOR in a cap or slots event. */
export function backupFloorAt(rules: RosterRules, posFloor: PosFloor | undefined, pos: string): number {
  const f = Math.max(1, posFloorAt(posFloor, pos));
  // A slots event (Championship Cap: P4 D4 G4 S4 B4 I6) rations cards the same way: a backup
  // built to a starter's floor takes a better tier's slot.
  const rationed = rules.restrictions?.teamCap != null || rules.restrictions?.slots != null;
  return rationed ? Math.min(f, CAP_BACKUP_FLOOR) : f;
}

/** The fielding positions this pool can cover twice (owned, eligible hitters at or above the backup floor). */
export function backupPositions(pool: readonly FillCard[], rules: RosterRules, posFloor?: PosFloor): BackupPosition[] {
  return FIELD_POS.map((pos) => {
    const floor = backupFloorAt(rules, posFloor, pos);
    const can = pool.filter((c) => !c.isPitcher && (c.ratings[`Pos Rating ${pos}`] ?? 0) >= floor && usable(c, rules));
    return { pos, floor, can };
  }).filter((b) => new Set(b.can.map((c) => c.cardId)).size >= 2);
}

/** In a cap event, the value of the cheapest card the pool can field: the floor. Null without a team cap. */
export function capFloorValue(pool: readonly FillCard[], rules: RosterRules): number | null {
  if (rules.restrictions?.teamCap == null) return null;
  let min = Infinity;
  for (const c of pool) if (c.val != null && usable(c, rules) && c.val < min) min = c.val;
  return Number.isFinite(min) ? min : null;
}

/** How many long men (pen arms at LONG_MAN_STAMINA+) the board is short of `want`. */
export function longMenShort(slots: FillResult, byId: ReadonlyMap<number, FillCard>, want: number): number {
  if (!want) return 0;
  let long = 0;
  for (const [key, id] of Object.entries(slots)) if ((key === "CL" || /^RP\d/.test(key)) && (byId.get(id)?.ratings.Stamina ?? 0) >= LONG_MAN_STAMINA) long++;
  return Math.max(0, want - long);
}

/**
 * Of `positions`, those a board can't cover from its bench, as "2B vR" / "2B vL".
 *
 * A backup is a hitter who doesn't start in the field against that hand, rated
 * at or above the floor there: the bench, the other hand's platoon starters,
 * or the DH (he moves out and a bench bat takes the DH). Two starters who can
 * each play 2B are not each other's backup: resting one moves the other off
 * his own spot (L.J., 2026-10-17: Goldfather II had five bench outfielders and
 * Polanco's backup was the 3B, whose backup was the catcher). One utility card
 * covers every spot he can play, which is what makes those cards worth a
 * bench seat.
 */
export function missingBackups(slots: FillResult, byId: ReadonlyMap<number, FillCard>, positions: readonly BackupPosition[]): string[] {
  if (!positions.length) return [];
  const hitters = [...new Set(Object.values(slots))].map((id) => byId.get(id)).filter((c): c is FillCard => c != null && !c.isPitcher);
  const out: string[] = [];
  for (const hand of ["R", "L"] as const) {
    const fielding = new Set(FIELD_POS.map((p) => slots[`${hand}:${p}`]).filter((id) => id != null));
    for (const b of positions) {
      if (!hitters.some((c) => !fielding.has(c.cardId) && (c.ratings[`Pos Rating ${b.pos}`] ?? 0) >= b.floor)) out.push(`${b.pos} v${hand}`);
    }
  }
  return out;
}

/**
 * Every rule fillOnce enforces, checked against a whole candidate roster.
 *
 * `byId` is passed in rather than built here: the pair-move search calls this a
 * few hundred thousand times a pass, and rebuilding a 276-entry Map inside it
 * was the entire runtime.
 */
function legal(
  slots: FillResult, byId: Map<number, FillCard>, rules: RosterRules, shape: FillShape, minPlayers = 0,
  minCatchers = 0, catcherFloor = 1, minShortstops = 0, ssFloor = 1, minLongMen = 0,
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
  const members = [...ids].map((id) => byId.get(id)).filter((c): c is FillCard => c != null);
  if (members.length !== ids.size) return false;
  // A two-way card in both roles is one card on the roster (two-way unitOf): roster size,
  // value, variants and tier slots count it once.
  const unitMap = new Map<number, FillCard>();
  for (const m of members) if (!unitMap.has(unitOf(m.cardId))) unitMap.set(unitOf(m.cardId), m);
  const units = [...unitMap.values()];
  if (units.length > size || units.length < minPlayers) return false;
  if (units.length !== members.length && !dualUseOk(slots)) return false;
  if (samePlayer(units)) return false; // one card per player
  // The copy on the board must be one L.J. owns. candidatesFor already keeps
  // unowned forms out of every move; this stops one that was on the STARTING
  // board (a saved roster naming the base copy of a variant-only card) from
  // riding through the whole search untouched.
  if (members.some((m) => (m.variant ? !m.variantOwned : !m.baseOwned))) return false;
  if (minCatchers > 0 && members.filter((m) => !m.isPitcher && (m.ratings["Pos Rating C"] ?? 0) >= catcherFloor).length < minCatchers) return false;
  if (minShortstops > 0 && members.filter((m) => !m.isPitcher && (m.ratings["Pos Rating SS"] ?? 0) >= ssFloor).length < minShortstops) return false;
  if (minLongMen > 0) {
    let long = 0;
    for (const [key, id] of Object.entries(slots)) {
      if (key !== "CL" && !/^RP\d/.test(key)) continue;
      if ((byId.get(id)?.ratings.Stamina ?? 0) >= LONG_MAN_STAMINA) long++;
    }
    if (long < minLongMen) return false;
  }
  if (members.filter((m) => !m.isPitcher).length > shape.bats) return false;
  if (rx?.teamCap != null && units.reduce((n, m) => n + (m.val ?? 0), 0) > rx.teamCap) return false;
  if (units.filter((m) => m.variant).length > variantLimit) return false;
  if (rx?.slots) {
    const tiers: Record<string, number> = {};
    for (const m of units) if (m.val != null) { const t = tierCode(m.val); tiers[t] = (tiers[t] ?? 0) + 1; }
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
  const full = new Map(keys.map((k) => [k, candidatesFor(k, pool, rules, o.minDefShare ?? 0, o.posFloor)]));
  // Cards pruning must not drop: the user's locks, and — when a catcher count
  // is required — the ten best catchers, whose bats rarely rank anywhere else.
  const keepIds = new Set(o.keep ?? []);
  if ((o.minCatchers ?? 0) > 0 && o.pairMoves) {
    const cf = Math.max(1, posFloorAt(o.posFloor, "C"));
    const rank = o.pairMoves.rank;
    pool.filter((c) => !c.isPitcher && (c.ratings["Pos Rating C"] ?? 0) >= cf)
      .sort((a, b) => rank("R:C", b) - rank("R:C", a)).slice(0, 10).forEach((c) => keepIds.add(c.cardId));
  }
  if ((o.minShortstops ?? 0) > 0 && o.pairMoves) {
    const sf = Math.max(1, posFloorAt(o.posFloor, "SS"));
    const rank = o.pairMoves.rank;
    pool.filter((c) => !c.isPitcher && (c.ratings["Pos Rating SS"] ?? 0) >= sf)
      .sort((a, b) => rank("R:SS", b) - rank("R:SS", a)).slice(0, 10).forEach((c) => keepIds.add(c.cardId));
  }
  // Backups: the positions the pool can cover twice, and the ten best at each
  // kept through pruning (as with catchers and shortstops).
  const backupPos = o.backups ? backupPositions(pool, rules, o.posFloor) : [];
  if (o.pairMoves) {
    const rank = o.pairMoves.rank;
    for (const b of backupPos) [...b.can].sort((x, y) => rank(`R:${b.pos}`, y) - rank(`R:${b.pos}`, x)).slice(0, 10).forEach((c) => keepIds.add(c.cardId));
  }
  const missing = (sl: FillResult) => missingBackups(sl, byId, backupPos);
  // Long men, the same way: a pen with none needs two swaps to reach two, which a
  // legality rule can't climb (the Live events of 10-05 kept seven 15-stamina relievers).
  const longShort = (sl: FillResult) => longMenShort(sl, byId, minLongWanted);
  const obj = (sl: FillResult) => o.objective(sl) - BACKUP_PENALTY * (missing(sl).length + longShort(sl));
  /** Who may play each slot at all — before pruning, so reassignment is exact. */
  const eligible = new Map([...full].map(([k, list]) => [k, new Set(list.map((c) => c.cardId))]));
  const cands = new Map(keys.map((k) => {
    let list = full.get(k)!;
    if (o.candidateLimit && o.pairMoves && list.length > o.candidateLimit) {
      const rank = o.pairMoves.rank;
      const top = [...list].sort((a, b) => rank(k, b) - rank(k, a)).slice(0, o.candidateLimit);
      const keep = new Set(top.map((c) => c.cardId));
      list = list.filter((c) => keep.has(c.cardId) || rostered.has(c.cardId) || keepIds.has(c.cardId));
    }
    return [k, list];
  }));
  let slots = { ...start };
  // Never shrink the roster. A platoon bat who only starts vs LHP holds no
  // vs-RHP or bench slot, so re-solving (or swapping on) the vs-LHP board can
  // drop him off the roster entirely — the objective gives an unused roster
  // spot no value, but the game wants all 26 (Negro Leagues Slots
  // 2026-09-26: 25 players, "this event needs 26").
  const minPlayers = Math.min(rosterSize(rules) ?? Infinity, new Set(Object.values(start).map(unitOf)).size);
  const minC = o.minCatchers ?? 0;
  const cFloor = Math.max(1, posFloorAt(o.posFloor, "C"));
  const minSS = o.minShortstops ?? 0;
  const ssFloor = Math.max(1, posFloorAt(o.posFloor, "SS"));
  // Scored as a penalty in obj (above), not a legality rule.
  const minLongWanted = o.minLongMen ?? 0;
  const minLong = 0;
  const startScore = obj(slots);
  // A starting board that breaks a rule (an unowned copy on a saved roster)
  // scores -Infinity, so the first legal board the search finds replaces it
  // even when it is worth fewer runs.
  const startLegal = legal(slots, byId, rules, shape, minPlayers, minC, cFloor, minSS, ssFloor, minLong);
  let score = startLegal ? startScore : -Infinity;
  let moves = 0;

  const pm = o.pairMoves;
  const upgrades = pm
    ? new Map(keys.map((k) => [k, [...(cands.get(k) ?? [])].sort((a, b) => pm.rank(k, b) - pm.rank(k, a)).slice(0, pm.aTop)]))
    : null;
  /*
   * Downgrades: the cheapest cards, and also the slot's value/rank frontier, the cards no
   * other card beats on both price and rank. With the cap full, an upgrade can only be paid
   * for by a cheaper card elsewhere, and the useful one is a few points cheaper and nearly as
   * good (a 64 for a 60), not the slot's 50s. Cheapest-only left Dregs (cap 1468, 0 spare)
   * catching Sam Huff (−27 runs vs RHP) over Tony Pena Sr. (−17), an 11-point upgrade no
   * single 50 could pay for (L.J. 10-27: "Sam Huff at C v R ... makes no sense"). A card off
   * the frontier is never the better payment: one cheaper and better-ranked exists. Only the
   * frontier, not every value level: a 45-point window (Low Gold Cap 40–84) at two a level
   * ran past 14 minutes.
   */
  const downgrades = pm
    ? new Map(keys.map((k) => {
        const list = cands.get(k) ?? [];
        const byPrice = [...list].sort((a, b) => (a.val ?? 0) - (b.val ?? 0) || pm.rank(k, b) - pm.rank(k, a));
        const frontier: FillCard[] = [];
        let best = -Infinity;
        for (const c of byPrice) { const r = pm.rank(k, c); if (r > best) { frontier.push(c); best = r; } }
        return [k, [...new Map([...byPrice.slice(0, pm.bCheapest), ...frontier].map((c) => [c.cardId, c])).values()]];
      }))
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
    const g = groupOf(key);
    const onBoard = (board: SlotGroup, except: string) => new Set(keys.filter((k) => groupOf(k) === board && k !== except).map((k) => t[k]));
    const bestRostered = (k2: string, exclude: Set<number>): number | null => {
      let pick: number | null = null, bestR = -Infinity;
      const rostered = new Set(Object.values(t));
      for (const x of cands.get(k2) ?? []) {
        if (!rostered.has(x.cardId) || exclude.has(x.cardId)) continue;
        const r = pm ? pm.rank(k2, x) : 0;
        if (r > bestR) { bestR = r; pick = x.cardId; }
      }
      return pick;
    };
    // (1) c already starts elsewhere on this board: a swap. His old slot goes
    // to the card he displaced when that card can play it, else to the best
    // rostered card not already on this board (Mack CF->LF for Bell vs LHP
    // needs Snider into CF — one move, not two).
    const k1 = keys.find((k) => k !== key && groupOf(k) === g && from[k] === c.cardId);
    if (k1 != null) {
      const elig = cands.get(k1) ?? [];
      const taken = onBoard(g, k1);
      let pick: number | null = cur != null && !taken.has(cur) && elig.some((x) => x.cardId === cur) ? cur : null;
      if (pick == null) pick = bestRostered(k1, taken);
      if (pick != null) t[k1] = pick;
      return t;
    }
    // (2) c is new to the roster: the displaced card leaves entirely, so his
    // other slots are refilled — with c where c can play them (a platoon
    // catcher's bench seat), else with the best rostered card free on that board.
    if (cur != null && !new Set(Object.values(from)).has(c.cardId)) {
      for (const k2 of keys) {
        if (k2 === key || t[k2] !== cur) continue;
        const g2 = groupOf(k2);
        const elig = cands.get(k2) ?? [];
        const taken = onBoard(g2, k2);
        let pick: number | null = g2 !== g && !taken.has(c.cardId) && elig.some((x) => x.cardId === c.cardId) ? c.cardId : null;
        if (pick == null) pick = bestRostered(k2, new Set([...taken, cur]));
        if (pick != null) t[k2] = pick;
      }
    }
    return t;
  };

  /*
   * Re-solve both boards' positions over the hitters already on the roster.
   * vs RHP, the lineup slots and the bench share one group (a bat either
   * starts or sits), so they are solved together; vs LHP is its own board.
   * The hitter part of the objective is exactly the sum of slotValue over
   * those slots, so the assignment is the best this set of hitters can do.
   * Returns `from` itself when there is nothing to solve or no complete
   * assignment exists.
   */
  const rRows = [...shape.lineupPos.map((p) => `R:${p}`), ...shape.benchKeys];
  const lRows = shape.lineupPos.map((p) => `L:${p}`);
  const hitKeys = new Set([...rRows, ...lRows]);
  // slotValue is pure per (slot, card) and the search asks for the same pairs
  // thousands of times, so remember them; -Infinity marks "may not play here".
  const svCache = new Map([...hitKeys].map((k) => [k, new Map<number, number>()]));
  const weight = (k: string, id: number): number => {
    const m = svCache.get(k)!;
    let w = m.get(id);
    if (w === undefined) { w = eligible.get(k)?.has(id) ? o.slotValue!(k, id) : -Infinity; m.set(id, w); }
    return w;
  };
  const reassign = (from: FillResult): FillResult => {
    if (!o.slotValue) return from;
    const hitters = [...new Set([...hitKeys].map((k) => from[k]).filter((id): id is number => id != null && byId.get(id)?.isPitcher === false))];
    const t: FillResult = { ...from };
    for (const rows of [rRows, lRows]) {
      if (rows.length === 0) continue;
      if (rows.length > hitters.length) return from;
      const w = rows.map((k) => hitters.map((id) => weight(k, id)));
      const a = maxAssignment(w);
      if (!a) return from;
      // An assignment can still hold an ineligible pairing (weight −∞) when the
      // board's bats cannot cover every position; legal() does not check
      // positions and the objective prices a 0 glove as average, so refuse it
      // here (2026-10-14: ten rebuilds put a 0-rated glove at 3B, 1B or RF).
      if (rows.some((_, i) => !Number.isFinite(w[i][a[i]]))) return from;
      rows.forEach((k, i) => { t[k] = hitters[a[i]]; });
    }
    return t;
  };
  /** The reassigned board when it is complete, legal and strictly better. */
  const settle = (from: FillResult, fromScore: number): { slots: FillResult; score: number } | null => {
    const t = reassign(from);
    if (t === from || !isComplete(t, shape) || !legal(t, byId, rules, shape, minPlayers, minC, cFloor, minSS, ssFloor, minLong)) return null;
    const s = obj(t);
    return s > fromScore + 1e-9 ? { slots: t, score: s } : null;
  };

  /*
   * THE STAFF, RE-SOLVED. Which arms on the roster start, which relieve, and in what order. The
   * objective prices each staff slot on its own (a rotation slot by its share of the starts, a
   * pen slot by its share of the batters times its leverage), so the best arrangement of a set of
   * arms is an assignment, as for the bats.
   *
   * Without it a new arm was only ever scored in the one slot he moved into. Saturday Bronze
   * Cap, 2026-11-07: Livan Hernandez (68, SP) for Satchel Paige (68, closing) is a legal swap at
   * a full cap, but scored with Hernandez closing it lost; it pays only with Hernandez starting,
   * the SP5 (Tin Can Kincannon) in the pen and Todd Jones closing. The best of 14 starts stopped
   * at 110.8 with Paige closing; the re-solved board is 114.3.
   */
  const staffKeys = [...shape.spKeys, ...shape.rpKeys];
  const stCache = new Map(staffKeys.map((k) => [k, new Map<number, number>()]));
  const staffWeight = (k: string, id: number): number => {
    const m = stCache.get(k)!;
    let w = m.get(id);
    if (w === undefined) { w = eligible.get(k)?.has(id) ? o.slotValue!(k, id) : -Infinity; m.set(id, w); }
    return w;
  };
  /** The pen's long men short of the minimum, for arms in staff-key order. */
  const longIn = (ids: readonly number[]) => {
    let n = 0;
    for (let i = shape.spKeys.length; i < ids.length; i++) if ((byId.get(ids[i])?.ratings.Stamina ?? 0) >= LONG_MAN_STAMINA) n++;
    return Math.max(0, minLongWanted - n);
  };
  /*
   * A set of arms at its best: the order (staff-key order) and what the staff then adds to the
   * objective, its slots' slotValue less the long-men penalty. That is all the staff adds (a
   * locked arm leaving and a two-way starter's lineup correction aside: the exact score settles
   * those), so a staff move's worth is this against the board's own, with nothing else scored.
   * Remembered by the set: the searches below meet the same set many times.
   */
  const staffMemo = new Map<string, { ids: number[]; value: number } | null>();
  const staffBest = (arms: readonly number[]): { ids: number[]; value: number } | null => {
    const key = [...arms].sort((x, y) => x - y).join(",");
    let m = staffMemo.get(key);
    if (m !== undefined) return m;
    const w = staffKeys.map((k) => arms.map((id) => staffWeight(k, id)));
    const a = maxAssignment(w);
    m = null;
    if (a) {
      const ids = a.map((j) => arms[j]);
      let v = 0;
      a.forEach((j, i) => { v += w[i][j]; });
      m = { ids, value: v - BACKUP_PENALTY * longIn(ids) };
    }
    if (staffMemo.size > 200_000) staffMemo.clear();
    staffMemo.set(key, m);
    return m;
  };
  // Every arm a staff slot may take, for the moves that bring one in: a reliever who cannot
  // start comes in for a starter too, once the staff is re-solved (a pen arm who can start moves up).
  const armPool = [...new Map(staffKeys.flatMap((k) => cands.get(k) ?? []).map((c) => [c.cardId, c])).values()];

  /*
   * The staff tier (o.staffTier): tried only when no plain move or pair helps, so a climb follows
   * the path it always did to the board it always reached, and only then looks further. Running
   * these moves on every pass instead changed which way each start went, and on Saturday Bronze
   * Cap all 14 λ starts ended lower (best 107.0 against 110.8): each climbs steepest-first, and
   * the big re-solve gains pulled them toward boards whose last fix (Reed Garrett back in the pen
   * for Jerry Augustine) lies outside the pair lists.
   *
   * One-card moves first, the best taken: the arms on the board re-solved as they are, then a
   * new arm for any arm on the staff, re-solved around him. Only when none helps, pairs with a
   * new arm on one side or both: a new arm and a bat move (a cheaper starter in for the closer
   * pays for a bat), or two new arms. Every move is priced first from its parts (the staff's
   * worth against the board's, plus what the bat move adds on its own: the two touch different
   * slots), and only a move that could beat the best so far is built, checked and scored.
   */
  const staffTier = (from: FillResult, fromScore: number, onRoster: ReadonlySet<number>): { slots: FillResult; score: number } | null => {
    if (!o.slotValue || !staffKeys.length) return null;
    const arms0 = staffKeys.map((k) => from[k]);
    let v0 = -BACKUP_PENALTY * longIn(arms0);
    staffKeys.forEach((k, i) => { v0 += staffWeight(k, arms0[i]); });
    let best: { slots: FillResult; score: number } | null = null;
    let floor = fromScore;
    /** Build `t` with the staff in `ids`' order, check it, and keep it when it beats the best. */
    const consider = (t: FillResult, ids: readonly number[]) => {
      if (!isComplete(t, shape)) return;
      const u: FillResult = { ...t };
      staffKeys.forEach((k, i) => { u[k] = ids[i]; });
      if (!legal(u, byId, rules, shape, minPlayers, minC, cFloor, minSS, ssFloor, minLong)) return;
      const s = obj(u);
      if (s > floor + 1e-9) { best = { slots: u, score: s }; floor = s; }
    };
    /** The best order of the staff with these arms swapped in, and what it adds over the board's. */
    const swapIn = (moves: readonly [number, number][]) => {
      const arms = arms0.slice();
      for (const [i, id] of moves) arms[i] = id;
      const m = staffBest(arms);
      return m ? { ids: m.ids, gain: m.value - v0 } : null;
    };

    const same = swapIn([]);
    if (same && fromScore + same.gain > floor + 1e-9) consider(from, same.ids);
    staffKeys.forEach((key, i) => {
      for (const c of armPool) {
        if (onRoster.has(c.cardId)) continue;
        const m = swapIn([[i, c.cardId]]);
        if (m && fromScore + m.gain > floor + 1e-9) consider(place(from, key, c), m.ids);
      }
    });
    if (best || !pm || !upgrades || !downgrades) return best;

    // A bat move on its own: what it adds (the pairs below join one to a staff move).
    const batGain = new Map<string, number>();
    const batMove = (key: string, c: FillCard) => {
      const k = `${key}|${c.cardId}`;
      let d = batGain.get(k);
      if (d === undefined) {
        const t = place(from, key, c);
        d = isComplete(t, shape) ? obj(t) - fromScore : -Infinity;
        batGain.set(k, d);
      }
      return d;
    };
    const idx = new Map(staffKeys.map((k, i) => [k, i]));
    for (const a of keys) {
      const ia = idx.get(a);
      for (const ca of upgrades.get(a) ?? []) {
        if (ca.cardId === from[a]) continue;
        // An arm already on the staff swapped in only reorders it: the re-solve covers that.
        if (ia != null && onRoster.has(ca.cardId)) continue;
        for (const b of keys) {
          const ib = idx.get(b);
          if (b === a || (ia == null && ib == null)) continue;
          for (const cb of downgrades.get(b) ?? []) {
            if (cb.cardId === from[b] || cb.cardId === ca.cardId || (ib != null && onRoster.has(cb.cardId))) continue;
            const m = ia != null && ib != null ? swapIn([[ia, ca.cardId], [ib, cb.cardId]])
              : swapIn([[(ia ?? ib)!, (ia != null ? ca : cb).cardId]]);
            if (!m) continue;
            const est = fromScore + m.gain + (ia == null ? batMove(a, ca) : ib == null ? batMove(b, cb) : 0);
            if (est > floor + 1e-9) consider(place(place(from, a, ca), b, cb), m.ids);
          }
        }
      }
    }
    return best;
  };

  const settled0 = settle(slots, score);
  if (settled0) { slots = settled0.slots; score = settled0.score; moves++; }

  for (let pass = 0; pass < (o.maxPasses ?? 40); pass++) {
    const onRoster = new Set(Object.values(slots));
    let bestKey: string | null = null, bestId = 0, bestScore = score;
    let bestSlots: FillResult | null = null;
    let bestPair: { a: string; ai: number; b: string; bi: number } | null = null;

    // A start already at the plain moves' optimum: its first pass is the staff tier's.
    const plain = !(pass === 0 && o.atOptimum && o.staffTier);
    for (const key of plain ? keys : []) {
      const current = slots[key];
      for (const c of cands.get(key) ?? []) {
        if (c.cardId === current) continue;
        const trial = place(slots, key, c);
        if (!isComplete(trial, shape)) continue;
        if (!legal(trial, byId, rules, shape, minPlayers, minC, cFloor, minSS, ssFloor, minLong)) continue;
        const s = obj(trial);
        if (s > bestScore + 1e-9) { bestScore = s; bestKey = key; bestId = c.cardId; bestSlots = trial; }
        // A new bat on the roster: also score him with every position re-solved
        // around him. (Moves among rostered bats need no re-solve — the board
        // is already settled after every accepted move.)
        if (o.slotValue && hitKeys.has(key) && !onRoster.has(c.cardId)) {
          const r = settle(trial, bestScore);
          if (r) { bestScore = r.score; bestKey = key; bestId = c.cardId; bestSlots = r.slots; }
        }
      }
    }

    // Only when no single move helps: pay for an upgrade with a downgrade.
    if (plain && !bestKey && pm && upgrades && downgrades) {
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
              if (!legal(t2, byId, rules, shape, minPlayers, minC, cFloor, minSS, ssFloor, minLong)) continue;
              const s = obj(t2);
              if (s > bestScore + 1e-9) { bestScore = s; bestPair = { a, ai: ca.cardId, b, bi: cb.cardId }; }
            }
          }
        }
      }
    }

    if (bestKey && bestSlots) { slots = bestSlots; void bestId; }
    else if (bestPair) { slots = place(place(slots, bestPair.a, byId.get(bestPair.ai)!), bestPair.b, byId.get(bestPair.bi)!); }
    else {
      // A local optimum for every plain move: the staff tier when asked for, or done.
      const st = o.staffTier ? staffTier(slots, score, onRoster) : null;
      if (!st) break;
      slots = st.slots; bestScore = st.score;
    }
    score = bestScore;
    moves++;
    const settled = settle(slots, score);
    if (settled) { slots = settled.slots; score = settled.score; }
  }
  // No legal board reachable from an illegal start: hand the start back as it was scored.
  return { slots, score: Number.isFinite(score) ? score : startScore, moves, startScore, startLegal, legal: Number.isFinite(score), missingBackups: missing(slots) };
}
