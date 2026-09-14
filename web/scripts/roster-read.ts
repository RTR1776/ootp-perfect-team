/**
 * Every card on the roster, read against a theme-week environment AND against
 * what it has actually been doing.
 *
 * Two independent reads per card, deliberately kept apart rather than blended:
 *
 *   MODEL    what the ratings are worth in THIS environment and park. It is the
 *            only thing that can price an environment nobody has played yet, and
 *            it is the only reason a 1989 read differs from a 2010 one.
 *   OBSERVED what the card did league-wide this season, pooled over every league
 *            and every owner, indexed to each week's own league mean. It cannot
 *            speak to 1989 at all, but it catches what the ratings do not say.
 *
 * Where they agree, act. Where they disagree hard, the observed season wins on
 * level and the model still wins on which direction the environment pushes.
 *
 *   pnpm roster:read --park "Baker Bowl" --park-year 1921 --dh \
 *     --roster-edit ../Inbox/roster-edit-2026-09-14.json --json out.json
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { roleRuns, hitterRates, pitcherRates, cardRuns, envFor } from "@/lib/analytics/card-value";
import { linearWeights, NEUTRAL_PARK } from "@/lib/analytics/run-env";
import { HIT_POS } from "@/lib/roster-fill";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const LEAGUE = val("league", "HD453")!, TEAM = val("team", "Kansas City Torrent")!;
const YEAR = val("year", "1989")!, ON = val("on", "2026-09-13")!;
const PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const OUT = val("json");

async function main() {
  const era = eraTable[YEAR]!, base = eraTable["0"]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  const half = pr ? { avgL: 1 + (pr.avgL! - 1) / 2, avgR: 1 + (pr.avgR! - 1) / 2,
    hrL: 1 + (pr.hrL! - 1) / 2, hrR: 1 + (pr.hrR! - 1) / 2,
    d2: 1 + (pr.d2! - 1) / 2, d3: 1 + (pr.d3! - 1) / 2 } as any : null;

  const rows = asRows<any>(await db.execute(sql`
    select st.cid, st.name, st.pos, st.is_pitcher, c.ratings, c.bats, c.card_value
    from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
    join cards c on c.card_id = st.cid
    where ls.league = ${LEAGUE} and ls.split='all' and ls.captured_on = ${ON} and st.org = ${TEAM}`));
  let pool = rows.map((r) => ({ cardId: r.cid, isPitcher: r.is_pitcher, bats: r.bats,
    ratings: r.ratings ?? {}, role: r.pos, name: r.name, val: r.card_value }));
  const EDIT = val("roster-edit");
  if (EDIT) {
    const e = JSON.parse(readFileSync(EDIT, "utf8"));
    pool = pool.filter((c) => !(e.drop ?? []).includes(c.name));
    for (const a of e.add ?? []) pool.push({ ...a, role: a.pos });
    for (const nm of e.addFromCards ?? []) {
      const [c] = asRows<any>(await db.execute(sql`
        select card_id, name, card_value, position, bats, ratings, is_pitcher, pitcher_role
        from cards where name = ${nm} order by card_value desc limit 1`));
      if (c) pool.push({ cardId: c.card_id, isPitcher: c.is_pitcher, bats: c.bats, ratings: c.ratings ?? {},
        role: c.is_pitcher ? c.pitcher_role : c.position, name: c.name, val: c.card_value });
    }
  }

  /* model, in the theme environment AND in the league's usual one, so the
     DIFFERENCE says what the theme week does to each card specifically */
  const themeFits = envFitMaps(pool as any, { era: era.rates, park: half });
  const baseFits = envFitMaps(pool as any, { era: base.rates, park: null });

  /* observed, league-wide, latest three weeks weighted */
  const ids = pool.map((c) => c.cardId);
  const obsRows = asRows<any>(await db.execute(sql`
    with wk as (
      select ls.captured_on::text wk, st.cid, st.is_pitcher,
        case when st.is_pitcher then (st.stats->>'BF')::numeric else st.pa::numeric end w,
        case when st.is_pitcher then (st.stats->>'ER')::numeric else (st.stats->>'wRAA')::numeric end num
      from league_stints st join league_snapshots ls on ls.id=st.snapshot_id where ls.split='all'),
    ok as (select * from wk where w>0 and num is not null),
    lgm as (select wk, is_pitcher, sum(num)/sum(w) mean from ok group by 1,2)
    select o.cid, o.wk, sum(o.w) w, sum((o.num/o.w - l.mean)*o.w)/nullif(sum(o.w),0) above, bool_or(o.is_pitcher) isp
    from ok o join lgm l on l.wk=o.wk and l.is_pitcher=o.is_pitcher
    where o.cid in (${sql.join(ids.map((i: number) => sql`${i}`), sql`, `)})
    group by 1,2 order by 1,2`));
  const obs = new Map<number, { wk: string; w: number; a: number }[]>();
  for (const r of obsRows) {
    const a = obs.get(r.cid) ?? []; 
    a.push({ wk: r.wk, w: Number(r.w), a: Number(r.above) * 700 * (r.isp ? -1 : 1) });
    obs.set(r.cid, a);
  }

  const out: any[] = [];
  for (const c of pool) {
    const series = (obs.get(c.cardId) ?? []).filter((x) => x.w >= 300);
    const recent = series.slice(-3);
    const obsNow = recent.length ? recent.reduce((a, b) => a + b.a * b.w, 0) / recent.reduce((a, b) => a + b.w, 0) : null;
    let slope: number | null = null;
    if (series.length >= 3) {
      const n = series.length, mx = (n - 1) / 2, my = series.reduce((a, b) => a + b.a, 0) / n;
      let sxy = 0, sxx = 0;
      series.forEach((s, i) => { sxy += (i - mx) * (s.a - my); sxx += (i - mx) ** 2; });
      slope = sxx > 0 ? sxy / sxx : 0;
    }
    const pos = HIT_POS.map((p) => ({ p, v: Math.round(c.ratings[`Pos Rating ${p}`] ?? 0) })).filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    out.push({
      name: c.name, val: c.val, bats: c.bats, role: c.role, isPitcher: c.isPitcher,
      themeR: themeFits.runsR.get(c.cardId) ?? null, themeL: themeFits.runsL.get(c.cardId) ?? null,
      baseR: baseFits.runsR.get(c.cardId) ?? null,
      obs: obsNow, slope, weeks: series.length, pos,
      stm: Math.round(c.ratings["Stamina"] ?? 0),
      key: c.isPitcher
        ? { STU: c.ratings["Stuff"], CON: c.ratings["Control"], pHR: c.ratings["pHR"], pBAB: c.ratings["pBABIP"] }
        : { K: c.ratings["Avoid Ks"], BABIP: c.ratings["BABIP"], POW: c.ratings["Power"], GAP: c.ratings["Gap"], EYE: c.ratings["Eye"] },
    });
  }
  out.sort((a, b) => (b.themeR ?? -1e9) - (a.themeR ?? -1e9));
  const f = (v: number | null, d = 1) => v == null ? "  —  " : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
  console.log(`\n${TEAM} — every card in ${YEAR}${pr ? ` @ ${PARK_YEAR} ${PARK}` : ""} · ${pool.length} cards\n`);
  console.log(`  card                  val B  1989vR   1989vL   2010vR   Δenv    observed  trend  best pos`);
  for (const o of out.filter((x) => !x.isPitcher)) {
    const d = o.themeR != null && o.baseR != null ? o.themeR - o.baseR : null;
    console.log(`  ${o.name.slice(0,20).padEnd(21)} ${String(o.val).padStart(3)} ${(o.bats??"-")}  ${f(o.themeR).padStart(6)}  ${f(o.themeL).padStart(6)}  ${f(o.baseR).padStart(6)}  ${f(d).padStart(6)}   ${f(o.obs,0).padStart(5)}  ${o.slope==null?"  — ":f(o.slope,1).padStart(5)}  ${o.pos.slice(0,3).map((p:any)=>`${p.p} ${p.v}`).join(" · ")}`);
  }
  console.log(`\n  ARMS                  val    1989    vsLHB   2010    Δenv    observed  trend  STM  role`);
  for (const o of out.filter((x) => x.isPitcher)) {
    const d = o.themeR != null && o.baseR != null ? o.themeR - o.baseR : null;
    console.log(`  ${o.name.slice(0,20).padEnd(21)} ${String(o.val).padStart(3)}  ${f(o.themeR).padStart(6)}  ${f(o.themeL).padStart(6)}  ${f(o.baseR).padStart(6)}  ${f(d).padStart(6)}   ${f(o.obs,0).padStart(5)}  ${o.slope==null?"  — ":f(o.slope,1).padStart(5)}  ${String(o.stm).padStart(3)}  ${o.role}`);
  }
  if (OUT) { writeFileSync(OUT, JSON.stringify(out, null, 2)); console.log(`\nwrote ${OUT}`); }
  process.exit(0);
}
main();
