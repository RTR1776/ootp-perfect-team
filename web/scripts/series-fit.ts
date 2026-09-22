/**
 * Score one team's ARMS for a specific playoff game: a given run-environment
 * year at a given park, at FULL park weight (theme-week halves the park because
 * a week-long lineup only sees it at home — a single game does not).
 *
 * It also weights the two platoon boards by the OPPONENT's actual left/right
 * plate-appearance mix, so "who should start" answers the question that matters:
 * expected runs against the lineup that team will really run out.
 *
 *   pnpm tsx scripts/series-fit.ts --league HD451 --on 2026-09-20 \
 *     --team "Kansas City Torrent - JW" --opp "Halsted Hams" \
 *     --year 1989 --park "Hinchliffe Stadium" --park-year 1936
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { roleRuns, marginalRatings } from "@/lib/analytics/card-value";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const LEAGUE = val("league", "HD451")!, ON = val("on", "2026-09-20")!;
const TEAM = val("team", "Kansas City Torrent - JW")!, OPP = val("opp")!;
const YEAR = val("year", "1989")!, PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

/**
 * VARIANTS. `cards.ratings` is the BASE card; the owned copy lives in
 * `collection_cards.ratings` and carries the boosts. Scoring his own club off
 * the base card graded the Cy Young variant as the 118/151/142 card Halsted
 * had rather than the 127/162/153 one he actually throws — about 4.3 runs per
 * 700 BF at Hinchliffe's marginals. The overlay is applied to HIS roster only:
 * an opponent's variants are not knowable from a league export.
 */
async function roster(org: string, overlay = false) {
  const rows = asRows<any>(await db.execute(sql`
    select st.cid, st.name, st.pos, st.is_pitcher, st.pa, c.ratings, c.bats, c.throws, c.card_value,
           st.is_variant,
           (select cc.ratings from collection_cards cc
             where cc.upload_id = (select max(id) from uploads where kind = 'collection')
               and cc.card_id = st.cid
             order by (cc.is_variant = st.is_variant) desc, cc.id limit 1) as copy
    from league_stints st
    join league_snapshots ls on ls.id = st.snapshot_id
    join cards c on c.card_id = st.cid
    where ls.league = ${LEAGUE} and ls.split = 'all' and ls.captured_on = ${ON} and st.org = ${org}`));
  if (overlay) for (const r of rows) if (r.copy) r.ratings = mergeCopyRatings(r.ratings, r.copy, r.pos);
  return rows;
}

async function main() {
  const era = eraTable[YEAR]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  if (PARK && !pr) { console.log(`!! no factors on file for ${PARK_YEAR} ${PARK}`); process.exit(1); }

  /* Opponent platoon mix: switch hitters bat opposite the pitcher, so the share
     of LEFT-handed batters an arm faces depends on that arm's own hand. */
  const opp = await roster(OPP);
  const paBy = { L: 0, R: 0, S: 0 } as Record<string, number>;
  for (const b of opp) if (!b.is_pitcher) paBy[(b.bats ?? "R") as string] += Number(b.pa ?? 0);
  const tot = paBy.L + paBy.R + paBy.S;
  const lhbShareVsRHP = (paBy.L + paBy.S) / tot;   // switch hitters bat left on a righty
  const lhbShareVsLHP = paBy.L / tot;
  console.log(`\n=== ${TEAM} arms · ${YEAR} · ${PARK ? `${PARK_YEAR} ${PARK} (full)` : "neutral"} · vs ${OPP} ===`);
  console.log(`${OPP} PA mix: L ${paBy.L} / R ${paBy.R} / S ${paBy.S}  ->  LHB share ${(lhbShareVsRHP * 100).toFixed(1)}% vs a RHP, ${(lhbShareVsLHP * 100).toFixed(1)}% vs a LHP`);
  if (pr) console.log(`park: avg L ${pr.avgL} / R ${pr.avgR}   HR L ${pr.hrL} / R ${pr.hrR}   2B ${pr.d2}  3B ${pr.d3}`);

  const rows = await roster(TEAM, true);
  const pool = rows.map((r) => ({
    cardId: r.cid, isPitcher: r.is_pitcher, bats: r.bats, ratings: r.ratings ?? {},
    role: r.pos, name: r.name, val: r.card_value, throws: r.throws,
  }));
  const fits = envFitMaps(pool as any, { era: era.rates, park: pr as any, eraYear: Number(YEAR) });
  const arms = pool.filter((c) => c.isPitcher);

  /* What the game in THIS park actually plays like, and what a +10 on each
     rating is worth there — the half-weight numbers theme-week prints are for a
     whole week split home/road, not for a single game in one park. */
  const bp = pr ? blendPark(pr as any, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp);
  const line = rateLine(bp ? applyPark(era.rates, bp) : era.rates, solved.RG);
  console.log(`game shape: R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)} OBP ${line.obp.toFixed(3)} SLG ${line.slg.toFixed(3)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%`);
  console.log(`+10 buys — LHB: ${marginalRatings(fits.envLeft, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`           RHB: ${marginalRatings(fits.envRight, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`          arms: ${marginalRatings(fits.envPitch, "pit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);

  const scored = arms.map((c) => {
    const vR = fits.runsR.get(c.cardId) ?? -1e6;   // vs right-handed batters
    const vL = fits.runsL.get(c.cardId) ?? -1e6;   // vs left-handed batters
    const hand = ((c as any).throws ?? "R") as string;
    const share = hand === "L" ? lhbShareVsLHP : lhbShareVsRHP;
    return { c, hand, vR, vL, blend: vL * share + vR * (1 - share) };
  }).sort((a, b) => b.blend - a.blend);

  console.log(`\n  role name                     val  T   vs${OPP.slice(0, 8)}   vsRHB   vsLHB   STM`);
  for (const s of scored) {
    const stm = s.c.ratings["Stamina"] ?? 0;
    console.log(`  ${(s.c.role ?? "").padEnd(4)} ${s.c.name.slice(0, 22).padEnd(23)} ${String(s.c.val).padStart(3)}  ${s.hand}  ${f1(s.blend).padStart(7)} ${f1(s.vR).padStart(7)} ${f1(s.vL).padStart(7)}   ${String(Math.round(stm)).padStart(3)}`);
  }
  process.exit(0);
}
main();
