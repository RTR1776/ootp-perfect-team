/**
 * Which card sets and card years an event's field actually plays, read off
 * the exports (observed_card_stats joined to cards, per series).
 *
 * The catalogue often lacks an event's set rule. Daily All-Star Hardware Slots
 * (9100139) had none until 2026-09-27, so a roster doc put Future Legend and
 * Snapshot cards on a board the game would refuse. The field's own play showed
 * the rule all along: every card played there was set 5 (209 cards) or 9 (111).
 *
 * Pure: the rows come from set-evidence-server.ts (or a test), so the same
 * reading serves /build, the roster scripts and the audit script.
 */
import { CARD_TYPE_SHORT, cardTypeRuleLabel } from "@/lib/roster-rules";

export interface SetEvidence {
  /** Distinct cards the field played. */
  n: number;
  /** Distinct cards per set (cards.card_type). */
  counts: Record<number, number>;
  /** Sets played, most-played first. */
  types: number[];
  yearMin: number | null;
  yearMax: number | null;
}

/** Enough cards that a missing set is a rule, not chance. */
export const NARROW_MIN_CARDS = 50;
/** Ten sets exist; a field playing three or fewer is almost always under a set rule. */
export const NARROW_MAX_SETS = 3;

export function summariseSetEvidence(rows: readonly { cardType: number | null; year: number | null }[]): SetEvidence | null {
  if (!rows.length) return null;
  const counts: Record<number, number> = {};
  let yearMin: number | null = null, yearMax: number | null = null;
  for (const r of rows) {
    if (r.cardType != null) counts[r.cardType] = (counts[r.cardType] ?? 0) + 1;
    if (r.year != null) {
      yearMin = yearMin == null ? r.year : Math.min(yearMin, r.year);
      yearMax = yearMax == null ? r.year : Math.max(yearMax, r.year);
    }
  }
  const types = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || a - b);
  return { n: rows.length, counts, types, yearMin, yearMax };
}

/** The field plays so few sets that the event must restrict them. */
export function setsNarrow(e: SetEvidence): boolean {
  return e.n >= NARROW_MIN_CARDS && e.types.length > 0 && e.types.length <= NARROW_MAX_SETS;
}

/** Every card played comes from one card year (Daily Live Plus: 2026 cards only). */
export function yearsNarrow(e: SetEvidence): boolean {
  return e.n >= NARROW_MIN_CARDS && e.yearMin != null && e.yearMin === e.yearMax;
}

/** "HAS 209 · HH 111 (320 cards)". */
export function evidenceLine(e: SetEvidence): string {
  return `${e.types.map((t) => `${CARD_TYPE_SHORT[t] ?? t} ${e.counts[t]}`).join(" · ")} (${e.n} cards)`;
}

/** The set rule the evidence implies, in the catalogue's form: "Historical All-Star+Hardware Heroes". */
export function evidenceRule(e: SetEvidence): string {
  return cardTypeRuleLabel(e.types);
}

/**
 * For a script about to build a roster for a series: a reason to stop when the
 * field plays only a few sets (or one card year) and no rule was given, so a
 * roster doc can't repeat the 9100139 mistake. Null means go ahead.
 */
export function setRuleGuard(
  series: string,
  e: SetEvidence | null,
  given: { cardTypes: boolean; cardYears: boolean; anySet: boolean },
): string | null {
  if (given.anySet || !e) return null;
  if (!given.cardTypes && setsNarrow(e)) {
    return `The field in ${series} plays only ${evidenceLine(e)}, so the event very likely allows only those sets.\n`
      + `Pass --card-types ${[...e.types].sort((a, b) => a - b).join(",")} (${evidenceRule(e)}), or --any-set to build from every set anyway.`;
  }
  if (!given.cardTypes && !given.cardYears && yearsNarrow(e)) {
    return `Every card played in ${series} is a ${e.yearMin} card (${evidenceLine(e)}), so the event very likely allows only ${e.yearMin} cards.\n`
      + `Pass --card-year-min ${e.yearMin} --card-year-max ${e.yearMax}, or --any-set to build from every year anyway.`;
  }
  return null;
}
