/**
 * What qualifying actually takes — the berth line, computed from the community
 * dumps rather than guessed.
 *
 * The dump lists the ENTIRE field in finish order for every event of the
 * season, so the official category standing is reproducible exactly: apply the
 * points table, sum per user, sort. The 128th-place total is the line, because
 * PTCS championship fields are 128 teams per category.
 *
 * This replaces the "the standings table is empty so there is no berth line"
 * answer, which was wrong — the line was computable from files already on disk.
 *
 *   node --env-file=.env.local --import tsx scripts/berth-lines.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDump, computeStandings, type ParsedDump } from "../src/lib/analytics/dumps";

const DIR = join(process.cwd(), "..", "Tourney Data");
const USER = "rtr1776";

const PERIODS: { name: string; start: string; end: string; champs: string }[] = [
  { name: "PTCS 4", start: "2026-06-01", end: "2026-07-05", champs: "2026-07-11" },
  { name: "PTCS 5", start: "2026-07-06", end: "2026-08-02", champs: "2026-08-08" },
  { name: "PTCS 6", start: "2026-08-03", end: "2026-09-06", champs: "2026-09-12" },
  { name: "PTCS 7", start: "2026-09-07", end: "2026-10-04", champs: "2026-10-10" },
];

const CATS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Cap", "Live", "PD Daily", "PD Weekly"];

function newest(prefix: string): ParsedDump {
  const f = readdirSync(DIR).filter((x) => x.startsWith(prefix) && x.endsWith(".csv")).sort().pop()!;
  const d = parseDump(readFileSync(join(DIR, f), "utf8"));
  if (!d) throw new Error(`could not parse ${f}`);
  console.log(`  ${f}  ${d.events.length} events  ${d.dateMin} → ${d.dateMax}`);
  return d;
}

console.log("\nDUMPS");
const T = newest("pt27_tournaments_competitve_dump_");
const D = newest("pt27_drafts_competitve_dump_");

for (const p of PERIODS) {
  const st = computeStandings(T, { start: p.start, end: p.end }, USER);
  const sd = computeStandings(D, { start: p.start, end: p.end }, USER);
  const all = { ...st.categories, ...sd.categories };
  const covered = Math.min(1, Math.max(0,
    (Math.min(Date.parse(`${T.dateMax}T00:00Z`), Date.parse(`${p.end}T00:00Z`)) - Date.parse(`${p.start}T00:00Z`)) /
    (Date.parse(`${p.end}T00:00Z`) - Date.parse(`${p.start}T00:00Z`))));

  console.log(`\n${p.name}   ${p.start} → ${p.end}   championships ${p.champs}` +
    (covered < 0.999 ? `   ** dump covers only ${(covered * 100).toFixed(0)}% of the window **` : ""));
  console.log(`  category     line@128   line@64   line@100   scored    ${USER}   rank     verdict`);
  for (const c of CATS) {
    const s = all[c];
    if (!s) continue;
    const line = s.lines.l128;
    const v = s.rank == null ? "not scored" : s.rank <= 128 ? `IN  (+${s.pts - line})` : `out (${s.pts - line})`;
    console.log(
      `  ${c.padEnd(11)} ${String(line).padStart(8)} ${String(s.lines.l64).padStart(9)} ${String(s.lines.l100).padStart(10)}` +
      ` ${String(s.scored).padStart(8)} ${String(s.pts).padStart(7)} ${String(s.rank ?? "—").padStart(6)}   ${v}`);
  }
}
console.log(`\n  line@128 is the berth line: PTCS championship fields are 128 teams per category.`);
console.log(`  line@64 / line@100 show how steep the board is just above the cut.\n`);
