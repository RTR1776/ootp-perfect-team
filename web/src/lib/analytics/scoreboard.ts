/**
 * The scoreboard: is this working?
 *
 * Everything here comes off the community dumps, which list every event's
 * whole field in finishing order. In a single-elimination bracket the finish
 * fixes the record (scripts/record.ts: 1st won every round, 2nd all but the
 * final, 65th-128th lost in round one), so series won and lost are exact for
 * every player, not just L.J. That is what lets his line sit beside the
 * field's: rank among the players who enter as often as he does, and round by
 * round against the 25 best of them.
 *
 * First run by hand on 2026-11-12 (Docs/Improvement Plan 2026-11-12.md):
 * tournaments 54.5% before the builder and 62.2% since, drafts flat at 54%,
 * and the gap to the top in the late rounds. scripts/scoreboard.ts writes
 * src/data/scoreboard.json after each dump; /scoreboard shows it.
 */
import { categoriesOf, pointsFor, type DumpEvent, type ParsedDump } from "./dumps";
import { isQuickEvent } from "./dump-files";

const SIZES = new Set([16, 32, 64, 128, 256]);
const DAY = 86_400;
const ymd = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/** Rounds won and whether the run ended in a loss, from a finishing position in a full bracket. */
export function seriesRecord(pos: number, size: number): { won: number; lost: number } {
  const rounds = Math.log2(size);
  return pos === 1 ? { won: rounds, lost: 0 } : { won: rounds - Math.ceil(Math.log2(pos)), lost: 1 };
}

export interface Line { entries: number; won: number; lost: number; pct: number | null; ptsPer: number | null; top8: number; titles: number }
interface Acc { entries: number; won: number; lost: number; pts: number; top8: number; titles: number }
const blank = (): Acc => ({ entries: 0, won: 0, lost: 0, pts: 0, top8: 0, titles: 0 });
const add = (a: Acc, pos: number, size: number) => {
  const r = seriesRecord(pos, size);
  a.entries++; a.won += r.won; a.lost += r.lost; a.pts += pointsFor(pos, size);
  if (pos <= 8) a.top8++;
  if (pos === 1) a.titles++;
};
const round1 = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const line = (a: Acc): Line => ({
  entries: a.entries, won: a.won, lost: a.lost,
  pct: a.won + a.lost ? round1((100 * a.won) / (a.won + a.lost)) : null,
  ptsPer: a.entries ? round1(a.pts / a.entries, 2) : null, top8: a.top8, titles: a.titles,
});

/** Monday of the week a day (unix seconds) falls in, YYYY-MM-DD. PTCS weeks and periods start on a Monday. */
export function weekOf(t: number): string {
  const d = new Date(t * 1000);
  const back = (d.getUTCDay() + 6) % 7;
  return ymd(t - back * DAY);
}

/** What an event is filed under on the board: its first standings category, else "Other". */
export function boardGroup(name: string, source: "tournaments" | "drafts"): string {
  return categoriesOf(name, source)[0] ?? "Other";
}

export interface WindowBoard {
  label: string; from: string; to: string;
  me: Line;
  /** Players with at least `minEntries` events in the window, him among them or not. */
  regulars: number; minEntries: number;
  /** His place among them on series win %; null when he is not a regular. */
  rank: number | null;
  /** The 10th-best and the median regular's series win %. */
  tenthPct: number | null; medianPct: number | null;
}
export interface RoundRow { left: number; won: number; played: number; pct: number | null; topPct: number | null }
export interface KindBoard {
  weeks: (Line & { week: string })[];
  windows: WindowBoard[];
  groups: (Line & { group: string; before: Line })[];
  events: (Line & { name: string; size: number })[];
  rounds: RoundRow[];
}
export interface Scoreboard { user: string; through: string; generatedOn: string; recentDays: number; tournaments: KindBoard; drafts: KindBoard }

const usable = (e: DumpEvent) => SIZES.has(e.finishers.length) && !isQuickEvent(e.name);

function windowBoard(events: DumpEvent[], user: string, label: string, from: number, to: number, minEntries: number): WindowBoard {
  const by = new Map<string, Acc>();
  for (const e of events) {
    if (e.start < from || e.start >= to) continue;
    const size = e.finishers.length;
    e.finishers.forEach((u, i) => { const k = u.toLowerCase(); let a = by.get(k); if (!a) by.set(k, (a = blank())); add(a, i + 1, size); });
  }
  const pctOf = (a: Acc) => a.won / Math.max(1, a.won + a.lost);
  const regs = [...by].filter(([, a]) => a.entries >= minEntries).sort((x, y) => pctOf(y[1]) - pctOf(x[1]));
  const at = regs.findIndex(([u]) => u === user);
  const pick = (i: number) => (regs[i] ? round1(100 * pctOf(regs[i][1])) : null);
  return {
    label, from: ymd(from), to: ymd(to - DAY), me: line(by.get(user) ?? blank()),
    regulars: regs.length, minEntries, rank: at >= 0 ? at + 1 : null,
    tenthPct: pick(9), medianPct: pick(Math.floor(regs.length / 2)),
  };
}

