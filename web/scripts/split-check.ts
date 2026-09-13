/**
 * Does the model get PLATOON SPLITS right?
 *
 * Never checked, and it decides every lineup the app builds: /build and
 * env:roster fill a vs-RHP board and a vs-LHP board from hitterRates(..., "vL")
 * and (..., "vR"), which push the card's SPLIT ratings through the very same
 * curves fitted on overall ratings. Two assumptions ride on that and neither has
 * been tested: that a split rating maps to a rate the same way an overall one
 * does, and that nothing else is going on.
 *
 * The league exports carry vL and vR stat lines separately — 1.8M PA against
 * right-handers and 1.5M against lefties across six weeks and five leagues — so
 * the differential is observable. The decisive test is not whether the model
 * ranks cards within a split (it would pass that on overall talent alone) but
 * whether it gets the DIFFERENCE right: observed (vL - vR) against predicted
 * (vL - vR). That is the quantity a platoon decision actually turns on.
 *
 * Split ratings live on the card, not in the league export, so cards.ratings is
 * joined in by cid.
 *
 *   pnpm split:check [--min 120]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { hitterRates, pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const MIN = Number((() => { const i = argv.indexOf("--min"); return i >= 0 ? argv[i + 1] : "120"; })());
const wmean = (v: number[], w: number[]) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);
function corr(x: number[], y: number[], w: number[]) {
  const mx = wmean(x, w), my = wmean(y, w);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += w[i] * dx * dy; sxx += w[i] * dx * dx; syy += w[i] * dy * dy; }
  return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, mx, my };
}

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  /**
   * Aggregated in SQL, not in node. Pulling every split stint with its stats
   * blob was ~30k rows of JSON over the Neon HTTP driver and it fell over once
   * PEL and HD451 joined the set. The per-cell mean and the per-card sums are
   * both group-bys, so the database does them and the script receives one row
   * per card per split.
   */
  const rows = asRows<any>(await db.execute(sql`
    with stint as (
      select ls.league, ls.captured_on, ls.split, st.cid, st.name, st.is_pitcher, st.pos,
             case when st.is_pitcher then (st.stats->>'BF')::numeric else st.pa::numeric end as w,
             case when st.is_pitcher then (st.stats->>'ER')::numeric
                  else (st.stats->>'wRAA')::numeric end as num
      from league_stints st
      join league_snapshots ls on ls.id = st.snapshot_id
      where ls.split in ('vL','vR') and st.cid is not null
    ),
    ok as (select * from stint where w > 0 and num is not null),
    cell as (
      select league, captured_on, split, is_pitcher, sum(num)/sum(w) as mean
      from ok group by 1,2,3,4
    ),
    card as (
      select o.cid, o.is_pitcher, o.split,
             max(o.name) as name, max(o.pos) as pos,
             sum(o.w) as w,
             sum((o.num/o.w - c.mean) * o.w) as above
      from ok o join cell c
        on c.league = o.league and c.captured_on = o.captured_on
       and c.split = o.split and c.is_pitcher = o.is_pitcher
      group by 1,2,3
    )
    select k.cid, k.is_pitcher, k.name, k.pos, c.ratings,
           max(case when k.split='vL' then k.w end) as wl,
           max(case when k.split='vL' then k.above end) as al,
           max(case when k.split='vR' then k.w end) as wr,
           max(case when k.split='vR' then k.above end) as ar
    from card k join cards c on c.card_id = k.cid
    group by 1,2,3,4,5`));

  const obs = new Map<string, any>();
  for (const r of rows) {
    const wl = Number(r.wl), wr = Number(r.wr);
    if (!(wl > 0) || !(wr > 0)) continue;
    obs.set(`${r.cid}|${r.is_pitcher}`, {
      cid: r.cid, name: r.name, isPit: r.is_pitcher, pos: r.pos, ratings: r.ratings,
      vL: { w: wl, n: Number(r.al) }, vR: { w: wr, n: Number(r.ar) },
    });
  }

  for (const kind of ["hit", "pit"] as const) {
    const isPit = kind === "pit";
    const pts: any[] = [];
    for (const [, e] of obs) {
      if (e.isPit !== isPit) continue;
      if (e.vL.w < MIN || e.vR.w < MIN) continue;
      const rL = isPit ? pitcherRates(e.ratings ?? {}, era.rates, "vL") : hitterRates(e.ratings ?? {}, era.rates, "vL");
      const rR = isPit ? pitcherRates(e.ratings ?? {}, era.rates, "vR") : hitterRates(e.ratings ?? {}, era.rates, "vR");
      if (!rL || !rR) continue;
      // model: runs above average on each board, per 700
      const mL = (isPit ? -1 : 1) * cardRuns(rL, env);
      const mR = (isPit ? -1 : 1) * cardRuns(rR, env);
      // observed: same units. wRAA is already runs; ER needs the sign flipped.
      const oL = (isPit ? -1 : 1) * (e.vL.n / e.vL.w) * 700;
      const oR = (isPit ? -1 : 1) * (e.vR.n / e.vR.w) * 700;
      pts.push({ name: e.name, pos: e.pos, w: Math.min(e.vL.w, e.vR.w),
        mL, mR, oL, oR, mD: mL - mR, oD: oL - oR });
    }
    const W = pts.map((p) => p.w);
    const lvl = corr(pts.map((p) => (p.mL + p.mR) / 2), pts.map((p) => (p.oL + p.oR) / 2), W);
    const dif = corr(pts.map((p) => p.mD), pts.map((p) => p.oD), W);
    console.log(`\n=== ${isPit ? "PITCHERS" : "HITTERS"} — ${pts.length} cards with ${MIN}+ ${isPit ? "BF" : "PA"} on both sides`);
    console.log(`  LEVEL   (how good overall)      r ${lvl.r.toFixed(3)}   slope ${lvl.slope.toFixed(3)}`);
    console.log(`  SPLIT   (vL minus vR)           r ${dif.r.toFixed(3)}   slope ${dif.slope.toFixed(3)}   <- what a platoon decision turns on`);
    console.log(`  mean differential: model ${dif.mx.toFixed(1)}   observed ${dif.my.toFixed(1)}  runs/700`);
    const agree = pts.filter((p) => Math.sign(p.mD) === Math.sign(p.oD));
    console.log(`  the model names the right side for ${(agree.length / pts.length * 100).toFixed(0)}% of cards`);
    console.log(`  how big does the model's call have to be before it is worth acting on?`);
    console.log(`    |model vL-vR|      cards   right side`);
    for (const [lo, hi] of [[0, 5], [5, 10], [10, 15], [15, 25], [25, 1e9]] as [number, number][]) {
      const g = pts.filter((p) => Math.abs(p.mD) >= lo && Math.abs(p.mD) < hi);
      if (!g.length) continue;
      const ok = g.filter((p) => Math.sign(p.mD) === Math.sign(p.oD)).length;
      const pct = ok / g.length * 100;
      const bar = "\u2588".repeat(Math.round(pct / 5));
      console.log(`    ${(hi > 1e8 ? `${lo}+` : `${lo}-${hi}`).padEnd(14)} ${String(g.length).padStart(5)}   ${pct.toFixed(0).padStart(3)}%  ${bar}`);
    }
  }
  process.exit(0);
}
main();
