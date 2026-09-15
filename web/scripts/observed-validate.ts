/**
 * Is observed play PREDICTIVE, or just descriptive?
 *
 * observed-blend pools a card's deviation from each series' average across
 * every series it played. That is only worth blending in if the deviation
 * is a property of the card and not of the week: a split-half test. For
 * every card with play in two or more series, split its series into two
 * halves (alternating, by series name), compute the PA-weighted deviation
 * in each half, and correlate the halves across cards. Then do the same
 * for the model, which by construction gives one number per card, so its
 * "split-half" is its correlation with each half's observed deviation.
 *
 *   pnpm tsx scripts/observed-validate.ts [--min-pa 200]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { wobaOf, fipOf } from "@/lib/analytics/league";
import { eraTable } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { cards } from "@/db/schema";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN = num("min-pa", 200);

const stintLike = (counters: Record<string, number>, ip: number, pa: number) => ({
  stats: counters, ip, pa, use: 0, isPitcher: false, isFreeAgent: false, org: "", cid: null, name: "", pos: "",
  clan: null, val: null, tier: null, isVariant: false, cardYear: null, ratings: {}, war: 0,
});
const pearson = (a: number[], b: number[]) => {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};
const spearman = (a: number[], b: number[]) => {
  const rank = (v: number[]) => { const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
  return pearson(rank(a), rank(b));
};

async function main() {
  const lines = asRows<any>(await db.execute(sql`select card_id, series, is_pitcher, pa, ip, woba, fip, counters from observed_card_stats`));
  // series baselines
  const sums = new Map<string, { h: Record<string, number>; p: Record<string, number>; pa: number; ip: number }>();
  for (const l of lines) {
    const s = sums.get(l.series) ?? { h: {}, p: {}, pa: 0, ip: 0 };
    const t = l.is_pitcher ? s.p : s.h;
    for (const [k, v] of Object.entries(l.counters ?? {})) t[k] = (t[k] ?? 0) + Number(v);
    if (l.is_pitcher) s.ip += Number(l.ip); else s.pa += Number(l.pa);
    sums.set(l.series, s);
  }
  const base = new Map<string, { woba: number; fip: number }>();
  for (const [s, c] of sums) base.set(s, { woba: wobaOf([stintLike(c.h, 0, c.pa) as never]), fip: fipOf([stintLike(c.p, c.ip, 0) as never]) });
  // per card, per series deviation in runs/700
  const dev = new Map<number, Array<{ series: string; d: number; w: number; isP: boolean }>>();
  for (const l of lines) {
    const b = base.get(l.series)!;
    let d: number, w: number;
    if (l.is_pitcher) { w = Number(l.counters?.BF ?? 0); if (!(w > 0) || l.fip == null) continue; d = (-((Number(l.fip) - b.fip) / 9) * Number(l.ip)) / w * 700; }
    else { w = Number(l.pa); if (!(w > 0) || l.woba == null) continue; d = ((Number(l.woba) - b.woba) / 1.25) * 700; }
    const a = dev.get(l.card_id) ?? []; a.push({ series: l.series, d, w, isP: !!l.is_pitcher }); dev.set(l.card_id, a);
  }
  // model runs at 2010 neutral
  const universe = await db.select().from(cards);
  const fits = envFitMaps(universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> })), { era: eraTable["2010"]!.rates, park: null, roleTrust: 0.25 });
  const model = (id: number) => { const r = fits.runsR.get(id), l = fits.runsL.get(id); return r == null || l == null ? null : 0.7 * r + 0.3 * l; };

  for (const isP of [false, true]) {
    const A: number[] = [], B: number[] = [], M: number[] = [], wA: number[] = [], wB: number[] = [];
    for (const [id, arr0] of dev) {
      const arr = arr0.filter((x) => x.isP === isP);
      if (arr.length < 2) continue;
      arr.sort((x, y) => x.series.localeCompare(y.series));
      const h1 = arr.filter((_, i) => i % 2 === 0), h2 = arr.filter((_, i) => i % 2 === 1);
      const wm = (h: typeof arr) => ({ d: h.reduce((s, x) => s + x.d * x.w, 0) / h.reduce((s, x) => s + x.w, 0), w: h.reduce((s, x) => s + x.w, 0) });
      const a = wm(h1), b = wm(h2);
      if (a.w < MIN || b.w < MIN) continue;
      const m = model(id); if (m == null) continue;
      A.push(a.d); B.push(b.d); M.push(m); wA.push(a.w); wB.push(b.w);
    }
    const lbl = isP ? "ARMS" : "HITTERS";
    console.log(`\n=== ${lbl}: ${A.length} cards with play in 2+ series (>= ${MIN} PA/BF each half)`);
    console.log(`  observed half A vs half B : Spearman ${spearman(A, B).toFixed(3)}  Pearson ${pearson(A, B).toFixed(3)}   <- how repeatable a card's deviation is`);
    console.log(`  model vs half A           : Spearman ${spearman(M, A).toFixed(3)}`);
    console.log(`  model vs half B           : Spearman ${spearman(M, B).toFixed(3)}`);
    // blended (A + model) predicting B, at several K
    for (const K of [1000, 2000, 3000, 5000, 8000, 15000, 1e9]) {
      const P = A.map((a, i) => (wA[i] * a + K * M[i]) / (wA[i] + K));
      console.log(`  blend(half A, model, K=${String(K === 1e9 ? "model only" : K).padEnd(10)}) vs half B : Spearman ${spearman(P, B).toFixed(3)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
