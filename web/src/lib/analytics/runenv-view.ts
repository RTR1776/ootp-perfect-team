/**
 * The view model behind /runenv. Everything here is pure and static-data only
 * (eras.json, park-factors.json, curves.json), so the whole page solves in the
 * browser and a change of ballpark redraws 140 years without a round trip.
 *
 * The chart metrics are closed-form from the rate profile — no Markov solve —
 * which is what makes that affordable. R/G, the preset and the bunt/steal
 * break-evens do need the chain, so they are solved only for the environments
 * actually on screen.
 */

import {
  applyPark, blendPark, linearWeights, rateLine, solveEnv,
  type EraRates, type ParkFactors, type RateLine, type RunEnv,
} from "@/lib/analytics/run-env";
import { envFor, marginalRatings, type Env, type RatingValue } from "@/lib/analytics/card-value";
import { eraTable, parkTable, type EraRow, type ParkRow } from "@/lib/analytics/tournament-env";

export { eraTable, parkTable };
export { PT_DEFAULT_ENV_YEAR } from "@/lib/analytics/tournament-env";
export type { EraRow, ParkRow };

/** Years with an era row, newest first, PT-default row ("0") excluded. */
export const ERA_YEARS: number[] = Object.keys(eraTable)
  .map(Number).filter((y) => y > 1800).sort((a, b) => a - b);

export const PARK_NAMES: string[] = Object.keys(parkTable).sort();

export const parkYears = (name: string): number[] =>
  Object.keys(parkTable[name] ?? {}).map(Number).sort((a, b) => a - b);

export const parkRow = (name: string | null, year: number | null): ParkRow | null => {
  if (!name) return null;
  const ys = parkTable[name];
  if (!ys) return null;
  if (year != null && ys[String(year)]) return ys[String(year)];
  const all = parkYears(name);
  return all.length ? ys[String(all[all.length - 1])] : null;
};

/* ------------------------------------------------------------------ */
/* Era bands — the colour spine of the chart.                          */
/* ------------------------------------------------------------------ */

export interface EraBand { key: string; label: string; from: number; to: number; color: string }

/**
 * Named for how the game plays, not for MLB trivia: the boundaries are where
 * the strikeout rate and the homer rate actually step, because those are the
 * two numbers that decide which cards you buy.
 */
export const ERA_BANDS: EraBand[] = [
  { key: "origins", label: "Origins", from: 1884, to: 1900, color: "#7c6f64" },
  { key: "deadball", label: "Dead Ball", from: 1901, to: 1919, color: "#8d8d8d" },
  { key: "liveball", label: "Live Ball", from: 1920, to: 1941, color: "#f59e0b" },
  { key: "wwii", label: "WWII", from: 1942, to: 1945, color: "#a1a1aa" },
  { key: "postwar", label: "Post-War", from: 1946, to: 1960, color: "#3b82f6" },
  { key: "expansion", label: "Expansion", from: 1961, to: 1968, color: "#8b5cf6" },
  { key: "postmound", label: "Post-Mound", from: 1969, to: 1976, color: "#06b6d4" },
  { key: "freeagency", label: "Free Agency", from: 1977, to: 1992, color: "#22c55e" },
  { key: "steroid", label: "Steroid", from: 1993, to: 2004, color: "#ef4444" },
  { key: "testing", label: "Post-Testing", from: 2005, to: 2013, color: "#f97316" },
  { key: "modern", label: "Modern", from: 2014, to: 2026, color: "#ec4899" },
];

export const bandFor = (year: number): EraBand =>
  ERA_BANDS.find((b) => year >= b.from && year <= b.to) ?? ERA_BANDS[ERA_BANDS.length - 1];

/* ------------------------------------------------------------------ */
/* Metrics.                                                            */
/* ------------------------------------------------------------------ */

export type MetricSide = "bat" | "pitch";

