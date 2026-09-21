/**
 * RATINGS-BASED home-park pick — the answer park-pick.py gives from one
 * season's COUNTS, computed instead from what the cards actually are.
 *
 * WHY. park-pick.py scores a park off (own hits - allowed hits) for a single
 * 163-game week. Measured Sep 2026, that driver is not stable: L.J.'s HR-vs-RHB
 * edge was +42 on 2026-09-13 and -6 on 2026-09-20, and the two park rankings
 * barely overlap. Counts are one noisy season AND the roster turns over between
 * weeks. Ratings are the thing that persists.
 *
 * THE MODEL. A park multiplies BOTH clubs, so it only pays where you differ
 * from the field. For each park P:
 *     edge(P) = 0.5 * [ dTeam(P) - dField(P) ]
 *     dX(P)   = PA-weighted sum over X's bats of runs(P) - runs(neutral)
 *             + BF-weighted sum over X's arms of runs(P) - runs(neutral)
 * runs() is envFitMaps' per-700 number: runs CREATED for a bat, runs SAVED for
 * an arm, so a hitter's park lifts the bats and cuts the arms and a club with
 * good pitching keeps more of the difference. The 0.5 is home games only.
 *
 * Bats are scored on the board their hand actually plays (switch hitters bat
 * opposite the arm, so they get the friendly side of a platoon park).
 *
 * VARIANTS ARE HANDLED. This reads league_stints.ratings — the OWNED copy out
 * of the export — not cards.ratings, which is the base card. series-fit and
 * anything else on envFitMaps scores the Cy Young variant as the base card.
 *
 *   pnpm tsx scripts/park-sweep.ts --league HD451 --on 2026-09-20 \
 *     --team "Kansas City Torrent - JW" --year 2010 \
 *     --field HD450,HD451,HD452,HD453,PEL --top 20
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkTable } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number) => { const v = val(k); return v == null ? d : Number(v); };
const LEAGUE = val("league", "HD451")!, ON = val("on", "2026-09-20")!;
const TEAM = val("team", "Kansas City Torrent - JW")!;
const YEAR = val("year", "2010")!;
const FIELD = (val("field", "HD450,HD451,HD452,HD453,PEL")!).split(",");
const TOP = num("top", 20), MINPA = num("min-pa", 50);
const ONLY = val("parks") ?? null;          // comma-separated "Name@Year" shortlist
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

type Row = { cid: number; name: string; pos: string; org: string; is_pitcher: boolean;
             pa: number; ip: number; ratings: Record<string, number>; bats: string | null;
             throws: string | null; is_variant: boolean; val: number | null; copy: Record<string, number> | null };

/**
 * league_stints.ratings is the LEAGUE export's compact schema (CON/EYE/POW/STU)
 * with no vL/vR boards, so it cannot drive envFitMaps. Ratings come from
 * cards.ratings, with the owned copy overlaid from the latest collection upload
 * for his own club - that is what keeps a variant from scoring as its base card.
 */
const load = async (leagues: string[], upload: number) => asRows<Row>(await db.execute(sql`
  select st.cid, st.name, st.pos, st.org, st.is_pitcher, st.pa, st.ip,
         c.ratings as ratings, st.is_variant, st.val, c.bats, c.throws,
         (select cc.ratings from collection_cards cc
           where cc.upload_id = ${upload} and cc.card_id = st.cid
           order by (cc.is_variant = st.is_variant) desc, cc.id limit 1) as copy
  from league_stints st
  join league_snapshots ls on ls.id = st.snapshot_id
  join cards c on c.card_id = st.cid
  where ls.split = 'all' and ls.captured_on = ${ON}
    and ls.league = any(${sql.raw(`array[${leagues.map((l) => `'${l}'`).join(",")}]`)})
    and st.org <> '-'`));

/** BF ~= IP*4.3 at these run levels; only the RATIO across a staff matters. */
const weightOf = (r: Row) => (r.is_pitcher ? Number(r.ip ?? 0) * 4.3 : Number(r.pa ?? 0));

