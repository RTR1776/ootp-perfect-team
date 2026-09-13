/**
 * Does the role adjustment actually rank arms better, on arms it was not fitted on?
 *
 * The effect was measured on this same data, so quoting an improvement from it
 * would be circular. Two-fold cross-validation: fit the per-role offset on one
 * half of the arms, score the other half with it, swap, and compare Spearman
 * against the observed ER index. The offsets used on each half never saw it.
 *
 *   pnpm role:validate
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const wmean = (v: number[], w: number[]) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);
function spearman(xs: number[], ys: number[], idx: number[]) {
  const rank = (v: number[]) => {
    const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length).fill(0);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
      const a = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = a; i = j + 1; }
    return r;
  };
  const X = idx.map((i) => xs[i]), Y = idx.map((i) => ys[i]);
  const a = rank(X), b = rank(Y), n = X.length, m = (n + 1) / 2;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - m, db = b[i] - m; sab += da * db; sa += da * da; sb += db * db; }
  return sab / Math.sqrt(sa * sb);
}

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.counters, cd.name, cd.pitcher_role, cd.ratings
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = true and cd.is_pitcher = true`));
  const per: any[] = [];
  for (const r of rows) {
    const bf = Number(r.counters.BF), er = Number(r.counters.ER);
    if (!(bf > 0) || !Number.isFinite(er)) continue;
    per.push({ series: r.series, card: r.card_id, raw: er / bf, w: bf, ratings: r.ratings ?? {}, role: r.pitcher_role });
  }
  const sm = new Map<string, { n: number; d: number }>();
  for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
  const overall = wmean(per.map((p) => p.raw), per.map((p) => p.w));
  const byCard = new Map<number, any>();
  for (const p of per) {
    const m = sm.get(p.series)!; const mean = m.n / m.d; if (!(mean > 0)) continue;
    const e = byCard.get(p.card) ?? { role: p.role, ratings: p.ratings, w: 0, num: 0 };
    e.w += p.w; e.num += (p.raw / mean) * p.w; byCard.set(p.card, e);
  }
  const cards: any[] = [];
  for (const [id, c] of byCard) {
    if (c.w < 600) continue;
    const rates = pitcherRates(c.ratings, era.rates); if (!rates) continue;
    cards.push({ id, role: c.role ?? "SP", w: c.w, model: cardRuns(rates, env), obs: (c.num / c.w - 1) * overall * 700 });
  }
  // deterministic split so the run is reproducible
  const A = cards.filter((c) => c.id % 2 === 0), B = cards.filter((c) => c.id % 2 === 1);
  const fitOffsets = (set: any[]) => {
    const W = set.map((c) => c.w);
    const mm = wmean(set.map((c) => c.model), W), om = wmean(set.map((c) => c.obs), W);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < set.length; i++) { const dx = set[i].model - mm, dy = set[i].obs - om; sxy += W[i] * dx * dy; sxx += W[i] * dx * dx; }
    const k = sxy / sxx;
    const off: Record<string, number> = {};
    for (const role of ["SP", "RP", "CL"]) {
      const g = set.filter((c) => c.role === role); if (g.length < 10) { off[role] = 0; continue; }
      off[role] = wmean(g.map((c) => c.obs - (om + k * (c.model - mm))), g.map((c) => c.w));
    }
    return off;
  };
  let plain = 0, withRole = 0, n = 0;
  const report: string[] = [];
  for (const [train, test, lbl] of [[A, B, "fit on even ids, tested on odd"], [B, A, "fit on odd ids, tested on even"]] as any[]) {
    const off = fitOffsets(train);
    const idx = test.map((_: any, i: number) => i);
    const s0 = spearman(test.map((c: any) => c.model), test.map((c: any) => c.obs), idx);
    const s1 = spearman(test.map((c: any) => c.model + (off[c.role] ?? 0) / 0.283), test.map((c: any) => c.obs), idx);
    report.push(`  ${lbl}  (${test.length} arms)\n    without role ${s0.toFixed(3)}   with role ${s1.toFixed(3)}   ${(s1 - s0 >= 0 ? "+" : "") + (s1 - s0).toFixed(3)}`);
    report.push(`    offsets learned: ${["SP", "RP", "CL"].map((r) => `${r} ${off[r].toFixed(2)}`).join("  ")}`);
    plain += s0; withRole += s1; n++;
  }
  console.log(`role adjustment, two-fold cross-validated — ${cards.length} arms\n`);
  console.log(report.join("\n"));
  console.log(`\n  mean across folds: ${(plain / n).toFixed(3)} -> ${(withRole / n).toFixed(3)}   ${((withRole - plain) / n >= 0 ? "+" : "") + ((withRole - plain) / n).toFixed(3)}`);
  process.exit(0);
}
main();