export interface Metric {
  key: keyof RateLine | "rg";
  label: string;
  side: MetricSide;
  /** How to print one value. */
  fmt: (n: number) => string;
  /** True when a bigger number means more offence — drives the chart colour. */
  offenseUp: boolean;
  help: string;
}

const p3 = (n: number) => n.toFixed(3).replace(/^0/, "");
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
const pct2 = (n: number) => `${(n * 100).toFixed(2)}%`;
const d1 = (n: number) => n.toFixed(1);
const d2 = (n: number) => n.toFixed(2);

export const METRICS: Metric[] = [
  { key: "rg", label: "R/G", side: "bat", fmt: d2, offenseUp: true, help: "Runs per game per team — the headline. Anchored to the era's stated scale and moved only by the park's relative effect." },
  { key: "avg", label: "AVG", side: "bat", fmt: p3, offenseUp: true, help: "Batting average the environment produces league-wide." },
  { key: "obp", label: "OBP", side: "bat", fmt: p3, offenseUp: true, help: "On-base. Drives how many runners are on when a hit lands, which is why it moves every linear weight." },
  { key: "slg", label: "SLG", side: "bat", fmt: p3, offenseUp: true, help: "Slugging." },
  { key: "ops", label: "OPS", side: "bat", fmt: p3, offenseUp: true, help: "OBP + SLG." },
  { key: "babip", label: "BABIP", side: "bat", fmt: p3, offenseUp: true, help: "Hits per ball in play. The park hands this to everyone — the BA rating only explains 26% of it, so it is the one thing you cannot buy." },
  { key: "bbPct", label: "BB%", side: "bat", fmt: pct1, offenseUp: true, help: "Walk rate per plate appearance. Parks do not touch it." },
  { key: "kPct", label: "K%", side: "bat", fmt: pct1, offenseUp: false, help: "Strikeout rate. The single biggest driver of whether small ball works — a runner only advances if the next man makes contact." },
  { key: "hrPa", label: "HR/PA", side: "bat", fmt: pct2, offenseUp: true, help: "Home runs per plate appearance, after the park." },
  { key: "ra9", label: "RA/9", side: "pitch", fmt: d2, offenseUp: true, help: "Runs allowed per nine — the same number as R/G, read from the mound." },
  { key: "whip", label: "WHIP", side: "pitch", fmt: p3, offenseUp: true, help: "Walks + hits per inning." },
  { key: "k9", label: "K/9", side: "pitch", fmt: d1, offenseUp: false, help: "Strikeouts per nine innings." },
  { key: "bb9", label: "BB/9", side: "pitch", fmt: d1, offenseUp: true, help: "Walks per nine innings." },
  { key: "hr9", label: "HR/9", side: "pitch", fmt: d2, offenseUp: true, help: "Home runs per nine innings." },
];

export const metricFor = (key: string): Metric => METRICS.find((m) => m.key === key) ?? METRICS[0];

/* ------------------------------------------------------------------ */
/* Solving one environment.                                            */
/* ------------------------------------------------------------------ */

export interface EnvSpec {
  /** Era year; null means the PT default engine. */
  year: number | null;
  park: string | null;
  parkYear: number | null;
  /** Share of the lineup that bats left — blends the park's L/R factors. */
  lhbShare: number;
}

export interface Solved {
  spec: EnvSpec;
  eraRow: EraRow | null;
  parkRow: ParkRow | null;
  /** Park factors as applied, after the handedness blend. */
  factors: ParkFactors | null;
  /** Era rates after the park — what the league actually plays. */
  rates: EraRates | null;
  line: RateLine | null;
  env: RunEnv | null;
  valueEnv: Env | null;
  eraLabel: string;
  parkLabel: string;
}

const eraRowFor = (year: number | null): EraRow | null =>
  year == null ? (eraTable["0"] ?? null) : (eraTable[String(year)] ?? eraTable["0"] ?? null);

