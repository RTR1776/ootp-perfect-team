/**
 * What +10 rating points buys, old curves vs refit, across environments.
 * This is the table the roster builder actually acts on.
 *   pnpm lever:diff
 */
import { readFileSync } from "node:fs";
import { envFor, marginalRatings, __setCurves } from "@/lib/analytics/card-value";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { linearWeights, blendPark, NEUTRAL_PARK } from "@/lib/analytics/run-env";

const A = JSON.parse(readFileSync("src/data/curves.json", "utf8"));
const B = JSON.parse(readFileSync("src/data/curves.v2.json", "utf8"));
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

const ENVS: [string, string, string | null, number | null][] = [
  ["PT default (2010)", "0", null, null],
  ["1935 · Cap berth", "1935", "Wrigley Field", 1932],
  ["1968 · Bronze berth", "1968", "Shea Stadium", 1964],
  ["2006 · Silver berth", "2006", "U.S. Cellular Field", 2005],
  ["2019 (modern)", "2019", null, null],
];

for (const [label, year, park, pyear] of ENVS) {
  const era = eraTable[year]; if (!era) continue;
  const pr = park ? parkRow(park, pyear) : null;
  const bp = pr ? blendPark(pr, 0.35) : NEUTRAL_PARK;
  const env = envFor(era.rates, bp, linearWeights(era.rates));
  console.log(`\n=== ${label} ===`);
  for (const kind of ["hit", "pit"] as const) {
    __setCurves(A); const a = marginalRatings(env, kind);
    __setCurves(B); const b = marginalRatings(env, kind);
    const byName = new Map(a.map((x) => [x.rating, x.runs]));
    const rows = b.map((x) => ({ r: x.rating, old: byName.get(x.rating) ?? 0, neu: x.runs }))
      .sort((x, y) => Math.abs(y.neu) - Math.abs(x.neu));
    console.log(`  ${kind === "hit" ? "BATS" : "ARMS"}   rating          old    refit   change`);
    for (const r of rows) {
      const d = r.neu - r.old;
      const rank = Math.abs(d) > 0.4 ? (d > 0 ? "  ^^" : "  vv") : "";
      console.log(`         ${r.r.padEnd(14)} ${f1(r.old).padStart(6)} ${f1(r.neu).padStart(7)}  ${f1(d).padStart(6)}${rank}`);
    }
  }
}
process.exit(0);
