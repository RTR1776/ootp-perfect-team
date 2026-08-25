/**
 * Community finish-order dumps → category standings.
 *
 * The dump format (databotai "competitive dump"): line 1 `SEP=`, line 2
 * `num,title,starttime,1st,2nd,3rd,…`, then one row per tournament instance —
 * event id, name, unix start time, and the ENTIRE field in finish order.
 * Because every entrant is listed, the official category standings are
 * computable exactly: apply the PT 27 points table to each row and sum.
 *
 * Validated 2026-08-25 against L.J.'s hand-tracked totals: every category
 * within a few points; the drift is weeklies straddling the period boundary.
 *
 * Category mapping: tags observed in the game UI for ~40 series, then name
 * heuristics ("Slots"/"Cap" adds Cap; a tier word sets the tier; floor-only
 * events are Open; "Live" events count Live only). Drafts dump: "Daily …" is
 * PD Daily, day-named events are PD Weekly. Three oddballs are excluded.
 */

import { splitLine } from "@/lib/ingest/csv";

export interface DumpEvent {
  id: string;
  name: string;
  start: number; // unix seconds
  finishers: string[]; // full field, finish order
}

export interface ParsedDump {
  source: "tournaments" | "drafts";
  events: DumpEvent[];
  dateMin: string;
  dateMax: string;
}

export interface CategoryStanding {
  pts: number;
  rank: number | null;
  scored: number;
  lines: { l64: number; l100: number; l128: number };
  top: { user: string; pts: number }[];
}

export interface DumpStandings {
  source: "tournaments" | "drafts";
  user: string;
  window: { start: string; end: string };
  events: number;
  excluded: number;
  categories: Record<string, CategoryStanding>;
}

export function looksLikeDump(headerLine: string): boolean {
  return /^SEP=/.test(headerLine.trim()) || /^num,title,starttime/.test(headerLine.trim());
}

export function parseDump(text: string): ParsedDump | null {
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (/^SEP=/.test(lines[0] ?? "")) i = 1;
  if (!/^num,title,starttime/.test(lines[i] ?? "")) return null;
  i += 1;
  const events: DumpEvent[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = splitLine(line);
    if (!cells[0] || !/^\d+$/.test(cells[0])) continue;
    const start = Number(cells[2]);
    if (!Number.isFinite(start)) continue;
    events.push({
      id: cells[0],
      name: (cells[1] ?? "").trim(),
      start,
      finishers: cells.slice(3).filter((u) => u !== ""),
    });
  }
  if (events.length === 0) return null;
  // drafts event ids start with 2, tournaments with 1 — majority decides
  const draftish = events.filter((e) => e.id.startsWith("2")).length;
  const source = draftish * 2 > events.length ? "drafts" : "tournaments";
  const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const starts = events.map((e) => e.start);
  return { source, events, dateMin: day(Math.min(...starts)), dateMax: day(Math.max(...starts)) };
}

/* ------------------------------------------------------------------ */
/* category mapping                                                    */
/* ------------------------------------------------------------------ */

const OBSERVED: Record<string, string[]> = {
  "Daily Low Diamond": ["Diamond"], "Daily Diamonds are Forever": ["Diamond"], "Daily Diamond Slots": ["Diamond", "Cap"],
  "Daily Diamond Heart": ["Diamond"], "Daily Diamond & Friends Slots": ["Diamond", "Cap"], "Wednesday Ice to See You": ["Diamond"],
  "Saturday Diamond Variety": ["Diamond"], "Daily Diamond Cap": ["Diamond", "Cap"], "Daily Diamond": ["Diamond"],
  "Daily Low Bronze": ["Bronze"], "Daily Bronze The Sequel": ["Bronze"], "Daily Bronze 1910-59": ["Bronze"],
  "Daily Bronze OOTP Era": ["Bronze"], "Daily Bronze PTCS 3 Replay Slots": ["Bronze", "Cap"],
  "Monday Up And At Them Bronze": ["Bronze"], "Daily Return of the Bronze": ["Bronze"],
  "Daily Late Silver": ["Silver"], "Daily Silver Slots": ["Silver", "Cap"], "Daily Silver Heart": ["Silver"],
  "Daily Silver & Friends Deadball Slots": ["Silver", "Cap"], "Thursday Silver Spectacular": ["Silver"],
  "Daily Early Gold": ["Gold"], "Daily Golden Heart": ["Gold"], "Daily Gold Slots": ["Gold", "Cap"],
  "Monday Wonky Historical Slots": ["Gold", "Cap"], "Sunday High Iron Floor and Gold Ceiling": ["Gold", "Cap"],
  "Tuesday Sporer's Sandlot": ["Gold", "Cap"], "Thursday CWhit's Cap Challenge 4": ["Gold", "Cap"],
  "Thursday CWhit's Cap Challenge 3": ["Gold", "Cap"],
  "Daily Goldfather II": ["Gold"], "Daily Low Gold Retrospecticus": ["Gold"], "Daily Low Gold Retrospectus": ["Gold"],
  "Monday Gold Floor Cap": ["Open", "Cap"], "Daily Open Slots": ["Open", "Cap"], "Sunday Open Main Event": ["Open"],
  "Daily Dank": ["Iron"], "Friday Danksville": ["Iron"], "Wednesday Night of the Living Deadball": ["Open"],
};

