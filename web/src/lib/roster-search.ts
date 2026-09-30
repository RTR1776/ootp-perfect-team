/**
 * The board search behind /build's Optimise and Search longer. It runs in a
 * Web Worker (optimize.worker.ts), so neither freezes the page and Stop works
 * in both: Optimise used to climb on the main thread, blocking it in 4–5 s
 * chunks for about 30 s with no way to stop it.
 *
 * STARTS. The board as it stands (holes filled from the greedy fill), the
 * greedy fill, then greedy fills under a rising value penalty λ, most
 * promising first so a time budget drops the long shots: λ 2 won on both
 * events measured 2026-09-26 (Negro Leagues Slots, Gold Rush). Distinct
 * rosters only: positions are re-solved inside the climb, so two starts with
 * the same cards are the same start. One climb stops at the first board no
 * one- or two-card move improves, and which board that is depends on where
 * it began (Negro Leagues Slots, 2026-09-26: from the greedy fill +39.5, from
 * a hand-built board +47.9).
 *
 * MODES.
 *   quick (Optimise)        up to 7 starts, each climbed once with the
 *                           narrow settings; no climb starts after the time
 *                           budget (45 s); then its 2 best boards polished
 *                           over the full pool (POLISH), even past the budget.
 *   deep  (Search longer)   up to 12 starts, each climbed under both
 *                           settings, then its 3 best polished. Several minutes.
 *
 * Wider is not simply better: the climb is steepest-ascent, so a different
 * candidate list takes a different path. On Saturday Bronze Cap (2026-09-26)
 * the full pool alone stopped at −21.8 and 300-per-slot at −21.1, where the
 * narrow setting reached −19.5 from the same start. Deep runs both settings
 * from a superset of quick's starts, so it can never do worse than Optimise.
 *
 * Prune width, measured on Gold Rush (3,321-card pool, 2026-09-17): greedy
 * 150.7 runs; top 30 per slot 170.1 in 16 s; top 60 173.8 in 14 s; top 120
 * 175.1 in 17 s; the full pool with 12 λ starts 179.4 in 4½ min. The width
 * barely moves the time (the pair search is bounded by aTop/bCheapest), so
 * 120 it is; the CLI stays the reference for a weekly event.
 *
 * Before each climb the best board so far is posted, so the page shows
 * progress and Stop keeps the best found. Everything arrives as plain data
 * (Maps as entry arrays) because functions and Maps are rebuilt here.
 */
import { optimizeRoster } from "./roster-optimize";
import { rosterObjective } from "./roster-objective";
import { LJ_FLOOR } from "./pos-floor";
import { fillOnce, fillRoster, isComplete, type FillCard, type FillResult, type FillShape, type FitMaps } from "./roster-fill";
import type { RosterRules } from "./roster-rules";

export const SETTINGS = [
  { candidateLimit: 120, aTop: 8, bCheapest: 10, maxPasses: 40, tag: "" },
  { candidateLimit: 300, aTop: 10, bCheapest: 12, maxPasses: 80, tag: ", wide" },
];
/**
 * POLISH. The narrow climbs stop where no move among each slot's top 120 helps;
 * a trade that needs a card outside that list (the cheap reliever that pays for
 * a bat under a tight cap) stays invisible. So the best boards found are climbed
 * once more over the full pool with the CLI's pair settings (env-roster, the
 * reference). From a board that is already good the full climb has few moves
 * left, so it is quick where a full climb from a cold start is not.
 * Measured 2026-09-30 on the CLI's inputs (env-roster --compare-search): see
 * Docs/Handoff 2026-09-30.md.
 */
export const POLISH = { candidateLimit: undefined as number | undefined, aTop: 10, bCheapest: 12, maxPasses: 80, tag: ", full pool" };
export const QUICK = { maxStarts: 7, lambdas: [2, 8, 1, 4, 0.5], budgetMs: 45_000, polish: 2 };
export const DEEP = { maxStarts: 12, lambdas: [2, 1, 4, 0.5, 8, 3, 1.5, 6, 0.25, 0.75, 5], polish: 3 };

type Entries = [number, number][];
/** FitMaps as entry arrays, to cross postMessage. */
export interface PlainFits { fitR: Entries; fitL: Entries; atR: Record<string, Entries>; atL: Record<string, Entries> }

export const toPlainFits = (f: FitMaps): PlainFits => ({
  fitR: [...f.fitR], fitL: [...f.fitL],
  atR: Object.fromEntries(Object.entries(f.atR).map(([k, m]) => [k, [...m]])),
  atL: Object.fromEntries(Object.entries(f.atL).map(([k, m]) => [k, [...m]])),
});
export const fromPlainFits = (p: PlainFits): FitMaps => ({
  fitR: new Map(p.fitR), fitL: new Map(p.fitL),
  atR: Object.fromEntries(Object.entries(p.atR).map(([k, e]) => [k, new Map(e)])),
  atL: Object.fromEntries(Object.entries(p.atL).map(([k, e]) => [k, new Map(e)])),
});

/**
 * Only what the fills, the rules and the climb read: the owned copies, the
 * value, year and set, the role, and the position ratings. The page's cards
 * carry every rating and the projections; this keeps the copy to the worker
 * small (2,080 cards on Daily Open Slots).
 */
export function searchCard(c: FillCard): FillCard {
  const ratings: Record<string, number> = {};
  for (const k in c.ratings) if (k.startsWith("Pos Rating ")) ratings[k] = c.ratings[k];
  return {
    cardId: c.cardId, name: c.name, val: c.val, year: c.year, isPitcher: c.isPitcher, role: c.role, cardType: c.cardType ?? null,
    ratings, baseOwned: c.baseOwned, variantOwned: c.variantOwned, variant: c.variant,
  };
}

