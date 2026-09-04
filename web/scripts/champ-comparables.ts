/**
 * Rank every catalogued tournament by how close its run environment sits to each
 * PTCS championship berth, and say whether we hold card-level exports for it.
 *
 *   pnpm champ:comps        (needs DATABASE_URL exported from web/.env.local)
 *
 * Writes scripts/.champ-comparables.json (full 104-row ranking per berth) and
 * prints the top 10 + the top 5 that actually have observed data. Feeds
 * "PTCS6 Championship Comparables.html" at the repo root.
 */
import { writeFileSync } from "node:fs";
import { db } from "../src/db/client";
import { tournaments, seriesMeta, observedCardStats } from "../src/db/schema";
import { sql } from "drizzle-orm";
import {
  OFFENSE_KEYS, STRATEGY_KEYS, distance, eraFor, parkFor, solveFor, spreads, vectorOf,
} from "../src/lib/analytics/tournament-env";

const WANT = ["Bronze", "Silver", "Gold", "Diamond", "Cap"];

async function main() {
  const all = await db.select().from(tournaments);
  const sm = await db.select().from(seriesMeta);
  const smBy = new Map(sm.map((s) => [s.series, s]));
  const agg = await db.execute(sql`
    select series,
           count(*)::int as rows,
           sum(case when is_pitcher then 0 else 1 end)::int as hitters,
           sum(pa)::int as pa, sum(ip)::float as ip
    from observed_card_stats group by series`);
  const aggRows = (Array.isArray(agg) ? agg : (agg as any).rows) as any[];
  const aggBy = new Map(aggRows.map((r) => [r.series, r]));

  const champ = all.filter((t) => t.series === "PTCS 6 Championship");
  const cands = all.filter((t) => t.series !== "PTCS 6 Championship" && !t.isDraft);

  const envOf = (t: typeof all[number]) => {
    const e = eraFor(t.envYear); if (!e) return null;
    const p = parkFor(t.stadium);
    return { park: p, era: e, v: vectorOf(solveFor(e.row, p.row)) };
  };

  const withEnv = cands.flatMap((t) => { const e = envOf(t); return e ? [{ t, ...e }] : []; });
  const sd = spreads(withEnv.map((r) => r.v), [...OFFENSE_KEYS, ...STRATEGY_KEYS]);

  const out: any[] = [];
  for (const name of WANT) {
    const c = champ.find((x) => (x.restrictions as any)?.category === name)!;
    const ce = envOf(c)!;
    const rows = withEnv.map((r) => {
      const s = r.t.series ? smBy.get(r.t.series) : null;
      const a = r.t.series ? aggBy.get(r.t.series) : null;
      return {
        id: r.t.id, name: r.t.name, envYear: r.t.envYear, eraLabel: r.era.label,
        stadium: r.t.stadium, park: r.park.label, dh: r.t.dh,
        valMin: r.t.ratingsMin, valMax: r.t.ratingsMax,
        yrMin: r.t.cardYearMin, yrMax: r.t.cardYearMax,
        teamCap: (r.t.restrictions as any)?.teamCap ?? null,
        entrants: r.t.entrants, retired: r.t.retired,
        series: r.t.series, runs: s?.files ?? 0,
        cardRows: a?.rows ?? 0, hitters: a?.hitters ?? 0, pa: a?.pa ?? 0, ip: a?.ip ?? 0,
        rg: r.v.rg, k: r.v.k, hr: r.v.hr, b1: r.v.b1, b2: r.v.b2, preset: r.v.preset,
        sameParkName: !!(r.park.name && ce.park.name && r.park.name === ce.park.name),
        samePark: r.t.stadium === c.stadium,
        sameEra: r.t.envYear === c.envYear,
        sameDh: r.t.dh === c.dh,
        gapOff: distance(r.v, ce.v, OFFENSE_KEYS, sd),
        gapAll: distance(r.v, ce.v, [...OFFENSE_KEYS, ...STRATEGY_KEYS], sd),
      };
    }).sort((a, b) => a.gapOff - b.gapOff);
    out.push({
      category: name, id: c.id, envYear: c.envYear, eraLabel: ce.era.label,
      stadium: c.stadium, park: ce.park.label, dh: c.dh,
      valMin: c.ratingsMin, valMax: c.ratingsMax, teamCap: (c.restrictions as any)?.teamCap ?? null,
      yrMin: c.cardYearMin, yrMax: c.cardYearMax,
      announced: (c.restrictions as any)?.announcedText,
      target: { rg: ce.v.rg, k: ce.v.k, hr: ce.v.hr, b1: ce.v.b1, b2: ce.v.b2, preset: ce.v.preset,
                bunt: ce.v.bunt, sb: ce.v.sb },
      neutral: vectorOf(solveFor(ce.era.row, null)).rg,
      matches: rows,
    });
  }
  writeFileSync("scripts/.champ-comparables.json", JSON.stringify(out, null, 1));

  // value-band reference
  const bands = new Map<string, Set<string>>();
  for (const t of cands) {
    for (const tier of ["Iron","Bronze","Silver","Gold","Diamond"]) {
      if (t.name.includes(tier) && (t.ratingsMin || t.ratingsMax)) {
        if (!bands.has(tier)) bands.set(tier, new Set());
        bands.get(tier)!.add(`${t.ratingsMin}-${t.ratingsMax}`);
      }
    }
  }
  console.log("value bands seen in the catalog:");
  for (const [k, v] of bands) console.log(" ", k, [...v].join(" | "));

  for (const o of out) {
    console.log(`\n=== ${o.category}  (${o.envYear} RE, DH ${o.dh ? "on" : "off"}, ${o.stadium}) `.padEnd(78, "="));
    console.log(`   target: R/G ${o.target.rg.toFixed(2)} (neutral ${o.neutral.toFixed(2)}) · K ${(o.target.k*100).toFixed(1)}% · HR/PA ${(o.target.hr*100).toFixed(2)}% · 1B/PA ${(o.target.b1*100).toFixed(1)}% · 2B/PA ${(o.target.b2*100).toFixed(2)}%`);
    console.log(`   ${"gap".padStart(5)}  ${"R/G".padStart(5)} ${"K%".padStart(5)} ${"HR%".padStart(5)}  ${"runs".padStart(4)} ${"cards".padStart(5)} ${"PA".padStart(7)}  tournament`);
    for (const m of o.matches.slice(0, 10)) {
      console.log(`   ${m.gapOff.toFixed(2).padStart(5)}  ${m.rg.toFixed(2).padStart(5)} ${(m.k*100).toFixed(1).padStart(5)} ${(m.hr*100).toFixed(2).padStart(5)}  ${String(m.runs).padStart(4)} ${String(m.cardRows).padStart(5)} ${String(m.pa).padStart(7)}  ${m.name} [${m.envYear}] @ ${m.stadium ?? "-"} ${m.valMin!=null?`(${m.valMin}-${m.valMax})`:""}${m.retired?" RETIRED":""}`);
    }
    const best = o.matches.filter((m:any) => m.runs > 0).slice(0, 5);
    console.log(`   -- best WITH observed data --`);
    for (const m of best) console.log(`   ${m.gapOff.toFixed(2).padStart(5)}  ${m.rg.toFixed(2).padStart(5)} ${(m.k*100).toFixed(1).padStart(5)} ${(m.hr*100).toFixed(2).padStart(5)}  ${String(m.runs).padStart(4)} ${String(m.cardRows).padStart(5)} ${String(m.pa).padStart(7)}  ${m.name} [${m.envYear}] @ ${m.stadium ?? "-"}`);
  }
  process.exit(0);
}
main();
