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
 *   pnpm tsx scripts/park-sweep.ts [--year 1989] [--top 20]
 *
 * --league is the export the ROSTER is read from; --field is who you play.
 * They are usually the same league, but on a promotion week they are not: the
 * roster is still in last week's export while the field is the tier you are
 * moving up into.
 *
 * --league / --team / --on / --field DEFAULT TO THE NEWEST DATA via
 * lib/league-scope and the resolved scope is printed. They used to be pinned
 * to HD451 / 2026-09-20 / "Kansas City Torrent - JW", which is right for one
 * week only: the team climbs a weekly ladder and the export appends the clan
 * tag to the org, so both the league and the name move. NOTE that --field
 * defaults to every league captured that week, which on a promotion week
 * includes the tier you just left — pass it explicitly (--field PEL) there.
 *
 * --add/--drop answer the park question for a roster you have not built yet.
 * A park pays a LHB park factor to a left-handed bat, so which bat you are
 * about to add can move the park ranking; --add "Fred McGriff" --drop "Roger
 * Connor" scores the park sweep as if that swap had already happened. Names
 * match on a case-insensitive substring; --add takes an optional @PA
 * ("Fred McGriff@600", default 600) because a card with no PA carries no
 * weight in a PA-weighted sum.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkTable } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { resolveLeagueScope } from "@/lib/league-scope";
