/**
 * Stamina is the one rating with real independent signal in the pitcher
 * residual — and the model does not read it at all. This asks what it stands
 * for: a starter and a reliever with identical Stuff, Control, pHR and pBABIP
 * get identical values from the model, and that cannot be right. A reliever
 * throws an inning at a time, faces a lineup once, and never turns it over.
 *
 * Measured as runs per 700 batters faced, against the model's own prediction,
 * so the difference reported is what the model MISSES, not how good the arm is.
 *
 *   pnpm role:effect
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const wmean = (v: number[], w: number[]) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.counters, cd.name, cd.card_value, cd.pitcher_role, cd.ratings
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = true and cd.is_pitcher = true`));
  const per: any[] = [];
  for (const r of rows) {
    const bf = Number(r.counters.BF), er = Number(r.counters.ER);
    if (!(bf > 0) || !Number.isFinite(er)) continue;
    per.push({ series: r.series, card: r.card_id, raw: er / bf, w: bf,
      ratings: r.ratings ?? {}, role: r.pitcher_role, name: r.name, val: r.card_value });
  }
  const sm = new Map<string, { n: number; d: number }>();
  for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
  const overall = wmean(per.map((p) => p.raw), per.map((p) => p.w));
  const byCard = new Map<number, any>();
  for (const p of per) {
    const m = sm.get(p.series)!; const mean = m.n / m.d; if (!(mean > 0)) continue;
    const e = byCard.get(p.card) ?? { name: p.name, val: p.val, role: p.role, ratings: p.ratings, w: 0, num: 0 };
    e.w += p.w; e.num += (p.raw / mean) * p.w; byCard.set(p.card, e);
  }
  const cards: any[] = [];
  for (const [, c] of byCard) {
    if (c.w < 1500) continue;
    const rates = pitcherRates(c.ratings, era.rates); if (!rates) continue;
    const stm = c.ratings["Stamina"]; if (!(stm > 0)) continue;
    cards.push({ ...c, model: cardRuns(rates, env),
      observed: (c.num / c.w - 1) * overall * 700, stm });
  }
  // absorb the known 3.5x scale error first, so what is left is role, not calibration
  const W = cards.map((c) => c.w);
  const mm = wmean(cards.map((c) => c.model), W), om = wmean(cards.map((c) => c.observed), W);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < cards.length; i++) { const dx = cards[i].model - mm, dy = cards[i].observed - om; sxy += W[i] * dx * dy; sxx += W[i] * dx * dx; }
  const k = sxy / sxx;
  for (const c of cards) c.gap = c.observed - (om + k * (c.model - mm));
  console.log(`role effect — ${cards.length} arms, ${Math.round(W.reduce((a, b) => a + b, 0)).toLocaleString()} BF`);
  console.log(`model rescaled by ${k.toFixed(3)} before measuring, so this is role, not calibration\n`);

  const groups = new Map<string, any[]>();
  for (const c of cards) { const g = groups.get(c.role ?? "?") ?? []; g.push(c); groups.set(c.role ?? "?", g); }
  console.log(`  role     arms         BF     runs/700 BF vs the model`);
  for (const [role, g] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const w = g.map((c) => c.w), gap = wmean(g.map((c) => c.gap), w);
    const bf = w.reduce((a, b) => a + b, 0);
    console.log(`  ${role.padEnd(6)} ${String(g.length).padStart(5)} ${String(Math.round(bf)).padStart(10)}       ${(gap >= 0 ? "+" : "") + gap.toFixed(2).padStart(6)}`);
  }
  console.log(`\n  (negative = the arm allowed FEWER runs than the model expected)`);

  const bands: [string, number, number][] = [
    ["1-25", 1, 25], ["26-40", 26, 40], ["41-55", 41, 55], ["56-70", 56, 70],
    ["71-85", 71, 85], ["86-100", 86, 100], ["101+", 101, 1e9],
  ];
  console.log(`\n  Stamina  arms         BF     runs/700 BF vs the model`);
  for (const [lbl, lo, hi] of bands) {
    const g = cards.filter((c) => c.stm >= lo && c.stm <= hi);
    if (g.length < 12) continue;
    const w = g.map((c) => c.w), gap = wmean(g.map((c) => c.gap), w);
    const bar = "█".repeat(Math.max(0, Math.round(Math.abs(gap) * 1.2)));
    console.log(`  ${lbl.padEnd(8)} ${String(g.length).padStart(4)} ${String(Math.round(w.reduce((a, b) => a + b, 0))).padStart(10)}       ${(gap >= 0 ? "+" : "") + gap.toFixed(2).padStart(6)}  ${bar}`);
  }
  process.exit(0);
}
main();