function main() {
  const era = eraTable[YEAR];
  if (!era) { console.log(`no era row for ${YEAR}`); process.exit(1); }

  (async () => {
    const up = Number(asRows<any>(await db.execute(sql`select max(id) as id from uploads where kind='collection'`))[0].id);
    const all = await load(FIELD, up);
    for (const r of all) if (r.org === TEAM && r.copy) r.ratings = mergeCopyRatings(r.ratings, r.copy, r.pos);
    const mine = all.filter((r) => r.org === TEAM && r.ratings);
    if (!mine.length) { console.log(`${TEAM} not found on ${ON}`); process.exit(1); }
    const field = all.filter((r) => r.org !== TEAM && r.ratings && weightOf(r) >= MINPA);
    const nTeams = new Set(field.map((r) => r.org)).size;

    const pool = (rs: Row[]) => rs.map((r) => ({
      cardId: r.cid, isPitcher: r.is_pitcher, bats: r.bats, ratings: r.ratings, role: r.pos,
    }));
    console.log(`collection upload ${up} used for the owned-copy overlay`);

    /** PA/BF-weighted runs for a set of cards in one park, per team. */
    const scoreOf = (rows: Row[], p: any, perTeams: number) => {
      const fits = envFitMaps(pool(rows) as any, { era: era.rates, park: p });
      let s = 0;
      for (const r of rows) {
        const w = weightOf(r); if (!w) continue;
        // A bat plays the board its hand faces: L and S on the vs-RHP board.
        const board = r.is_pitcher ? null : (r.bats === "L" || r.bats === "S" ? "R" : "L");
        const v = r.is_pitcher
          ? 0.45 * (fits.runsL.get(r.cid) ?? 0) + 0.55 * (fits.runsR.get(r.cid) ?? 0)
          : (board === "R" ? fits.runsR.get(r.cid) : fits.runsL.get(r.cid)) ?? 0;
        s += (v * w) / 700;
      }
      return s / perTeams;
    };

    const base = { me: scoreOf(mine, null, 1), fld: scoreOf(field, null, nTeams) };
    console.log(`\n=== ${TEAM} · ${LEAGUE} ${ON} · run environment ${YEAR} ===`);
    console.log(`field: ${nTeams} teams from ${FIELD.join("/")}  ·  ${mine.length} own cards (${mine.filter((r)=>r.is_variant).length} variants, read from the export not the base card)`);
    console.log(`neutral: you ${f1(base.me)} runs vs a ${f1(base.fld)} field average  ->  ${f1(base.me - base.fld)} before any park`);

    const want = ONLY ? new Set(ONLY.split(",").map((s) => s.trim())) : null;
    const out: { label: string; p: any; edge: number; dMe: number; dF: number }[] = [];
    for (const [nm, years] of Object.entries(parkTable)) {
      for (const [yr, p] of Object.entries(years as any)) {
        const label = `${nm}@${yr}`;
        if (want && !want.has(label) && !want.has(nm)) continue;
        const dMe = scoreOf(mine, p, 1) - base.me;
        const dF = scoreOf(field, p, nTeams) - base.fld;
        out.push({ label: `${yr} ${nm}`, p, edge: 0.5 * (dMe - dF), dMe: 0.5 * dMe, dF: 0.5 * dF });
      }
    }
    out.sort((a, b) => b.edge - a.edge);
    const hdr = `${"park".padEnd(38)} ${"AvgL".padStart(5)} ${"AvgR".padStart(5)} ${"HRL".padStart(5)} ${"HRR".padStart(5)} ${"2B".padStart(5)} ${"3B".padStart(5)} ${"you".padStart(7)} ${"field".padStart(7)} ${"edge".padStart(7)}`;
    console.log(`\nTop ${TOP} — runs over 81 home games vs the field in the same park (~10 runs = 1 win)`);
    console.log(hdr);
    const line = (o: any) => console.log(`${o.label.slice(0,38).padEnd(38)} ${o.p.avgL.toFixed(3).padStart(5)} ${o.p.avgR.toFixed(3).padStart(5)} ${o.p.hrL.toFixed(3).padStart(5)} ${o.p.hrR.toFixed(3).padStart(5)} ${o.p.d2.toFixed(3).padStart(5)} ${o.p.d3.toFixed(3).padStart(5)} ${f1(o.dMe).padStart(7)} ${f1(o.dF).padStart(7)} ${f1(o.edge).padStart(7)}`);
    out.slice(0, TOP).forEach(line);
    console.log(`\nBottom 5`); out.slice(-5).forEach(line);
    process.exit(0);
  })();
}
main();
