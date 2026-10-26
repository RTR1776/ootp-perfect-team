/**
 * What scripts/draft-study.ts learned from a draft series' exports, as the
 * page reads it (src/data/draft-study.json). Pure.
 */
import STUDY from "@/data/draft-study.json";

export interface StudyTeam {
  file: string;
  org: string;
  w: number;
  l: number;
  /** The engine's finished-team value. */
  value: number;
  /** Its percentile among that run's full teams. */
  pct: number;
  /** Every card on file; when false a card never played and the value is a floor. */
  full: boolean;
}

export interface StudySeries {
  files: string[];
  /** Teams in the files, and those with every card on file (the rest had a card that never played). */
  teams: number;
  fullTeams: number;
  /** The field measured as the importer measures it (field-construction, series_meta), on these files only. */
  lhpBfShare: number | null;
  lhbPaShare: number | null;
  spWeight: number | null;
  rpWeight: number | null;
  staff: { sp: number; rp: number } | null;
  /** Share of full teams that drafted each card, by card id. */
  shares: Record<string, number>;
  /** Every card any team drafted in these files, and the last day they speak for (a card first listed after it can't be in them). */
  seen: number[];
  seenThrough: string;
  /**
   * Cards taken to have left the draft pool: drafted in the series' earlier runs
   * often enough to expect 3 or more picks in these files, and picked 0 times.
   */
  out: number[];
  /** The field's finished-team values: 0th..100th percentile. */
  fieldValues: number[];
  /** Win% against the engine's team value, full teams centred within each run. */
  validation: {
    teams: number;
    /** Pearson r of value with win% (all teams) and with run differential per game. */
    rWin: number;
    rRuns: number;
    /** Win% by quarter of value within each run, lowest first. */
    quarters: number[];
    /** The same r from the bats-only and arms-only halves of the value. */
    rBats: number;
    rArms: number;
    /** The same r for the sum of the team's card values: the market's read, for comparison. */
    rCardValue: number;
    /** Every team, with the number of its cards on file held fixed within each run. */
    allTeams: number;
    rWinAll: number;
    rCardValueAll: number;
    /** Card by card: model runs against runs in these events (bats wRAA, arms runs allowed), r and slope. */
    cards: { bats: { n: number; r: number; slope: number }; arms: { n: number; r: number; slope: number } };
  } | null;
  /** L.J.'s teams in these files. */
  lj: StudyTeam[];
  /** Notes from the study, one line each. */
  notes: string[];
}

export interface DraftStudy { generatedAt: string | null; series: Record<string, StudySeries> }

export const DRAFT_STUDY = STUDY as unknown as DraftStudy;

export const studyFor = (series: string): StudySeries | null => DRAFT_STUDY.series[series] ?? null;

/** Where a finished-team value sits in the field (0-100), from the study's percentiles; null without them. */
export function fieldPercentile(values: readonly number[] | null | undefined, v: number): number | null {
  if (!values?.length) return null;
  if (v <= values[0]) return 0;
  const last = values.length - 1;
  if (v >= values[last]) return 100;
  for (let k = 1; k <= last; k++) {
    if (v <= values[k]) {
      const lo = values[k - 1], hi = values[k];
      return ((k - 1) + (hi > lo ? (v - lo) / (hi - lo) : 0)) * (100 / last);
    }
  }
  return 100;
}
