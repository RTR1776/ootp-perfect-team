/**
 * Ranks the owned collection for each PTCS 6 Championship berth using only the
 * /runenv model — no observed stats, no projected-wOBA fit. Needs DATABASE_URL.
 *
 *   pnpm verify:runenv:pool
 */
import { blendPark, linearWeights } from "@/lib/analytics/run-env";
import { cardRuns, envFor, hitterRates, pitcherRates } from "@/lib/analytics/card-value";
import { applyPark } from "@/lib/analytics/run-env";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { ownedPool } from "@/lib/analytics/runenv-pool";
import { HIT_KEYS, PIT_KEYS, type PoolCard } from "@/lib/analytics/pool-shape";

const BERTHS = [
  { berth: "Bronze", year: 1968, park: "Shea Stadium", parkYear: 1964 },
  { berth: "Silver", year: 2006, park: "U.S. Cellular Field", parkYear: 2005 },
  { berth: "Gold", year: 1984, park: "Wrigley Field", parkYear: 1985 },
  { berth: "Diamond", year: 1987, park: "Yankee Stadium", parkYear: 1987 },
  { berth: "Cap", year: 1935, park: "Wrigley Field", parkYear: 1932 },
];

const ratingsOf = (c: PoolCard) => {
  const keys = c.isP ? PIT_KEYS : HIT_KEYS;
  const out: Record<string, number> = {};
  keys.forEach((k, i) => { out[k] = c.r[i * 3]; });
  return out;
};

async function main() {
  const pool = await ownedPool();
  console.log(`pool: ${pool.count} owned cards, collection as of ${pool.asOf}\n`);

  for (const b of BERTHS) {
    const era = eraTable[String(b.year)];
    const pr = parkRow(b.park, b.parkYear);
    const factors = pr ? blendPark(pr, 0.35) : null;
    const rates = factors ? applyPark(era.rates, factors) : era.rates;
    const env = envFor(era.rates, factors, linearWeights(rates));

    const rank = (side: "hit" | "pit") => pool.cards
      .filter((c) => (c.isP ? "pit" : "hit") === side)
      .filter((c) => c.year != null && c.year >= 1920 && c.year <= 1989)
      .map((c) => {
        const r = ratingsOf(c);
        const cr = side === "hit" ? hitterRates(r, env.rates, "all") : pitcherRates(r, env.rates, "all");
        return cr ? { c, runs: cardRuns(cr, env) * (side === "pit" ? -1 : 1) } : null;
      })
      .filter((x): x is { c: PoolCard; runs: number } => x !== null)
      .sort((a, x) => x.runs - a.runs);

    const hit = rank("hit"), pit = rank("pit");
    console.log(`--- ${b.berth}: ${b.year} @ ${b.parkYear} ${b.park} (${hit.length} hitters, ${pit.length} arms eligible 1920-89) ---`);
    console.log("  bats:", hit.slice(0, 8).map((x) => `${x.c.name} ${x.runs >= 0 ? "+" : ""}${x.runs.toFixed(1)}`).join(", "));
    console.log("  arms:", pit.slice(0, 6).map((x) => `${x.c.name} ${x.runs >= 0 ? "+" : ""}${x.runs.toFixed(1)}`).join(", "));
    console.log();
  }
}

main().then(() => process.exit(0));
