/**
 * Pen leverage (L.J. 11-01: the builder undervalues short relievers). OOTP's exports carry pLi, a
 * pitcher's average leverage index over the batters he faced (1 = an average plate appearance).
 * Per team in the tournament exports: relievers ranked by card value (as penshare.mts ranks them,
 * which is the order roster-objective's pen slots are in) and by pLi (the roles the managers used),
 * with each rank's BF share and BF-weighted pLi, plus starters' pLi as the baseline.
 *   node --import tsx scripts/model-v2/leverage.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import { num, parseCsv } from "@/lib/ingest/csv";
const ROOT = "..";
const files: string[] = [];
for (const f of readdirSync(`${ROOT}/Tourney Data/Cap Exports`).filter((x) => x.endsWith(".csv"))) files.push(`${ROOT}/Tourney Data/Cap Exports/${f}`);
for (const b of ["bronze", "silver", "gold", "diamond", "open", "cap"]) files.push(`${ROOT}/Tourney Data/PTCS7 Championship/${b}_all.csv`);
type Arm = { val: number; stm: number; g: number; gs: number; bf: number; pli: number; gf: number; sv: number; hld: number };
const acc = (n: number) => ({ teams: 0, bf: Array(n).fill(0), pliBf: Array(n).fill(0), share: Array(n).fill(0), stm: Array(n).fill(0) });
const byVal = new Map<number, ReturnType<typeof acc>>(), byPli = new Map<number, ReturnType<typeof acc>>();
let spBf = 0, spPli = 0, rpBf = 0, rpPli = 0, teams = 0;
const stmBands = new Map<string, { bf: number; pli: number; n: number }>();
for (const f of files) {
  const { rows } = parseCsv(readFileSync(f, "utf8"), { extraFields: "drop" });
  const t = new Map<string, Arm[]>();
  for (const r of rows) {
    const org = (r["ORG"] ?? "").trim();
    if (!org || org === "-") continue;
    const bf = num(r["BF"]) ?? 0, pli = num(r["pLi"]);
    if (bf <= 0 || pli == null || !["SP", "RP", "CL"].includes((r["POS"] ?? "").trim())) continue;
    const a: Arm = { val: num(r["VAL"]) ?? 0, stm: num(r["STM"]) ?? 0, g: num(r["G_1"]) ?? 0, gs: num(r["GS_1"]) ?? 0, bf, pli, gf: num(r["GF"]) ?? 0, sv: num(r["SD"]) ?? 0, hld: num(r["HLD_1"]) ?? 0 };
    (t.get(org) ?? t.set(org, []).get(org)!).push(a);
  }
  for (const arms of t.values()) {
    const sp = arms.filter((a) => a.gs >= 1 && a.gs >= 0.5 * a.g), rp = arms.filter((a) => !sp.includes(a));
    for (const a of sp) { spBf += a.bf; spPli += a.bf * a.pli; }
    const bf = rp.reduce((s, a) => s + a.bf, 0);
    if (rp.length < 3 || bf <= 0) continue;
    teams++;
    for (const a of rp) {
      rpBf += a.bf; rpPli += a.bf * a.pli;
      const band = a.stm < 30 ? "<30" : a.stm < 45 ? "30-44" : a.stm < 60 ? "45-59" : "60+";
      const e = stmBands.get(band) ?? { bf: 0, pli: 0, n: 0 }; e.bf += a.bf; e.pli += a.bf * a.pli; e.n++; stmBands.set(band, e);
    }
    const n = Math.min(rp.length, 9);
    for (const [map, order] of [[byVal, [...rp].sort((a, b) => b.val - a.val || b.bf - a.bf)], [byPli, [...rp].sort((a, b) => b.pli - a.pli)]] as const) {
      const e = map.get(n) ?? acc(9); e.teams++;
      order.slice(0, 9).forEach((a, i) => { e.bf[i] += a.bf; e.pliBf[i] += a.bf * a.pli; e.share[i] += a.bf / bf; e.stm[i] += a.stm; });
      map.set(n, e);
    }
  }
}
console.log(`${files.length} exports, ${teams} teams with 3+ relievers who pitched`);
console.log(`BF-weighted pLi: starters ${(spPli / spBf).toFixed(3)}, relievers ${(rpPli / rpBf).toFixed(3)}, all ${((spPli + rpPli) / (spBf + rpBf)).toFixed(3)}; pen's share of BF ${(rpBf / (spBf + rpBf)).toFixed(3)}`);
console.log("reliever pLi by stamina band: " + [...stmBands].sort().map(([b, e]) => `${b} ${(e.pli / e.bf).toFixed(2)} (${e.n})`).join(" · "));
for (const [label, map] of [["card value", byVal], ["pLi (role)", byPli]] as const) {
  console.log(`\nby ${label} rank within the team: BF share · pLi · mean stamina`);
  for (const [n, e] of [...map].sort((a, b) => a[0] - b[0])) {
    if (e.teams < 30) continue;
    console.log(`  ${n} RP (${e.teams} teams)`);
    console.log(`    share ${e.share.slice(0, n).map((x) => (x / e.teams).toFixed(2)).join(" ")}`);
    console.log(`    pLi   ${e.pliBf.slice(0, n).map((x, i) => (x / e.bf[i]).toFixed(2)).join(" ")}`);
    console.log(`    stm   ${e.stm.slice(0, n).map((x) => Math.round(x / e.teams)).join(" ")}`);
  }
}
