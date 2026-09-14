/**
 * What the PTCS berth line will END at, projected from where it is now.
 *
 * A line grows through a period as everyone plays, so "the line is 38" a week
 * in means nothing on its own. PTCS 5 is the structural twin of PTCS 7 — both
 * 28 days — so its own growth from day 8 to the finish is the multiplier, read
 * off the same dumps rather than assumed. PTCS 6 (35 days) is shown as a
 * sanity check, scaled for length.
 *
 *   pnpm cutoff:project
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDump, computeStandings, type ParsedDump } from "../src/lib/analytics/dumps";

const DIR = join(process.cwd(), "..", "Tourney Data");
const USER = "rtr1776";
const CATS = ["Bronze","Silver","Gold","Diamond","Cap","Open","PD Daily","PD Weekly","Iron","Live"];
const newest = (p: string): ParsedDump => {
  const f = readdirSync(DIR).filter(x => x.startsWith(p) && x.endsWith(".csv")).sort().pop()!;
  return parseDump(readFileSync(join(DIR, f), "utf8"))!;
};
const T = newest("pt27_tournaments_competitve_dump_"), D = newest("pt27_drafts_competitve_dump_");
const day = (start: string, n: number) => new Date(Date.parse(`${start}T00:00:00Z`) + (n - 1) * 864e5).toISOString().slice(0, 10);
const lines = (start: string, end: string) => {
  const a = computeStandings(T, { start, end }, USER).categories;
  const b = computeStandings(D, { start, end }, USER).categories;
  return { ...a, ...b } as Record<string, any>;
};

const P5 = { start: "2026-07-06", end: "2026-08-02" };
const P6 = { start: "2026-08-03", end: "2026-09-06" };
const P7 = { start: "2026-09-07", end: "2026-10-04" };

const p5d8 = lines(P5.start, day(P5.start, 8)), p5end = lines(P5.start, P5.end);
const p6d8 = lines(P6.start, day(P6.start, 8)), p6end = lines(P6.start, P6.end);
const p7d8 = lines(P7.start, day(P7.start, 8));

console.log(`\nPTCS 7 · day 8 of 28 · where the line is now and where it lands\n`);
console.log(`  category     you  rank   line now |  P5 d8 → P5 end  ×    |  P6 scaled ×  |  PROJECTED  verdict`);
for (const c of CATS) {
  const now = p7d8[c]; if (!now) continue;
  const a = p5d8[c]?.lines.l128 ?? 0, b = p5end[c]?.lines.l128 ?? 0;
  const a6 = p6d8[c]?.lines.l128 ?? 0, b6 = p6end[c]?.lines.l128 ?? 0;
  const m5 = a > 0 ? b / a : 0;
  // PTCS 6 ran 35 days; rescale its growth to a 28-day period
  const m6 = a6 > 0 ? 1 + (b6 / a6 - 1) * (28 - 8) / (35 - 8) : 0;
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
console.log(`\n  "line now" is the 128th-place total as of the 14 Sep dump — one week in, so it is small by`);
console.log(`  construction. The multiplier is how much that same line grew over the rest of PTCS 5 (28`);
console.log(`  days, the same shape as this period) averaged with PTCS 6 rescaled to 28 days.\n`);
process.exit(0);
