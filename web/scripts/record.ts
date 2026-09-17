/**
 * Series record by round, read off the tournaments dump.
 *
 *   pnpm record                       rtr1776, every format
 *   pnpm record --user spatrick4 --size 128 --weekly
 *   pnpm record --series "Daily Diamonds are Forever"
 *
 * The dump lists each event's field in finishing order. In a single-
 * elimination bracket the finishing position fixes the record: 1st won every
 * round; 2nd won all but the final; 3rd–4th lost in the semis; 5th–8th in the
 * quarters; and so on down to 65th–128th, who lost in round one. So round-by-
 * round series W–L is exact from the dump alone. Verified 2026-09-17 against
 * an independently published table for cwhitman (673–335) and spatrick4
 * (865–342) on weekly 128s, March 14 – September 13: identical to the game.
 *
 * "weekly" = title starts with a weekday; everything else is a daily.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k: string) => argv.includes(`--${k}`);
const USER = (val("user", "rtr1776") as string).toLowerCase();
const SIZE = val("size") ? Number(val("size")) : null;
const WEEKLY = flag("weekly"), DAILY = flag("daily");
const SERIES = val("series")?.toLowerCase() ?? null;
const FROM = val("from") ? Date.parse(val("from")!) / 1000 : 0;
const TO = val("to") ? Date.parse(val("to")!) / 1000 : Infinity;

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIR = join(ROOT, "Tourney Data");
const dump = readdirSync(DIR).filter((f) => /^pt27_tournaments_.*\.csv$/i.test(f)).sort().at(-1);
if (!dump) throw new Error(`no tournaments dump in ${DIR}`);
const lines = readFileSync(join(DIR, dump), "utf8").split(/\r?\n/).filter((l) => l.trim());
const rows = lines.slice(2).map((l) => l.split(","));
const DAYS = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;

type Rec = { size: number; won: number; lost: boolean; pos: number; title: string; ts: number; weekly: boolean };
const recs: Rec[] = [];
for (const r of rows) {
  const names = r.slice(3).map((x) => x.toLowerCase()); const size = names.length;
  if (![16, 32, 64, 128, 256].includes(size)) continue;
  const pos = names.indexOf(USER) + 1; if (!pos) continue;
  const ts = Number(r[2]) || 0; if (ts < FROM || ts >= TO) continue;
  const title = r[1].replace(/\s+/g, " ").trim(); const weekly = DAYS.test(title);
  if (SIZE && size !== SIZE) continue;
  if (WEEKLY && !weekly) continue; if (DAILY && weekly) continue;
  if (SERIES && !title.toLowerCase().includes(SERIES)) continue;
  const R = Math.log2(size);
  const won = pos === 1 ? R : R - Math.ceil(Math.log2(pos));
  recs.push({ size, won, lost: pos !== 1, pos, title, ts, weekly });
}
const pct = (w: number, l: number) => (w + l ? `${(100 * w / (w + l)).toFixed(1)}%` : "—");
const span = recs.length ? `${new Date(Math.min(...recs.map((r) => r.ts)) * 1000).toISOString().slice(0, 10)} – ${new Date(Math.max(...recs.map((r) => r.ts)) * 1000).toISOString().slice(0, 10)}` : "";
console.log(`\n${USER} · ${dump} · ${recs.length} events${span ? ` · ${span}` : ""}${SIZE ? ` · ${SIZE}-team` : ""}${WEEKLY ? " · weeklies" : DAILY ? " · dailies" : ""}${SERIES ? ` · "${SERIES}"` : ""}\n`);

// by round, per field size
for (const size of [...new Set(recs.map((r) => r.size))].sort((a, b) => a - b)) {
  const R = Math.log2(size); const W = Array(R).fill(0), L = Array(R).fill(0);
  const here = recs.filter((r) => r.size === size);
  for (const r of here) { for (let i = 0; i < r.won; i++) W[i]++; if (r.lost) L[r.won]++; }
  const tw = W.reduce((a, b) => a + b, 0), tl = L.reduce((a, b) => a + b, 0);
  console.log(`${size}-team · ${here.length} events · titles ${here.filter((r) => r.pos === 1).length}`);
  for (let i = 0; i < R; i++) {
    const label = i === R - 1 ? "Final" : i === R - 2 ? "Semifinal" : i === R - 3 ? "Quarterfinal" : `Round of ${size >> i}`;
    console.log(`  ${String(i + 1)}  ${label.padEnd(13)} ${String(W[i]).padStart(4)}-${String(L[i]).padEnd(4)} ${pct(W[i], L[i]).padStart(6)}`);
  }
  console.log(`     ${"all rounds".padEnd(13)} ${String(tw).padStart(4)}-${String(tl).padEnd(4)} ${pct(tw, tl).padStart(6)}\n`);
}

// by series
const bySeries = new Map<string, { n: number; w: number; l: number; t: number }>();
for (const r of recs) { const a = bySeries.get(r.title) ?? { n: 0, w: 0, l: 0, t: 0 }; a.n++; a.w += r.won; a.l += r.lost ? 1 : 0; a.t += r.pos === 1 ? 1 : 0; bySeries.set(r.title, a); }
const list = [...bySeries].filter(([, a]) => a.n >= 5).sort((x, y) => y[1].w / (y[1].w + y[1].l) - x[1].w / (x[1].w + x[1].l));
if (list.length) {
  console.log("by series (5+ entries), best to worst:");
  for (const [t, a] of list) console.log(`  ${t.padEnd(46)} ${String(a.n).padStart(3)} ev  ${String(a.w).padStart(3)}-${String(a.l).padEnd(3)} ${pct(a.w, a.l).padStart(6)}  titles ${a.t}`);
}
// by month
const byMonth = new Map<string, { n: number; w: number; l: number }>();
for (const r of recs) { const m = new Date(r.ts * 1000).toISOString().slice(0, 7); const a = byMonth.get(m) ?? { n: 0, w: 0, l: 0 }; a.n++; a.w += r.won; a.l += r.lost ? 1 : 0; byMonth.set(m, a); }
console.log("\nby month:");
for (const [m, a] of [...byMonth].sort()) console.log(`  ${m}  ${String(a.n).padStart(4)} events  ${a.w}-${a.l}  ${pct(a.w, a.l)}`);
