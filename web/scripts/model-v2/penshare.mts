/** Who throws the pen's innings: reliever BF share by quality rank within the team (card value), tournament exports. */
import { readFileSync, readdirSync } from "node:fs";
import { parseLeagueExport } from "@/lib/ingest/league";
const ROOT = "..";
const files: string[] = [];
for (const f of readdirSync(`${ROOT}/Tourney Data/Cap Exports`).filter((x) => x.endsWith(".csv"))) files.push(`${ROOT}/Tourney Data/Cap Exports/${f}`);
for (const b of ["bronze", "silver", "gold", "diamond", "open", "cap"]) files.push(`${ROOT}/Tourney Data/PTCS7 Championship/${b}_all.csv`);
const byN = new Map<number, { share: number[]; teams: number }>();
let benchPa = 0, lineupPa = 0, nTeams = 0, benchN = 0;
for (const f of files) {
  const { stints } = parseLeagueExport(readFileSync(f, "utf8"), f.split("/").pop()!) as any;
  const teams = new Map<string, any[]>();
  for (const s of stints) { if (s.isFreeAgent) continue; (teams.get(s.org) ?? teams.set(s.org, []).get(s.org)!).push(s); }
  for (const rows of teams.values()) {
    const arms = rows.filter((s) => s.isPitcher);
    const rp = arms.filter((s) => { const g = s.stats.G_p ?? 0, gs = s.stats.GS_p ?? 0; return g > 0 ? !(gs >= 1 && gs >= 0.5 * g) : s.pos !== "SP"; });
    const bf = rp.reduce((a, s) => a + (s.stats.BF ?? 0), 0);
    if (rp.length < 3 || bf <= 0) continue;
    rp.sort((a, b) => (b.val ?? 0) - (a.val ?? 0) || (b.stats.BF ?? 0) - (a.stats.BF ?? 0));
    const n = Math.min(rp.length, 9); const e = byN.get(n) ?? { share: Array(9).fill(0), teams: 0 };
    rp.slice(0, 9).forEach((s, i) => (e.share[i] += (s.stats.BF ?? 0) / bf)); e.teams++; byN.set(n, e);
    const bats = rows.filter((s) => !s.isPitcher).sort((a, b) => (b.stats.PA ?? 0) - (a.stats.PA ?? 0));
    const tot = bats.reduce((a, s) => a + (s.stats.PA ?? 0), 0); if (!tot) continue;
    const slot = tot / 9; const bench = bats.filter((s) => (s.stats.PA ?? 0) < 0.25 * slot);
    benchPa += bench.reduce((a, s) => a + (s.stats.PA ?? 0), 0) / slot; benchN += bench.length; nTeams++;
  }
}
console.log("reliever BF share by card-value rank within the team (relievers who pitched; tournament exports)");
for (const [n, e] of [...byN].sort((a, b) => a[0] - b[0])) console.log(`  ${n} relievers (${e.teams} teams): ` + e.share.slice(0, n).map((x) => (x / e.teams).toFixed(2)).join(" "));
console.log(`bench bats: ${(benchN / nTeams).toFixed(1)} per team, ${(benchPa / benchN).toFixed(3)} of a lineup slot's PA each, ${(benchPa / nTeams).toFixed(2)} slots in all`);
