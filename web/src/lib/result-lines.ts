/**
 * Turn pasted "Your Tournaments" rows into scoring inputs.
 *
 * OOTP's screen cannot be copied as text, so a row arrives however it was
 * transcribed: tab-separated from a spreadsheet, pipe-separated, or one line
 * of prose in the screen's own column order —
 *
 *   Daily Perfectly Gold (2220177)  PD Daily  64 / 64 - Bo7  1999/DH/BP  100 CS, HDPk  Yesterday  5th-8th Place
 *
 * Every column we need has a shape nothing else on the row shares, so each is
 * found by its shape rather than its position: the event id is the number in
 * parentheses, the field size is "n / m", the placement is an ordinal range or
 * "Winner"/"Eliminated", the standings tag is the comma list made only of
 * category words, and the date is Today / Yesterday / "Sep. 5th" / "9/5".
 *
 * Everything before the id is the name. Everything after it is searched, so a
 * name like "2nd Chance Saloon" cannot be mistaken for a placement.
 */

import { CATEGORY_BY_TAG, NON_SCORING_TAGS } from "./ingest/constants";
import type { ScoreInput } from "./scoring";

export interface ParsedResultLine {
  /** The line as pasted, for the preview table and error messages. */
  line: string;
  /** Null when the line could not be read well enough to score. */
  input: ScoreInput | null;
  /** YYYY-MM-DD the event resolved on; null when the row carried no date. */
  occurredOn: string | null;
  problems: string[];
}

const TAG_WORDS = new Set([...Object.keys(CATEGORY_BY_TAG), ...NON_SCORING_TAGS]);

const PLACEMENT_RE =
  /\b(winner|champion|1st|2nd|3rd\s*[/&-]\s*4th|5th\s*-\s*8th|9th\s*-\s*16th|17th\s*-\s*32nd|33rd\s*-\s*64th|65th\s*-\s*128th|129th\s*-\s*256th|eliminated)\b/i;
const FIELD_RE = /\b(\d{2,4})\s*\/\s*(\d{2,4})\b/;
const ID_RE = /\((\d{4,9})\)/;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const DATE_RE =
  /\b(today|yesterday|(\d{4})-(\d{2})-(\d{2})|(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b|(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)\b/i;

/** Is this a comma list made entirely of standings words ("Gld,Cp,TW")? */
function isTagList(text: string): boolean {
  const parts = text.split(/[,/|]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => TAG_WORDS.has(p));
}

/** "Yesterday" needs to know what day the screen was read. */
function resolveDate(token: RegExpMatchArray, asOf: string): string | null {
  const word = token[1].toLowerCase();
  const base = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(base)) return null;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  if (word === "today") return asOf;
  if (word === "yesterday") return iso(base - 86_400_000);
  if (token[2]) return `${token[2]}-${token[3]}-${token[4]}`;

  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;
  if (token[5]) {
    month = MONTHS[token[5].toLowerCase()];
    day = Number(token[6]);
  } else if (token[7]) {
    month = Number(token[7]);
    day = Number(token[8]);
    if (token[9]) year = Number(token[9].length === 2 ? `20${token[9]}` : token[9]);
  }
  if (!month || !day || month > 12 || day > 31) return null;
  // No year on the screen: the most recent occurrence of that month/day that is
  // not in the future. A result dated "Dec 30" read on Jan 2 belongs to last year.
  if (year == null) {
    year = Number(asOf.slice(0, 4));
    const candidate = Date.UTC(year, month - 1, day);
    if (candidate > base + 86_400_000) year -= 1;
  }
  return iso(Date.UTC(year, month - 1, day));
}

function findTag(fields: string[], rest: string, fieldAt: number): string | null {
  // Delimited input: the tag is the field made only of category words.
  for (const f of fields) if (isTagList(f)) return f.trim();
  // Prose: the first run of category words after the id, and it must come
  // BEFORE the field size — the standings column sits between the name and
  // the field, ahead of restrictions like "Cards <= GOLD" or "1767 Cap" that
  // would otherwise read as a tag on a row that has none.
  const words = [...TAG_WORDS].sort((a, b) => b.length - a.length).map((w) => w.replace(/ /g, "\\s+"));
  const re = new RegExp(`\\b(?:${words.join("|")})(?:\\s*,\\s*(?:${words.join("|")}))*\\b`, "i");
  const m = rest.match(re);
  if (!m || m.index == null) return null;
  if (fieldAt >= 0 && m.index > fieldAt) return null;
  return m[0];
}

/** The first "n / m" whose scheduled size is a real bracket; else the first. */
function findField(text: string): RegExpMatchArray | null {
  let first: RegExpMatchArray | null = null;
  for (const m of text.matchAll(new RegExp(FIELD_RE.source, "g"))) {
    first ??= m;
    if ([32, 64, 128, 256].includes(Number(m[2]))) return m;
  }
  return first;
}

export function parseResultLine(rawLine: string, asOf: string): ParsedResultLine {
  const line = rawLine.replace(/\s+/g, " ").trim();
  const problems: string[] = [];
  const idMatch = line.match(ID_RE);
  if (!idMatch || idMatch.index == null) {
    return { line, input: null, occurredOn: null, problems: ["No event id in parentheses — cannot dedupe or score this row."] };
  }
  const name = line
    .slice(0, idMatch.index + idMatch[0].length)
    .replace(/^[\s★☆*•·\-–|]+/, "")
    .trim();
  const afterId = line.slice(idMatch.index + idMatch[0].length).replace(/\[\+\]/g, " ");
  const fields = rawLine.includes("\t")
    ? rawLine.split("\t")
    : rawLine.includes("|")
      ? rawLine.split("|")
      : [];

  // Date first, then blank it out: "Sep. 1st" must not read as a 1st-place
  // finish, and "12/10" must not read as a field size.
  const dateMatch = afterId.match(DATE_RE);
  const occurredOn = dateMatch ? resolveDate(dateMatch, asOf) : null;
  if (dateMatch && !occurredOn) problems.push(`Could not read the date "${dateMatch[0]}".`);
  const rest = dateMatch && dateMatch.index != null
    ? afterId.slice(0, dateMatch.index) + " ".repeat(dateMatch[0].length) + afterId.slice(dateMatch.index + dateMatch[0].length)
    : afterId;

  const field = findField(rest);
  if (!field) problems.push('No field size like "64 / 64" found.');

  const tag = findTag(fields, rest, field?.index ?? -1);
  if (!tag) problems.push("No standings tag (Silver, PD Daily, Gld,Cp,TW …) found.");

  const placement = rest.match(PLACEMENT_RE);
  if (!placement) problems.push("No placement (5th-8th, Winner, Eliminated …) found.");

  if (!tag || !field || !placement) return { line, input: null, occurredOn, problems };
  return {
    line,
    input: { name, standingsTag: tag, field: `${field[1]} / ${field[2]}`, status: placement[1] },
    occurredOn,
    problems,
  };
}

export function parseResultLines(text: string, asOf: string): ParsedResultLine[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => parseResultLine(l, asOf));
}
