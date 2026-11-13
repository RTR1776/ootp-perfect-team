/**
 * The scoreboard, from the newest community dumps: L.J.'s series record and
 * points an entry by week, category, event and round, with his rank among
 * the players who enter as often and the 25 best of them round by round
 * (lib/analytics/scoreboard). No database: the dumps list every field.
 *
 *   pnpm scoreboard [--user rtr1776] [--days 42] [--dry]
 *
 * Writes src/data/scoreboard.json, which /scoreboard shows. load:dumps runs
 * it after every dump; commit the file with the rest of web/src/data.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newestDumpFile } from "@/lib/analytics/dump-files";
import { parseDump } from "@/lib/analytics/dumps";
import { buildScoreboard } from "@/lib/analytics/scoreboard";
import { todayInChicago } from "@/lib/ptcs-progress";

const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const USER = val("user", "rtr1776");
const DAYS = Number(val("days", "42")) || 42;
const DIR = join(process.env.OOTP_DATA_ROOT ?? "..", "Tourney Data");

const load = (kind: "tournaments" | "drafts") => {
  const f = newestDumpFile(DIR, kind);
  if (!f) throw new Error(`no ${kind} dump in ${DIR}`);
  const d = parseDump(readFileSync(join(DIR, f), "utf8"));
  if (!d) throw new Error(`could not parse ${f}`);
  console.log(`  ${f}: ${d.events.length} events through ${d.dateMax}`);
  return d;
};

console.log(`\nSCOREBOARD for ${USER}`);
const board = buildScoreboard(load("tournaments"), load("drafts"), USER, todayInChicago(), DAYS);
for (const [label, k] of [["tournaments", board.tournaments], ["drafts", board.drafts]] as const) {
  console.log(`\n  ${label}`);
  for (const w of k.windows) {
    console.log(`    ${w.label.padEnd(22)} ${String(w.me.entries).padStart(4)} entries  ${w.me.won}-${w.me.lost}  ${w.me.pct ?? "—"}%  ${w.me.ptsPer ?? "—"} pts/entry` +
      `  rank ${w.rank ?? "—"} of ${w.regulars} (${w.minEntries}+ events; 10th ${w.tenthPct ?? "—"}%, median ${w.medianPct ?? "—"}%)`);
  }
  if (k.rounds.length) console.log(`    by teams left (you / top 25): ${k.rounds.map((r) => `${r.left}: ${r.pct}/${r.topPct ?? "—"}`).join("  ")}`);
}
if (argv.includes("--dry")) process.exit(0);
const dest = join(process.cwd(), "src", "data", "scoreboard.json");
writeFileSync(dest, JSON.stringify(board, null, 1) + "\n");
console.log(`\n  wrote ${dest} (through ${board.through}); commit it so /scoreboard shows it\n`);
