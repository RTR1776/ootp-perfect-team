/**
 * Era Strength: the collection against the best cards in five eras, per
 * tier, and the cards to buy before an event's rules are announced.
 *
 * L.J., 2026-09-28: the PTCS events get announced with their own card rules,
 * eras and parks, and the related cards go up once they are. "Give me an idea
 * of how strong each [tier] looks and then identify the top cards by position
 * (3 each) that I don't own", with "cards that do well across eras" singled
 * out, since those also carry tourney play in general.
 *
 * Each card has one score per era: runs per 700 PA on env-fit's scorer
 * (calibrated, era-corrected, observed play blended in), averaged over three
 * run environments PT actually uses in that era, in a neutral park. A bat is
 * 0.7 × vs RHP + 0.3 × vs LHP (the both-hands read Played and Build use), plus
 * its glove at the position on fielding.ts's scale for that era. An arm is its
 * vs-RHP board, as Build's shop and the roster objective read it.
 *
 * Everything here is pure; lib/era-strength-load.ts scores the cards.
 */
import { fieldingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import { RP_WEIGHT_DEFAULT } from "@/lib/roster-objective";

/**
 * Five eras, each read at three run environments PT runs events in (2010 is
 * the PT default). The deadball years stand in for the Iron Dreamland and
 * early-years events, which use 1907 and 1888.
 */
export const ERAS = [
  { key: "deadball", label: "Deadball", short: "Dead", span: "to 1919", years: [1907, 1911, 1916] },
  { key: "liveball", label: "Live ball", short: "Live", span: "1920–45", years: [1925, 1935, 1942] },
  { key: "postwar", label: "Post-war", short: "Post", span: "1946–68", years: [1952, 1959, 1968] },
  { key: "expansion", label: "Expansion", short: "Exp", span: "1969–93", years: [1974, 1985, 1991] },
  { key: "modern", label: "Modern", short: "Mod", span: "1994 on", years: [1999, 2010, 2019] },
] as const;
export const ERA_COUNT = ERAS.length;

/** The four card tiers L.J. plays, each with every card at or under its ceiling. */
export const ERA_TIERS = [
  { key: "bronze", label: "Bronze", max: 69 },
  { key: "silver", label: "Silver", max: 79 },
  { key: "gold", label: "Gold", max: 89 },
  { key: "diamond", label: "Diamond", max: 99 },
] as const;
export type TierKey = (typeof ERA_TIERS)[number]["key"];

export const FIELD_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type FieldPos = (typeof FIELD_POS)[number];
export const SPOTS = [...FIELD_POS, "DH", "SP", "RP"] as const;
export type Spot = (typeof SPOTS)[number];

/** How a lineup is filled for the team total: the scarce gloves first, so a shortstop isn't spent at first base. */
const LINEUP_ORDER: Spot[] = ["C", "SS", "CF", "2B", "3B", "RF", "LF", "1B", "DH"];
const STAFF = { SP: 5, RP: 7 } as const;
/**
 * The card a buy would replace: his best at a fielding spot or DH, his fifth
 * starter, his seventh reliever. An arm no better than his ace can still
 * lift the back of the staff.
 */
export const DEPTH: Record<Spot, number> = { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1, SP: STAFF.SP, RP: STAFF.RP };

export type Rank = "avg" | "worst";

export interface EraCard {
  id: number;
  name: string;
  val: number;
  year: number | null;
  /** Card set (cards.card_type). */
  set: number | null;
  le: boolean;
  /** Release date, YYYY-MM-DD. */
  released: string | null;
  /** SP or RP for an arm; null for a bat. */
  role: "SP" | "RP" | null;
  owned: boolean;
  /** This is the owned variant's form (its ratings). */
  variant: boolean;
  /** Runs per 700 PA in each era: a bat's both-hands read without the glove, an arm's vs-RHP board. */
  runs: number[];
  /** Position ratings at or above L.J.'s floor. */
  pos: Partial<Record<FieldPos, number>>;
  /** The shop list's lowest ask and last-10 average; null when not listed. */
  ask: number | null;
  last10: number | null;
}

/** A card as the page shows it. */
export type CardRef = Pick<EraCard, "id" | "name" | "val" | "year" | "set" | "le" | "released" | "owned" | "variant" | "ask" | "last10">;
const ref = (c: EraCard): CardRef => ({ id: c.id, name: c.name, val: c.val, year: c.year, set: c.set, le: c.le, released: c.released, owned: c.owned, variant: c.variant, ask: c.ask, last10: c.last10 });
const r1 = (x: number) => Math.round(x * 10) / 10;
const r1s = (xs: readonly number[]) => xs.map(r1);
const r1n = (xs: readonly (number | null)[]) => xs.map((x) => (x == null ? null : r1(x)));

/** A card's value at a spot in each era, or null when it can't play there. */
export function valueAt(c: EraCard, spot: Spot, glove: readonly number[]): number[] | null {
  if (spot === "SP" || spot === "RP") return c.role === spot ? c.runs : null;
  if (c.role) return null;
  if (spot === "DH") return c.runs;
  const rating = c.pos[spot];
  if (rating == null || rating <= 0 || rating < posFloorAt(LJ_FLOOR, spot)) return null;
  return c.runs.map((r, e) => r + (glove[e] ?? 1) * fieldingRuns(spot, rating));
}

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const worstOf = (xs: readonly number[]) => Math.min(...xs);
export const rankValue = (xs: readonly number[], rank: Rank) => (rank === "worst" ? worstOf(xs) : mean(xs));

type Scored = { c: EraCard; v: number[] };
type Candidates = Record<Spot, Scored[]>;

/** Every card that can play each spot, with its value there in each era. */
function candidates(cards: readonly EraCard[], glove: readonly number[]): Candidates {
  const out = Object.fromEntries(SPOTS.map((s) => [s, [] as Scored[]])) as Candidates;
  for (const c of cards) for (const spot of SPOTS) { const v = valueAt(c, spot, glove); if (v) out[spot].push({ c, v }); }
  return out;
}

/**
 * The lineup: each spot takes the best card left by `score`, each card once,
 * the scarce gloves first so a shortstop isn't spent at first base.
 */
function fillLineup(cand: Candidates, score: (v: readonly number[]) => number): Partial<Record<Spot, Scored>> {
  const used = new Set<number>(), out: Partial<Record<Spot, Scored>> = {};
  for (const spot of LINEUP_ORDER) {
    let best: Scored | null = null, bestScore = -Infinity;
    for (const x of cand[spot]) {
      if (used.has(x.c.id)) continue;
      const v = score(x.v);
      if (v > bestScore) { best = x; bestScore = v; }
    }
    if (best) { used.add(best.c.id); out[spot] = best; }
  }
  return out;
}

/** An arm role's top `n` values in one era, best first. */
const staffTop = (cand: Candidates, role: "SP" | "RP", era: number) =>
  cand[role].map((x) => x.v[era]).sort((a, b) => b - a).slice(0, DEPTH[role]);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function teamOf(cand: Candidates, era: number): number {
  const lineup = fillLineup(cand, (v) => v[era]);
  return sum(Object.values(lineup).map((x) => x!.v[era])) + sum(staffTop(cand, "SP", era)) + RP_WEIGHT_DEFAULT * sum(staffTop(cand, "RP", era));
}

/**
 * The team total in one era: the best nine bats (each card once, scarce
 * gloves first), five starters, and seven relievers at the roster objective's
 * relief weight.
 */
export function teamRuns(cards: readonly EraCard[], glove: readonly number[], era: number): number {
  return teamOf(candidates(cards, glove), era);
}

export interface TierGrid {
  tier: TierKey;
  /** Runs his best team is short of the best possible, per era (0 = he owns the best). */
  short: number[];
  mine: number[];
  best: number[];
}

export interface SpotRow {
  spot: Spot;
  mine: { card: CardRef; runs: number[] } | null;
  best: { card: CardRef; runs: number[] } | null;
  /**
   * Per era, the best possible team's card at this spot minus his team's
   * (each card used once, as in the strength grid, so the bats' gaps add up to
   * its total); for SP and RP, per slot over the five starters or seven
   * relievers. Null when he has no one there.
   */
  gap: (number | null)[];
}

export interface BuyRow {
  spot: Spot;
  place: number;
  card: CardRef;
  runs: number[];
  /**
   * Over the card it would replace, per era: the card his best team plays at
   * the spot (each card once), his fifth starter, or his seventh reliever.
   * Negative when he owns better; null when he has no one there.
   */
  gain: (number | null)[];
}

export interface TierView {
  tier: TierKey;
  grid: TierGrid;
  spots: Record<Rank, SpotRow[]>;
  buys: Record<Rank, BuyRow[]>;
  /** His cards that hold up in every era: bats at their best spot, arms in their role. */
  core: { spot: Spot; card: CardRef; runs: number[] }[];
}

/** One card per id: his variant's form where he owns the variant, else the base card. */
export function oneForm(cards: readonly EraCard[]): EraCard[] {
  const out = new Map<number, EraCard>();
  for (const c of cards) {
    const had = out.get(c.id);
    if (!had || (c.variant && c.owned)) out.set(c.id, c);
  }
  return [...out.values()];
}

export function tierView(all: readonly EraCard[], tier: (typeof ERA_TIERS)[number], glove: readonly number[], opts: { buys?: number; core?: number } = {}): TierView {
  const perSpot = opts.buys ?? 3, coreN = opts.core ?? 10;
  const game = oneForm(all.filter((c) => c.val <= tier.max));
  const mine = game.filter((c) => c.owned);
  const eras = [...Array(ERA_COUNT).keys()];

  const candG = candidates(game, glove);
  const candM = Object.fromEntries(SPOTS.map((sp) => [sp, candG[sp].filter((x) => x.c.owned)])) as Candidates;
  const bestMine = eras.map((e) => teamOf(candM, e));
  const bestGame = eras.map((e) => teamOf(candG, e));
  const grid: TierGrid = { tier: tier.key, mine: r1s(bestMine), best: r1s(bestGame), short: r1s(eras.map((e) => Math.max(0, bestGame[e] - bestMine[e]))) };

  // Each era's lineups, the cards that set the gaps and the gains.
  const fillG = eras.map((e) => fillLineup(candG, (v) => v[e]));
  const fillM = eras.map((e) => fillLineup(candM, (v) => v[e]));
  const isArm = (spot: Spot): spot is "SP" | "RP" => spot === "SP" || spot === "RP";
  /** What a card at the spot is measured against in era e: his team's card there, or his last starter or reliever. */
  const replaced = (spot: Spot, e: number): number | null => {
    if (!isArm(spot)) return fillM[e][spot]?.v[e] ?? null;
    const top = staffTop(candM, spot, e);
    return top.length < DEPTH[spot] ? null : top[top.length - 1];
  };
  const gapAt = (spot: Spot, e: number): number | null => {
    if (!isArm(spot)) {
      const g = fillG[e][spot]?.v[e], m = fillM[e][spot]?.v[e];
      return g == null ? 0 : m == null ? null : g - m;
    }
    const g = staffTop(candG, spot, e), m = staffTop(candM, spot, e);
    return m.length < DEPTH[spot] ? null : (sum(g) - sum(m)) / DEPTH[spot];
  };
  const gaps = Object.fromEntries(SPOTS.map((sp) => [sp, r1n(eras.map((e) => gapAt(sp, e)))])) as Record<Spot, (number | null)[]>;

  const spots = { avg: [] as SpotRow[], worst: [] as SpotRow[] };
  const buys = { avg: [] as BuyRow[], worst: [] as BuyRow[] };
  for (const rank of ["avg", "worst"] as const) {
    const score = (v: readonly number[]) => rankValue(v, rank);
    const showG = fillLineup(candG, score), showM = fillLineup(candM, score);
    const top = (xs: readonly Scored[]) => xs.reduce<Scored | null>((b, x) => (!b || score(x.v) > score(b.v) ? x : b), null);
    for (const spot of SPOTS) {
      const m = isArm(spot) ? top(candM[spot]) : showM[spot] ?? null;
      const g = isArm(spot) ? top(candG[spot]) : showG[spot] ?? null;
      spots[rank].push({ spot, mine: m ? { card: ref(m.c), runs: r1s(m.v) } : null, best: g ? { card: ref(g.c), runs: r1s(g.v) } : null, gap: gaps[spot] });
      candG[spot].filter((x) => !x.c.owned).sort((a, b) => score(b.v) - score(a.v)).slice(0, perSpot).forEach((x, i) => {
        buys[rank].push({ spot, place: i + 1, card: ref(x.c), runs: r1s(x.v), gain: r1n(x.v.map((v, e) => { const m0 = replaced(spot, e); return m0 == null ? null : v - m0; })) });
      });
    }
  }

  // Era-proof: his bats at the spot where their worst era is highest, then his arms.
  const bestSpot = (c: EraCard) => SPOTS.reduce<{ spot: Spot; v: number[] } | null>((b, spot) => {
    const v = valueAt(c, spot, glove);
    return v && (!b || worstOf(v) > worstOf(b.v)) ? { spot, v } : b;
  }, null);
  const proof = (arms: boolean) => mine.filter((c) => !!c.role === arms).flatMap((c) => { const b = bestSpot(c); return b ? [{ spot: b.spot, card: ref(c), runs: r1s(b.v) }] : []; })
    .sort((a, b) => worstOf(b.runs) - worstOf(a.runs)).slice(0, coreN);

  return { tier: tier.key, grid, spots, buys, core: [...proof(false), ...proof(true)] };
}
