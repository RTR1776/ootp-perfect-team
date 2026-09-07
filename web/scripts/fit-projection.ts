/**
 * Projection model v0 — fit observed performance on card ratings.
 *
 * Pulls every card's career observed line (PA-weighted wOBA across all
 * series; IP-weighted FIP) from observed_card_stats, joins card ratings,
 * and fits two weighted ridge regressions:
 *
 *   hitters :  wOBA ~ Contact + Gap + Power + Eye + Avoid Ks + BABIP + Speed
 *   pitchers:  FIP  ~ Stuff + Movement + Control + pHR + pBABIP
 *
 * Coefficients land in src/lib/analytics/projection-coeffs.json, which the
 * app applies per card (overall and vL/vR by swapping in split ratings).
 * The model carries no park/era terms, so the SAMPLE has to supply the
 * single run environment instead: only series at PT's default env year
 * (2010) train it. Everything else still shows as observed columns across
 * the app — it just stops teaching the regression.
 *
 * Why that filter earns its keep (measured 2026-09-06, same code both ways):
 *
 *              all non-draft series        2010-env series only
 *   hitters    n=1472  r² .358            n=1013  r² .301
 *              Contact -0.000087 (!)      Contact +0.000250
 *              BABIP   +0.000370          BABIP   +0.000077
 *   pitchers   n=1173  r² .319            n=847   r² .375
 *              Stuff   -0.005546          Stuff   -0.006716
 *              pHR     -0.006277          pHR     -0.009387
 *
 * Mixed-RE Contact comes out NEGATIVE — more contact, less wOBA — because
 * high-BABIP eras load onto the BABIP rating and strip Contact's signal.
 * One environment restores the sign. Pitchers gain r² outright on a third
 * fewer rows. The hitter r² drop is the point, not a cost: the variance
 * that goes away is era, not card. Same reasoning already excludes draft
 * series below.
 *
 * NOT fixable with league data. League is one RE and league stats are
 * normalised somewhat; tourneys vary in RE and are not normalised, so a
 * league-fitted model would be trained in a regime it never predicts.
 * League exports answer league questions (see /meta) — never this one.
 *
 * Run: pnpm fit:projection   (needs DATABASE_URL; rerun after import:observed)
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { cards, observedCardStats, tournaments } from "../src/db/schema";
import { PT_DEFAULT_ENV_YEAR } from "../src/lib/analytics/tournament-env";

const HIT_FEATURES = ["Contact", "Gap", "Power", "Eye", "Avoid Ks", "BABIP", "Speed"];
// Only the three FIP components: Stuff→K, Control→BB, pHR→HR. Movement and
// pBABIP are deliberately absent — Movement is collinear with pHR, and BABIP
// is outside FIP by construction; both flip signs when included.
const PIT_FEATURES = ["Stuff", "Control", "pHR"];
const MIN_PA = 100;
const MIN_IP = 25;
const RIDGE = 1e-4;

/** Solve (X'WX + λI) b = X'Wy via Gaussian elimination. */
function ridgeFit(rows: number[][], y: number[], w: number[], lambda: number): number[] {
  const k = rows[0].length;
  const A: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const b: number[] = Array(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    const wi = w[i];
    for (let a = 0; a < k; a++) {
      b[a] += wi * rows[i][a] * y[i];
      for (let c = a; c < k; c++) A[a][c] += wi * rows[i][a] * rows[i][c];
    }
  }
  for (let a = 0; a < k; a++) for (let c = 0; c < a; c++) A[a][c] = A[c][a];
  const scale = rows.reduce((s, _r, i) => s + w[i], 0) / rows.length;
  for (let a = 1; a < k; a++) A[a][a] += lambda * scale * rows.length; // don't shrink intercept
  // solve
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    const d = A[col][col] || 1e-12;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = A[r][col] / d;
      for (let c = col; c < k; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  return b.map((v, i) => v / (A[i][i] || 1e-12));
}

function weightedR2(rows: number[][], y: number[], w: number[], beta: number[]): number {
  let sw = 0, mean = 0;
  for (let i = 0; i < y.length; i++) { sw += w[i]; mean += w[i] * y[i]; }
  mean /= sw;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < y.length; i++) {
    const pred = rows[i].reduce((s, x, j) => s + x * beta[j], 0);
    ssTot += w[i] * (y[i] - mean) ** 2;
    ssRes += w[i] * (y[i] - pred) ** 2;
  }
  return 1 - ssRes / ssTot;
}

