/**
 * Where each PTCS berth line will END, projected from the newest community
 * dump and how the same line grew in past periods. This is THE qualification
 * line: `pnpm cutoff:project` prints it, `pnpm ptcs:standing` measures against
 * it, and `cutoff:project --write` stores it as the period's targets for /ptcs
 * (with cwhit's projected cutoffs kept beside it in src/data/ptcs-lines.json).
 *
 * A line grows through a period as everyone plays, so "the line is 38" a week
 * in means nothing on its own. PTCS 5 is the structural twin of PTCS 7 — both
 * 28 days — so its own growth from day N to the finish is the multiplier, read
 * off the same dumps rather than assumed. PTCS 6 (35 days) is rescaled to this
 * period's length and averaged in.
 *
 * N IS NOT A CONSTANT. It is how far into the period the newest dump actually
 * reaches, and the SAME N has to cut PTCS 5 and PTCS 6 as cuts PTCS 7 — the
 * method is "how much did this same line grow from day N to the finish", so an
 * N in the numerator that differs from the one in the denominator breaks it
 * silently. (It used to be hardcoded to 8, which threw away every newer dump.)
 *
 * N IS THE LAST WHOLE DAY. The community dumps are pulled early on their
 * filename date, so that day holds a handful of events (the 11-09 tournaments
 * dump: 6 on 11-09 against about 55 a day). Counting it made N one day too
 * late, and the period's thin day N was then grown by PTCS 5's and 6's growth
 * from a whole day N: every line read low (PTCS 9 Bronze 131 against 156).
 * dumpReach() drops a last day that is thin against the days before it.
 *
 * Node-only: reads Tourney Data/ from disk. The page reads the stored copy.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDump, computeStandings, type ParsedDump } from "@/lib/analytics/dumps";
import type { CwhitBoard } from "@/lib/ptcs-progress";

export const PROJECTION_CATS = ["Bronze", "Silver", "Gold", "Diamond", "Cap", "Open", "PD Daily", "PD Weekly", "Iron", "Live"] as const;

type Window = { start: string; end: string };
/** Past periods whose growth curves are the history. P5 has P7's 28-day shape. */
export const P5: Window = { start: "2026-07-06", end: "2026-08-02" };
export const P6: Window = { start: "2026-08-03", end: "2026-09-06" };

const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const dayOf = (start: string, n: number) => new Date(at(start) + (n - 1) * 864e5).toISOString().slice(0, 10);
export const dayIndex = (start: string, iso: string) => Math.round((at(iso) - at(start)) / 864e5) + 1;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface ProjectedLine {
  category: string;
  /** 128th-place total through day N of this period. */
  now: number;
  /** Your points and rank in the dump through day N (null rank = not entered). */
  you: number;
  rank: number | null;
  p5: { atN: number; end: number; mult: number };
  p6: { atN: number; end: number; mult: number };
  mult: number;
  projected: number;
}

export interface ProjectionSource extends DumpReach {
  kind: "tournaments" | "drafts";
  file: string;
}

export interface Projection {
  day: number;
  /** The last whole day the dumps reach, as a day of the period, before any --day override. */
  dumpDay: number;
  periodDays: number;
  sources: ProjectionSource[];
  /** The staler of the two dumps, which sets N. */
  binding: ProjectionSource;
  lines: ProjectedLine[];
}

/**
 * The Central day an event starts on, on the clock computeStandings buckets
 * by: each day's window opens at 05:00Z (~midnight Central), so
 * ParsedDump.dateMax (a plain UTC date) would roll a late-evening Central
 * event into the next day.
 */
const centralDay = (start: number) => new Date((start - 5 * 3600) * 1000).toISOString().slice(0, 10);

/** A last day with fewer events than this share of the usual day is one the dump was pulled during. */
export const THIN_DAY_SHARE = 0.5;
/** The usual day is the median of up to this many days before the last one… */
const THIN_LOOKBACK = 7;
/** …and is only judged with at least this many of them. */
const THIN_MIN_DAYS = 3;

