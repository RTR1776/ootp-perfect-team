/**
 * /environments — two views of the same question.
 *
 * The top card solves each tournament's CURRENT era + ballpark through the RE
 * model and ranks them against whatever pair you ask about, because both
 * settings rotate through the year and the scheduled snapshot goes stale. The
 * catalog below is that snapshot: neutral-park environment rows joined to each
 * event's rule set, which is still the fastest way to read the whole schedule.
 */

import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { EnvSimilarity, type TournamentEnv } from "@/components/env-similarity";
import { EnvironmentsCatalog } from "@/components/environments-catalog";
import { eraFor, parkFor, solveFor, vectorOf } from "@/lib/analytics/tournament-env";

export const dynamic = "force-dynamic";

/** ~110 Markov solves; the inputs only change on import, so do it once. */
let cache: { rows: TournamentEnv[]; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

async function tournamentEnvs(): Promise<TournamentEnv[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const list = await db.select().from(tournaments);
  const rows: TournamentEnv[] = [];
  for (const t of list) {
    const era = eraFor(t.envYear);
    if (!era) continue; // no era on file — nothing to compare
    const park = parkFor(t.stadium);
    rows.push({
      id: t.id,
      name: t.name,
      envYear: t.envYear,
      eraLabel: era.label,
      stadium: t.stadium,
      parkLabel: park.label,
      tier: null,
      cap: t.ratingsMax != null ? `${t.ratingsMin ?? 40}–${t.ratingsMax}` : null,
      dh: t.dh,
      entrants: t.entrants,
      series: t.series,
      env: vectorOf(solveFor(era.row, park.row)),
    });
  }
  cache = { rows, at: Date.now() };
  return rows;
}

export default async function EnvironmentsPage() {
  const rows = await tournamentEnvs();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Environments</h1>
        <p className="text-sm text-muted-foreground">
          What each tournament actually plays like — the era it runs and the ballpark it runs in, solved through the
          run-expectancy model.
        </p>
      </div>
      <EnvSimilarity tournaments={rows} />
      <EnvironmentsCatalog />
    </div>
  );
}
