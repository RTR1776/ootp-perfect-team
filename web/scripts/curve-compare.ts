/**
 * Paired comparison of two curve tables on the same cards, with a bootstrap.
 *
 * A Spearman of 0.49 against 0.43 looks like an improvement, but both are
 * measured on the same ~900 cards, so the question is not "are these two
 * numbers different" — it is "would the ordering still favour the refit if I
 * had drawn a different set of cards". Resampling cards with replacement
 * answers that; the interval on the DIFFERENCE is what decides it, not the two
 * intervals separately.
 *
 *   pnpm curve:compare src/data/curves.json src/data/curves.v2.json
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { hitterRates, pitcherRates, cardRuns, envFor, __setCurves } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith("--"));
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN = num("min-pa", 300), BOOT = num("boot", 400);

function spearman(xs: number[], ys: number[], idx: number[]): number {
  const rank = (v: number[]) => {
    const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length).fill(0);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
      const a = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = a; i = j + 1; }
    return r;
  };
  const X = idx.map((i) => xs[i]), Y = idx.map((i) => ys[i]);
  const a = rank(X), b = rank(Y), n = X.length;
  const ma = (n + 1) / 2, mb = (n + 1) / 2;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sab / Math.sqrt(sa * sb);
}

async function main() {
  const [fa, fb] = files;
  const A = JSON.parse(readFileSync(fa, "utf8")), B = JSON.parse(readFileSync(fb, "utf8"));
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  console.log(`A = ${fa}\nB = ${fb}\n${BOOT} bootstrap resamples of the card set\n`);

  for (const kind of ["hit", "pit"] as const) {
    const rows = asRows<any>(await db.execute(sql`
      select o.series, o.card_id, o.pa, o.woba, o.counters, cd.ratings
      from observed_card_stats o join cards cd on cd.card_id = o.card_id
      where o.is_pitcher = ${kind === "pit"} and cd.is_pitcher = ${kind === "pit"}
        and ${kind === "pit" ? sql`(o.counters->>'BF')::numeric` : sql`o.pa`} >= ${MIN}`));
    const per: any[] = [];
    for (const r of rows) {
      let raw: number, w: number;
      if (kind === "hit") { if (r.woba == null || !(r.pa > 0)) continue; raw = Number(r.woba); w = Number(r.pa); }
      else { const bf = Number(r.counters.BF); if (!(bf > 0)) continue; raw = Number(r.counters.ER) / bf; w = bf; }
      if (!Number.isFinite(raw)) continue;
      per.push({ series: r.series, card: r.card_id, raw, w, ratings: r.ratings ?? {} });
    }
    const sm = new Map<string, { n: number; d: number }>();
    for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
    const byCard = new Map<number, { w: number; num: number; ratings: any }>();
    for (const p of per) { const m = sm.get(p.series)!.n / sm.get(p.series)!.d; if (!(m > 0)) continue;
      const e = byCard.get(p.card) ?? { w: 0, num: 0, ratings: p.ratings }; e.w += p.w; e.num += (p.raw / m) * p.w; byCard.set(p.card, e); }

    const obs: number[] = [], pa: number[] = [], pb: number[] = [];
    for (const [, e] of byCard) {
      if (e.w < MIN * 2) continue;
      __setCurves(A); const ra = kind === "hit" ? hitterRates(e.ratings, era.rates) : pitcherRates(e.ratings, era.rates);
      __setCurves(B); const rb = kind === "hit" ? hitterRates(e.ratings, era.rates) : pitcherRates(e.ratings, era.rates);
      if (!ra || !rb) continue;
      obs.push(e.num / e.w); pa.push(cardRuns(ra, env)); pb.push(cardRuns(rb, env));
    }
    const n = obs.length, all = Array.from({ length: n }, (_, i) => i);
    const sA = spearman(pa, obs, all), sB = spearman(pb, obs, all);
    const diffs: number[] = [];
    for (let b = 0; b < BOOT; b++) {
      const idx = Array.from({ length: n }, () => (Math.random() * n) | 0);
      diffs.push(spearman(pb, obs, idx) - spearman(pa, obs, idx));
    }
    diffs.sort((x, y) => x - y);
    const lo = diffs[Math.floor(0.025 * BOOT)], hi = diffs[Math.floor(0.975 * BOOT)];
    const pos = diffs.filter((d) => d > 0).length / BOOT;
    const verdict = lo > 0 ? "B BETTER" : hi < 0 ? "B WORSE" : "NO DIFFERENCE THAT SURVIVES RESAMPLING";
    console.log(`${kind === "hit" ? "HITTERS" : "PITCHERS"} (${n} cards)`);
    console.log(`  A ${sA.toFixed(3)}   B ${sB.toFixed(3)}   diff ${(sB - sA >= 0 ? "+" : "") + (sB - sA).toFixed(3)}`);
    console.log(`  95% CI on the difference [${lo.toFixed(3)}, ${hi.toFixed(3)}]   P(B better) ${(pos * 100).toFixed(0)}%   -> ${verdict}\n`);
  }
  process.exit(0);
}
main();
