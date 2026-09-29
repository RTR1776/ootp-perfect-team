/**
 * Batting order, from the data: every order is played through nine innings
 * on the app's base/out chain (run-env.ts), with each batter's own event
 * odds, and the order that scores the most runs wins.
 *
 * L.J., 2026-09-28: "put a recommended batting order based on whatever the
 * data says - not sure if that would be typical baseball thinking or
 * something else or different by era". The chain answers all three: a
 * batter's odds come from his ratings in the event's run environment and
 * park against that pitcher hand, and the era's own out mix (ground-ball
 * share, double plays) moves the runners. The usual order (The Book: the
 * best three hitters at 1, 2 and 4, on-base first, power 4-5, the rest in
 * descending order) is scored alongside, so the board can say whether the
 * data agrees with it.
 *
 * The same transition table as the run environments, so the runners advance
 * the same generic way for every batter: speed and stolen bases are not in
 * it. Orders move a game by hundredths of a run; the ranking is the point,
 * the gain is small.
 */
import { applyPark, BASES, bidx, EVENT_KEYS, gshare, probs, trans, type EraRates, type EventKey, type ParkFactors } from "@/lib/analytics/run-env";

/** One batter's per-PA odds: K, BB (with HBP), HR, B1, B2, B3, OUT (balls in play caught). */
export type PaLine = Record<EventKey, number>;

/** A batter's odds from his rate profile, pushed through the park. */
export function paLine(rates: EraRates, park: ParkFactors | null): PaLine {
  return probs(park ? applyPark(rates, park) : rates);
}

/**
 * Pull a batter's odds toward the league line by `s`. The rating curves
 * overstate the spread between cards by about half (calibration.ts), so the
 * app's calibrated scale uses s = the hit slope; the order it finds is the
 * same, the runs it claims are honest.
 */
export function shrink(p: PaLine, league: PaLine, s: number): PaLine {
  return Object.fromEntries(EVENT_KEYS.map((k) => [k, Math.max(0, league[k] + s * (p[k] - league[k]))])) as PaLine;
}

export const obp = (p: PaLine) => p.BB + p.HR + p.B1 + p.B2 + p.B3;
export const slg = (p: PaLine) => { const ab = 1 - p.BB; return ab > 0 ? (p.B1 + 2 * p.B2 + 3 * p.B3 + 4 * p.HR) / ab : 0; };

/**
 * A pitcher at the plate when there is no DH: roughly what pitchers hit in
 * any era (MLB pitchers ran near .140/.170/.180, a strikeout in a third of
 * their trips). No card rates them, so this line stands in for all of them.
 */
export function pitcherLine(era: EraRates): PaLine {
  return probs({
    K: Math.min(0.45, era.K * 2), BB: era.BB * 0.35, HBP: era.HBP * 0.5,
    HR: era.HR * 0.15, B2: era.B2 * 0.6, B3: era.B3 * 0.5, BABIP: Math.max(0.15, era.BABIP - 0.07),
  });
}

/* ------------------------------------------------------------------ the chain */

const NE = EVENT_KEYS.length;

/**
 * The transition table, flat for speed: for state s (bases * 3 + outs) and
 * event e, entries first[s * NE + e] up to first[s * NE + e + 1] hold where
 * the runners go (to = -1 when the inning ends), the runs in, and the weight.
 */
export interface OrderEnv { first: Int32Array; to: Int32Array; runs: Float64Array; w: Float64Array }

/** The era's out mix: ground-ball share from its home-run rate, the chain's double-play rate. */
export function orderEnv(era: EraRates): OrderEnv {
  const g = gshare(era.HR), dp = 0.115;
  const first = new Int32Array(24 * NE + 1), to: number[] = [], runs: number[] = [], w: number[] = [];
  for (const b of BASES) for (let o = 0; o < 3; o++) for (let e = 0; e < NE; e++) {
    const at = (bidx(b) * 3 + o) * NE + e;
    first[at] = to.length;
    for (const [ns, oa, r, wt] of trans(b, EVENT_KEYS[e], g, dp, o)) {
      const no = o + oa;
      to.push(no >= 3 ? -1 : bidx(ns) * 3 + no); runs.push(r); w.push(wt);
    }
  }
  // BASES runs in bidx order, so the entries were written in index order and
  // each one ends where the next begins.
  first[24 * NE] = to.length;
  return { first, to: Int32Array.from(to), runs: Float64Array.from(runs), w: Float64Array.from(w) };
}

const asArray = (p: PaLine) => Float64Array.from(EVENT_KEYS, (k) => p[k]);

/** Expected runs in an inning led off by batter `lead`; adds the odds of who leads off the next into `next`. */
function inning(lines: readonly Float64Array[], lead: number, env: OrderEnv, next: Float64Array): number {
  const n = lines.length, { first, to, runs: rn, w } = env;
  let dist = new Float64Array(24), out = new Float64Array(24);
  dist[0] = 1;
  let runs = 0;
  for (let step = 0, left = 1; left > 1e-9 && step < 60; step++) {
    const k = (lead + step) % n, p = lines[k];
    out.fill(0);
    left = 0;
    for (let s = 0; s < 24; s++) {
      const m = dist[s];
      if (!m) continue;
      for (let e = 0; e < NE; e++) {
        const pe = p[e];
        if (!pe) continue;
        const mp = m * pe;
        for (let j = first[s * NE + e], end = first[s * NE + e + 1]; j < end; j++) {
          const x = mp * w[j];
          runs += x * rn[j];
          const t = to[j];
          if (t < 0) next[(k + 1) % n] += x;
          else { out[t] += x; left += x; }
        }
      }
    }
    [dist, out] = [out, dist];
  }
  return runs;
}

