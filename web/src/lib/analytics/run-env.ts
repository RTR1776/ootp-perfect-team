/**
 * Run-environment model — the 24-state base/out Markov chain that produced
 * `PT Strategy Presets by Environment.html`, ported here so the app can solve
 * an environment on demand instead of reading precomputed rows.
 *
 * A tournament's environment is TWO independent settings: the era (databotai
 * puts it at the end of the title — "Daily Diamond Cap 1998") and the stadium
 * ("1993 Joe Robbie Stadium"). Era fixes the rate profile; the park scales
 * BABIP/HR/2B/3B on top of it. Strikeouts and walks are park-immune.
 *
 * Units gotcha carried over from the Card Lab: K/BB/HBP are per PA, but
 * HR/B2/B3 are per ball-in-play and BABIP is per (BIP - HR). Treating the
 * per-BIP rates as per-PA inflates every environment by ~30%.
 */

export interface EraRates {
  K: number; BB: number; HBP: number;
  HR: number; B2: number; B3: number; BABIP: number;
}

export interface ParkFactors { avg: number; hr: number; d2: number; d3: number }

export const NEUTRAL_PARK: ParkFactors = { avg: 1, hr: 1, d2: 1, d3: 1 };

type Base = [number, number, number];

const BASES: Base[] = [];
for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) BASES.push([a, b, c]);
const bidx = (b: Base) => b[0] * 4 + b[1] * 2 + b[2];

const EVS = ["K", "BB", "HR", "B1", "B2", "B3", "OUT"] as const;
type Ev = (typeof EVS)[number];

/** Per-PA event probabilities from the era's mixed-unit rate profile. */
export function probs(e: EraRates): Record<Ev, number> {
  const bip = 1 - e.K - e.BB - e.HBP;
  const HR = e.HR * bip, B2 = e.B2 * bip, B3 = e.B3 * bip;
  const hits = e.BABIP * (bip - HR);
  const B1 = Math.max(hits - B2 - B3, 0);
  const OUT = Math.max(bip - HR - B1 - B2 - B3, 0);
  return { K: e.K, BB: e.BB + e.HBP, HR, B1, B2, B3, OUT };
}

/** Ground-ball share of outs — falls as the era's home-run rate climbs. */
const gshare = (hrbip: number) => Math.min(0.62, Math.max(0.42, 0.6 - 4.0 * (hrbip - 0.014)));

type Trans = [Base, number, number, number]; // [newBases, outsAdded, runs, weight]

function trans(b: Base, ev: Ev, g: number, dp: number, o: number): Trans[] {
  const [b1, b2, b3] = b;
  const out: Trans[] = [];
  if (ev === "K") out.push([b, 1, 0, 1]);
  else if (ev === "OUT") {
    const gp = g, fp = 1 - g;
    if (b1 && o < 2) { out.push([[0, b2, b3], 2, 0, gp * dp]); out.push([[0, 1, b3], 1, 0, gp * (1 - dp)]); }
    else if (b1) out.push([b, 1, 0, gp]);
    else { out.push([[0, 0, b2], 1, b3, gp * 0.35]); out.push([b, 1, 0, gp * 0.65]); }
    if (b3 && o < 2) { out.push([[b1, b2, 0], 1, 1, fp * 0.5]); out.push([b, 1, 0, fp * 0.5]); }
    else out.push([b, 1, 0, fp]);
  } else if (ev === "BB") {
    if (b1 && b2 && b3) out.push([[1, 1, 1], 0, 1, 1]);
    else if (b1 && (b2 || b3)) out.push([[1, 1, 1], 0, 0, 1]);
    else if (b1) out.push([[1, 1, b3], 0, 0, 1]);
    else out.push([[1, b2, b3], 0, 0, 1]);
  } else if (ev === "B1") {
    if (b2) {
      out.push([[1, 0, b1], 0, b3 + b2, 0.6 * 0.28]); out.push([[1, b1, 0], 0, b3 + b2, 0.6 * 0.72]);
      out.push([[1, 1, b1], 0, b3, 0.4 * 0.28]); out.push([[1, b1, 1], 0, b3, 0.4 * 0.72]);
    } else { out.push([[1, 0, b1], 0, b3, 0.28]); out.push([[1, b1, 0], 0, b3, 0.72]); }
  } else if (ev === "B2") {
    if (b1) { out.push([[0, 1, 0], 0, b1 + b2 + b3, 0.55]); out.push([[0, 1, 1], 0, b2 + b3, 0.45]); }
    else out.push([[0, 1, 0], 0, b2 + b3, 1]);
  } else if (ev === "B3") out.push([[0, 0, 1], 0, b1 + b2 + b3, 1]);
  else if (ev === "HR") out.push([[0, 0, 0], 0, 1 + b1 + b2 + b3, 1]);
  return out;
}