/** One kind's board. `recentDays` is the window everything "recent" is read over (the weeks table runs longer). */
export function kindBoard(dump: ParsedDump, userName: string, o: { recentDays: number; regularPerRecent: number; weeks: number }): KindBoard {
  const user = userName.toLowerCase();
  const events = dump.events.filter(usable);
  if (!events.length) return { weeks: [], windows: [], groups: [], events: [], rounds: [] };
  const first = Math.min(...events.map((e) => e.start));
  const end = Math.floor(Math.max(...events.map((e) => e.start)) / DAY) * DAY + DAY; // midnight after the newest event
  const recent = end - o.recentDays * DAY, prior = recent - o.recentDays * DAY;
  const mine = events.flatMap((e) => { const i = e.finishers.findIndex((u) => u.toLowerCase() === user); return i < 0 ? [] : [{ e, pos: i + 1, size: e.finishers.length }]; });

  // Weeks, newest last.
  const wk = new Map<string, Acc>();
  for (const m of mine) { const k = weekOf(m.e.start); let a = wk.get(k); if (!a) wk.set(k, (a = blank())); add(a, m.pos, m.size); }
  const weeks = [...wk].sort((a, b) => a[0].localeCompare(b[0])).slice(-o.weeks).map(([week, a]) => ({ week, ...line(a) }));

  // Three windows: the recent one, the same length before it, and everything earlier.
  const days = (a: number, b: number) => Math.max(1, Math.round((b - a) / DAY));
  const scale = (a: number, b: number) => Math.max(10, Math.round((o.regularPerRecent * days(a, b)) / o.recentDays));
  const windows = [
    windowBoard(events, user, `Last ${o.recentDays} days`, recent, end, o.regularPerRecent),
    windowBoard(events, user, `The ${o.recentDays} days before`, prior, recent, o.regularPerRecent),
    ...(first < prior ? [windowBoard(events, user, "Earlier this season", first, prior, scale(first, prior))] : []),
  ];

  // By category and by event over the recent window, with the category's earlier line beside it.
  const grp = new Map<string, { now: Acc; before: Acc }>(), ev = new Map<string, { a: Acc; size: Map<number, number> }>();
  for (const m of mine) {
    const g = boardGroup(m.e.name, dump.source);
    let e = grp.get(g); if (!e) grp.set(g, (e = { now: blank(), before: blank() }));
    add(m.e.start >= recent ? e.now : e.before, m.pos, m.size);
    if (m.e.start < recent) continue;
    let x = ev.get(m.e.name); if (!x) ev.set(m.e.name, (x = { a: blank(), size: new Map() }));
    add(x.a, m.pos, m.size); x.size.set(m.size, (x.size.get(m.size) ?? 0) + 1);
  }
  const groups = [...grp].filter(([, e]) => e.now.entries > 0).map(([group, e]) => ({ group, ...line(e.now), before: line(e.before) })).sort((a, b) => b.entries - a.entries);
  const eventsOut = [...ev].map(([name, x]) => ({ name, size: [...x.size].sort((a, b) => b[1] - a[1])[0][0], ...line(x.a) })).sort((a, b) => b.entries - a.entries);

  // Round by round over the recent window, against the 25 best regulars (by series win %).
  const acc = new Map<string, Acc>();
  const recentEvents = events.filter((e) => e.start >= recent);
  for (const e of recentEvents) e.finishers.forEach((u, i) => { const k = u.toLowerCase(); let a = acc.get(k); if (!a) acc.set(k, (a = blank())); add(a, i + 1, e.finishers.length); });
  const top = new Set([...acc].filter(([u, a]) => a.entries >= o.regularPerRecent && u !== user).sort((x, y) => y[1].won / Math.max(1, y[1].won + y[1].lost) - x[1].won / Math.max(1, x[1].won + x[1].lost)).slice(0, 25).map(([u]) => u));
  const rd = new Map<number, { w: number; p: number; tw: number; tp: number }>();
  for (const e of recentEvents) {
    const size = e.finishers.length, R = Math.log2(size);
    e.finishers.forEach((u, i) => {
      const k = u.toLowerCase(), isMe = k === user;
      if (!isMe && !top.has(k)) return;
      const { won } = seriesRecord(i + 1, size);
      for (let r = 1; r <= R; r++) {
        if (won < r - 1) break;
        const left = size >> (r - 1);
        let x = rd.get(left); if (!x) rd.set(left, (x = { w: 0, p: 0, tw: 0, tp: 0 }));
        if (isMe) { x.p++; if (won >= r) x.w++; } else { x.tp++; if (won >= r) x.tw++; }
      }
    });
  }
  const rounds = [...rd].sort((a, b) => b[0] - a[0]).filter(([, x]) => x.p > 0).map(([left, x]) => ({
    left, won: x.w, played: x.p, pct: round1((100 * x.w) / x.p), topPct: x.tp ? round1((100 * x.tw) / x.tp) : null,
  }));
  return { weeks, windows, groups, events: eventsOut, rounds };
}

export function buildScoreboard(tournaments: ParsedDump, drafts: ParsedDump, user: string, today: string, recentDays = 42): Scoreboard {
  return {
    user, generatedOn: today, recentDays,
    through: [tournaments.dateMax, drafts.dateMax].sort()[0],
    tournaments: kindBoard(tournaments, user, { recentDays, regularPerRecent: 60, weeks: 16 }),
    drafts: kindBoard(drafts, user, { recentDays, regularPerRecent: 30, weeks: 16 }),
  };
}
