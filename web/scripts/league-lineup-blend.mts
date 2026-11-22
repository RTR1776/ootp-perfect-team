/**
 * KC's PEL lineups on the league model, blended with each card's league history.
 *
 *   python3 scripts/league-resid.py ../Archive/.league-panel.csv ../Archive/.league-resid.json src/data/league-model.json
 *   node --import tsx scripts/league-lineup-blend.mts ../Archive/.league-resid.json [year 2014] [K 1300]
 *
 * Each bat = league model (year, 1987 Yankee Stadium at half weight) + n/(n+K) x (observed - model)
 * over every league line of that card (league-resid.py). Reggie, Matsui and Edgar are DH-only (L.J.).
 * Env: ROSTER="Name,Name#id,..." (default: the 2026-11-16 KC pool), ACTIVE="..." (the bats on the 26),
 * MINE_R / MINE_L="SLOT:Name,..." to score his lineups against the best nine, LHP=share for the season weights.
 * FAMILY=PEL|HD|LD (default PEL) and PARK="1987 Yankee Stadium" (the home park) for another tier or park.
 * Prints each bat, the best nines, the gap to his lineups, and each bat's season worth.
 */
import { readFileSync } from "node:fs";
import { loadHitterUniverse, resolveRoster } from "@/lib/league-hitters";
import { leagueLineups, type Lineup, type Locks } from "@/lib/analytics/league-lineup";
import { parkFor } from "@/lib/analytics/tournament-env";

const [residPath, yearArg, kArg] = process.argv.slice(2);
const YEAR = Number(yearArg ?? 2014), K = Number(kArg ?? 1300), LHP_DIV = Number(process.env.LHP ?? 0.44);
const resid = JSON.parse(readFileSync(residPath, "utf8")) as Record<string, { pa: number; obs: number; pred: number; pelPa?: number; pelResid?: number }>;
const NAMES = (process.env.ROSTER ?? "George Brett,Ed Delahanty,Corey Seager,Leodalis De Vries,Reggie Jackson,Andruw Jones,Gabriel Moreno,Albert Pujols,Alex Rodriguez,Juan Soto,Chase Utley,Edgar Martinez,Curtis Granderson,Bob Boone#87498,Jose Bautista,Yadier Molina,Hideki Matsui,Elly De La Cruz#87387").split(",");
const DH_ONLY = ["Reggie Jackson", "Hideki Matsui", "Edgar Martinez"];
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

const u = await loadHitterUniverse();
const { hitters, warnings } = resolveRoster(NAMES, u, false);
const FAMILY = (process.env.FAMILY ?? "PEL") as "PEL" | "HD" | "LD";
const park = parkFor(process.env.PARK ?? "1987 Yankee Stadium");
const m = leagueLineups(hitters, { family: FAMILY, year: YEAR, park: park.row });
for (const w of [...warnings, ...m.warnings]) console.log("  !!", w);
for (const h of hitters) if (DH_ONLY.some((n) => h.label.startsWith(n))) for (const k of Object.keys(h.ratings)) if (k.startsWith("Pos Rating")) h.ratings[k] = 0;
console.log(`year ${YEAR} · park ${park.label} · K ${K} · LHP share ${LHP_DIV}`);
console.log("bat (model → blended)              vs RHP                     vs LHP");
for (const h of hitters) {
  const r = m.runs.get(h.id)!; const parts: string[] = [];
  for (const b of ["vR", "vL"] as const) {
    const e = resid[`${h.cardId}|${b}`], mod = r[b];
    if (mod == null) { parts.push("—".padEnd(26)); continue; }
    const w = e ? e.pa / (e.pa + K) : 0, bl = mod + (e ? w * (e.obs - e.pred) : 0);
    r[b] = bl;
    parts.push(`${f1(mod).padStart(6)} → ${f1(bl).padStart(6)} (${e ? Math.round(e.pa / 1000) + "k" : "0"} PA)`.padEnd(26));
  }
  console.log(`  ${h.label.padEnd(30)} ${parts.join("  ")}`);
}
const ids = hitters.map((h) => h.id);
const byLabel = (s: string) => hitters.find((h) => h.label.toLowerCase().startsWith(s.toLowerCase()))!.id;
const show = (label: string, s: Lineup | null) => console.log(`  ${label.padEnd(22)} ${s ? f1(s.total).padStart(7) + "  " + s.lineup.map((x) => `${x.slot} ${x.label.replace(/ \d+( VAR)?$/, "$1")} ${f1(x.runs)}`).join(" · ") : "no legal lineup"}`);
const act = (process.env.ACTIVE ?? "").split(",").filter(Boolean).map(byLabel);
const pool = act.length ? act : ids;
const best = { vR: m.solve(pool, "vR"), vL: m.solve(pool, "vL") };
console.log(`\nbest nines (active ${pool.length} bats):`); show("vs RHP", best.vR); show("vs LHP", best.vL);
const mine = (spec?: string): Locks => Object.fromEntries((spec ?? "").split(",").filter(Boolean).map((p) => { const [slot, n] = p.split(":"); return [slot, byLabel(n)]; }));
if (process.env.MINE_R) { const s = m.solve(pool, "vR", mine(process.env.MINE_R)); show("his vs RHP", s); console.log(`    gap ${f1((s?.total ?? 0) - best.vR!.total)}`); }
if (process.env.MINE_L) { const s = m.solve(pool, "vL", mine(process.env.MINE_L)); show("his vs LHP", s); console.log(`    gap ${f1((s?.total ?? 0) - best.vL!.total)}`); }
console.log(`\nseason worth of each bat in the active pool (best nines without him; boards ${Math.round((1 - LHP_DIV) * 100)}/${Math.round(LHP_DIV * 100)}):`);
for (const id of pool) {
  const rest = pool.filter((x) => x !== id);
  const r = m.solve(rest, "vR"), l = m.solve(rest, "vL");
  const dR = (r?.total ?? -999) - best.vR!.total, dL = (l?.total ?? -999) - best.vL!.total;
  console.log(`  ${hitters[id].label.padEnd(30)} ${f1((1 - LHP_DIV) * dR + LHP_DIV * dL).padStart(7)}   (vR ${f1(dR)}, vL ${f1(dL)})`);
}
for (const id of ids.filter((x) => !pool.includes(x))) {
  const r = m.solve([...pool, id], "vR"), l = m.solve([...pool, id], "vL");
  const dR = (r?.total ?? 0) - best.vR!.total, dL = (l?.total ?? 0) - best.vL!.total;
  console.log(`  + ${hitters[id].label.padEnd(28)} ${f1((1 - LHP_DIV) * dR + LHP_DIV * dL).padStart(7)}   (vR ${f1(dR)}, vL ${f1(dL)})  [not active]`);
}
process.exit(0);
