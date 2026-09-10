/**
 * Sanity harness for the /runenv math. No DB, no network — it re-solves the
 * five PTCS 6 Championship berths and prints the rate line, the preset and the
 * linear weights beside the numbers the championship-comparables report
 * published, so a change to the model announces itself.
 *
 *   pnpm verify:runenv
 */
import ERAS from "@/data/eras.json";
import PARKS from "@/data/park-factors.json";
import { rateLine, linearWeights, solveEnv, blendPark, applyPark, type EraRates } from "@/lib/analytics/run-env";

const eras = ERAS as unknown as Record<string, { rates: EraRates; rg: number; src: string; preset: string }>;
const parks = PARKS as unknown as Record<string, Record<string, { avgL: number; avgR: number; hrL: number; hrR: number; d2: number; d3: number }>>;

/** From PTCS6 Championship Comparables — the published berth table. */
const EXPECT: Record<string, { rg: number; k: number; hrPa: number }> = {
  Bronze: { rg: 4.03, k: 15.4, hrPa: 2.12 },
  Silver: { rg: 5.09, k: 16.8, hrPa: 3.41 },
  Gold: { rg: 4.60, k: 14.0, hrPa: 2.37 },
  Diamond: { rg: 4.34, k: 14.9, hrPa: 2.29 },
  Cap: { rg: 4.98, k: 7.2, hrPa: 1.39 },
};

const BERTHS = [
  { berth: "Bronze", year: "1968", park: "Shea Stadium", parkYear: "1964" },
  { berth: "Silver", year: "2006", park: "U.S. Cellular Field", parkYear: "2005" },
  { berth: "Gold", year: "1984", park: "Wrigley Field", parkYear: "1985" },
  { berth: "Diamond", year: "1987", park: "Yankee Stadium", parkYear: "1987" },
  { berth: "Cap", year: "1935", park: "Wrigley Field", parkYear: "1932" },
];

const f3 = (n: number) => n.toFixed(3);

function show(label: string, year: string, parkName?: string, parkYear?: string) {
  const era = eras[year];
  if (!era) { console.log(`${label}: NO ERA ROW for ${year}`); return; }
  const pf = parkName ? parks[parkName]?.[parkYear!] : null;
  if (parkName && !pf) console.log(`  !! no park factors for ${parkYear} ${parkName}`);
  const bp = pf ? blendPark(pf, 0.35) : null;
  const env = solveEnv(era.rates, era.rg, bp);
  const rates = bp ? applyPark(era.rates, bp) : era.rates;
  const L = rateLine(rates, env.RG);
  const w = linearWeights(rates);
  const e = EXPECT[label];
  const flag = (got: number, want: number | undefined, tol: number) =>
    want == null ? "" : Math.abs(got - want) <= tol ? "  ok" : `  <-- published ${want}`;

  console.log(`${label.padEnd(8)} ${year} @ ${parkName ? `${parkYear} ${parkName}` : "neutral"}   ${env.preset}`);
  console.log(`   R/G ${env.RG.toFixed(2)}${flag(env.RG, e?.rg, 0.06)}   K% ${(L.kPct * 100).toFixed(1)}${flag(L.kPct * 100, e?.k, 0.3)}   HR/PA ${(L.hrPa * 100).toFixed(2)}%${flag(L.hrPa * 100, e?.hrPa, 0.08)}`);
  console.log(`   AVG ${f3(L.avg)} OBP ${f3(L.obp)} SLG ${f3(L.slg)} OPS ${f3(L.ops)} BABIP ${f3(L.babip)} BB% ${(L.bbPct * 100).toFixed(1)}`);
  console.log(`   K/9 ${L.k9.toFixed(1)} BB/9 ${L.bb9.toFixed(1)} HR/9 ${L.hr9.toFixed(2)} WHIP ${f3(L.whip)}`);
  console.log(`   above out: BB ${f3(w.aboveOut.BB)} 1B ${f3(w.aboveOut.B1)} 2B ${f3(w.aboveOut.B2)} 3B ${f3(w.aboveOut.B3)} HR ${f3(w.aboveOut.HR)} K ${f3(w.aboveOut.K)}   PA/inn ${w.paPerInning.toFixed(2)}`);
  console.log();
}

console.log("=== baseline ===\n");
show("2010", "2010");
console.log("=== PTCS 6 Championship berths (published table in parentheses) ===\n");
for (const b of BERTHS) show(b.berth, b.year, b.park, b.parkYear);

/* ---------------- what +10 rating points buys, per berth ---------------- */
import { envFor, marginalRatings, AVERAGE_RATING, curveMeta } from "@/lib/analytics/card-value";
import { linearWeights as lw } from "@/lib/analytics/run-env";

console.log(`=== +10 rating points, runs per 700 PA (league-average card, ${AVERAGE_RATING}s) ===`);
console.log(`    curves: ${curveMeta.frame}, fitted ${curveMeta.fittedAt}\n`);
for (const b of [{ berth: "2010 neutral", year: "2010", park: undefined, parkYear: undefined }, ...BERTHS]) {
  const era = eras[b.year];
  const pf = b.park ? parks[b.park]?.[b.parkYear!] : null;
  const bp = pf ? blendPark(pf, 0.35) : null;
  const rates = bp ? applyPark(era.rates, bp) : era.rates;
  const env = envFor(era.rates, bp, lw(rates));
  const hit = marginalRatings(env, "hit");
  const pit = marginalRatings(env, "pit");
  console.log(`${b.berth.padEnd(12)} hit: ${hit.map((v) => `${v.rating} ${v.runs >= 0 ? "+" : ""}${v.runs.toFixed(1)}`).join("  ")}`);
  console.log(`${"".padEnd(12)} pit: ${pit.map((v) => `${v.rating} ${v.runs >= 0 ? "+" : ""}${v.runs.toFixed(1)}`).join("  ")}`);
}
