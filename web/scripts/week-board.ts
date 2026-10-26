/**
 * One week's PTCS leaderboard per category, rebuilt from the newest competitive
 * dumps (L.J. 10-25: "how many points have I scored just this week … will I get
 * any CS from weekly placing in a category").
 *
 * Every dump row is one event with its full field in finish order, so every
 * player's points per category can be summed for any window, with the same
 * category map and start-night rule as /ptcs (lib/analytics/dumps). Prints his
 * points and rank, the CS he would be paid, and the payout lines from the rules
 * PDF (Docs/Rules): weekly 1st 100, 2nd 75, 3rd–4th 50, 5th–10th 35, 11th–20th
 * 20; per PTCS period 1st 300, 2nd 200, 3rd–4th 100, 5th–10th 70, 11th–20th 40,
 * 21st–50th 20 (--period). The window defaults to the last full Monday–Sunday
 * the dumps cover.
 *
 *   node --env-file=.env.local --import tsx scripts/week-board.ts [--start 2026-10-19] [--end 2026-10-25] [--period] [--user rtr1776]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { categoriesOf, parseDump, pointsFor } from "@/lib/analytics/dumps";
import { newestDumpFile } from "@/lib/analytics/dump-files";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const DIR = join(process.env.OOTP_DATA_ROOT ?? "..", "Tourney Data");
const USER = (val("user") ?? "rtr1776").toLowerCase();
const PERIOD = argv.includes("--period");
/** Clubhouse Stars by rank (Docs/Rules/PT 27 Road to the Perfect Team World Championship.pdf). */
const PAY: [number, number][] = PERIOD ? [[1, 300], [2, 200], [4, 100], [10, 70], [20, 40], [50, 20]] : [[1, 100], [2, 75], [4, 50], [10, 35], [20, 20]];
const cs = (rank: number) => PAY.find(([r]) => rank <= r)?.[1] ?? 0;

const dumps = (["tournaments", "drafts"] as const).map((kind) => {
  const f = newestDumpFile(DIR, kind);
  if (!f) throw new Error(`no ${kind} competitive dump in ${DIR}`);
  return { kind, file: f, dump: parseDump(readFileSync(join(DIR, f), "utf8"))! };
});
const reach = dumps.map((d) => d.dump.dateMax).sort()[0];
// Default: the last Monday–Sunday that ends on or before the dumps' reach.
const lastSunday = (() => { const d = new Date(`${reach}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 7) % 7)); return d; })();
const end = val("end") ?? lastSunday.toISOString().slice(0, 10);
const start = val("start") ?? new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86400e3).toISOString().slice(0, 10);
const lo = Date.parse(`${start}T05:00:00Z`) / 1000, hi = Date.parse(`${end}T05:00:00Z`) / 1000 + 86400;

const totals = new Map<string, Map<string, number>>();
for (const { kind, dump } of dumps) for (const e of dump.events) {
  if (e.start < lo || e.start >= hi) continue;
  const cats = categoriesOf(e.name, kind), field = e.finishers.length;
  e.finishers.forEach((u, i) => {
    const p = pointsFor(i + 1, field);
    if (p > 0) for (const c of cats) { const m = totals.get(c) ?? new Map<string, number>(); m.set(u, (m.get(u) ?? 0) + p); totals.set(c, m); }
  });
}

console.log(`${dumps.map((d) => d.file).join(" + ")} (reach ${reach}); week ${start} → ${end}${end > reach ? "  !! past the dumps' reach: partial" : ""}`);
const LINES = PERIOD ? [1, 4, 10, 20, 50, 128] : [1, 4, 10, 20, 50];
console.log("category    you  rank/of     CS  " + LINES.map((n) => `#${n}`.padStart(5)).join(" "));
for (const [c, m] of [...totals].sort()) {
  const b = [...m.entries()].sort((x, y) => y[1] - x[1]);
  const r = b.findIndex(([u]) => u.toLowerCase() === USER);
  const at = (n: number) => (b.length >= n ? String(b[n - 1][1]) : "-").padStart(5);
  console.log(`${c.padEnd(10)} ${String(r >= 0 ? b[r][1] : 0).padStart(4)}  ${(r >= 0 ? `${r + 1}` : "-").padStart(4)}/${String(b.length).padEnd(5)} ${String(r >= 0 ? cs(r + 1) : 0).padStart(4)}  ${LINES.map(at).join(" ")}`);
}
