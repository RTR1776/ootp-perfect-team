/**
 * Fit k_arm: how much of a pitcher's ratings edge survives into league play.
 * Read-only on the database; writes src/data/league-arm-model.json.
 *
 *   node --env-file=.env.local --import tsx scripts/fit-arm-slope.ts [--dry]
 *
 * For every base card (not a variant) with 1,000+ league innings, pooled over
 * every complete league week (lib/league-arms.ts poolArmEdges):
 *   y = its edge per 9 against each week's league, in its main role
 *   x = the tournament model's runs saved per 9 for its shop ratings (PT
 *       default era, neutral park, that role), minus the league's average arm
 * and y = a + k·x by least squares. The Card Model uses k to estimate an arm
 * with no league sample (a shop variant no team has rostered).
 *
 * Then, per league family (PEL, HD, LD), how a card's edge there follows its
 * edge in the other families: a stronger league compresses edges (a card's
 * PEL edge runs about 0.73× its edge elsewhere). For cards with 1,000+ IP in a
 * role both in the family and outside it, y = a + b·x (x the edge outside);
 * with under 30 such cards the family is read as the others are (a 0, b 1).
 * And w, how many innings of the family's own play the other leagues' line is
 * worth: the family's team-weeks are split in two, and w is the weight that
 * best predicts one half from the other half and that prior.
 */
import { writeFileSync } from "node:fs";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraTable } from "@/lib/analytics/tournament-env";
import { leagueFamily, type LeagueFamily } from "@/lib/analytics/league-model";
import { ARM_PRIOR_IP, loadArmRows, poolArmEdges, roleOf, type ArmEdge, type ArmRole, type ArmRow } from "@/lib/league-arms";

const DRY = process.argv.includes("--dry");
const MIN_IP = 1000;
const FAMILIES: LeagueFamily[] = ["PEL", "HD", "LD"];
const FAMILY_MIN_CARDS = 30;
const W_GRID = [150, 300, 600, 1000, 1500, 2000, 3000, 4000, 6000];

const sideOf = (e: ArmEdge | undefined, role: ArmRole) => (role === "SP" ? e?.asSP : e?.asRP) ?? null;
function ols(pts: { x: number; y: number }[]) {
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  return { a: my - (sxy / sxx) * mx, b: sxy / sxx, r: sxy / Math.sqrt(sxx * syy) };
}
/** A team-week's half for the split-half fit: fixed, so a rerun on the same data gives the same w. */
const half = (r: ArmRow) => { let h = 0; for (const c of `${r.snapshotId}|${r.org}`) h = (h * 31 + c.charCodeAt(0)) | 0; return h & 1; };
const OUT = new URL("../src/data/league-arm-model.json", import.meta.url);

