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
import { CARD_TYPE_SHORT, cardTypeRuleLabel } from "@/lib/card-sets";

export interface SetEvidence {
  /** Distinct cards the field played with a known set. */
  n: number;
  /** Distinct cards with a known card year. */
  nYears: number;
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
/**
 * An open field plays cards from the 1870s to this year. One whose oldest
 * card is this recent, or whose newest is this old, is under a year rule:
 * Iron & Friends OOTP Era (1999–2026), Late 1900s (1980–1999), Live Plus (2026).
 */
export const NARROW_YEAR_FROM = 1930;
export const NARROW_YEAR_TO = 2005;
/** Live is a top-two set in most fields; a field this big with none is under a "no Live" rule. */
export const NO_LIVE_MIN_CARDS = 300;

export function summariseSetEvidence(rows: readonly { cardType: number | null; year: number | null }[]): SetEvidence | null {
  if (!rows.length) return null;
  const counts: Record<number, number> = {};
  let n = 0, nYears = 0, yearMin: number | null = null, yearMax: number | null = null;
  for (const r of rows) {
    if (r.cardType != null) { counts[r.cardType] = (counts[r.cardType] ?? 0) + 1; n++; }
    if (r.year != null) {
      nYears++;
      yearMin = yearMin == null ? r.year : Math.min(yearMin, r.year);
      yearMax = yearMax == null ? r.year : Math.max(yearMax, r.year);
    }
  }
  const types = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || a - b);
  return { n, nYears, counts, types, yearMin, yearMax };
}

/** The field plays so few sets that the event must restrict them. */
export function setsNarrow(e: SetEvidence): boolean {
  return e.n >= NARROW_MIN_CARDS && e.types.length > 0 && e.types.length <= NARROW_MAX_SETS;
}

/** The field's card years stop well short of the 1870s–today an open field plays. */
export function yearsNarrow(e: SetEvidence): boolean {
  return e.nYears >= NARROW_MIN_CARDS && e.yearMin != null && e.yearMax != null
    && (e.yearMin >= NARROW_YEAR_FROM || e.yearMax <= NARROW_YEAR_TO);
}

/** A big field with no Live card at all: usually "historical cards only". */
export function liveAbsent(e: SetEvidence): boolean {
  return e.n >= NO_LIVE_MIN_CARDS && !(e.counts[1] > 0);
}

/** "2026" or "1999–2026". */
export const yearSpan = (e: SetEvidence) => (e.yearMin === e.yearMax ? `${e.yearMin}` : `${e.yearMin}–${e.yearMax}`);
/** Every set but Live, as the catalogue stores it. */
export const NO_LIVE_RULE = cardTypeRuleLabel([2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** "HAS 209 · HH 111 (320 cards)". */
export function evidenceLine(e: SetEvidence): string {
  return `${e.types.map((t) => `${CARD_TYPE_SHORT[t] ?? t} ${e.counts[t]}`).join(" · ")} (${e.n} cards)`;
}

/** The set rule the evidence implies, in the catalogue's form: "Historical All-Star+Hardware Heroes". */
export function evidenceRule(e: SetEvidence): string {
  return cardTypeRuleLabel(e.types);
}

/**
 * For a script about to build a roster for a series: the reasons to stop when
 * the field's play shows a set or year rule the flags don't repeat, so a
 * roster doc can't repeat the 9100139 mistake. Sets and years are separate
 * rules: a set flag does not answer a year question (Live Plus with
 * --card-types 1,6 still let in older-year Future Legends). Null means go.
 */
export function setRuleGuard(
  series: string,
  e: SetEvidence | null,
  given: { cardTypes: boolean; cardYears: boolean; anySet: boolean },
): string | null {
  if (given.anySet || !e) return null;
  const stop: string[] = [];
  if (!given.cardTypes && setsNarrow(e)) {
    stop.push(`The field in ${series} plays only ${evidenceLine(e)}, so the event very likely allows only those sets.\n`
      + `Pass --card-types ${[...e.types].sort((a, b) => a - b).join(",")} (${evidenceRule(e)}).`);
  } else if (!given.cardTypes && liveAbsent(e) && !given.cardYears) {
    stop.push(`The field in ${series} has played no Live card in ${e.n} cards, so the event very likely bars Live cards.\n`
      + `Pass --card-types 2,3,4,5,6,7,8,9,10 (every set but Live).`);
  }
  if (!given.cardYears && yearsNarrow(e)) {
    stop.push(`Every card played in ${series} is from ${yearSpan(e)}, so the event very likely allows only those years.\n`
      + `Pass --card-year-min ${e.yearMin} --card-year-max ${e.yearMax}.`);
  }
  return stop.length ? `${stop.join("\n")}\nOr pass --any-set to build from every set and year anyway.` : null;
}