function buildRE(p: Record<Ev, number>, g: number, dp: number): number[][] {
  let RE = Array.from({ length: 8 }, () => [0, 0, 0]);
  for (let it = 0; it < 400; it++) {
    const N = Array.from({ length: 8 }, () => [0, 0, 0]);
    let mx = 0;
    for (const b of BASES) for (let o = 0; o < 3; o++) {
      let v = 0;
      for (const ev of EVS) {
        const pr = p[ev]; if (!pr) continue;
        for (const [ns, oa, r, w] of trans(b, ev, g, dp, o)) {
          const no = o + oa;
          v += pr * w * (r + (no >= 3 ? 0 : RE[bidx(ns)][no]));
        }
      }
      N[bidx(b)][o] = v; mx = Math.max(mx, Math.abs(v - RE[bidx(b)][o]));
    }
    RE = N; if (mx < 1e-13) break;
  }
  return RE;
}

export interface Analysis {
  RG: number; reStart: number; rates: Record<Ev, number>;
  bunt_1_0: number; bunt_12_0: number; bunt_2_0: number;
  sbbe0: number; sbbe1: number; sbbe2: number;
}

function analyze(e: EraRates): Analysis {
  const p = probs(e), g = gshare(e.HR), dp = 0.115, RE = buildRE(p, g, dp);
  const r = (b: Base, o: number) => RE[bidx(b)][o];
  const sb = (o: number) => {
    const gn = r([0, 1, 0], o) - r([1, 0, 0], o);
    const ls = (o < 2 ? r([0, 0, 0], o + 1) : 0) - r([1, 0, 0], o);
    return -ls / (gn - ls);
  };
  return {
    RG: r([0, 0, 0], 0) * 9, reStart: r([0, 0, 0], 0), rates: p,
    bunt_1_0: r([0, 1, 0], 1) - r([1, 0, 0], 0),
    bunt_12_0: r([0, 1, 1], 1) - r([1, 1, 0], 0),
    bunt_2_0: r([0, 0, 1], 1) - r([0, 1, 0], 0),
    sbbe0: sb(0), sbbe1: sb(1), sbbe2: sb(2),
  };
}

export const applyPark = (e: EraRates, f: ParkFactors): EraRates =>
  ({ ...e, BABIP: e.BABIP * f.avg, HR: e.HR * f.hr, B2: e.B2 * f.d2, B3: e.B3 * f.d3 });

export const PRESETS = [
  "Sabermetric", "Moderate Sabermetric", "Balanced",
  "Traditional", "Moderate Small Ball", "Small Ball",
] as const;

export interface RunEnv extends Analysis { preset: string; presetIndex: number; notes: string[] }

/**
 * Solve an environment.
 *
 * `statedRG` anchors the answer: the raw model runs 2-9% under each era's
 * stated R/G (it credits no errors, wild pitches or extra advancement), so
 * absolute scoring is reported on the stated scale and moved only by the
 * model's RELATIVE response to the park. Using raw model R/G would silently
 * shift several eras across the 4.05 preset threshold.
 */
export function solveEnv(rates: EraRates, statedRG: number, park?: ParkFactors | null): RunEnv {
  const neutral = analyze(rates);
  const m = park ? analyze(applyPark(rates, park)) : neutral;
  const RG = statedRG * (m.RG / neutral.RG);
  const b = m.bunt_12_0;
  let i = b >= 0.09 ? 5 : b >= 0.045 ? 4 : b >= 0.025 ? 3 : b >= 0.005 ? 2 : b >= -0.03 ? 1 : 0;
  const notes: string[] = [];
  if (RG < 4.05 && i < 5) { i++; notes.push(`bumped +1 toward small ball (R/G ${RG.toFixed(2)} < 4.05)`); }
  if (m.rates.K >= 0.2 && i > 2) { i = 2; notes.push(`capped at Balanced (K rate ${(m.rates.K * 100).toFixed(1)}% strands runners)`); }
  return { ...m, RG, preset: PRESETS[i], presetIndex: i, notes };
}

/** Blend a park's L/R split factors for a lineup that is `lhbShare` left-handed. */
export function blendPark(
  f: { avgL: number; avgR: number; hrL: number; hrR: number; d2: number; d3: number },
  lhbShare = 0.35,
): ParkFactors {
  const R = 1 - lhbShare;
  return { avg: f.avgL * lhbShare + f.avgR * R, hr: f.hrL * lhbShare + f.hrR * R, d2: f.d2, d3: f.d3 };
}

/* ------------------------------------------------------------------ */
/* Derived rate line — the slash stats an environment produces.         */
/* ------------------------------------------------------------------ */

/**
 * Closed-form, no Markov solve: every one of these falls straight out of the
 * rate profile, which is why the era chart can redraw 140 years on a keystroke.
 * Only R/G and the bunt/steal break-evens need the chain.
 *
 * `SF` is ignored (the export has none), so AB is PA minus walks and HBP. That
 * biases AVG/SLG up by well under a point and never changes a comparison,
 * since it biases every era identically.
 */