async function main() {
  const rows = await loadArmRows({ family: "all", split: "all" });
  if (!rows.length) throw new Error("no complete league snapshots");
  const bf = rows.reduce((a, r) => a + (r.stats.BF ?? 0), 0), ip = rows.reduce((a, r) => a + r.ip, 0);
  const bfPerIp = bf / ip;
  const edges = poolArmEdges(rows);

  // The tournament model's read of every arm's shop card, per role.
  const shop = await db.select({ cardId: cards.cardId, name: cards.name, isPitcher: cards.isPitcher, ratings: cards.ratings }).from(cards);
  const arms = shop.filter((c) => c.isPitcher);
  const era = eraTable["0"];
  const fitAs = (role: ArmRole) => envFitMaps(
    arms.map((c) => ({ cardId: c.cardId, isPitcher: true, bats: null, role, ratings: (c.ratings ?? {}) as Record<string, number> })),
    { era: era.rates, park: null, roleTrust: 0.25 },
  );
  const byRole = { SP: fitAs("SP"), RP: fitAs("RP") };
  const app9 = (cid: number, role: ArmRole): number | null => {
    const r = byRole[role].runsR.get(cid);
    return r == null ? null : (r * bfPerIp * 9) / 700;
  };

  // The league's average arm on the same scale, weighted by the innings each line pitched.
  let lgNum = 0, lgDen = 0;
  for (const r of rows) {
    if (r.cid == null || r.isVariant || !(r.ip > 0) || r.isFreeAgent) continue;
    const x = app9(r.cid, roleOf(r));
    if (x == null) continue;
    lgNum += x * r.ip; lgDen += r.ip;
  }
  const app9League = lgNum / lgDen;

  const pts: { name: string; x: number; y: number; ip: number }[] = [];
  for (const e of edges.values()) {
    if (e.isVariant || e.cid == null) continue;
    const sp = e.asSP?.ip ?? 0, rp = e.asRP?.ip ?? 0;
    if (sp + rp < MIN_IP) continue;
    const role: ArmRole = sp >= rp ? "SP" : "RP";
    const side = role === "SP" ? e.asSP! : e.asRP!;
    const x = app9(e.cid, role);
    if (x == null) continue;
    pts.push({ name: e.name, x: x - app9League, y: side.edge9, ip: side.ip });
  }
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const k = sxy / sxx, intercept = my - k * mx, r = sxy / Math.sqrt(sxx * syy);

  // Per league family: the slope from the other families' edge, and the weight of that prior.
  const est = (cid: number, role: ArmRole) => { const x = app9(cid, role); return x == null ? null : intercept + k * (x - app9League); };
  const families: Record<string, { a: number; b: number; w: number; n: number; r: number | null }> = {};
  for (const f of FAMILIES) {
    const inF = rows.filter((x) => leagueFamily(x.league) === f);
    if (!inF.length) continue;
    const F = poolArmEdges(inF), O = poolArmEdges(rows.filter((x) => leagueFamily(x.league) !== f));
    const both: { x: number; y: number }[] = [];
    for (const [key, e] of F) for (const role of ["SP", "RP"] as const) {
      const a = sideOf(e, role), o = sideOf(O.get(key), role);
      if (a && o && a.ip >= MIN_IP && o.ip >= MIN_IP) both.push({ x: o.edge9, y: a.edge9 });
    }
    const line = both.length >= FAMILY_MIN_CARDS ? ols(both) : { a: 0, b: 1, r: null };
    const A = poolArmEdges(inF.filter((x) => half(x) === 0)), B = poolArmEdges(inF.filter((x) => half(x) === 1));
    let w = W_GRID[0], bestErr = Infinity;
    const errs: string[] = [];
    for (const W of W_GRID) {
      let se = 0, wt = 0;
      for (const [key, ea] of A) {
        if (ea.isVariant || ea.cid == null) continue;
        for (const role of ["SP", "RP"] as const) {
          const a = sideOf(ea, role), b = sideOf(B.get(key), role), o = sideOf(O.get(key), role), e0 = est(ea.cid, role);
          if (!a || !b || b.ip < ARM_PRIOR_IP || e0 == null) continue;
          const oIp = o?.ip ?? 0;
          const prior = line.a + line.b * ((oIp * (o?.edge9 ?? 0) + ARM_PRIOR_IP * e0) / (oIp + ARM_PRIOR_IP));
          se += b.ip * ((a.ip * a.edge9 + W * prior) / (a.ip + W) - b.edge9) ** 2; wt += b.ip;
        }
      }
      const err = se / wt;
      errs.push(`${W}: ${err.toFixed(5)}`);
      if (err < bestErr) { bestErr = err; w = W; }
    }
    families[f] = { a: Math.round(line.a * 1e4) / 1e4, b: Math.round(line.b * 1e4) / 1e4, w, n: both.length, r: line.r == null ? null : Math.round(line.r * 1000) / 1000 };
    console.log(`${f}: edge ≈ ${families[f].a} + ${families[f].b} × edge elsewhere (${both.length} card-roles, r ${families[f].r ?? "—"}); w ${w} (split-half error by w: ${errs.join(", ")})`);
  }

  const out = {
    fittedAt: new Date().toISOString().slice(0, 10),
    source: `${n} base-card arms with ${MIN_IP}+ league IP, ${new Set(rows.map((r) => r.capturedOn)).size} weeks, pnpm fit:arms`,
    k: Math.round(k * 1e4) / 1e4, intercept: Math.round(intercept * 1e4) / 1e4, app9League: Math.round(app9League * 1e4) / 1e4,
    n, r: Math.round(r * 1000) / 1000, minIp: MIN_IP, bfPerIp: Math.round(bfPerIp * 1000) / 1000,
    families,
  };
  console.log(JSON.stringify(out, null, 2));
  const show = [...pts].sort((a, b) => b.y - a.y);
  console.log("\nbest and worst by league edge (edge per 9 · model runs per 9 over the league's arm · IP):");
  for (const p of [...show.slice(0, 5), ...show.slice(-5)]) console.log(`  ${p.name.padEnd(22)} ${p.y >= 0 ? "+" : ""}${p.y.toFixed(2)}  ${p.x >= 0 ? "+" : ""}${p.x.toFixed(2)}  ${Math.round(p.ip).toLocaleString()}`);
  if (!DRY) { writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`); console.log(`\nwrote ${OUT.pathname}`); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