export function solve(spec: EnvSpec): Solved {
  const eraRow = eraRowFor(spec.year);
  const pr = parkRow(spec.park, spec.parkYear);
  const factors = pr ? blendPark(pr, spec.lhbShare) : null;
  if (!eraRow) {
    return { spec, eraRow: null, parkRow: pr, factors, rates: null, line: null, env: null, valueEnv: null,
      eraLabel: spec.year == null ? "PT default" : `${spec.year} (no era row)`, parkLabel: spec.park ?? "Neutral" };
  }
  const rates = factors ? applyPark(eraRow.rates, factors) : eraRow.rates;
  const env = solveEnv(eraRow.rates, eraRow.rg, factors);
  const line = rateLine(rates, env.RG);
  const valueEnv = envFor(eraRow.rates, factors, linearWeights(rates));
  return {
    spec, eraRow, parkRow: pr, factors, rates, line, env, valueEnv,
    eraLabel: spec.year == null ? "PT default engine" : `${spec.year} · ${eraRow.src}`,
    parkLabel: pr ? `${spec.parkYear ?? ""} ${spec.park}`.trim() : "Neutral park",
  };
}

export const metricValue = (s: Solved, key: string): number | null => {
  if (!s.line || !s.env) return null;
  if (key === "rg" || key === "ra9") return s.env.RG;
  const v = (s.line as unknown as Record<string, number>)[key];
  return Number.isFinite(v) ? v : null;
};

/**
 * One row per year for the chart. The ballpark is held constant across the
 * whole range on purpose: "what would every era look like in THIS park" is the
 * question a roster builder is actually asking.
 *
 * `withRg` costs two Markov solves a year, so it is opt-in.
 */
export interface YearPoint { year: number; value: number | null; band: EraBand }

export function series(
  years: number[], key: string, park: string | null, parkYear: number | null, lhbShare: number,
): YearPoint[] {
  const pr = parkRow(park, parkYear);
  const factors = pr ? blendPark(pr, lhbShare) : null;
  const needsSolve = key === "rg" || key === "ra9";
  return years.map((year) => {
    const row = year === 0 ? eraTable["0"] : eraTable[String(year)];
    if (!row) return { year, value: null, band: bandFor(year) };
    let value: number | null;
    if (needsSolve) value = solveEnv(row.rates, row.rg, factors).RG;
    else {
      const rates = factors ? applyPark(row.rates, factors) : row.rates;
      const v = (rateLine(rates, row.rg) as unknown as Record<string, number>)[key];
      value = Number.isFinite(v) ? v : null;
    }
    return { year, value, band: bandFor(year) };
  });
}

/* ------------------------------------------------------------------ */
/* The roster read.                                                    */
/* ------------------------------------------------------------------ */

export interface Levers { hit: RatingValue[]; pit: RatingValue[] }

export const leversOf = (s: Solved): Levers | null =>
  s.valueEnv ? { hit: marginalRatings(s.valueEnv, "hit"), pit: marginalRatings(s.valueEnv, "pit") } : null;

export interface HandRead {
  /** R/G with an all-left lineup and with an all-right one. */
  rgL: number; rgR: number;
  hrL: number; hrR: number; avgL: number; avgR: number;
  /** Positive = the park favours left-handed bats. */
  edge: number;
}

export function handRead(spec: EnvSpec): HandRead | null {
  const eraRow = eraRowFor(spec.year);
  const pr = parkRow(spec.park, spec.parkYear);
  if (!eraRow || !pr) return null;
  const rgL = solveEnv(eraRow.rates, eraRow.rg, blendPark(pr, 1)).RG;
  const rgR = solveEnv(eraRow.rates, eraRow.rg, blendPark(pr, 0)).RG;
  return { rgL, rgR, hrL: pr.hrL, hrR: pr.hrR, avgL: pr.avgL, avgR: pr.avgR, edge: rgL - rgR };
}
