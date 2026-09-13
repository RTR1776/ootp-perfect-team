/**
 * What is the model still missing?
 *
 * The refit closed the gap between each rating and its own rate. It cannot find
 * a rating the model does not look at AT ALL — Movement being the known one. So:
 * take the residual (what a card actually did, minus what the model says it
 * should have done) and screen every numeric rating against it. A rating that
 * explains residual variance is a rating the model should be using.
 *
 * TWO TRAPS, both of which caught me first time round:
 *
 *  1. Work in DIFFERENCES, not ratios. Linear weights are centred on the league
 *     line, so runsPerPa of an average card is ~0 and dividing by it produces
 *     nonsense. Both sides are converted to runs per 700 PA above average.
 *
 *  2. Control for card value. Ratings climb together: a 100-value arm has more
 *     Stuff AND more Fastball AND a better Infield Arm, and Infield Arm does
 *     nothing for a pitcher. Screening raw against the residual finds the card's
 *     price tag, not a mechanism. Every fit here partials out log(card value)
 *     from both sides first, so what is reported is the rating's own share.
 *
 *   pnpm residual:screen [--kind pit|hit] [--min 1500] [--raw]
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { hitterRates, pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { eraTable } from "@/lib/analytics/runenv-view";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const KIND = val("kind", "pit") as "pit" | "hit";
const MIN = Number(val("min", "1500"));
const RAW = argv.includes("--raw");
const USED = KIND === "pit"
  ? new Set(["Stuff", "Control", "pHR", "pBABIP"])
  : new Set(["Avoid Ks", "Eye", "Power", "Gap", "BABIP"]);
const SKIP = /( vL| vR)$|^Pos Rating |^Learn|^Height$|^Arm Slot$/;
/** wOBA points per run — the usual scale factor. */
const WOBA_SCALE = 1.2;

const wmean = (v: number[], w: number[]) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);
function wfit(x: number[], y: number[], w: number[]) {
  const mx = wmean(x, w), my = wmean(y, w);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += w[i] * dx * dy; sxx += w[i] * dx * dx; syy += w[i] * dy * dy; }
  if (sxx <= 0 || syy <= 0) return { slope: 0, r2: 0 };
  return { slope: sxy / sxx, r2: (sxy * sxy) / (sxx * syy) };
}
/** Residualise v against c (weighted), so the fit sees only v's own variation. */
function partial(v: number[], c: number[], w: number[]) {
  const f = wfit(c, v, w), mc = wmean(c, w), mv = wmean(v, w);
  return v.map((x, i) => x - (mv + f.slope * (c[i] - mc)));
}

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const env = envFor(era.rates, NEUTRAL_PARK, linearWeights(era.rates));
  const rows = asRows<any>(await db.execute(sql`
    select o.series, o.card_id, o.pa, o.woba, o.counters, cd.name, cd.card_value, cd.ratings
    from observed_card_stats o join cards cd on cd.card_id = o.card_id
    where o.is_pitcher = ${KIND === "pit"} and cd.is_pitcher = ${KIND === "pit"}`));

  const per: any[] = [];
  for (const r of rows) {
    let raw: number, w: number;
    if (KIND === "hit") { if (r.woba == null || !(r.pa > 0)) continue; raw = Number(r.woba); w = Number(r.pa); }
    else { const bf = Number(r.counters.BF); if (!(bf > 0)) continue; raw = Number(r.counters.ER) / bf; w = bf; }
    if (!Number.isFinite(raw)) continue;
    per.push({ series: r.series, card: r.card_id, raw, w, ratings: r.ratings ?? {}, name: r.name, val: r.card_value });
  }
  // series means and the overall level, which sets the scale of the index
  const sm = new Map<string, { n: number; d: number }>();
  for (const p of per) { const s = sm.get(p.series) ?? { n: 0, d: 0 }; s.n += p.raw * p.w; s.d += p.w; sm.set(p.series, s); }
  const overall = wmean(per.map((p) => p.raw), per.map((p) => p.w));

  const byCard = new Map<number, any>();
  for (const p of per) {
    const m = sm.get(p.series)!; const mean = m.n / m.d; if (!(mean > 0)) continue;
    const e = byCard.get(p.card) ?? { name: p.name, val: p.val, ratings: p.ratings, w: 0, num: 0 };
    e.w += p.w; e.num += (p.raw / mean) * p.w; byCard.set(p.card, e);
  }

  const cards: { ratings: any; w: number; resid: number; name: string; val: number }[] = [];
  for (const [, c] of byCard) {
    if (c.w < MIN || !(c.val > 0)) continue;
    const rates = KIND === "hit" ? hitterRates(c.ratings, era.rates) : pitcherRates(c.ratings, era.rates);
    if (!rates) continue;
    const model = cardRuns(rates, env);                      // runs per 700 PA above average
    const idx = c.num / c.w;                                 // 1.00 = series average
    const observed = KIND === "hit"
      ? ((idx - 1) * overall) / WOBA_SCALE * 700              // wOBA index -> runs per 700 PA
      : (idx - 1) * overall * 700;                           // ER/BF index -> runs per 700 BF
    // a pitcher's cardRuns is runs ALLOWED above average, same sign as observed
    cards.push({ ratings: c.ratings, w: c.w, resid: observed - model, name: c.name, val: c.val });
  }
  const W = cards.reduce((a, b) => a + b.w, 0);
  const sd = Math.sqrt(cards.reduce((a, b) => a + b.w * (b.resid - wmean(cards.map((c) => c.resid), cards.map((c) => c.w))) ** 2, 0) / W);

  const keys = [...new Set(cards.flatMap((c) => Object.keys(c.ratings)))]
    .filter((k) => !SKIP.test(k))
    .filter((k) => cards.filter((c) => typeof c.ratings[k] === "number" && c.ratings[k] > 0).length > cards.length * 0.8);

  const out: any[] = [];
  for (const k of keys) {
    const pts = cards.filter((c) => typeof c.ratings[k] === "number" && c.ratings[k] > 0);
    if (pts.length < 60) continue;
    const w = pts.map((c) => c.w);
    const cv = pts.map((c) => Math.log(c.val));
    let x = pts.map((c) => Math.log(c.ratings[k] / 50));
    let y = pts.map((c) => c.resid);
    if (!RAW) { x = partial(x, cv, w); y = partial(y, cv, w); }
    const f = wfit(x, y, w);
    out.push({ k, ...f, n: pts.length });
  }
  out.sort((a, b) => b.r2 - a.r2);
  console.log(`residual screen — ${KIND === "pit" ? "PITCHERS (earned runs per BF)" : "HITTERS (wOBA)"}`);
  console.log(`${cards.length} cards, ${Math.round(W).toLocaleString()} ${KIND === "pit" ? "BF" : "PA"} · residual sd ${sd.toFixed(1)} runs/700`);
  console.log(RAW ? `RAW — card value NOT controlled; expect every rating to light up\n`
                  : `log(card value) partialled out of both sides\n`);
  console.log(`  rating                    R²     slope    n`);
  for (const o of out.slice(0, 16)) {
    const tag = USED.has(o.k) ? "   (in the model)" : o.r2 >= 0.02 ? "   <-- worth a look" : "";
    console.log(`  ${o.k.padEnd(21)} ${o.r2.toFixed(4).padStart(7)}  ${(o.slope >= 0 ? "+" : "") + o.slope.toFixed(2)}  ${String(o.n).padStart(5)}${tag}`);
  }
  process.exit(0);
}
main();