export interface DumpReach {
  /** The last whole day in the dump: this is the day it reaches. */
  reach: string;
  /** The last day with any event, whole or not. */
  last: string;
  /** Events that start on `last`. */
  lastEvents: number;
  /** The median events a day over the days before `last`; null with too few of them to judge. */
  usual: number | null;
  /** True when `last` was dropped as thin, so `reach` is the day before it. */
  partial: boolean;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * How far a dump reaches: its last Central day, unless that day is thin
 * against the days before it (under THIN_DAY_SHARE of their median), in
 * which case the day before it. All 26 dumps on disk (08-17 to 11-09) end on
 * a thin day: 1–11 tournaments against a usual 53–55, 2–8 drafts against 31–38.
 */
export function dumpReach(d: ParsedDump): DumpReach {
  const perDay = new Map<string, number>();
  for (const e of d.events) { const k = centralDay(e.start); perDay.set(k, (perDay.get(k) ?? 0) + 1); }
  const dates = [...perDay.keys()].sort();
  const last = dates[dates.length - 1];
  const lastEvents = perDay.get(last) ?? 0;
  const before = dates.slice(0, -1).slice(-THIN_LOOKBACK).map((k) => perDay.get(k)!);
  const usual = before.length >= THIN_MIN_DAYS ? median(before) : null;
  const partial = usual != null && lastEvents < THIN_DAY_SHARE * usual;
  const reach = partial ? new Date(at(last) - 864e5).toISOString().slice(0, 10) : last;
  return { reach, last, lastEvents, usual, partial };
}

function newest(dir: string, prefix: string): { file: string; dump: ParsedDump } {
  const file = readdirSync(dir).filter((x) => x.startsWith(prefix) && x.endsWith(".csv")).sort().pop();
  if (!file) throw new Error(`no ${prefix}*.csv in ${dir}`);
  const dump = parseDump(readFileSync(join(dir, file), "utf8"));
  if (!dump) throw new Error(`could not parse ${file}`);
  return { file, dump };
}

type ProjectOpts = { period: Window; user?: string; day?: number };

/** The newest tournaments and drafts dumps in `dir`, projected. */
export function projectCutoffs(opts: ProjectOpts & { dir: string }): Projection {
  return projectFromDumps({
    ...opts,
    tournaments: newest(opts.dir, "pt27_tournaments_competitve_dump_"),
    drafts: newest(opts.dir, "pt27_drafts_competitve_dump_"),
  });
}

/** The projection from two dumps already in hand (the tests build them). */
export function projectFromDumps(opts: ProjectOpts & {
  tournaments: { file: string; dump: ParsedDump };
  drafts: { file: string; dump: ParsedDump };
}): Projection {
  const user = opts.user ?? "rtr1776";
  const T = opts.tournaments, D = opts.drafts;
  /*
   * Both dumps go in together: Live spans BOTH files, and a per-file merge
   * kept whichever came last instead of the sum. computeStandings tags each
   * event with its own source, so tier and PD categories are unchanged.
   */
  const standings = (w: Window) => computeStandings([T.dump, D.dump], w, user).categories;

  const len = (w: Window) => dayIndex(w.start, w.end);
  const P7LEN = len(opts.period), P5LEN = len(P5), P6LEN = len(P6);
  const sources: ProjectionSource[] = [
    { kind: "tournaments", file: T.file, ...dumpReach(T.dump) },
    { kind: "drafts", file: D.file, ...dumpReach(D.dump) },
  ];
  // One N covers every category, so the STALER dump binds (each on its last whole day).
  const binding = sources.reduce((a, b) => (a.reach <= b.reach ? a : b));
  const dumpDay = dayIndex(opts.period.start, binding.reach);
  const N = clamp(opts.day ?? dumpDay, 1, P7LEN);

  const p5dN = standings({ start: P5.start, end: dayOf(P5.start, N) }), p5end = standings(P5);
  const p6dN = standings({ start: P6.start, end: dayOf(P6.start, N) }), p6end = standings(P6);
  const p7dN = standings({ start: opts.period.start, end: dayOf(opts.period.start, N) });

  /** Growth from day N to the end of a `fromLen`-day period, restated over this one. */
  const rescale = (g: number, fromLen: number) =>
    fromLen === P7LEN || N >= fromLen ? g : 1 + (g - 1) * (P7LEN - N) / (fromLen - N);

  const lines: ProjectedLine[] = [];
  for (const c of PROJECTION_CATS) {
    const now = p7dN[c];
    if (!now) continue;
    const a5 = p5dN[c]?.lines.l128 ?? 0, b5 = p5end[c]?.lines.l128 ?? 0;
    const a6 = p6dN[c]?.lines.l128 ?? 0, b6 = p6end[c]?.lines.l128 ?? 0;
    const m5 = a5 > 0 ? rescale(b5 / a5, P5LEN) : 0;
    const m6 = a6 > 0 ? rescale(b6 / a6, P6LEN) : 0;
    const mult = m5 > 0 && m6 > 0 ? (m5 + m6) / 2 : (m5 || m6);
    lines.push({
      category: c, now: now.lines.l128 || 0, you: now.pts, rank: now.rank ?? null,
      p5: { atN: a5, end: b5, mult: m5 }, p6: { atN: a6, end: b6, mult: m6 },
      mult, projected: Math.round((now.lines.l128 || 0) * mult),
    });
  }
  return { day: N, dumpDay, periodDays: P7LEN, sources, binding, lines };
}

/**
 * cwhit's "Cycle N qualification targets" board, transcribed to
 * reference/cwhit/<date> cycle<N> targets.csv — newest file wins. Shown
 * beside the projection, never instead of it: his last-cutoff column is the
 * game's own number, so a wide gap between the two is worth a look. The
 * cycle comes from the file name and the length from his Weeks column; a
 * board for another cycle or length stays out of safe at (cwhitLinesFor).
 */
export function readCwhitTargets(dir: string): CwhitBoard | null {
  try {
    const f = readdirSync(dir).filter((x) => /cycle\d+ targets\.csv$/.test(x)).sort().pop();
    if (!f) return null;
    const [head, ...rows] = readFileSync(join(dir, f), "utf8").split(/\r?\n/).filter((l) => l.trim());
    const cols = head.split(",");
    const out: Record<string, number> = {};
    let weeks: number | null = null;
    for (const r of rows) {
      const c = Object.fromEntries(cols.map((k, n) => [k, r.split(",")[n] ?? ""]));
      const v = Number(c.ProjectedCutoff);
      if (c.Category && c.ProjectedCutoff !== "" && Number.isFinite(v)) out[c.Category] = v;
      const w = Number(c.Weeks);
      if (weeks == null && c.Weeks && Number.isFinite(w) && w > 0) weeks = w;
    }
    const cycle = Number(f.match(/cycle(\d+)/)?.[1]);
    return { file: f, lines: out, cycle: Number.isFinite(cycle) ? cycle : null, days: weeks != null ? weeks * 7 : null };
  } catch { return null; }
}

/** The stored copy /ptcs reads (src/data/ptcs-lines.json). */
export interface StoredLines {
  period: string;
  day: number;
  periodDays: number;
  dumpReach: string;
  dumpFile: string;
  writtenOn: string;
  projected: Record<string, number>;
  cwhit: CwhitBoard | null;
}