export interface RateLine {
  avg: number; obp: number; slg: number; ops: number; babip: number;
  bbPct: number; kPct: number; hrPa: number;
  whip: number; k9: number; bb9: number; hr9: number;
  /** Runs allowed per 9 — the run environment itself, not a modelled ERA. */
  ra9: number;
  paPer9: number;
}

export function rateLine(e: EraRates, RG: number): RateLine {
  const p = probs(e);
  const bip = 1 - e.K - e.BB - e.HBP;
  const hr = e.HR * bip;
  const H = p.B1 + p.B2 + p.B3 + hr;
  const AB = 1 - e.BB - e.HBP;
  const onBase = H + e.BB + e.HBP;
  const outsPerPa = 1 - onBase;
  const paPer9 = outsPerPa > 0 ? 27 / outsPerPa : 0;
  return {
    avg: H / AB,
    obp: onBase,
    slg: (p.B1 + 2 * p.B2 + 3 * p.B3 + 4 * hr) / AB,
    ops: onBase + (p.B1 + 2 * p.B2 + 3 * p.B3 + 4 * hr) / AB,
    babip: (H - hr) / Math.max(AB - e.K - hr, 1e-9),
    bbPct: e.BB,
    kPct: e.K,
    hrPa: hr,
    whip: ((H + e.BB) * paPer9) / 9,
    k9: e.K * paPer9,
    bb9: e.BB * paPer9,
    hr9: hr * paPer9,
    ra9: RG,
    paPer9,
  };
}

/* ------------------------------------------------------------------ */
/* Linear weights — what one event is worth in THIS environment.        */
/* ------------------------------------------------------------------ */

export type EventKey = Ev;
export const EVENT_KEYS = EVS;

export interface LinearWeights {
  /** Expected runs added by one occurrence, averaged over the states it happens in. */
  abs: Record<Ev, number>;
  /** The same minus a generic out — what a card actually buys you. */
  aboveOut: Record<Ev, number>;
  /** Plate appearances per inning, which is what turns a rate into a count. */
  paPerInning: number;
}

/**
 * Run values are frequency-weighted over the base/out states a plate
 * appearance actually arrives in, so they respond to the environment: in a
 * high-OBP era more men are on, and a single is worth more.
 *
 * The state frequencies come from propagating the same chain forward from
 * (bases empty, 0 out) until the inning's mass is spent — the identical
 * transition table `buildRE` solves backwards, so the weights and the run
 * expectancies can never drift apart.
 */
export function linearWeights(e: EraRates): LinearWeights {
  const p = probs(e), g = gshare(e.HR), dp = 0.115, RE = buildRE(p, g, dp);

  const f = Array.from({ length: 8 }, () => [0, 0, 0]);
  let v = Array.from({ length: 8 }, () => [0, 0, 0]);
  v[bidx([0, 0, 0])][0] = 1;
  let total = 0;
  for (let it = 0; it < 400; it++) {
    const n = Array.from({ length: 8 }, () => [0, 0, 0]);
    let step = 0;
    for (const b of BASES) for (let o = 0; o < 3; o++) {
      const w = v[bidx(b)][o];
      if (w < 1e-15) continue;
      f[bidx(b)][o] += w; step += w;
      for (const ev of EVS) {
        const pr = p[ev]; if (!pr) continue;
        for (const [ns, oa, , tw] of trans(b, ev, g, dp, o)) {
          const no = o + oa;
          if (no >= 3) continue;
          n[bidx(ns)][no] += w * pr * tw;
        }
      }
    }
    total += step;
    v = n;
    if (step < 1e-12) break;
  }

  const abs = {} as Record<Ev, number>;
  for (const ev of EVS) {
    let num = 0;
    for (const b of BASES) for (let o = 0; o < 3; o++) {
      const w = f[bidx(b)][o];
      if (w < 1e-15) continue;
      const cur = RE[bidx(b)][o];
      for (const [ns, oa, r, tw] of trans(b, ev, g, dp, o)) {
        const no = o + oa;
        num += w * tw * (r + (no >= 3 ? 0 : RE[bidx(ns)][no]) - cur);
      }
    }
    abs[ev] = num / total;
  }
  const aboveOut = {} as Record<Ev, number>;
  for (const ev of EVS) aboveOut[ev] = abs[ev] - abs.OUT;
  return { abs, aboveOut, paPerInning: total };
}

/** Runs per plate appearance a rate profile produces against these weights. */
export function runsPerPa(e: EraRates, w: LinearWeights): number {
  const p = probs(e);
  let r = 0;
  for (const ev of EVS) r += p[ev] * w.abs[ev];
  return r;
}
