/**
 * Parser for the official PT category standings exports
 * (`pt_standings_tournament_daily_diamond_period_5_(weeks_18-21)_-_...csv`).
 *
 * These are what turn the PTCS targets from an estimate into a fact. Until a
 * period's standings land, targets are guessed from the previous period's
 * cutoff scaled by length; once they land, we read the real qualifying line
 * straight off the rank we care about.
 */

import { num, parseCsv } from "./csv";
import type { Category } from "./constants";

export interface StandingsRow {
  rank: number;
  user: string;
  team: string | null;
  points: number;
  played: number | null;
  combined: number | null;
  best: number | null;
}

export interface StandingsFile {
  category: Category | null;
  /** "tournament" | "draft" — draft files are the PD standings. */
  family: string | null;
  period: number | null;
  weeks: string | null;
  dateRange: string | null;
  rows: StandingsRow[];
  /** Points at each qualifying rank of interest. */
  cutoffs: Record<number, number | null>;
}

const FILENAME_CATEGORY: Array<[RegExp, Category]> = [
  [/draft_daily/i, "PD Daily"],
  [/draft_weekly/i, "PD Weekly"],
  [/daily_iron/i, "Iron"],
  [/daily_bronze/i, "Bronze"],
  [/daily_silver/i, "Silver"],
  [/daily_gold/i, "Gold"],
  [/daily_diamond/i, "Diamond"],
  [/daily_open/i, "Open"],
  [/daily_live/i, "Live"],
  [/daily_cap/i, "Cap"],
];

/** Ranks worth reporting a cutoff for — berth lines and the PTCS field size. */
export const CUTOFF_RANKS = [32, 64, 128, 256] as const;

export function parseStandingsFilename(filename: string): {
  category: Category | null;
  family: string | null;
  period: number | null;
  weeks: string | null;
  dateRange: string | null;
} {
  const base = filename.toLowerCase();
  const category = FILENAME_CATEGORY.find(([re]) => re.test(base))?.[1] ?? null;
  const family = /draft_/.test(base) ? "draft" : /tournament_/.test(base) ? "tournament" : null;
  const period = num(base.match(/period[_\s]+(\d+)/)?.[1] ?? null);
  const weeks = base.match(/weeks[_\s]+([\d-]+)/)?.[1] ?? null;
  const dateRange = base.match(/-\s*([a-z]{3}_\d{2}[a-z]{2}_till_[a-z]{3}_\d{2}[a-z]{2})/)?.[1] ?? null;
  return { category, family, period, weeks, dateRange };
}

export function parseStandings(text: string, filename = ""): StandingsFile {
  const parsed = parseCsv(text);
  const meta = parseStandingsFilename(filename);

  const rows: StandingsRow[] = [];
  for (const row of parsed.rows) {
    const rank = num(row["Rank"]);
    const points = num(row["Points"]);
    if (rank == null || points == null) continue;
    rows.push({
      rank,
      user: (row["User"] ?? "").trim(),
      team: (row["Team"] ?? "").trim() || null,
      points,
      played: num(row["Played"]),
      combined: num(row["Combined"]),
      best: num(row["Best"]),
    });
  }

  rows.sort((a, b) => a.rank - b.rank);

  const cutoffs: Record<number, number | null> = {};
  for (const rank of CUTOFF_RANKS) {
    cutoffs[rank] = rows.find((r) => r.rank === rank)?.points ?? null;
  }

  return { ...meta, rows, cutoffs };
}

export function looksLikeStandings(headerLine: string): boolean {
  return /Rank/i.test(headerLine) && /User/i.test(headerLine) && /Points/i.test(headerLine);
}

/**
 * Project a period's final cutoff from a partial standing.
 *
 * The 128th-place line accumulates close to LINEARLY — week 1 to week 2 has
 * run 1.9-2.1x all season — so `current x (totalDays / elapsedDays)` has been
 * the most accurate method available. Report it as a band, not a point
 * estimate; false precision here is worse than an honest range.
 */
export function projectCutoff(
  currentPoints: number,
  elapsedDays: number,
  totalDays: number,
): { low: number; mid: number; high: number } {
  if (elapsedDays <= 0) return { low: 0, mid: 0, high: 0 };
  const mid = (currentPoints * totalDays) / elapsedDays;
  return { low: Math.round(mid * 0.9), mid: Math.round(mid), high: Math.round(mid * 1.1) };
}
