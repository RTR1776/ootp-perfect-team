/**
 * Resolving a tournament into a run environment.
 *
 * Two independent settings, and databotai reports them in different places:
 *   era  — the trailing year in the title ("Daily Diamond Cap 1998"), stored as
 *          tournaments.envYear. Year 2010 is databotai's label for PT's default
 *          modern environment (60 of 113 events carry it, matching the ~62
 *          null reYears in engine/config/tournaments.json), so it maps to the
 *          Card Lab's fitted PT-default profile rather than to MLB 2010.
 *   park  — tournaments.stadium, "<year> <name>". Nothing ties the park year to
 *          the era year: PTCS 4 Cap Replay runs the modern environment in 1995
 *          Coors Field.
 *
 * Park factors are looked up by name AND year, because the year is the whole
 * story in some parks — 1996 Coors is an average park (AVG 1.14 / HR 1.05),
 * 2000 Coors is a homer park (AVG 1.09 / HR 1.27), and per the park-factor
 * work the AVG factor moves scoring roughly 3x as hard as the HR factor.
 */

import ERAS from "@/data/eras.json";
import PARKS from "@/data/park-factors.json";
import { blendPark, solveEnv, type EraRates, type RunEnv } from "@/lib/analytics/run-env";

export interface ParkRow {
  team: string | null;
  avgL: number; avgR: number; hrL: number; hrR: number; d2: number; d3: number;
}
export interface EraRow { rates: EraRates; rg: number; src: string; preset: string | null }

export const eraTable = ERAS as unknown as Record<string, EraRow>;
export const parkTable = PARKS as unknown as Record<string, Record<string, ParkRow>>;

/** databotai's label for PT's default modern environment. */
export const PT_DEFAULT_ENV_YEAR = 2010;

export const eraYears = Object.keys(eraTable).map(Number).sort((a, b) => b - a);
export const parkNames = Object.keys(parkTable).sort();

export function eraFor(year: number | null): { row: EraRow; label: string } | null {
  if (year == null) return null;
  if (year === PT_DEFAULT_ENV_YEAR && eraTable["0"]) {
    return { row: eraTable["0"], label: `PT default (listed as ${PT_DEFAULT_ENV_YEAR})` };
  }
  const row = eraTable[String(year)];
  return row ? { row, label: `${year} · ${row.src}` } : null;
}

export interface ParkPick { name: string | null; year: number | null; row: ParkRow | null; label: string }

/** Neutral until proven otherwise — a missing park must never fake a factor. */
export function parkFor(stadium: string | null): ParkPick {
  if (!stadium) return { name: null, year: null, row: null, label: "no stadium listed → neutral" };
  const m = /^(\d{4})\s+(.*)$/.exec(stadium);
  const wantYear = m ? Number(m[1]) : null;
  const name = (m ? m[2] : stadium).trim();
  if (/^standard stadium$/i.test(name)) return { name, year: wantYear, row: null, label: "Standard Stadium (neutral)" };

  let key: string | null = parkTable[name] ? name : null;
  if (!key) {
    const alias: Record<string, string> = { "Comisky Park": "Comiskey Park" }; // databotai's spelling
    if (alias[name] && parkTable[alias[name]]) key = alias[name];
  }
  if (!key) {
    const hits = parkNames.filter((p) => p.includes(name) || name.includes(p));
    if (hits.length === 1) key = hits[0];
  }
  if (!key) return { name, year: wantYear, row: null, label: `no factors on file for ${name} → neutral` };

  const years = Object.keys(parkTable[key]).map(Number).sort((a, b) => a - b);
  const pick = wantYear == null
    ? years[years.length - 1]
    : years.reduce((best, y) => (Math.abs(y - wantYear) < Math.abs(best - wantYear) ? y : best), years[0]);
  return {
    name: key, year: pick, row: parkTable[key][String(pick)],
    label: pick === wantYear ? `${key} ${pick}` : `${key} ${pick} (nearest on file to ${wantYear})`,
  };
}

export function solveFor(era: EraRow, park: ParkRow | null, lhbShare = 0.35): RunEnv {
  return solveEnv(era.rates, era.rg, park ? blendPark(park, lhbShare) : null);
}

/** The comparable slice of an environment — what a card is judged against. */
export interface EnvVector {
  rg: number; k: number; hr: number; b1: number; b2: number;
  bunt: number; sb: number; preset: string;
}

export const vectorOf = (e: RunEnv): EnvVector => ({
  rg: e.RG, k: e.rates.K, hr: e.rates.HR, b1: e.rates.B1, b2: e.rates.B2,
  bunt: e.bunt_12_0, sb: e.sbbe0, preset: e.preset,
});

/** Offense shape decides which cards are good; the small-ball pair is strategy. */
export const OFFENSE_KEYS = ["rg", "k", "hr", "b1", "b2"] as const;
export const STRATEGY_KEYS = ["bunt", "sb"] as const;
export type MetricKey = (typeof OFFENSE_KEYS)[number] | (typeof STRATEGY_KEYS)[number];

/** z-scored Euclidean distance, so R/G in runs and K in rate weigh the same. */
export function distance(a: EnvVector, b: EnvVector, keys: readonly MetricKey[], sd: Record<string, number>): number {
  return Math.sqrt(keys.reduce((s, k) => s + ((a[k] - b[k]) / (sd[k] || 1)) ** 2, 0));
}

export function spreads(rows: EnvVector[], keys: readonly MetricKey[]): Record<string, number> {
  const sd: Record<string, number> = {};
  for (const k of keys) {
    const v = rows.map((r) => r[k]);
    const m = v.reduce((a, b) => a + b, 0) / (v.length || 1);
    sd[k] = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length || 1)) || 1;
  }
  return sd;
}
