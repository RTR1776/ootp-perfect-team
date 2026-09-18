/**
 * CALIBRATION — is a modelled run a real run?
 *
 * model:validate answers "does the model RANK cards the way play ranked them"
 * (Spearman .54 bats / .40 arms). This answers the question the blend, the
 * glove-for-bat trades and the cap search actually depend on: when the model
 * says a card is +20 runs better than the field it plays in, what does play
 * say? For every (card, series) line with enough PA:
 *
 *     x = model runs of the card − PA-weighted mean model runs of that field
 *     y = the card's observed runs above that field (wOBA over the series'
 *         wOBA on the wOBA scale; FIP under the series' FIP for arms)
 *
 * and the PA-weighted fit  y = intercept + slope · x.  Within the field, so
 * that the level of the field — which observed-blend builds FROM the model
 * and which would otherwise correlate the two sides by construction — cancels
 * out. A slope of 1 means the ratings buy exactly the runs the curves say. A
 * slope below 1 means the model overstates the spread between cards, and a
 * "+9 runs of bat for −38 of glove" trade is priced on the wrong scale, since
 * the glove side (fielding.ts) is measured in runs directly.
 *
 * Sampling noise in y does not pull the slope down (noise on the response
 * side leaves a least-squares slope unbiased), so a low slope is a property
 * of the model, not of the sample.
 *
 * Also reported, because a 2026-09-17 handoff proposed rules for both:
 *   - residual by RELEASE MONTH: do launch-window base cards underperform
 *     their ratings ("card creep — down-weight launch cards")?
 *   - residual by VALUE tier: the same question for cheap vs expensive cards.
 *
 * Writes src/data/model-calibration.json. env-fit reads it and, when
 * `applied` is set (slope outside 0.85–1.15), puts the model's runs on the
 * observed scale before observed play is blended in and before defence in
 * runs is added. Rankings within a scale are unchanged by it; the exchange
 * rates between bat, glove and arm are what it corrects.
 *
 *   pnpm model:calibrate [--min-n 300] [--no-write]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { eraTable } from "@/lib/analytics/tournament-env";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { wobaOf, fipOf } from "@/lib/analytics/league";
import { tierCode } from "@/lib/roster-rules";

const argv = process.argv.slice(2);
const num = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const MIN_N = num("min-n", 300);
const WRITE = !argv.includes("--no-write");
/** Runs per unit of wOBA — the same scale observed-blend and roster-fill use. */
const WOBA_SCALE = 1.25;
type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));
const n = (v: unknown) => (v == null ? 0 : Number(v));

const stintLike = (counters: Record<string, number>, ip: number, pa: number) => ({
  stats: counters, ip, pa, use: 0, isPitcher: false, isFreeAgent: false, org: "", cid: null, name: "", pos: "",
  clan: null, val: null, tier: null, isVariant: false, cardYear: null, ratings: {}, war: 0,
});

interface Pt { cardId: number; series: string; x: number; y: number; w: number; val: number; released: string | null }

function wfit(pts: Pt[]) {
  let sw = 0, mx = 0, my = 0;
  for (const p of pts) { sw += p.w; mx += p.w * p.x; my += p.w * p.y; }
  mx /= sw; my /= sw;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += p.w * dx * dx; sxy += p.w * dx * dy; syy += p.w * dy * dy; }
  const slope = sxy / sxx, intercept = my - slope * mx, r = sxy / Math.sqrt(sxx * syy);
  let ss = 0;
  for (const p of pts) ss += p.w * (p.y - (intercept + slope * p.x)) ** 2;
  return { slope, intercept, r, rmse: Math.sqrt(ss / sw), sdModel: Math.sqrt(sxx / sw), sdObs: Math.sqrt(syy / sw) };
}

const f1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

