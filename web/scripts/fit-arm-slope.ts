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
 */
import { writeFileSync } from "node:fs";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraTable } from "@/lib/analytics/tournament-env";
import { loadArmRows, poolArmEdges, roleOf, type ArmRole } from "@/lib/league-arms";

const DRY = process.argv.includes("--dry");
const MIN_IP = 1000;
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

  const out = {
    fittedAt: new Date().toISOString().slice(0, 10),
    source: `${n} base-card arms with ${MIN_IP}+ league IP, ${new Set(rows.map((r) => r.capturedOn)).size} weeks, pnpm fit:arms`,
    k: Math.round(k * 1e4) / 1e4, intercept: Math.round(intercept * 1e4) / 1e4, app9League: Math.round(app9League * 1e4) / 1e4,
    n, r: Math.round(r * 1000) / 1000, minIp: MIN_IP, bfPerIp: Math.round(bfPerIp * 1000) / 1000,
  };
  console.log(JSON.stringify(out, null, 2));
  const show = [...pts].sort((a, b) => b.y - a.y);
  console.log("\nbest and worst by league edge (edge per 9 · model runs per 9 over the league's arm · IP):");
  for (const p of [...show.slice(0, 5), ...show.slice(-5)]) console.log(`  ${p.name.padEnd(22)} ${p.y >= 0 ? "+" : ""}${p.y.toFixed(2)}  ${p.x >= 0 ? "+" : ""}${p.x.toFixed(2)}  ${Math.round(p.ip).toLocaleString()}`);
  if (!DRY) { writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`); console.log(`\nwrote ${OUT.pathname}`); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
