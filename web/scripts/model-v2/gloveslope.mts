/** Does league normalisation compress defence? ZR per 600 PA against the card's own (shop) position rating, league vs tournaments. */
import { readFileSync, readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { parseLeagueExport } from "@/lib/ingest/league";
import { fieldingRuns } from "@/lib/analytics/fielding";
const sql = neon(process.env.DATABASE_URL!);
const snaps = (await sql.query(`select id from league_snapshots where split='all' and not (league='HD452' and captured_on::date in ('2026-10-01','2026-10-08','2026-10-10'))`)) as any[];
const L = (await sql.query(`select cid, pos, pa, stats from league_stints where snapshot_id = any($1) and not is_free_agent and not is_pitcher and cid is not null`, [snaps.map((s: any) => s.id)])) as any[];
const T: any[] = [];
const files = readdirSync("../Tourney Data/Cap Exports").filter((x) => x.endsWith(".csv")).map((f) => `../Tourney Data/Cap Exports/${f}`)
  .concat(["bronze", "silver", "gold", "diamond", "open", "cap"].map((b) => `../Tourney Data/PTCS7 Championship/${b}_all.csv`));
for (const f of files) for (const s of (parseLeagueExport(readFileSync(f, "utf8"), f.split("/").pop()!) as any).stints) if (!s.isPitcher && !s.isFreeAgent && s.cid != null) T.push({ cid: s.cid, pos: s.pos, pa: s.stats.PA ?? 0, stats: s.stats });
const ids = [...new Set([...L, ...T].map((r) => r.cid))];
const rat = new Map(((await sql.query(`select card_id, ratings from cards where card_id = any($1)`, [ids])) as any[]).map((c) => [c.card_id, c.ratings]));
const fit = (rows: any[], pos: string) => {
  const xs: number[] = [], ys: number[] = [], ws: number[] = [], ms: number[] = [];
  for (const r of rows) { if (r.pos !== pos || r.pa < 50 || r.stats.ZR == null) continue; const g = rat.get(r.cid)?.[`Pos Rating ${pos}`]; if (!g) continue; xs.push(g); ys.push((600 * r.stats.ZR) / r.pa); ws.push(r.pa); ms.push(fieldingRuns(pos, g) * 600 / 700); }
  const sw = ws.reduce((a, b) => a + b, 0); if (sw === 0) return null;
  const mean = (v: number[]) => v.reduce((a, b, i) => a + b * ws[i], 0) / sw;
  const mx = mean(xs), my = mean(ys), mm = mean(ms);
  let sxy = 0, sxx = 0, smy = 0, smm = 0;
  xs.forEach((x, i) => { sxy += ws[i] * (x - mx) * (ys[i] - my); sxx += ws[i] * (x - mx) ** 2; smy += ws[i] * (ms[i] - mm) * (ys[i] - my); smm += ws[i] * (ms[i] - mm) ** 2; });
  return { n: xs.length, pa: sw, slope10: 10 * sxy / sxx, onModel: smy / smm };
};
console.log("ZR per 600 PA per +10 card position rating; and ZR per run of the model's glove runs (1.00 = the model's price)");
for (const pos of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]) {
  const a = fit(L, pos), b = fit(T, pos);
  console.log(`  ${pos.padEnd(3)} league ${a ? `${a.slope10.toFixed(2)} /10 pts · ${a.onModel.toFixed(2)}× model (${a.n} lines, ${Math.round(a.pa / 1000)}k PA)` : "-"}   |   tournaments ${b ? `${b.slope10.toFixed(2)} /10 pts · ${b.onModel.toFixed(2)}× model (${b.n} lines, ${Math.round(b.pa / 1000)}k PA)` : "-"}`);
}
