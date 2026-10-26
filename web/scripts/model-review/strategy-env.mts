/**
 * Era inputs for the steal / pitch-count study (2026-10-27): per archived export,
 * its catalogue env year and park, and the steal break-evens env-roster prints
 * (solveEnv: sbbe0 / sbbe1, park blended at 35% LHB). Also the same for the current
 * events and the PTCS 8 Championship brackets, so recommendations use one source.
 *   node --env-file=.env.local --import tsx scripts/model-review/strategy-env.mts OUT.json
 */
import { readdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { solveEnv, blendPark } from "@/lib/analytics/run-env";
const sql = neon(process.env.DATABASE_URL!);
const tours = (await sql`select id, name, series, env_year, stadium, retired, is_draft from tournaments`) as any[];
const bySeries = new Map<string, any>();
for (const t of tours) if (t.series && !bySeries.has(t.series)) bySeries.set(t.series, t);
const env = (year: number | null, stadium: string | null) => {
  const y = year ?? 2010;
  const era = eraFor(y)?.row ?? eraTable["0"];
  const pr = stadium ? parkFor(stadium).row : null;
  const s = solveEnv(era.rates, era.rg, pr ? blendPark(pr, 0.35) : null);
  return { year: y, rg: s.RG, sbbe0: s.sbbe0, sbbe1: s.sbbe1 };
};
const exportsOut: Record<string, any> = {};
for (const f of readdirSync("../Archive/Completed").filter((x) => x.endsWith(".csv"))) {
  const t = bySeries.get(f.replace(/_\d+\.csv$/, ""));
  if (t) exportsOut[f] = env(t.env_year, t.stadium);
}
const events = tours.filter((t) => !t.retired && !t.is_draft && (t.series || String(t.id).startsWith("908"))).map((t) => ({ id: t.id, name: t.name, ...env(t.env_year, t.stadium) }));
writeFileSync(process.argv[2], JSON.stringify({ exports: exportsOut, events }));
console.log(`${Object.keys(exportsOut).length} exports, ${events.length} events`);
process.exit(0);
