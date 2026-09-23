/**
 * What the PTCS berth line will END at, projected from where it is now.
 *
 * A line grows through a period as everyone plays, so "the line is 38" a week
 * in means nothing on its own. PTCS 5 is the structural twin of PTCS 7 — both
 * 28 days — so its own growth from day N to the finish is the multiplier, read
 * off the same dumps rather than assumed. PTCS 6 (35 days) is shown as a
 * sanity check, scaled for length.
 *
 * N IS NOT A CONSTANT. It is how far into the period the newest dump on disk
 * actually reaches, and the SAME N has to cut PTCS 5 and PTCS 6 as cuts PTCS 7
 * — the method is "how much did this same line grow from day N to the finish",
 * so an N in the numerator that differs from the one in the denominator breaks
 * it silently. It used to be hardcoded to 8, which quietly threw away every
 * dump newer than day 8: dropping in a fresher file changed nothing because
 * the day-8 window truncated it straight back.
 *
 *   pnpm cutoff:project [--day N]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDump, computeStandings, type ParsedDump } from "../src/lib/analytics/dumps";
import { todayInChicago } from "@/lib/ptcs-progress";

const DIR = join(process.cwd(), "..", "Tourney Data");
const USER = "rtr1776";
const CATS = ["Bronze","Silver","Gold","Diamond","Cap","Open","PD Daily","PD Weekly","Iron","Live"];
const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const newest = (p: string): { file: string; dump: ParsedDump } => {
  const file = readdirSync(DIR).filter(x => x.startsWith(p) && x.endsWith(".csv")).sort().pop()!;
  return { file, dump: parseDump(readFileSync(join(DIR, file), "utf8"))! };
};
const T = newest("pt27_tournaments_competitve_dump_"), D = newest("pt27_drafts_competitve_dump_");
const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const day = (start: string, n: number) => new Date(at(start) + (n - 1) * 864e5).toISOString().slice(0, 10);
const dayIndex = (start: string, iso: string) => Math.round((at(iso) - at(start)) / 864e5) + 1;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/*
 * Both dumps go in together. A per-file merge would be enough for the tier
 * categories (tournaments only) and the PD ones (drafts only), but Live spans
 * BOTH files, and spreading one result over the other silently kept whichever
 * came last instead of the sum — the Live line read 7 against a PTCS 5 anchor
 * of 103. computeStandings tags each event with its own source, so the tier
 * and PD categories are unchanged by passing the pair.
 */
const lines = (start: string, end: string) =>
  computeStandings([T.dump, D.dump], { start, end }, USER).categories as Record<string, any>;

const P5 = { start: "2026-07-06", end: "2026-08-02" };
const P6 = { start: "2026-08-03", end: "2026-09-06" };
const P7 = { start: "2026-09-07", end: "2026-10-04" };
const len = (p: { start: string; end: string }) => dayIndex(p.start, p.end);
const P5LEN = len(P5), P6LEN = len(P6), P7LEN = len(P7);

/**
 * How far the dump itself reaches, on the clock computeStandings buckets by.
 * That function opens each day's window at 05:00Z (~midnight Central), so the
 * dump's last day has to be read on the same clock — ParsedDump.dateMax is a
 * plain UTC date and rolls a late-evening Central event into the next day,
 * which would overstate N by one for any dump pulled after midnight Central.
 */
const latestDay = (d: ParsedDump) =>
  new Date((Math.max(...d.events.map(e => e.start)) - 5 * 3600) * 1000).toISOString().slice(0, 10);
const SRC = [
  { kind: "tournaments", file: T.file, reach: latestDay(T.dump) },
  { kind: "drafts", file: D.file, reach: latestDay(D.dump) },
];
/*
 * One N covers every category, so the STALER of the two dumps is what binds:
 * running a day-15 window over a drafts file that stops at day 8 would read
 * the day-8 PD lines back out and then divide them by a day-15 multiplier.
 * Both files are printed below so a mismatch is visible rather than inferred.
 */