export interface SearchRequest {
  mode: "quick" | "deep";
  /** Quick mode: no climb starts after this many ms (the first always runs). Default QUICK.budgetMs. */
  budgetMs?: number;
  /** The board as it stands, on the shape's slots; holes are filled from the greedy fill. */
  board: FillResult;
  /** The pool the search may use: the chosen sets, no banned card. */
  pool: FillCard[];
  rules: RosterRules;
  shape: FillShape;
  fits: PlainFits;
  runsR: Entries;
  runsL: Entries;
  lhpShare: number;
  /** The series' measured starter / reliever weights (field-construction.ts); defaults when absent. */
  spWeight?: number;
  rpWeight?: number;
  gloveScale?: number;
  /** Locked cards the pool holds: every board must carry them (1000 runs off each one missing). */
  locks: number[];
  minCatchers: number;
}
export interface SearchBest { slots: FillResult; score: number; moves: number; from: string }
export interface SearchMessage {
  type: "progress" | "done";
  /** Climbs finished, and how many there are. */
  done: number;
  total: number;
  /** The best legal board so far; its score is the search's (with the must-carry penalty). */
  best: SearchBest | null;
  /** The climb about to run, e.g. "λ 2" or "your board, wide". */
  current?: string | null;
  /** Quick mode stopped starting climbs at its time budget. */
  cut?: boolean;
}

const shapeKeys = (s: FillShape) => [
  ...s.lineupPos.map((p) => `R:${p}`), ...s.lineupPos.map((p) => `L:${p}`), ...s.spKeys, ...s.rpKeys, ...s.benchKeys,
];

/** The distinct complete starts, in the order they are climbed. */
export function searchStarts(d: SearchRequest): { label: string; slots: FillResult }[] {
  const plan = d.mode === "quick" ? QUICK : DEEP;
  const locks = new Set(d.locks);
  const fits = fromPlainFits(d.fits);
  const greedy = fillRoster(d.pool, d.rules, d.shape, fits, locks).slots;
  // The search needs a complete board to score; fill the holes greedily first.
  const current: FillResult = {};
  for (const k of shapeKeys(d.shape)) { const id = d.board[k] ?? greedy[k]; if (id != null) current[k] = id; }
  const starts: { label: string; slots: FillResult }[] = [];
  const seen = new Set<string>();
  const add = (label: string, b: FillResult) => {
    if (starts.length >= plan.maxStarts || !isComplete(b, d.shape)) return;
    const key = [...new Set(Object.values(b))].sort((x, y) => x - y).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    starts.push({ label, slots: b });
  };
  add("your board", current);
  add("the greedy fill", greedy);
  for (const lam of plan.lambdas) {
    if (starts.length >= plan.maxStarts) break;
    add(`λ ${lam}`, fillOnce(d.pool, d.rules, d.shape, fits, lam, locks));
  }
  return starts;
}

/** Run the whole search, posting progress before each climb and "done" at the end. */
export function runSearch(d: SearchRequest, post: (m: SearchMessage) => void, now: () => number = () => performance.now()): void {
  const t0 = now();
  const quick = d.mode === "quick";
  const settings = quick ? SETTINGS.slice(0, 1) : SETTINGS;
  const budget = quick ? d.budgetMs ?? QUICK.budgetMs : Infinity;
  const locks = new Set(d.locks);
  const starts = searchStarts(d);
  const obj = rosterObjective(d.pool, {
    shape: d.shape, runsR: new Map(d.runsR), runsL: new Map(d.runsL), lhpShare: d.lhpShare,
    spWeight: d.spWeight, rpWeight: d.rpWeight, gloveScale: d.gloveScale,
    mustIds: locks.size ? locks : undefined,
  });
  const plan = quick ? QUICK : DEEP;
  const total = starts.length * settings.length + plan.polish;
  let best: SearchBest | null = null;
  let done = 0;
  let cut = false;
  const found: SearchBest[] = [];
  const climb = (slots: FillResult, cfg: { candidateLimit?: number; aTop: number; bCheapest: number; maxPasses: number }, from: string) => {
    const r = optimizeRoster(slots, d.pool, d.rules, d.shape, {
      objective: obj.objective, slotValue: obj.slotValue, minDefShare: 0.6, posFloor: LJ_FLOOR,
      pairMoves: { aTop: cfg.aTop, bCheapest: cfg.bCheapest, rank: obj.rank }, maxPasses: cfg.maxPasses,
      candidateLimit: cfg.candidateLimit, keep: locks, minCatchers: d.minCatchers,
    });
    // Only boards that pass every rule compete.
    if (r.legal) {
      const b = { slots: r.slots, score: r.score, moves: r.moves, from };
      found.push(b);
      if (!best || r.score > best.score + 1e-9) best = b;
    }
    done++;
  };
  climbs: for (const st of starts) {
    for (const cfg of settings) {
      if (done > 0 && now() - t0 > budget) { cut = true; break climbs; }
      post({ type: "progress", done, total, best, current: st.label + cfg.tag });
      climb(st.slots, cfg, st.label + cfg.tag);
    }
  }
  // The best distinct boards, polished over the full pool (quick: its one best, even past the budget).
  const seen = new Set<string>();
  const top = found.sort((a, b) => b.score - a.score).filter((b) => {
    const k = [...new Set(Object.values(b.slots))].sort((x, y) => x - y).join(",");
    return seen.has(k) ? false : (seen.add(k), true);
  }).slice(0, plan.polish);
  for (const b of top) {
    post({ type: "progress", done, total, best, current: b.from + POLISH.tag });
    climb(b.slots, POLISH, b.from + POLISH.tag);
  }
  // Fewer distinct boards than planned polishes: the count ends where the work did.
  post({ type: "done", done, total: done, best, cut });
}
