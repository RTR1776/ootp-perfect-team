/**
 * Cross-check the tournament findings against LEAGUE play, and report a team.
 *
 * League data and tournament data are different worlds — one run environment,
 * full 162-game seasons, and league stats get compressed toward the mean where
 * tournaments do not — so this is NOT used to fit anything. It is used the one
 * way league data is safe: as an independent check on a STRUCTURAL claim that
 * was measured somewhere else. The bullpen role effect was found on 10.7M
 * tournament batters faced; if it is real it should appear here too, in data
 * that shares none of that sample.
 *
 *   pnpm league:check [--league HD453] [--on 2026-09-13] [--team "Kansas City Torrent"]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pitcherRates, hitterRates, cardRuns, envFor, roleRuns } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const LEAGUE = val("league", "HD453"), ON = val("on", "2026-09-13"), TEAM = val("team", "Kansas City Torrent");

/** League exports abbreviate the rating names; the model speaks the shop's. */
const MAP: Record<string, string> = {
  STU: "Stuff", CON: "Control", PBAB: "pBABIP", HRA: "pHR", STM: "Stamina",
  Kav: "Avoid Ks", EYE: "Eye", POW: "Power", GAP: "Gap", BABr: "BABIP",
};
const expand = (r: Record<string, number>) => {
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) o[MAP[k] ?? k] = v;
  return o;
};
const wmean = (v: number[], w: number[]) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  const snap = asRows<any>(await db.execute(sql`
    select id from league_snapshots where league=${LEAGUE} and split='all' and captured_on=${ON}`));
  if (!snap.length) throw new Error(`no ${LEAGUE} all snapshot on ${ON}`);
  const rows = asRows<any>(await db.execute(sql`
    select name, pos, org, val, tier, is_pitcher, pa, ip, war, ratings, stats
    from league_stints where snapshot_id = ${snap[0].id} and not is_free_agent`));
  console.log(`${LEAGUE} · week of ${ON} · ${rows.length} rostered cards\n`);

  /* ---------------- the role effect, on data it was not found in ----------- */
  const arms = rows.filter((r) => r.is_pitcher)
    .map((r) => ({ ...r, rt: expand(r.ratings), bf: Number(r.stats.BF), er: Number(r.stats.ER) }))
    .filter((r) => r.bf >= 200 && Number.isFinite(r.er));
  const lgRate = arms.reduce((a, b) => a + b.er, 0) / arms.reduce((a, b) => a + b.bf, 0);
  const pts: any[] = [];
  for (const a of arms) {
    const rates = pitcherRates(a.rt, era.rates); if (!rates) continue;
    pts.push({ ...a, model: cardRuns(rates, env), obs: (a.er / a.bf / lgRate - 1) * lgRate * 700 });
  }
  const W = pts.map((p) => p.bf);
  const mm = wmean(pts.map((p) => p.model), W), om = wmean(pts.map((p) => p.obs), W);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < pts.length; i++) { const dx = pts[i].model - mm, dy = pts[i].obs - om; sxy += W[i] * dx * dy; sxx += W[i] * dx * dx; }
  const k = sxy / sxx;
  for (const p of pts) p.gap = p.obs - (om + k * (p.model - mm));
  console.log(`ROLE EFFECT — does it show up in league play too?`);
  console.log(`  ${pts.length} arms, ${Math.round(W.reduce((a, b) => a + b, 0)).toLocaleString()} BF · model rescaled by ${k.toFixed(3)} first\n`);
  console.log(`  role     arms       BF    league    tournament   (runs per 700 BF vs the model)`);
  const TOURN: Record<string, number> = { SP: 0.82, RP: -3.79, CL: -4.94 };
  for (const role of ["SP", "RP", "CL"]) {
    const g = pts.filter((p) => p.pos === role); if (!g.length) continue;
    const gap = wmean(g.map((p) => p.gap), g.map((p) => p.bf));
    console.log(`  ${role.padEnd(6)} ${String(g.length).padStart(5)} ${String(Math.round(g.reduce((a, b) => a + b.bf, 0))).padStart(9)}    ${(gap >= 0 ? "+" : "") + gap.toFixed(2).padStart(6)}      ${(TOURN[role] >= 0 ? "+" : "") + TOURN[role].toFixed(2).padStart(6)}`);
  }

  /* ---------------------------- the team ----------------------------------- */
  const teams = new Map<string, { war: number; n: number }>();
  for (const r of rows) { const t = teams.get(r.org) ?? { war: 0, n: 0 }; t.war += Number(r.war); t.n++; teams.set(r.org, t); }
  const rank = [...teams].sort((a, b) => b[1].war - a[1].war);
  const mine = rank.findIndex(([t]) => t === TEAM);
  const lgWarPerTeam = [...teams.values()].reduce((a, b) => a + b.war, 0) / teams.size;
  console.log(`\n\n${TEAM} — ${mine + 1} of ${teams.size} by WAR (${rank[mine][1].war.toFixed(1)}, league average ${lgWarPerTeam.toFixed(1)})`);
  const mineRows = rows.filter((r) => r.org === TEAM);
  const show = (label: string, set: any[], metric: (r: any) => string) => {
    console.log(`\n  ${label}`);
    for (const r of set) console.log(`    ${r.name.slice(0, 24).padEnd(25)} ${String(r.val ?? "").padStart(3)} ${r.pos.padEnd(3)} ${Number(r.war).toFixed(1).padStart(5)}  ${metric(r)}`);
  };
  const bats = mineRows.filter((r) => !r.is_pitcher).sort((a, b) => Number(b.war) - Number(a.war));
  const pit = mineRows.filter((r) => r.is_pitcher).sort((a, b) => Number(b.war) - Number(a.war));
  show(`bats (${bats.length})`, bats, (r) => `${r.pa} PA  wRAA ${Number(r.stats.wRAA ?? 0).toFixed(0)}`);
  show(`arms (${pit.length})`, pit, (r) => `${Number(r.ip).toFixed(0)} IP  SIERA ${Number(r.stats.SIERA ?? 0).toFixed(2)}`);

  /* ------------- each of his cards: the model against what happened -------- */
  console.log(`\n\n  your cards — model value against what they actually did, per 700 PA/BF`);
  console.log(`  (one league season is a small sample; treat a gap under ~8 runs as noise)`);
  const lgBats = rows.filter((r: any) => !r.is_pitcher && Number(r.pa) >= 150);
  const lgW = wmean(lgBats.map((r: any) => Number(r.stats.wRAA ?? 0) / Number(r.pa)), lgBats.map((r: any) => Number(r.pa)));
  /**
   * The model's zero is a league-average CARD (~110 ratings). HD453 is a field
   * where every roster spot is a 100-value card, so that zero sits far below the
   * field and every card on every team reads "under". Both sides are therefore
   * re-centred on THIS league's own weighted mean — the same per-series
   * normalisation the tournament work uses, applied to a league.
   */
  const centre = (isPit: boolean) => {
    const set = rows.filter((r: any) => r.is_pitcher === isPit)
      .map((r: any) => {
        const rt = expand(r.ratings);
        const w = isPit ? Number(r.stats.BF) : Number(r.pa);
        if (!(w >= 150)) return null;
        const rates = isPit ? pitcherRates(rt, era.rates) : hitterRates(rt, era.rates);
        if (!rates) return null;
        const m = isPit ? -(cardRuns(rates, env) + roleRuns(r.pos, rt["Stamina"])) * k : cardRuns(rates, env) * k;
        return { m, w };
      }).filter(Boolean) as { m: number; w: number }[];
    return wmean(set.map((x) => x.m), set.map((x) => x.w));
  };
  const cBat = centre(false), cPit = centre(true);
  console.log(`  (model re-centred on the ${LEAGUE} field: bats ${cBat.toFixed(1)}, arms ${cPit.toFixed(1)} runs/700 — the model's own zero is a ~110-rated card, far below this field)`);
  const line: any[] = [];
  for (const r of mineRows) {
    const rt = expand(r.ratings);
    if (r.is_pitcher) {
      const bf = Number(r.stats.BF); if (!(bf >= 150)) continue;
      const rates = pitcherRates(rt, era.rates); if (!rates) continue;
      const model = -(cardRuns(rates, env) + roleRuns(r.pos, rt["Stamina"]));   // runs SAVED
      const obs = -((Number(r.stats.ER) / bf / lgRate - 1) * lgRate * 700);
      line.push({ nm: r.name, val: r.val, pos: r.pos, use: `${Number(r.ip).toFixed(0)} IP`, model: model * k - cPit, obs });
    } else {
      const pa = Number(r.pa); if (!(pa >= 150)) continue;
      const rates = hitterRates(rt, era.rates); if (!rates) continue;
      const obs = (Number(r.stats.wRAA ?? 0) / pa - lgW) * 700;
      line.push({ nm: r.name, val: r.val, pos: r.pos, use: `${pa} PA`, model: cardRuns(rates, env) * k - cBat, obs });
    }
  }
  line.sort((a, b) => (a.obs - a.model) - (b.obs - b.model));
  console.log(`    card                      val  pos       use     model     actual     gap`);
  for (const x of line) {
    const gap = x.obs - x.model;
    const flag = gap < -10 ? "  <-- under" : gap > 10 ? "  <-- over" : "";
    console.log(`    ${x.nm.slice(0, 24).padEnd(25)} ${String(x.val).padStart(3)}  ${x.pos.padEnd(3)} ${x.use.padStart(8)}  ${x.model.toFixed(1).padStart(7)}  ${x.obs.toFixed(1).padStart(8)}  ${(gap >= 0 ? "+" : "") + gap.toFixed(1).padStart(6)}${flag}`);
  }

  /* --------------- where the top teams differ from this one ---------------- */
  const top = rank.slice(0, 5).map(([t]) => t).filter((t) => t !== TEAM);
  const profile = (teamsIn: string[]) => {
    const set = rows.filter((r) => teamsIn.includes(r.org));
    const n = new Set(set.map((r) => r.org)).size;
    const p = set.filter((r) => r.is_pitcher);
    return {
      cards: set.length / n,
      val: wmean(set.map((r) => Number(r.val ?? 0)), set.map(() => 1)),
      armShare: p.length / (set.length / 1) ,
      spIp: p.filter((r) => r.pos === "SP").reduce((a, b) => a + Number(b.ip), 0) / n,
      penIp: p.filter((r) => r.pos !== "SP").reduce((a, b) => a + Number(b.ip), 0) / n,
      warPit: p.reduce((a, b) => a + Number(b.war), 0) / n,
      warBat: set.filter((r) => !r.is_pitcher).reduce((a, b) => a + Number(b.war), 0) / n,
    };
  };
  const a = profile([TEAM]), b = profile(top);
  console.log(`\n\n  shape, you vs the other top-5 teams (per team)`);
  console.log(`                        you    top-5`);
  console.log(`    cards            ${a.cards.toFixed(1).padStart(7)} ${b.cards.toFixed(1).padStart(8)}`);
  console.log(`    avg card value   ${a.val.toFixed(1).padStart(7)} ${b.val.toFixed(1).padStart(8)}`);
  console.log(`    starter IP       ${a.spIp.toFixed(0).padStart(7)} ${b.spIp.toFixed(0).padStart(8)}`);
  console.log(`    bullpen IP       ${a.penIp.toFixed(0).padStart(7)} ${b.penIp.toFixed(0).padStart(8)}`);
  console.log(`    WAR from bats    ${a.warBat.toFixed(1).padStart(7)} ${b.warBat.toFixed(1).padStart(8)}`);
  console.log(`    WAR from arms    ${a.warPit.toFixed(1).padStart(7)} ${b.warPit.toFixed(1).padStart(8)}`);
  process.exit(0);
}
main();