const bind = SRC.reduce((a, b) => (a.reach <= b.reach ? a : b));
const derived = dayIndex(P7.start, bind.reach);
const raw = val("day");
if (argv.includes("--day") && !/^\d+$/.test(raw ?? "")) { console.error(`--day takes a whole number of days, got ${raw === undefined ? "nothing" : JSON.stringify(raw)}`); process.exit(1); }
const N = clamp(raw !== undefined ? Number(raw) : derived, 1, P7LEN);

const p5dN = lines(P5.start, day(P5.start, N)), p5end = lines(P5.start, P5.end);
const p6dN = lines(P6.start, day(P6.start, N)), p6end = lines(P6.start, P6.end);
const p7dN = lines(P7.start, day(P7.start, N));

/** Growth from day N to the end of a `fromLen`-day period, restated over this one. */
const rescale = (g: number, fromLen: number) =>
  fromLen === P7LEN || N >= fromLen ? g : 1 + (g - 1) * (P7LEN - N) / (fromLen - N);

console.log(`\nPTCS 7 · day ${N} of ${P7LEN} · where the line is now and where it lands\n`);
const forced = raw !== undefined && N !== derived;
if (forced) console.log(`  day ${N} ← --day${Number(raw) === N ? "" : ` (clamped from ${raw})`}, overriding the day ${derived} the dumps reach`);
console.log(`  ${forced ? "dumps  " : `day ${N} ←`} ${bind.file} (${bind.kind}, reaches ${bind.reach})`);
for (const s of SRC) if (s !== bind) console.log(`  also    ${s.file} (${s.kind}, reaches ${s.reach})`);
const today = todayInChicago(), calendarDay = clamp(dayIndex(P7.start, today), 1, P7LEN);
/* Staleness is a property of the dump, so it reads off `derived` — forcing N
 * with --day moves the multiplier, not the data underneath it. */
if (derived < 1) console.log(`  ⚠ the newest dump ends BEFORE PTCS 7 opened — there is no day-N read here at all`);
else if (calendarDay > derived) console.log(`  ⚠ today is ${today}, day ${calendarDay} — the dump stops at day ${derived}, ${calendarDay - derived} day(s) back, and so does every line below`);
if (SRC[0].reach !== SRC[1].reach) console.log(`  ⚠ the two dumps end on different days; the earlier one sets N`);
console.log();
console.log(`  category     you  rank   line now |  P5 d${N} → P5 end  ×    |  P6 scaled ×  |  PROJECTED  verdict`);
for (const c of CATS) {
  const now = p7dN[c]; if (!now) continue;
  const a = p5dN[c]?.lines.l128 ?? 0, b = p5end[c]?.lines.l128 ?? 0;
  const a6 = p6dN[c]?.lines.l128 ?? 0, b6 = p6end[c]?.lines.l128 ?? 0;
  const m5 = a > 0 ? rescale(b / a, P5LEN) : 0;
  const m6 = a6 > 0 ? rescale(b6 / a6, P6LEN) : 0;
  const mult = m5 > 0 && m6 > 0 ? (m5 + m6) / 2 : (m5 || m6);
  const proj = Math.round((now.lines.l128 || 0) * mult);
  const you = now.pts, rank = now.rank;
  const verdict = rank == null ? "not entered"
    : rank <= 128 ? `IN now, ${you >= proj ? "already past the projected line" : `needs ${proj - you} more`}`
    : `out — ${proj - you} short of the projection`;
  console.log(`  ${c.padEnd(11)} ${String(you).padStart(4)} ${String(rank ?? "—").padStart(5)} ${String(now.lines.l128).padStart(9)} | ` +
    `${String(a).padStart(5)} →${String(b).padStart(5)} ${m5.toFixed(2).padStart(6)} | ` +
    `${m6.toFixed(2).padStart(12)} | ${String(proj).padStart(9)}  ${verdict}`);
}
console.log(`\n  "line now" is the 128th-place total through day ${N} of ${P7LEN} (${bind.reach}), so it is small by`);
console.log(`  construction. The multiplier is how much that same line grew from day ${N} over the rest of PTCS 5`);
console.log(`  (${P5LEN} days, the same shape as this period) averaged with PTCS 6 rescaled to ${P7LEN} days.\n`);
process.exit(0);