async function main() {
  /**
   * The fit sample is exactly the series that run at PT's default env year,
   * drafts excluded. Drafts were already out — their pools mix environments
   * so widely that including them cut r² .42 → .31 — and the same argument
   * retires every other non-default era from the regression.
   *
   * A series with no catalog row is dropped too: unknown env year is not the
   * same as default, and guessing is how a 1907 event ends up teaching the
   * model what Contact is worth. The count is reported below, because that
   * is sample lost to a stale catalog, recoverable with pnpm import:refresh.
   */
  const catalog = await db
    .select({ series: tournaments.series, envYear: tournaments.envYear, isDraft: tournaments.isDraft })
    .from(tournaments)
    .where(sql`${tournaments.series} is not null`);
  const defaultEnvSeries = [
    ...new Set(
      catalog
        .filter((t) => !t.isDraft && t.envYear === PT_DEFAULT_ENV_YEAR)
        .map((t) => t.series!),
    ),
  ];
  const knownSeries = new Set(catalog.map((t) => t.series!));
  if (defaultEnvSeries.length === 0) {
    console.error(`No series at env year ${PT_DEFAULT_ENV_YEAR} — run pnpm import:tournaments first.`);
    process.exit(1);
  }

  const careers = await db
    .select({
      cardId: observedCardStats.cardId,
      pa: sql<number>`sum(${observedCardStats.pa})`.mapWith(Number),
      ip: sql<number>`sum(${observedCardStats.ip})`.mapWith(Number),
      woba: sql<number | null>`sum(${observedCardStats.woba} * ${observedCardStats.pa}) / nullif(sum(case when ${observedCardStats.woba} is not null then ${observedCardStats.pa} end), 0)`,
      fip: sql<number | null>`sum(${observedCardStats.fip} * ${observedCardStats.ip}) / nullif(sum(case when ${observedCardStats.fip} is not null then ${observedCardStats.ip} end), 0)`,
    })
    .from(observedCardStats)
    .where(inArray(observedCardStats.series, defaultEnvSeries))
    .groupBy(observedCardStats.cardId);

  /* Say out loud what the filter cost, so a shrinking sample is visible
     rather than silent. */
  const observedSeries = (
    await db.selectDistinct({ series: observedCardStats.series }).from(observedCardStats)
  ).map((r) => r.series);
  const inFit = new Set(defaultEnvSeries);
  const unmapped = observedSeries.filter((x) => !knownSeries.has(x));
  const nonDefault = observedSeries.filter((x) => knownSeries.has(x) && !inFit.has(x));
  console.log(
    `fit sample: ${observedSeries.filter((x) => inFit.has(x)).length} series at env ` +
      `${PT_DEFAULT_ENV_YEAR} · excluded ${nonDefault.length} non-default/draft` +
      (unmapped.length
        ? `, ${unmapped.length} unmapped (${unmapped.slice(0, 4).join(", ")}${
            unmapped.length > 4 ? "…" : ""
          }) — seed them with pnpm import:refresh to win the sample back`
        : ""),
  );

  const ids = careers.map((c) => c.cardId);
  const ratingRows = await db
    .select({ cardId: cards.cardId, isPitcher: cards.isPitcher, ratings: cards.ratings })
    .from(cards)
    .where(inArray(cards.cardId, ids));
  const ratingsById = new Map(ratingRows.map((r) => [r.cardId, r]));

  const fit = (
    features: string[],
    pick: (c: (typeof careers)[number]) => { y: number | null; w: number },
    wantPitcher: boolean,
  ) => {
    const X: number[][] = [], y: number[] = [], w: number[] = [];
    for (const c of careers) {
      const card = ratingsById.get(c.cardId);
      if (!card || (card.isPitcher ?? false) !== wantPitcher) continue;
      const t = pick(c);
      if (t.y == null || t.w <= 0) continue;
      const r = (card.ratings ?? {}) as Record<string, number>;
      if (features.some((f) => r[f] == null)) continue;
      X.push([1, ...features.map((f) => r[f])]);
      y.push(t.y);
      w.push(t.w);
    }
    const beta = ridgeFit(X, y, w, RIDGE);
    const r2 = weightedR2(X, y, w, beta);
    return { intercept: beta[0], features, coef: beta.slice(1), n: X.length, r2 };
  };

  const hit = fit(HIT_FEATURES, (c) => ({ y: c.pa >= MIN_PA ? c.woba : null, w: c.pa }), false);
  const pit = fit(PIT_FEATURES, (c) => ({ y: c.ip >= MIN_IP ? c.fip : null, w: c.ip }), true);

  const out = { fittedAt: new Date().toISOString().slice(0, 10), minPa: MIN_PA, minIp: MIN_IP, hit, pit };
  const dest = join(process.cwd(), "src/lib/analytics/projection-coeffs.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

  const show = (m: typeof hit, label: string) => {
    console.log(`${label}: n=${m.n} r²=${m.r2.toFixed(3)} intercept=${m.intercept.toFixed(4)}`);
    m.features.forEach((f, i) => console.log(`  ${f.padEnd(10)} ${m.coef[i] >= 0 ? "+" : ""}${m.coef[i].toFixed(6)}`));
  };
  show(hit, "hitters wOBA");
  show(pit, "pitchers FIP");
  console.log("wrote", dest);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
