/**
 * Where each PTCS category stands and whether it is safe to stop feeding it.
 * /ptcs and scripts/ptcs-standing.ts both read their verdicts from here, so
 * the page and the script cannot disagree on when to stop.
 */
import type { MergedDay } from "@/lib/result-ledger";

/** Today's date where L.J. plays — PT days roll over on his clock, not UTC's. */
export function todayInChicago(now=new Date()): string {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=(key:string)=>parts.find(p=>p.type===key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Calendar time, independent of how many days have been entered in the log.
 * `remaining` counts the days after today; `daysLeft` counts today too, since
 * today can still be played (0 once the period is over).
 */
export function periodCalendar(startsOn:string, endsOn:string, now=new Date()) {
  const today=todayInChicago(now);
  const start=Date.parse(`${startsOn}T00:00:00Z`), end=Date.parse(`${endsOn}T00:00:00Z`);
  const totalDays=Math.max(0,Math.round((end-start)/86400000)+1);
  const elapsed=Math.max(0,Math.min(totalDays,Math.round((Date.parse(`${today}T00:00:00Z`)-start)/86400000)+1));
  const dates=Array.from({length:elapsed},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
  const finished=today>endsOn;
  const daysLeft=finished?0:totalDays-elapsed+(elapsed>0?1:0);
  return {today,totalDays,elapsed,remaining:totalDays-elapsed,daysLeft,finished,dates};
}

/** How far past the higher of the two lines a category has to be before it is safe to stop. */
export const SAFE_MARGIN = 0.10;
/** The forecast rule: no projection until a category has scored on this many days. */
export const FORECAST_MIN_DAYS = 3;
/** "Not playing" is called only from this day of the period… */
export const NOT_PLAYING_FROM_DAY = 7;
/** …and only for a category under this share of its line. */
export const NOT_PLAYING_SHARE = 0.1;

export interface SafeMark {
  /** The higher of our line and cwhit's. */
  line: number;
  /** line × (1 + SAFE_MARGIN), rounded up. */
  safeAt: number;
  /** Points still to get to safeAt; 0 once past it. */
  toSafe: number;
}

/**
 * The safe mark: the higher of our projected line and cwhit's, plus
 * SAFE_MARGIN, rounded up. Past it, stop feeding the category. Null when
 * neither line is known.
 */
export function safeMark(total: number, ourLine: number | null | undefined, cwhitLine: number | null | undefined): SafeMark | null {
  const lines = [ourLine, cwhitLine].filter((v): v is number => v != null && Number.isFinite(v));
  if (!lines.length) return null;
  const line = Math.max(...lines);
  // Rounded before the ceiling, or float noise (100 × 1.1 = 110.00000000000001) adds a point.
  const safeAt = Math.ceil(Number((line * (1 + SAFE_MARGIN)).toFixed(6)));
  return { line, safeAt, toSafe: Math.max(0, safeAt - total) };
}

export type Verdict = "safe" | "to-safe" | "on-pace" | "behind" | "not-playing" | "no-line";

export interface StandingRow {
  category: string;
  total: number;
  /** The part of `total` from dump events that were never logged. */
  fromDump: number;
  ourLine: number | null;
  cwhitLine: number | null;
  /** The higher of the two lines; null when neither is known. */
  line: number | null;
  safeAt: number | null;
  toSafe: number | null;
  /** Points short of the line; 0 once past it. */
  gap: number | null;
  /** The gap spread over the days left, today included. */
  needPerDay: number | null;
  scoringDays: number;
  /** Points a day, from the category's first scoring day to the last day with data. */
  pace: number | null;
  /** Where that pace ends the period; null before FORECAST_MIN_DAYS scoring days. */
  projected: number | null;
  verdict: Verdict;
}

/** The last day with anything on file (logged, dump or imported); -1 when none. */
export function lastDataIndex(days: readonly MergedDay[]): number {
  for (let i = days.length - 1; i >= 0; i--) if (days[i].source !== "none") return i;
  return -1;
}

/** Rows that still need points first (most to get first), then safe, then not playing. */
const GROUP: Record<Verdict, number> = { behind: 0, "on-pace": 0, "to-safe": 0, "no-line": 0, safe: 1, "not-playing": 2 };

/**
 * One row per category from the merged days (lib/result-ledger), in the
 * order to act on them.
 *
 * - Pace runs to the last day with data, not to today: a day nobody has
 *   logged yet is missing, not a day that scored nothing. It starts at the
 *   category's own first scoring day — a staggered start is a plan, not a
 *   deficit.
 * - "Not playing" means under a tenth of the line with too few scoring days
 *   for a forecast, from day 7 on. The UI plan (P2) said "at most one scoring
 *   day"; with the dump counted, PTCS 7's Live has two incidental 1-point
 *   days (a Daily Live Open and a Time Travelers entry), and that rule put a
 *   category he isn't playing at the top of the list. So the bar is the
 *   forecast rule's instead.
 */
export function standings(
  days: readonly MergedDay[],
  categories: readonly string[],
  o: {
    totalDays: number;
    /** Days still to play, today included. */
    daysLeft: number;
    /** Today's day number in the period; day 1 is the first day. */
    dayIndex: number;
    ourLines: Readonly<Record<string, number | null | undefined>>;
    cwhitLines?: Readonly<Record<string, number | null | undefined>> | null;
  },
): StandingRow[] {
  const lastData = lastDataIndex(days);
  const rows = categories.map((category): StandingRow => {
    const series = days.map((d) => d.points[category] ?? 0);
    const total = series.reduce((s, v) => s + v, 0);
    let fromDump = 0;
    for (const d of days) for (const e of d.events) if (e.source === "dump" && e.categories.includes(category)) fromDump += e.points;
    const scoringDays = series.filter((v) => v > 0).length;
    const first = series.findIndex((v) => v > 0);
    const pace = first >= 0 && lastData >= first ? total / (lastData - first + 1) : null;
    const projected = pace != null && scoringDays >= FORECAST_MIN_DAYS
      ? Math.round(total + pace * Math.max(0, o.totalDays - lastData - 1))
      : null;
    const ourLine = o.ourLines[category] ?? null;
    const cwhitLine = o.cwhitLines?.[category] ?? null;
    const mark = safeMark(total, ourLine, cwhitLine);
    const gap = mark ? Math.max(0, mark.line - total) : null;
    const needPerDay = gap && o.daysLeft > 0 ? Math.round((gap / o.daysLeft) * 10) / 10 : null;

    let verdict: Verdict;
    if (!mark) verdict = "no-line";
    else if (total >= mark.safeAt) verdict = "safe";
    else if (total >= mark.line) verdict = "to-safe";
    else if (o.dayIndex >= NOT_PLAYING_FROM_DAY && scoringDays < FORECAST_MIN_DAYS && total < NOT_PLAYING_SHARE * mark.line) verdict = "not-playing";
    else if (projected != null && projected >= mark.line) verdict = "on-pace";
    else verdict = "behind";

    return {
      category, total, fromDump, ourLine, cwhitLine,
      line: mark?.line ?? null, safeAt: mark?.safeAt ?? null, toSafe: mark?.toSafe ?? null,
      gap, needPerDay, scoringDays, pace, projected, verdict,
    };
  });
  return rows.sort((a, b) => GROUP[a.verdict] - GROUP[b.verdict] || (b.toSafe ?? -1) - (a.toSafe ?? -1));
}

/** The verdict as the page's chip and the script's last column say it. */
export function verdictLabel(r: StandingRow): string {
  switch (r.verdict) {
    case "safe": return "safe — stop";
    case "to-safe": return `${r.toSafe} to safe`;
    case "on-pace": return "on pace";
    case "behind": return r.needPerDay != null ? `needs ${r.needPerDay.toFixed(1)}/day` : `short ${r.gap}`;
    case "not-playing": return "not playing";
    default: return "no line";
  }
}
