/**
 * Checks the ported RE model against the numbers the presets page shipped
 * with, then prints the live ranking for a target era + park.
 *   pnpm verify:env                       (defaults to 1998 @ Coors Field 1996)
 *   pnpm verify:env 1968 "Fenway Park" 1975
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/db/client";
import { tournaments } from "../src/db/schema";
import {
  OFFENSE_KEYS, STRATEGY_KEYS, distance, eraFor, parkFor, parkTable,
  solveFor, spreads, vectorOf,
} from "../src/lib/analytics/tournament-env";

const html = readFileSync(resolve(process.cwd(), "..", "PT Strategy Presets by Environment.html"), "utf8");
const shipped = JSON.parse(/^const D=(\[.*\]);$/m.exec(html)![1]) as {
  year: number; R_g: number; bunt_12_0: number; SBBE0: number; preset: string;
  rates: Record<string, number>;
}[];

let worst = 0, worstYear = 0, presetMisses = 0;
for (const e of shipped) {
  const got = solveFor({ rates: e.rates as never, rg: e.R_g, src: "", preset: e.preset }, null);
  const d = Math.max(Math.abs(got.RG - e.R_g), Math.abs(got.bunt_12_0 - e.bunt_12_0), Math.abs(got.sbbe0 - e.SBBE0));
  if (d > worst) { worst = d; worstYear = e.year; }
  if (got.preset !== e.preset) { presetMisses++; console.log(`  preset mismatch ${e.year}: ${got.preset} vs ${e.preset}`); }
}
console.log(`RE model vs the ${shipped.length} shipped era rows: worst deviation ${worst.toExponential(2)} (year ${worstYear}), ${presetMisses} preset mismatches\n`);

const [yArg, pArg, pyArg] = process.argv.slice(2);
const eraYear = yArg ? Number(yArg) : 1998;
const parkName = pArg ?? "Coors Field";
const parkYear = pyArg ?? "1996";

const era = eraFor(eraYear);
if (!era) throw new Error(`no era on file for ${eraYear}`);
const parkRow = parkTable[parkName]?.[parkYear] ?? null;
if (parkName && !parkRow) throw new Error(`no factors for ${parkName} ${parkYear}`);

const target = vectorOf(solveFor(era.row, parkRow));
const neutral = vectorOf(solveFor(era.row, null));
console.log(`target: ${eraYear} @ ${parkName} ${parkYear}`);
console.log(`  R/G ${target.rg.toFixed(2)} (neutral ${neutral.rg.toFixed(2)}) · K ${(target.k * 100).toFixed(1)}% · HR/PA ${(target.hr * 100).toFixed(2)}% · 1B/PA ${(target.b1 * 100).toFixed(1)}% · bunt ${target.bunt.toFixed(3)} · ${target.preset}\n`);

async function main() {
  const list = await db.select().from(tournaments);
  const rows = list.flatMap((t) => {
    const e = eraFor(t.envYear);
    if (!e) return [];
    const p = parkFor(t.stadium);
    return [{ t, park: p, env: vectorOf(solveFor(e.row, p.row)) }];
  });
  const sd = spreads(rows.map((r) => r.env), [...OFFENSE_KEYS, ...STRATEGY_KEYS]);
  for (const [label, keys] of [["offense shape", OFFENSE_KEYS], ["incl. small-ball", [...OFFENSE_KEYS, ...STRATEGY_KEYS]]] as const) {
    console.log(`ranked by ${label}:`);
    rows.map((r) => ({ ...r, d: distance(r.env, target, keys, sd) }))
      .sort((a, b) => a.d - b.d).slice(0, 6)
      .forEach((r, i) => console.log(
        `  ${i + 1}. gap ${r.d.toFixed(2)}  R/G ${r.env.rg.toFixed(2)}  K ${(r.env.k * 100).toFixed(1)}%  HR ${(r.env.hr * 100).toFixed(2)}%  ` +
        `${r.t.name} [${r.t.envYear}] @ ${r.park.label}`));
    console.log();
  }
  process.exit(0);

}
main();
