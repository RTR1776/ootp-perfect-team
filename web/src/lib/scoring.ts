/**
 * Tournament result scoring for the PTCS category standings.
 *
 * This is the logic that currently lives in a spreadsheet and in the head of
 * whoever is scoring the screenshot. Encoding it here is the point of the app:
 * paste a result, get the points, never mis-add a multi-category event again.
 */

import {
  CATEGORY_BY_TAG,
  FIELD_SIZES,
  NON_SCORING_TAGS,
  POINTS_TABLE,
  PLACEMENTS,
  type Category,
  type FieldSize,
  type Placement,
} from "./ingest/constants";

export interface ResultRow {
  /** Event instance id from the tournament name, e.g. 1900080. THE dedup key. */
  eventId: number | null;
  name: string;
  /** Raw STANDINGS cell, e.g. "Silver,Cap" or "Gld,Cp,TW". */
  standingsTag: string;
  categories: Category[];
  fieldSize: FieldSize | null;
  placement: Placement | null;
  /** True when the row showed "Eliminated" with no placement — scores nothing. */
  eliminated: boolean;
  /** Points awarded per category. Each category gets the FULL amount. */
  points: number;
  /** points x categories.length — what the day total actually increases by. */
  totalPoints: number;
  warnings: string[];
}

/** "64 / 64 - Bo7" -> 64. Always read this off the row; it changes over the year. */
export function parseFieldSize(text: string): FieldSize | null {
  const match = text.match(/(\d{2,4})\s*\/\s*(\d{2,4})/);
  const raw = match ? Number(match[2]) : Number(text.trim());
  if (!Number.isFinite(raw)) return null;
  return (FIELD_SIZES as readonly number[]).includes(raw) ? (raw as FieldSize) : null;
}

const PLACEMENT_PATTERNS: Array<[RegExp, Placement]> = [
  [/^winner|^1st|^champion/i, "1st"],
  [/^2nd|runner.?up/i, "2nd"],
  [/^3rd\s*[/&-]\s*4th|^3rd-4th|^semi/i, "3rd-4th"],
  [/^5th\s*-\s*8th|^quarter|^qf/i, "5th-8th"],
  [/^9th\s*-\s*16th/i, "9th-16th"],
  [/^17th\s*-\s*32nd/i, "17th-32nd"],
  [/^33rd\s*-\s*64th/i, "33rd-64th"],
  [/^65th\s*-\s*128th/i, "65th-128th"],
  [/^129th\s*-\s*256th/i, "129th-256th"],
];

/**
 * "Eliminated" with no placement shown scores nothing and must be logged as 0
 * with a note — not guessed at.
 */
export function parsePlacement(text: string): {
  placement: Placement | null;
  eliminated: boolean;
} {
  const s = text.trim();
  if (/^eliminated/i.test(s)) return { placement: null, eliminated: true };
  for (const [pattern, placement] of PLACEMENT_PATTERNS) {
    if (pattern.test(s)) return { placement, eliminated: false };
  }
  return { placement: null, eliminated: false };
}

/**
 * Split a STANDINGS cell into scoring categories.
 *
 * `TW` (tournament weekly) is NOT a standing in PT 27 and is dropped: a
 * `Dia,TW` event scores Diamond only. It pays extra only when Cap or Live is
 * also tagged (`Gld,Cp,TW` -> Gold + Cap).
 */
export function parseCategories(tag: string): {
  categories: Category[];
  unknown: string[];
} {
  const categories: Category[] = [];
  const unknown: string[] = [];
  for (const partRaw of tag.split(/[,/|]+/)) {
    const part = partRaw.trim().toLowerCase();
    if (!part) continue;
    if (NON_SCORING_TAGS.has(part)) continue;
    const category = CATEGORY_BY_TAG[part];
    if (category) {
      if (!categories.includes(category)) categories.push(category);
    } else {
      unknown.push(partRaw.trim());
    }
  }
  return { categories, unknown };
}

/** "Daily Silver & Friends Deadball Slots (1900080)" -> 1900080 */
export function parseEventId(name: string): number | null {
  const match = name.match(/\((\d{4,9})\)/);
  return match ? Number(match[1]) : null;
}

export function pointsFor(placement: Placement, fieldSize: FieldSize): number | null {
  return POINTS_TABLE[placement][fieldSize];
}

export interface ScoreInput {
  name: string;
  standingsTag: string;
  field: string;
  status: string;
}

export function scoreResult(input: ScoreInput): ResultRow {
  const warnings: string[] = [];
  const eventId = parseEventId(input.name);
  if (eventId == null) {
    warnings.push("No event id in the name — cannot dedupe this row against earlier uploads.");
  }

  const fieldSize = parseFieldSize(input.field);
  if (fieldSize == null) warnings.push(`Unrecognised field size: "${input.field}"`);

  const { placement, eliminated } = parsePlacement(input.status);
  if (!placement && !eliminated) warnings.push(`Unrecognised placement: "${input.status}"`);

  const { categories, unknown } = parseCategories(input.standingsTag);
  if (unknown.length) warnings.push(`Unrecognised standings tag(s): ${unknown.join(", ")}`);
  if (categories.length === 0 && !eliminated) {
    warnings.push("No scoring category on this row — it awards nothing.");
  }

  let points = 0;
  if (placement && fieldSize) {
    const value = pointsFor(placement, fieldSize);
    if (value == null) {
      warnings.push(`${placement} is impossible in a ${fieldSize}-team field.`);
    } else {
      points = value;
    }
  }

  return {
    eventId,
    name: input.name.replace(/\s*\(\d{4,9}\)\s*/, " ").trim(),
    standingsTag: input.standingsTag,
    categories,
    fieldSize,
    placement,
    eliminated,
    points,
    totalPoints: points * categories.length,
    warnings,
  };
}

/**
 * Score a batch and drop rows whose event id was already logged.
 *
 * Results resolve late — a day's events keep landing for a day or two after —
 * so overlapping uploads are the norm, not the exception. Dedupe on the event
 * id in parentheses, NEVER on the name: ids increment by one per day per event,
 * so `Trying to Look Busy (2110152)` and `(2110153)` are different instances of
 * the same tournament on consecutive days.
 */
export function scoreBatch(
  inputs: ScoreInput[],
  alreadyLoggedEventIds: Iterable<number> = [],
): { rows: ResultRow[]; duplicates: ResultRow[]; byCategory: Record<string, number> } {
  const seen = new Set<number>(alreadyLoggedEventIds);
  const rows: ResultRow[] = [];
  const duplicates: ResultRow[] = [];
  const byCategory: Record<string, number> = {};

  for (const input of inputs) {
    const scored = scoreResult(input);
    if (scored.eventId != null && seen.has(scored.eventId)) {
      duplicates.push(scored);
      continue;
    }
    if (scored.eventId != null) seen.add(scored.eventId);
    rows.push(scored);
    for (const category of scored.categories) {
      byCategory[category] = (byCategory[category] ?? 0) + scored.points;
    }
  }

  return { rows, duplicates, byCategory };
}

export { PLACEMENTS, FIELD_SIZES };
export type { Placement, FieldSize, Category };