const EXCLUDED = new Set(["Daily Negro Leagues", "Tuesday Up to 1969", "Wednesday 1950 to Now"]);

const DAY_RE = /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/;

export function categoriesOf(name: string, source: "tournaments" | "drafts"): string[] {
  if (source === "drafts") return DAY_RE.test(name) ? ["PD Weekly"] : ["PD Daily"];
  if (OBSERVED[name]) return [...OBSERVED[name]];
  if (EXCLUDED.has(name)) return [];
  if (name.includes("Live")) return ["Live"];
  const cats: string[] = [];
  for (const [w, c] of [["Iron", "Iron"], ["Bronze", "Bronze"], ["Silver", "Silver"], ["Gold", "Gold"], ["Diamond", "Diamond"], ["Open", "Open"]] as const) {
    if (name.includes(w)) { cats.push(c); break; }
  }
  if ((name.includes("Slots") || /\bCap\b/.test(name)) && !cats.includes("Cap")) cats.push("Cap");
  return cats;
}

/* ------------------------------------------------------------------ */
/* points                                                              */
/* ------------------------------------------------------------------ */

const BRACKETS: [number, number, Record<number, number>][] = [
  [1, 1, { 256: 40, 128: 30, 64: 25, 32: 20 }],
  [2, 2, { 256: 30, 128: 20, 64: 15, 32: 10 }],
  [3, 4, { 256: 20, 128: 15, 64: 10, 32: 6 }],
  [5, 8, { 256: 15, 128: 10, 64: 6, 32: 3 }],
  [9, 16, { 256: 10, 128: 6, 64: 3, 32: 1 }],
  [17, 32, { 256: 6, 128: 3, 64: 1, 32: 0 }],
  [33, 64, { 256: 3, 128: 1, 64: 0 }],
  [65, 128, { 256: 1, 128: 0 }],
  [129, 256, { 256: 0 }],
];

export function pointsFor(position: number, fieldSize: number): number {
  const scheduled = [32, 64, 128, 256].find((s) => s >= fieldSize) ?? 256;
  for (const [lo, hi, table] of BRACKETS) {
    if (position >= lo && position <= hi) return table[scheduled] ?? 0;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* standings                                                           */
/* ------------------------------------------------------------------ */

const DAY_SECONDS = 86400;

export function computeStandings(
  dump: ParsedDump,
  window: { start: string; end: string },
  user = "rtr1776",
): DumpStandings {
  const lo = Date.parse(`${window.start}T05:00:00Z`) / 1000; // ~midnight Central
  const hi = Date.parse(`${window.end}T05:00:00Z`) / 1000 + DAY_SECONDS;
  const totals = new Map<string, Map<string, number>>();
  let counted = 0, excluded = 0;

  for (const e of dump.events) {
    const weekly = DAY_RE.test(e.name);
    const finish = e.start + (weekly ? 7 * DAY_SECONDS : DAY_SECONDS);
    if (finish < lo || finish > hi) continue;
    if (!weekly && e.start < lo) continue;
    const cats = categoriesOf(e.name, dump.source);
    if (cats.length === 0) { excluded++; continue; }
    counted++;
    const field = e.finishers.length;
    e.finishers.forEach((u, idx) => {
      const p = pointsFor(idx + 1, field);
      if (p <= 0) return;
      for (const c of cats) {
        const m = totals.get(c) ?? new Map<string, number>();
        m.set(u, (m.get(u) ?? 0) + p);
        totals.set(c, m);
      }
    });
  }

  const categories: Record<string, CategoryStanding> = {};
  for (const [cat, m] of totals) {
    const board = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const rank = board.findIndex(([u]) => u.toLowerCase() === user.toLowerCase());
    const at = (n: number) => (board.length >= n ? Math.round(board[n - 1][1]) : 0);
    categories[cat] = {
      pts: rank >= 0 ? Math.round(board[rank][1]) : 0,
      rank: rank >= 0 ? rank + 1 : null,
      scored: board.length,
      lines: { l64: at(64), l100: at(100), l128: at(128) },
      top: board.slice(0, 3).map(([u, p]) => ({ user: u, pts: Math.round(p) })),
    };
  }
  return { source: dump.source, user, window, events: counted, excluded, categories };
}
