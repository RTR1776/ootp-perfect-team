/**
 * Is the staff-stamina effect (calibration.ts STAMINA_RUNS_PER_POINT) a starters' effect or a whole-staff one?
 * Team runs allowed per 9 in the 42 tournament exports, centred per export, regressed on the staff's quality
 * (BF-weighted card VAL of starters and of the pen) and the BF-weighted stamina of the starters and of the pen
 * separately. Relievers as penshare.mts defines them.  node --import tsx scripts/model-v2/penstamina.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import { num, parseCsv } from "@/lib/ingest/csv";
const ROOT = "..";
const files: string[] = [];
for (const f of readdirSync(`${ROOT}/Tourney Data/Cap Exports`).filter((x) => x.endsWith(".csv"))) files.push(`${ROOT}/Tourney Data/Cap Exports/${f}`);
for (const b of ["bronze", "silver", "gold", "diamond", "open", "cap"]) files.push(`${ROOT}/Tourney Data/PTCS7 Championship/${b}_all.csv`);
type T = { y: number; w: number; x: number[]; e: number };
type Row = Record<string, string | undefined>;
const all: T[] = [];
const ipOf = (s: string | undefined) => { const v = Number(s ?? 0); const w = Math.trunc(v); return w + Math.round((v - w) * 10) / 3; };
for (const f of files) {
  const { rows } = parseCsv(readFileSync(f, "utf8"), { extraFields: "drop" });
  const t = new Map<string, Row[]>();
  for (const r of rows) { const org = (r["ORG"] ?? "").trim(); if (!org || org === "-" || !["SP", "RP", "CL"].includes((r["POS"] ?? "").trim())) continue; if ((num(r["BF"]) ?? 0) <= 0) continue; (t.get(org) ?? t.set(org, []).get(org)!).push(r); }
  const local: T[] = [];
  for (const arms of t.values()) {
    const g = (r: Row) => num(r["G_1"]) ?? 0, gs = (r: Row) => num(r["GS_1"]) ?? 0, bf = (r: Row) => num(r["BF"]) ?? 0;
    const sp = arms.filter((r) => gs(r) >= 1 && gs(r) >= 0.5 * g(r)), rp = arms.filter((r) => !sp.includes(r));
    const ip = arms.reduce((a, r) => a + ipOf(r["IP"]), 0), ra = arms.reduce((a, r) => a + (num(r["R_1"]) ?? 0), 0);
    if (!sp.length || rp.length < 2 || ip < 40) continue;
    const wavg = (set: Row[], k: string) => { const b = set.reduce((a, r) => a + bf(r), 0); return set.reduce((a, r) => a + bf(r) * (num(r[k]) ?? 0), 0) / b; };
    const pBf = rp.reduce((a, r) => a + bf(r), 0) / arms.reduce((a, r) => a + bf(r), 0);
    local.push({ e: files.indexOf(f), y: (9 * ra) / ip, w: ip, x: [wavg(sp, "VAL"), wavg(rp, "VAL"), wavg(sp, "STM"), wavg(rp, "STM"), pBf] });
  }
  if (local.length < 10) continue;
  const my = local.reduce((a, t) => a + t.y * t.w, 0) / local.reduce((a, t) => a + t.w, 0);
  const mx = local[0].x.map((_, j) => local.reduce((a, t) => a + t.x[j] * t.w, 0) / local.reduce((a, t) => a + t.w, 0));
  for (const t of local) all.push({ e: t.e, y: t.y - my, w: t.w, x: t.x.map((v, j) => v - mx[j]) });
}
function ols(T: T[], cols: number[]) {
  const k = cols.length, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  for (const t of T) for (let i = 0; i < k; i++) { b[i] += t.w * t.x[cols[i]] * t.y; for (let j = 0; j < k; j++) A[i][j] += t.w * t.x[cols[i]] * t.x[cols[j]]; }
  // Gauss-Jordan
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < k; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c <= k; c++) M[r][c] -= f * M[i][c]; } }
  return M.map((r, i) => r[k] / r[i]);
}
const names = ["SP VAL", "RP VAL", "SP STM", "RP STM", "pen BF share"];
console.log(`${all.length} team-events (centred per export, weighted by IP); runs allowed per 9`);
const cols = [0, 1, 2, 3];
const full = ols(all, cols);
console.log("all:   " + cols.map((c, i) => `${names[c]} ${(full[i] * 10).toFixed(3)}/10`).join("  "));
// five folds by export, each fit leaving a fifth of the exports out
for (let f = 0; f < 5; f++) { const s = all.filter((t) => t.e % 5 !== f); const r = ols(s, cols); console.log(`fold ${f}: ` + cols.map((c, i) => `${names[c]} ${(r[i] * 10).toFixed(3)}`).join("  ")); }
