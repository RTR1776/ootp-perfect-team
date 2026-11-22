/**
 * Batting order (lib/batting-order) for given nines in a league run environment at 1987 Yankee Stadium,
 * half weight; also scores the order as listed.
 *
 *   YEAR=2014 NINE_R="1B:George Brett,..." NINE_L="..." node --import tsx scripts/league-order.mts
 */
import { loadHitterUniverse, resolveRoster } from "@/lib/league-hitters";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { leagueEraFor, eraTable, leagueRow, parkFor } from "@/lib/analytics/tournament-env";
import { hitterRates } from "@/lib/analytics/card-value";
import { calibrationSlope } from "@/lib/analytics/calibration";
import { bestOrder, gameRuns, obp, orderEnv, paLine, shrink, slg } from "@/lib/batting-order";
const YEAR = Number(process.env.YEAR ?? 2014);
const era = leagueEraFor(YEAR)?.row ?? leagueRow(eraTable["0"]);
const p = parkFor("1987 Yankee Stadium").row!;
const park = { ...p, avgL: 1 + (p.avgL - 1) / 2, avgR: 1 + (p.avgR - 1) / 2, hrL: 1 + (p.hrL - 1) / 2, hrR: 1 + (p.hrR - 1) / 2, d2: 1 + (p.d2 - 1) / 2, d3: 1 + (p.d3 - 1) / 2 };
const u = await loadHitterUniverse();
for (const [hand, spec] of [["R", process.env.NINE_R], ["L", process.env.NINE_L]] as const) {
  if (!spec) continue;
  const slots = spec.split(",").map((x) => x.split(":"));
  const { hitters } = resolveRoster(slots.map(([, n]) => n), u);
  const fits = envFitMaps(hitters.map((h) => ({ cardId: h.id, isPitcher: false, bats: h.bats, throws: null, ratings: h.ratings })), { era: era.rates, park, roleTrust: 0.25, eraYear: YEAR });
  const chain = orderEnv(era.rates), s = calibrationSlope("hit");
  const lines = hitters.map((h) => {
    const side = batsLeftOn(h.bats, hand) ? fits.envLeft : fits.envRight;
    const league = paLine(side.rates, side.park);
    const r = hitterRates(h.ratings, side.rates, hand === "R" ? "vR" : "vL");
    return r ? shrink(paLine(r, side.park), league, s) : league;
  });
  const res = bestOrder(lines, chain);
  const row = (i: number) => `${slots[i][0]} ${hitters[i].label} (${obp(lines[i]).toFixed(3)}/${slg(lines[i]).toFixed(3)})`;
  console.log(`vs ${hand}HP: ${res.runs.toFixed(3)} R/G (book ${res.bookRuns.toFixed(3)})`);
  res.order.forEach((i, k) => console.log(`  ${k + 1}. ${row(i)}`));
  console.log(`  as listed: ${gameRuns(lines, chain).toFixed(3)} R/G`);
}
process.exit(0);