import { fitEraYear } from "@/lib/analytics/league-era";
import { isMyOrg } from "@/lib/my-team";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number) => { const v = val(k); return v == null ? d : Number(v); };
const LEAGUE_ARG = val("league") ?? null, ON_ARG = val("on") ?? null;
const TEAM_ARG = val("team") ?? null;
const YEAR_ARG = val("year") ?? null;
let YEAR = "";
const FIELD_ARG = val("field")?.split(",") ?? null;
let LEAGUE = "", ON = "", TEAM = "", FIELD: string[] = [];
const TOP = num("top", 20), MINPA = num("min-pa", 50);
const ONLY = val("parks") ?? null;            // comma-separated "Name@Year" shortlist
const ADD = (val("add") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const DROP = (val("drop") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const ADD_PA = num("add-pa", 600);
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

type Row = { league: string; cid: number; name: string; pos: string; org: string; is_pitcher: boolean;
             pa: number; ip: number; ratings: Record<string, number>; bats: string | null;
             throws: string | null; is_variant: boolean; val: number | null; copy: Record<string, number> | null };

/**
 * league_stints.ratings is the LEAGUE export's compact schema (CON/EYE/POW/STU)
 * with no vL/vR boards, so it cannot drive envFitMaps. Ratings come from
 * cards.ratings, with the owned copy overlaid from the latest collection upload
 * for his own club - that is what keeps a variant from scoring as its base card.
 */
const load = async (leagues: string[], upload: number) => asRows<Row>(await db.execute(sql`
  select ls.league as league, st.cid, st.name, st.pos, st.org, st.is_pitcher, st.pa, st.ip,
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

/**
 * A prospective bat, by name, off the card table — with the owned copy overlaid
 * when he already has one, for the same reason the roster rows get it. Picks
 * the highest card_value on a name collision and reports what it matched, so a
 * wrong "Hank Aaron" year is visible rather than silent.
 */
const findCard = async (name: string, upload: number) => asRows<any>(await db.execute(sql`
  select c.card_id, c.name, c.position, c.bats, c.is_pitcher, c.card_value, c.year, c.ratings,
         (select cc.ratings from collection_cards cc
           where cc.upload_id = ${upload} and cc.card_id = c.card_id order by cc.id limit 1) as copy
  from cards c
  where c.is_pitcher = false and c.ratings is not null and c.name ilike ${"%" + name + "%"}
  order by c.card_value desc nulls last, c.card_id limit 1`))[0] ?? null;

/** BF ~= IP*4.3 at these run levels; only the RATIO across a staff matters. */
const weightOf = (r: Row) => (r.is_pitcher ? Number(r.ip ?? 0) * 4.3 : Number(r.pa ?? 0));

function main() {
  (async () => {
    const sc = await resolveLeagueScope({ league: LEAGUE_ARG, team: TEAM_ARG, on: ON_ARG, field: FIELD_ARG });
    ({ league: LEAGUE, team: TEAM, on: ON, field: FIELD } = sc);
    console.log(sc.summary);
    for (const n of sc.notes) console.log(`  !! ${n}`);
    /*
     * The era is FITTED from the week's own play, not pinned. --year 2010 was
     * right for an ordinary week and wrong for a theme week (2026-09-20 ran
     * 1989, 2026-08-23 ran 1959), and a park scored in the wrong era is just a
     * different answer with nothing to flag it.
     */
    const eraFit = await fitEraYear(ON);
    YEAR = YEAR_ARG ?? eraFit?.year ?? "2010";
    if (YEAR_ARG) console.log(`era ${YEAR} from --year${eraFit ? ` (the ${ON} line fits ${eraFit.year})` : ""}`);
    else if (eraFit) console.log(eraFit.summary);
    else console.log(`era ${YEAR} — fallback, ${ON} has no hitter stat keys to fit from`);
    // checked here, not at the top: YEAR is not known until the week is.
    const era = eraTable[YEAR];
    if (!era) { console.log(`no era row for ${YEAR}`); process.exit(1); }
    const up = sc.upload;
    /*
     * Roster league and playing field are loaded together and split apart by
     * league below, because on a promotion week they are different leagues.
     */
    const all = await load([...new Set([LEAGUE, ...FIELD])], up);
    /* isMyOrg, not === TEAM: the org carries a clan tag that changes. */
    for (const r of all) if (isMyOrg(r.org) && r.copy) r.ratings = mergeCopyRatings(r.ratings, r.copy, r.pos);
    let mine = all.filter((r) => r.league === LEAGUE && isMyOrg(r.org) && r.ratings);
    if (!mine.length) { console.log(`${TEAM} not found in ${LEAGUE} on ${ON}`); process.exit(1); }

    for (const name of DROP) {
      const hit = mine.find((r) => r.name.toLowerCase().includes(name.toLowerCase()));
      if (!hit) { console.log(`--drop "${name}": not on the roster`); process.exit(1); }
      mine = mine.filter((r) => r !== hit);
      console.log(`drop  ${hit.name} (${hit.pos}, ${hit.is_pitcher ? `${Math.round(Number(hit.ip))} IP` : `${hit.pa} PA`})`);
    }
    for (const spec of ADD) {
      const at = spec.lastIndexOf("@");
      const name = at > 0 ? spec.slice(0, at) : spec;
      const pa = at > 0 ? Number(spec.slice(at + 1)) : ADD_PA;
      const c = await findCard(name, up);
      if (!c) { console.log(`--add "${name}": no bat by that name in the card table`); process.exit(1); }
      const ratings = c.copy ? mergeCopyRatings(c.ratings, c.copy, c.position) : c.ratings;
      mine.push({ league: LEAGUE, cid: Number(c.card_id), name: c.name, pos: c.position, org: TEAM,
        is_pitcher: false, pa, ip: 0, ratings, bats: c.bats, throws: null,
        is_variant: false, val: c.card_value, copy: null } as Row);
      console.log(`add   ${c.name} ${c.year} (${c.position}, bats ${c.bats}, value ${c.card_value}) at ${pa} PA${c.copy ? " — owned copy" : ""}`);
    }
    const field = all.filter((r) => FIELD.includes(r.league) && !isMyOrg(r.org) && r.ratings && weightOf(r) >= MINPA);
    const nTeams = new Set(field.map((r) => r.org)).size;

    const pool = (rs: Row[]) => rs.map((r) => ({
      cardId: r.cid, isPitcher: r.is_pitcher, bats: r.bats, ratings: r.ratings, role: r.pos,
    }));
    console.log(`collection upload ${up} used for the owned-copy overlay`);

    /**
     * PA/BF-weighted runs for a set of cards in one park, per team, split into
     * the bats' half and the arms' half. They answer different questions: a
     * park's HR factors pay the lineup and charge the rotation, so a park can
     * be a net gain while actively costing the staff runs. Printing only the
     * total hides that.
     */
    const scoreOf = (rows: Row[], p: any, perTeams: number) => {
      const fits = envFitMaps(pool(rows) as any, { era: era.rates, park: p, eraYear: Number(YEAR) });
      let bats = 0, arms = 0;
      for (const r of rows) {
        const w = weightOf(r); if (!w) continue;
        // A bat plays the board its hand faces: L and S on the vs-RHP board.
        const board = r.is_pitcher ? null : (r.bats === "L" || r.bats === "S" ? "R" : "L");
        const v = r.is_pitcher
          ? 0.45 * (fits.runsL.get(r.cid) ?? 0) + 0.55 * (fits.runsR.get(r.cid) ?? 0)
          : (board === "R" ? fits.runsR.get(r.cid) : fits.runsL.get(r.cid)) ?? 0;
        if (r.is_pitcher) arms += (v * w) / 700; else bats += (v * w) / 700;
      }
      return { total: (bats + arms) / perTeams, bats: bats / perTeams, arms: arms / perTeams };
    };

    const baseMe = scoreOf(mine, null, 1), baseFld = scoreOf(field, null, nTeams);
    const base = { me: baseMe.total, fld: baseFld.total };
    console.log(`\n=== ${TEAM} · ${LEAGUE} ${ON} · run environment ${YEAR} ===`);
    console.log(`field: ${nTeams} teams from ${FIELD.join("/")}  ·  ${mine.length} own cards (${mine.filter((r)=>r.is_variant).length} variants, read from the export not the base card)`);
    console.log(`neutral: you ${f1(base.me)} runs vs a ${f1(base.fld)} field average  ->  ${f1(base.me - base.fld)} before any park`);
    console.log(`  of which bats ${f1(baseMe.bats)} vs ${f1(baseFld.bats)} (${f1(baseMe.bats - baseFld.bats)})  ·  arms ${f1(baseMe.arms)} vs ${f1(baseFld.arms)} (${f1(baseMe.arms - baseFld.arms)})`);
    console.log(`  a run-suppressing park pays the side you are STRONGER on; which side that is, is the line above.`);
    if (ADD.length || DROP.length) {
      const pa = mine.reduce((t, r) => t + (r.is_pitcher ? 0 : Number(r.pa ?? 0)), 0);
      console.log(`roster as modified: ${mine.length} cards, ${pa} bat PA — a park's pay scales with PA, so compare runs only against a run made the same way`);
    }

    const want = ONLY ? new Set(ONLY.split(",").map((s) => s.trim())) : null;
    const out: { label: string; p: any; edge: number; dMe: number; dF: number; dBats: number; dArms: number }[] = [];
    for (const [nm, years] of Object.entries(parkTable)) {
      for (const [yr, p] of Object.entries(years as any)) {
        const label = `${nm}@${yr}`;
        if (want && !want.has(label) && !want.has(nm)) continue;
        const me = scoreOf(mine, p, 1);
        const dMe = me.total - base.me;
        const dF = scoreOf(field, p, nTeams).total - base.fld;
        out.push({ label: `${yr} ${nm}`, p, edge: 0.5 * (dMe - dF), dMe: 0.5 * dMe, dF: 0.5 * dF,
                   dBats: 0.5 * (me.bats - baseMe.bats), dArms: 0.5 * (me.arms - baseMe.arms) });
      }
    }
    out.sort((a, b) => b.edge - a.edge);
    const hdr = `${"park".padEnd(30)} ${"AvgL".padStart(5)} ${"AvgR".padStart(5)} ${"HRL".padStart(5)} ${"HRR".padStart(5)} ${"2B".padStart(5)} ${"3B".padStart(5)} ${"bats".padStart(6)} ${"arms".padStart(6)} ${"you".padStart(7)} ${"field".padStart(7)} ${"edge".padStart(7)}`;
    console.log(`\nTop ${TOP} — runs over 81 home games vs the field in the same park (~10 runs = 1 win)`);
    console.log(`bats/arms split "you" into the lineup's half and the staff's half, both vs neutral.`);
    console.log(hdr);
    const line = (o: any) => console.log(`${o.label.slice(0,30).padEnd(30)} ${o.p.avgL.toFixed(3).padStart(5)} ${o.p.avgR.toFixed(3).padStart(5)} ${o.p.hrL.toFixed(3).padStart(5)} ${o.p.hrR.toFixed(3).padStart(5)} ${o.p.d2.toFixed(3).padStart(5)} ${o.p.d3.toFixed(3).padStart(5)} ${f1(o.dBats).padStart(6)} ${f1(o.dArms).padStart(6)} ${f1(o.dMe).padStart(7)} ${f1(o.dF).padStart(7)} ${f1(o.edge).padStart(7)}`);
    out.slice(0, TOP).forEach(line);
    console.log(`\nBottom 5`); out.slice(-5).forEach(line);
    process.exit(0);
  })();
}
main();