async function main() {
  const era = eraTable["0"] ?? eraTable["2010"];
  const universe = await db.select({
    cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, isPitcher: cards.isPitcher,
    bats: cards.bats, pitcherRole: cards.pitcherRole, releasedOn: cards.releasedOn, ratings: cards.ratings,
  }).from(cards);
  // The frame every consumer of the model shares: PT default engine, neutral
  // park, relief role at the trusted quarter. Calibration OFF here, or the
  // script would measure its own previous output.
  const fits = envFitMaps(universe.map((c) => ({
    cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole,
    ratings: (c.ratings ?? {}) as Record<string, number>,
  })), { era: era.rates, park: null, roleTrust: 0.25, calibrate: false });
  const model = (id: number) => { const r = fits.runsR.get(id), l = fits.runsL.get(id); return r == null || l == null ? null : 0.7 * r + 0.3 * l; };
  const byId = new Map(universe.map((c) => [c.cardId, c]));

  const lines = asRows(await db.execute(sql`
    select series, card_id, is_pitcher, pa, ip, woba, fip, (counters->>'BF')::float bf from observed_card_stats`));
  const sums = asRows(await db.execute(sql`
    select series, is_pitcher, e.key k, sum((e.value)::float) v
    from observed_card_stats, jsonb_each_text(counters) e group by 1, 2, 3`));
  const vol = asRows(await db.execute(sql`
    select series, is_pitcher, sum(pa)::float pa, sum(ip)::float ip from observed_card_stats group by 1, 2`));

  /* Series baselines: observed wOBA / FIP of the whole field, and the field's
     level on the model's scale (PA-weighted mean model runs of its cards). */
  const cnt = new Map<string, { h: Record<string, number>; p: Record<string, number>; pa: number; ip: number }>();
  const at = (s: string) => { const c = cnt.get(s) ?? { h: {}, p: {}, pa: 0, ip: 0 }; cnt.set(s, c); return c; };
  for (const r of sums) (r.is_pitcher ? at(String(r.series)).p : at(String(r.series)).h)[String(r.k)] = n(r.v);
  for (const r of vol) { const c = at(String(r.series)); if (r.is_pitcher) c.ip += n(r.ip); else c.pa += n(r.pa); }
  const base = new Map<string, { woba: number; fip: number }>();
  for (const [s, c] of cnt) base.set(s, { woba: wobaOf([stintLike(c.h, 0, c.pa) as never]), fip: fipOf([stintLike(c.p, c.ip, 0) as never]) });
  const level = new Map<string, { h: { num: number; den: number }; p: { num: number; den: number } }>();
  for (const l of lines) {
    const m = model(n(l.card_id)); if (m == null) continue;
    const w = l.is_pitcher ? n(l.bf) : n(l.pa); if (!(w > 0)) continue;
    const e = level.get(String(l.series)) ?? { h: { num: 0, den: 0 }, p: { num: 0, den: 0 } };
    const side = l.is_pitcher ? e.p : e.h; side.num += m * w; side.den += w; level.set(String(l.series), e);
  }

  const out: Record<string, unknown> = {
    fittedAt: new Date().toISOString().slice(0, 10), minN: MIN_N,
    frame: "within-series: card's observed runs above its field vs model runs above the field's model mean; PT default engine, neutral park, roleTrust 0.25",
  };
  for (const kind of ["hit", "pit"] as const) {
    const isP = kind === "pit";
    const pts: Pt[] = [];
    for (const l of lines) {
      if (!!l.is_pitcher !== isP) continue;
      const id = n(l.card_id), c = byId.get(id), series = String(l.series);
      const m = model(id), b = base.get(series), lv = level.get(series);
      if (!c || m == null || !b || !lv) continue;
      const side = isP ? lv.p : lv.h; if (!(side.den > 0)) continue;
      let y: number, w: number;
      if (isP) {
        w = n(l.bf); if (w < MIN_N || l.fip == null || !(b.fip > 0)) continue;
        y = (-((n(l.fip) - b.fip) / 9) * n(l.ip) / w) * 700;
      } else {
        w = n(l.pa); if (w < MIN_N || l.woba == null || !(b.woba > 0)) continue;
        y = ((n(l.woba) - b.woba) / WOBA_SCALE) * 700;
      }
      pts.push({ cardId: id, series, x: m - side.num / side.den, y, w, val: c.cardValue, released: c.releasedOn ? String(c.releasedOn).slice(0, 7) : null });
    }
    const fit = wfit(pts);
    const total = pts.reduce((s, p) => s + p.w, 0);
    console.log(`\n=== ${isP ? "ARMS" : "HITTERS"} — ${pts.length} card-series lines with ${MIN_N}+ ${isP ? "BF" : "PA"}, ${new Set(pts.map((p) => p.cardId)).size} cards, ${Math.round(total).toLocaleString()} total`);
    console.log(`  observed above field = ${fit.intercept.toFixed(2)} + ${fit.slope.toFixed(3)} × (model above field)    r ${fit.r.toFixed(3)} · rmse ${fit.rmse.toFixed(1)} runs/700`);
    console.log(`  spread within a field: model sd ${fit.sdModel.toFixed(1)} · observed sd ${fit.sdObs.toFixed(1)} runs/700 (observed includes sampling noise; the slope does not)`);
    const applied = fit.slope < 0.85 || fit.slope > 1.15;
    console.log(`  verdict: ${fit.slope < 0.85 ? "model OVERSTATES the spread — applied" : fit.slope > 1.15 ? "model UNDERSTATES the spread — applied" : "within ±15% — recorded, not applied"}`);

    const sorted = [...pts].sort((a, b) => a.x - b.x);
    const per = Math.ceil(sorted.length / 10);
    console.log(`  decile   lines   model   observed   (runs/700 above the field, PA-weighted)`);
    const deciles: Array<{ n: number; model: number; observed: number }> = [];
    for (let i = 0; i < 10; i++) {
      const g = sorted.slice(i * per, (i + 1) * per); if (!g.length) continue;
      const w = g.reduce((s, p) => s + p.w, 0);
      const mm = g.reduce((s, p) => s + p.x * p.w, 0) / w, mo = g.reduce((s, p) => s + p.y * p.w, 0) / w;
      deciles.push({ n: g.length, model: Math.round(mm * 10) / 10, observed: Math.round(mo * 10) / 10 });
      console.log(`    ${String(i + 1).padStart(2)}    ${String(g.length).padStart(4)}  ${f1(mm).padStart(6)}   ${f1(mo).padStart(8)}`);
    }

    /** Residual (observed − calibrated model) by a grouping, PA-weighted. */
    const residBy = (key: (p: Pt) => string, label: string) => {
      const g = new Map<string, { w: number; cards: Set<number>; num: number }>();
      for (const p of pts) { const k = key(p); const e = g.get(k) ?? { w: 0, cards: new Set(), num: 0 }; e.w += p.w; e.cards.add(p.cardId); e.num += (p.y - (fit.intercept + fit.slope * p.x)) * p.w; g.set(k, e); }
      const rows = [...g].sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => ({ key: k, cards: e.cards.size, n: Math.round(e.w), resid: Math.round((e.num / e.w) * 10) / 10 }));
      console.log(`  residual after calibration by ${label}:`);
      for (const r of rows) console.log(`    ${r.key.padEnd(9)} ${String(r.cards).padStart(4)} cards  ${String(r.n).padStart(10)}  ${f1(r.resid).padStart(6)} runs/700`);
      return rows;
    };
    const byRelease = residBy((p) => p.released ?? "unknown", "release month");
    const byTier = residBy((p) => tierCode(p.val ?? 0), "value tier");

    out[kind] = {
      lines: pts.length, cards: new Set(pts.map((p) => p.cardId)).size, n: Math.round(total),
      slope: Number(fit.slope.toFixed(4)), intercept: Number(fit.intercept.toFixed(3)),
      r: Number(fit.r.toFixed(4)), rmse: Number(fit.rmse.toFixed(2)),
      sdModel: Number(fit.sdModel.toFixed(2)), sdObs: Number(fit.sdObs.toFixed(2)),
      applied, deciles, byRelease, byTier,
    };
  }

  if (WRITE) {
    const dest = join(process.cwd(), "src/data/model-calibration.json");
    writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
    console.log(`\nwrote ${dest}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
