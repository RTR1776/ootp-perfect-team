/**
 * Set a league roster for a THEME WEEK — a run environment that is not the
 * league's usual one, plus a home park you get to choose.
 *
 * The park only applies to home games, so the lineup you set for the whole week
 * sees it at half strength; that is the blend used here. The run environment
 * applies everywhere and is the bigger effect.
 *
 *   pnpm theme:week --league HD453 --team "Kansas City Torrent" --year 1989 \
 *     --park "Baker Bowl" --park-year 1921 --dh
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { marginalRatings, roleRuns } from "@/lib/analytics/card-value";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";
import { HIT_POS } from "@/lib/roster-fill";
import { readFileSync } from "node:fs";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const LEAGUE = val("league", "HD453")!, TEAM = val("team", "Kansas City Torrent")!;
const YEAR = val("year", "1989")!, ON = val("on", "2026-09-13")!;
const PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const DH = argv.includes("--dh");
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const era = eraTable[YEAR]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  if (PARK && !pr) console.log(`!! no factors on file for ${PARK_YEAR} ${PARK}`);
  /** home park, half the games → half weight on the way in */
  const half = pr ? { avgL: 1 + (pr.avgL! - 1) / 2, avgR: 1 + (pr.avgR! - 1) / 2,
    hrL: 1 + (pr.hrL! - 1) / 2, hrR: 1 + (pr.hrR! - 1) / 2,
    d2: 1 + (pr.d2! - 1) / 2, d3: 1 + (pr.d3! - 1) / 2 } as any : null;

  const bp = half ? blendPark(half, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp);
  const line = rateLine(bp ? applyPark(era.rates, bp) : era.rates, solved.RG);
  console.log(`\n=== ${TEAM} · ${LEAGUE} · ${YEAR} theme week ${pr ? `· ${PARK_YEAR} ${PARK} (home only, half weight)` : "· neutral park"} · DH ${DH ? "on" : "off"} ===`);
  console.log(`R/G ${solved.RG.toFixed(2)}  AVG ${line.avg.toFixed(3)} OBP ${line.obp.toFixed(3)} SLG ${line.slg.toFixed(3)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%  preset ${solved.preset}`);
  console.log(`bunt (1st & 2nd, 0 out) ${f1(solved.bunt_12_0 * 100 / 100)}  ·  steal break-even ${(solved.sbbe0 * 100).toFixed(1)}%`);

  const rows = asRows<any>(await db.execute(sql`
    select st.cid, st.name, st.pos, st.is_pitcher, c.ratings, c.bats, c.card_value
    from league_stints st
    join league_snapshots ls on ls.id = st.snapshot_id
    join cards c on c.card_id = st.cid
    where ls.league = ${LEAGUE} and ls.split = 'all' and ls.captured_on = ${ON}
      and st.org = ${TEAM}`));
  let pool = rows.map((r) => ({
    cardId: r.cid, isPitcher: r.is_pitcher, bats: r.bats, ratings: r.ratings ?? {},
    role: r.pos, name: r.name, val: r.card_value,
  }));
  /** Mid-week roster changes the weekly export has not caught up with. */
  const EDIT = val("roster-edit");
  if (EDIT) {
    const e = JSON.parse(readFileSync(EDIT, "utf8"));
    const before = pool.length;
    pool = pool.filter((c) => !(e.drop ?? []).includes(c.name));
    for (const a of e.add ?? []) pool.push({ ...a, role: a.pos });
    for (const nm of e.addFromCards ?? []) {
      const [c] = asRows<any>(await db.execute(sql`
        select card_id, name, card_value, position, bats, ratings, is_pitcher, pitcher_role
        from cards where name = ${nm} order by card_value desc limit 1`));
      if (!c) { console.log(`!! ${nm} not in the cards table`); continue; }
      pool.push({ cardId: c.card_id, isPitcher: c.is_pitcher, bats: c.bats, ratings: c.ratings ?? {},
        role: c.is_pitcher ? c.pitcher_role : c.position, name: c.name, val: c.card_value });
    }
    console.log(`roster edit: ${before} -> ${pool.length}  (out: ${(e.drop ?? []).join(", ")} · in: ${[...(e.add ?? []).map((a: any) => a.name), ...(e.addFromCards ?? [])].join(", ")})`);
  }
  const fits = envFitMaps(pool as any, { era: era.rates, park: half });
  console.log(`\n+10 rating buys — LHB: ${marginalRatings(fits.envLeft, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                  RHB: ${marginalRatings(fits.envRight, "hit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);
  console.log(`                 arms: ${marginalRatings(fits.envPitch, "pit").map((v) => `${v.rating} ${f1(v.runs)}`).join("  ")}`);

  const bats = pool.filter((c) => !c.isPitcher);
  const arms = pool.filter((c) => c.isPitcher);
  const posOf = (c: any, p: string) => c.ratings[`Pos Rating ${p}`] ?? 0;
  const bestPos = (c: any) => Math.max(...HIT_POS.map((p) => posOf(c, p)));

  for (const board of ["R", "L"] as const) {
    const runs = (c: any) => (board === "R" ? fits.runsR : fits.runsL).get(c.cardId) ?? -1e6;
    // greedy assignment, scarce positions first
    const slots = DH ? [...HIT_POS, "DH"] : [...HIT_POS];
    const supply = (p: string) => p === "DH" ? 999 : bats.filter((c) => posOf(c, p) >= 0.6 * bestPos(c) && posOf(c, p) > 0).length;
    const order = [...slots].sort((a, b) => supply(a) - supply(b));
    const taken = new Set<number>(); const out: Record<string, any> = {};
    for (const p of order) {
      const cand = bats.filter((c) => !taken.has(c.cardId) && (p === "DH" || (posOf(c, p) > 0 && posOf(c, p) >= 0.6 * bestPos(c))))
        .sort((a, b) => runs(b) - runs(a))[0];
      if (cand) { out[p] = cand; taken.add(cand.cardId); }
    }
    const lineup = slots.map((p) => [p, out[p]] as const).filter(([, c]) => c)
      .sort((a, b) => runs(b[1]) - runs(a[1]));
    console.log(`\n--- lineup vs ${board === "R" ? "RHP" : "LHP"} ---`);
    lineup.forEach(([p, c], i) => {
      const side = batsLeftOn(c.bats, board) ? "park:L" : "park:R";
      const def = p === "DH" ? "" : ` DEF ${String(Math.round(posOf(c, p))).padStart(3)}/${String(Math.round(bestPos(c))).padStart(3)}`;
      console.log(`  ${i + 1}. ${p.padEnd(3)} ${c.name.slice(0, 22).padEnd(23)} ${String(c.val).padStart(3)} ${(c.bats ?? "-")}  ${f1(runs(c)).padStart(7)}  ${side}${def}`);
    });
    const bench = bats.filter((c) => !taken.has(c.cardId)).sort((a, b) => runs(b) - runs(a));
    console.log(`  bench: ${bench.map((c) => `${c.name} ${f1(runs(c))}`).join(" · ")}`);
  }

  console.log(`\n--- staff (runs saved per 700 BF, role adjustment applied) ---`);
  const ranked = arms.map((c) => ({ c, r: fits.runsR.get(c.cardId) ?? -1e6, rl: fits.runsL.get(c.cardId) ?? -1e6 }))
    .sort((a, b) => b.r - a.r);
  for (const { c, r, rl } of ranked) {
    const stm = c.ratings["Stamina"] ?? 0;
    console.log(`  ${(c.role ?? "").padEnd(3)} ${c.name.slice(0, 22).padEnd(23)} ${String(c.val).padStart(3)} ${f1(r).padStart(7)}  vsLHB ${f1(rl).padStart(6)}  STM ${String(Math.round(stm)).padStart(3)}  role ${f1(-roleRuns(c.role, stm))}`);
  }
  process.exit(0);
}
main();