function gameRunsOf(lines: readonly Float64Array[], env: OrderEnv, innings: number): number {
  const n = lines.length;
  const runs = new Float64Array(n), next = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) runs[i] = inning(lines, i, env, next[i]);
  let lead = new Float64Array(n), nextLead = new Float64Array(n);
  lead[0] = 1;
  let total = 0;
  for (let inn = 0; inn < innings; inn++) {
    nextLead.fill(0);
    for (let i = 0; i < n; i++) {
      const li = lead[i];
      if (!li) continue;
      total += li * runs[i];
      const ni = next[i];
      for (let j = 0; j < n; j++) nextLead[j] += li * ni[j];
    }
    [lead, nextLead] = [nextLead, lead];
  }
  return total;
}

/** Expected runs over `innings` for batters in this order, the first leading off the first. */
export function gameRuns(lines: readonly PaLine[], env: OrderEnv, innings = 9): number {
  return gameRunsOf(lines.map(asArray), env, innings);
}

/* ------------------------------------------------------------------ orders */

/** A batter's worth per PA on the chain's own scale: runs over nine innings of him alone, for ranking. */
const alone = (p: PaLine, env: OrderEnv) => gameRuns(Array(9).fill(p), env);

/**
 * The usual order (The Book): of the best three hitters, the best on-base man
 * leads off, the best of the other two bats second and the third fourth; the
 * next two bat third (the higher on-base) and fifth; the rest follow best
 * first. Slots listed in `fixed` keep their batter (a pitcher ninth).
 */
export function bookOrder(lines: readonly PaLine[], env: OrderEnv, fixed: readonly number[] = []): number[] {
  const free = lines.map((_, i) => i).filter((i) => !fixed.includes(i));
  const worth = new Map(free.map((i) => [i, alone(lines[i], env)]));
  const ranked = [...free].sort((a, b) => worth.get(b)! - worth.get(a)!);
  const top3 = ranked.slice(0, 3), next2 = ranked.slice(3, 5), rest = ranked.slice(5);
  const lead = [...top3].sort((a, b) => obp(lines[b]) - obp(lines[a]))[0];
  const [second, fourth] = top3.filter((i) => i !== lead);
  const [third, fifth] = [...next2].sort((a, b) => obp(lines[b]) - obp(lines[a]));
  const order = [lead, second, third, fourth, fifth, ...rest].filter((i) => i != null);
  const out = Array<number>(lines.length);
  for (const i of fixed) out[i] = i;
  let at = 0;
  for (let slot = 0; slot < out.length; slot++) if (out[slot] == null) out[slot] = order[at++];
  return out;
}

export interface OrderResult {
  /** Batter indexes in batting order. */
  order: number[];
  runs: number;
  /** The usual order and its runs, for comparison. */
  book: number[];
  bookRuns: number;
}

/**
 * The order with the most runs: swaps and moves from the usual order and from
 * on-base order, first improvement, until nothing gains. About 50 ms for nine
 * batters. Checked against trying every order (8 bats and a pitcher ninth,
 * 40,320 orders) in 1910, 1968, 2000 and the PT default: the same order and
 * runs each time.
 */
export function bestOrder(lines: readonly PaLine[], env: OrderEnv, fixed: readonly number[] = []): OrderResult {
  const n = lines.length;
  const arr = lines.map(asArray);
  const score = (o: readonly number[]) => gameRunsOf(o.map((i) => arr[i]), env, 9);
  const book = bookOrder(lines, env, fixed);
  const bookRuns = score(book);
  const movable = [...Array(n).keys()].filter((s) => !fixed.includes(s));
  const byObp = (() => {
    const out = [...book];
    const free = movable.map((s) => book[s]).sort((a, b) => obp(lines[b]) - obp(lines[a]));
    movable.forEach((s, j) => { out[s] = free[j]; });
    return out;
  })();

  let best = { order: book, runs: bookRuns };
  for (const start of [book, byObp]) {
    let cur = [...start], curRuns = score(cur);
    for (let improved = true; improved;) {
      improved = false;
      for (let a = 0; a < movable.length && !improved; a++) for (let b = a + 1; b < movable.length && !improved; b++) {
        const t = [...cur];
        [t[movable[a]], t[movable[b]]] = [t[movable[b]], t[movable[a]]];
        const r = score(t);
        if (r > curRuns + 1e-9) { cur = t; curRuns = r; improved = true; }
      }
      for (let a = 0; a < movable.length && !improved; a++) for (let b = 0; b < movable.length && !improved; b++) {
        if (a === b) continue;
        const slots = movable.map((s) => cur[s]);
        const [x] = slots.splice(a, 1);
        slots.splice(b, 0, x);
        const t = [...cur];
        movable.forEach((s, j) => { t[s] = slots[j]; });
        const r = score(t);
        if (r > curRuns + 1e-9) { cur = t; curRuns = r; improved = true; }
      }
    }
    if (curRuns > best.runs) best = { order: cur, runs: curRuns };
  }
  return { order: best.order, runs: best.runs, book, bookRuns };
}
