/**
 * League panel for the league model: one row per (week, league, split, team,
 * card copy). Each row carries:
 *   - the copy's split ratings on that board (vs LHP or vs RHP), variants included
 *   - its stats on that split
 *   - the app's tournament-calibrated model runs for that board, in that week's
 *     run environment
 *
 *   pnpm league:panel                 # -> ../Archive/.league-panel.csv
 *   python3 scripts/league-fit.py     # fits src/data/league-model.json from it
 *
 * TWO SOURCES, best first, per (week, league, split):
 *   1. The raw export in League Data/<week>/ (e.g. hd451_vL.csv). Its rows
 *      carry the exact split ratings every copy played with.
 *   2. The database's league_snapshots / league_stints, for weeks that are
 *      imported but not on disk here (uploads from another machine, the
 *      current week). Split ratings come from the stint itself when it was
 *      imported after 2026-09-26 (the parser keeps them now). Before that,
 *      they come from the shop's base card; a variant copy takes the base
 *      splits moved by its own overall boost. Those rows are marked
 *      `src = db-approx`.
 * When a week-league-split was imported more than once (a mid-week upload,
 * then the full week), the newest snapshot wins.
 *
 * THEME WEEKS. The league's run environment changes. Ordinary weeks play the
 * PT default (they fit 2010-2013); theme weeks jump (2026-08-23 fits 1959,
 * 2026-09-20 fits 1989). Each week is scored in its own environment: the
 * fitted year when league-era calls it a theme week, the PT default otherwise.
 * Without DATABASE_URL, only files are read and every week is scored in the
 * default, with a warning.
 *
 * Each row also carries scale_<rating>: what +10 of that rating is worth to an
 * average card in the week's environment, over what it is worth in the PT
 * default. It is 1 in an ordinary week. The fit multiplies the league's own
 * rating terms by it, so a term learned in 2010-type weeks carries into a
 * theme week at that environment's price.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { dropSuperseded } from "@/lib/league-arms";
import { dirname, join } from "node:path";
import { sql } from "drizzle-orm";
import { parseCsv, num } from "@/lib/ingest/csv";
import { hand, parseLeagueFilename, resolveRatingCols } from "@/lib/ingest/league";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { envFor, marginalRatings } from "@/lib/analytics/card-value";
import { linearWeights, type EraRates } from "@/lib/analytics/run-env";
import { eraFor, eraTable } from "@/lib/analytics/tournament-env";
import { fitEraYear } from "@/lib/analytics/league-era";

const ROOT = join(process.cwd(), "..", "League Data");
const OUT = process.argv[2] ?? join(process.cwd(), "..", "Archive", ".league-panel.csv");
const HAS_DB = !!process.env.DATABASE_URL;
const PIT = ["STU", "CON", "PBABIP", "HRA"] as const;
/** The export's stat columns, and the database's name for each (STAT_COLS in ingest/league). */
const STATS: Array<[csv: string, db: string]> = [
  ["PA", "PA"], ["AB", "AB"], ["H", "H"], ["1B_1", "b1"], ["2B_1", "b2"], ["3B_1", "b3"], ["HR", "HR"], ["BB", "BB"], ["IBB", "IBB"],
  ["HP", "HP"], ["SF", "SF"], ["K", "K"], ["SB", "SB"], ["CS", "CS"], ["BF", "BF"], ["K_1", "Ka"], ["BB_1", "BBa"], ["HP_1", "HPa"],
  ["HR_1", "HRa"], ["R_1", "Ra"], ["ER", "ER"], ["IP", "IP_raw"], ["G_1", "G_p"], ["GS_1", "GS_p"],
];
/** Hitter split ratings: the export's column stem, the shop's rating name, the stint key. */
const HIT: Array<[col: string, shop: string, stint: string]> = [
  ["K", "Avoid K", "Kav"], ["BA", "BABIP", "BABr"], ["GAP", "Gap", "GAP"], ["POW", "Power", "POW"], ["EYE", "Eye", "EYE"],
];
const HIT_OVERALL: Record<string, string> = { "Avoid K": "Avoid Ks", BABIP: "BABIP", Gap: "Gap", Power: "Power", Eye: "Eye" };

type Out = Record<string, string | number | null>;
type Job = { week: string; league: string; split: "vL" | "vR"; src: "file" | "db"; file?: string; snapshotId?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));

/** +10 rating value in an environment, per hitting rating, from the app's marginal line. */
const worth = (rates: EraRates) => {
  const env = envFor(rates, null, linearWeights(rates));
  return Object.fromEntries(marginalRatings(env, "hit").map((v) => [v.rating, v.runs]));
};
const BASE_WORTH = worth((eraTable["0"] ?? eraTable["2010"]).rates);
const RATING_OF: Record<string, string> = { K: "Avoid Ks", BA: "BABIP", GAP: "Gap", POW: "Power", EYE: "Eye" };

async function envOf(week: string): Promise<{ year: number; themed: boolean }> {
  if (!HAS_DB) return { year: 2010, themed: false };
  const fit = await fitEraYear(week).catch(() => null);
  return fit?.themed ? { year: Number(fit.year), themed: true } : { year: 2010, themed: false };
}

async function main() {
  if (!HAS_DB) console.warn("!! no DATABASE_URL: files only, every week scored in the PT default environment, theme weeks included");
  const jobs = new Map<string, Job>();
  if (existsSync(ROOT)) {
    for (const week of readdirSync(ROOT).sort()) {
      const dir = join(ROOT, week);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir)) {
        if (!/\.csv$/i.test(file)) continue;
        const { league, split } = parseLeagueFilename(file.replace(/\.csv\.csv$/i, ".csv"));
        if (!league || split === "all") continue;
        jobs.set(`${week}|${league}|${split}`, { week, league, split, src: "file", file: join(dir, file) });
      }
    }
  }
  const { db } = HAS_DB ? await import("@/db/client") : { db: null };
  if (db) {
    const snaps = asRows(await db.execute(sql`
      select distinct on (captured_on, league, split) id, captured_on::text wk, league, split
      from league_snapshots where split in ('vL', 'vR') order by captured_on, league, split, id desc`));
    // One season once: a mid-season upload is dropped when the same league was captured again within the week.
    const bySplit = (sp: string) => dropSuperseded(snaps.filter((s: any) => s.split === sp).map((s: any) => ({ ...s, on: String(s.wk) }))) as any[];
    for (const s of [...bySplit("vL"), ...bySplit("vR")]) {
      const key = `${s.wk}|${s.league}|${s.split}`;
      if (!jobs.has(key)) jobs.set(key, { week: s.wk, league: s.league, split: s.split, src: "db", snapshotId: Number(s.id) });
    }
  }
  const cards = db ? asRows(await db.execute(sql`select card_id, bats, ratings from cards`)) : [];
  const cardById = new Map(cards.map((c) => [Number(c.card_id), c]));

  const rows: Out[] = [];
  const envCache = new Map<string, { year: number; themed: boolean }>();
  for (const job of [...jobs.values()].sort((a, b) => `${a.week}${a.league}${a.split}`.localeCompare(`${b.week}${b.league}${b.split}`))) {
    if (!envCache.has(job.week)) {
      envCache.set(job.week, await envOf(job.week));
      const e = envCache.get(job.week)!;
      if (e.themed) console.log(`${job.week}: theme week, scored in ${e.year}`);
    }
    const env = envCache.get(job.week)!;
    const era = eraFor(env.year)?.row ?? eraTable["0"];
    const recs: Out[] = [];
    const pool: Parameters<typeof envFitMaps>[0][number][] = [];
    const push = (rec: Out, isP: boolean, ratings: Record<string, number>) => {
      rec.rowid = rows.length + recs.length + 1;
      recs.push(rec);
      pool.push({ cardId: rec.rowid as number, isPitcher: isP, bats: (rec.bats as string) || null, role: isP ? (rec.pos as string) : null, ratings });
    };
    const w = worth(era.rates);
    const scales = Object.fromEntries(Object.entries(RATING_OF).map(([k, r]) => [`scale_${k}`, BASE_WORTH[r] ? Math.round((w[r] / BASE_WORTH[r]) * 1000) / 1000 : 1]));
    const base = { week: job.week, env_year: env.year, themed: env.themed ? 1 : 0, league: job.league, split: job.split, ...scales };

    if (job.src === "file") {
      const parsed = parseCsv(readFileSync(job.file!, "utf8"), { extraFields: "drop" });
      // Pitcher Control by its place in the pitching block: the 338-column view
      // also has hitter Contact under CON / CON vL / CON vR.
      const cols = new Map(resolveRatingCols(parsed.headers));
      const col = (name: string) => (name.startsWith("CON") ? cols.get(name) ?? "" : name);
      for (const r of parsed.rows) {
        const org = (r["ORG"] ?? "").trim(), pos = (r["POS"] ?? "").trim();
        if (!org || org === "-" || !pos) continue;
        const isP = pos === "SP" || pos === "RP" || pos === "CL";
        const rec: Out = { ...base, src: "file", org, pos, cid: num(r["CID"]), name: (r["Name"] ?? "").trim(), bats: hand(r["B"]) ?? "",
          val: num(r["VAL"]), var: (r["VAR"] ?? "").trim().toUpperCase() === "Y" ? 1 : 0, vlvl: num(r["VLvl"]), isP: isP ? 1 : 0, SPE: num(r["SPE"]), STM: num(r["STM"]) };
        for (const [csv] of STATS) rec[csv] = num(r[csv]) ?? 0;
        const ratings: Record<string, number> = {};
        if (!isP) {
          for (const hs of ["vL", "vR"]) for (const [col, shop] of HIT) {
            const v = num(r[`${col} ${hs}`]); rec[`${col}_${hs}`] = v;
            if (v != null) ratings[`${shop} ${hs}`] = v;
          }
        } else {
          for (const ps of ["vL", "vR"]) for (const k of PIT) rec[`${k}_${ps}`] = num(r[col(`${k} ${ps}`)]);
          for (const [shop, name] of [["Stuff", "STU"], ["Control", "CON"], ["pBABIP", "PBABIP"], ["pHR", "HRA"]] as const) {
            const v = num(r[col(name)]); if (v != null) ratings[shop] = v;
            for (const ps of ["vL", "vR"]) { const w = num(r[col(`${name} ${ps}`)]); if (w != null) ratings[`${shop} ${ps}`] = w; }
          }
          if (rec.STM != null) ratings.Stamina = rec.STM as number;
        }
        push(rec, isP, ratings);
      }
    } else {
      const stints = asRows(await db!.execute(sql`
        select cid, name, pos, org, val, is_variant, is_pitcher, ratings, stats from league_stints
        where snapshot_id = ${job.snapshotId} and not is_free_agent`));
      for (const st of stints) {
        const isP = !!st.is_pitcher;
        const sr = (st.ratings ?? {}) as Record<string, number>, ss = (st.stats ?? {}) as Record<string, number>;
        const card = st.cid != null ? cardById.get(Number(st.cid)) : undefined;
        const cr = (card?.ratings ?? {}) as Record<string, number>;
        const rec: Out = { ...base, src: "db", org: st.org, pos: st.pos, cid: st.cid, name: st.name, bats: card?.bats ?? "", val: st.val,
          var: st.is_variant ? 1 : 0, vlvl: sr.VLvl ?? null, isP: isP ? 1 : 0, SPE: sr.SPE ?? null, STM: sr.STM ?? null };
        for (const [csv, key] of STATS) rec[csv] = ss[key] ?? 0;
        const ratings: Record<string, number> = {};
        if (!isP) {
          for (const hs of ["vL", "vR"]) for (const [col, shop, key] of HIT) {
            let v: number | null = sr[`${key} ${hs}`] ?? null;
            if (v == null && cr[`${shop} ${hs}`] != null) {
              // shop base card's split, moved by this copy's overall boost (0 for a base copy)
              const boost = (sr[key] ?? cr[HIT_OVERALL[shop]] ?? 0) - (cr[HIT_OVERALL[shop]] ?? 0);
              v = cr[`${shop} ${hs}`] + (st.is_variant ? boost : 0);
              rec.src = "db-approx";
            }
            rec[`${col}_${hs}`] = v;
            if (v != null) ratings[`${shop} ${hs}`] = v;
          }
        } else {
          for (const ps of ["vL", "vR"]) for (const k of PIT) {
            const key = k === "PBABIP" ? "PBAB" : k;
            const shop = { STU: "Stuff", CON: "Control", PBABIP: "pBABIP", HRA: "pHR" }[k];
            const v = sr[`${key} ${ps}`] ?? cr[`${shop} ${ps}`] ?? null;
            rec[`${k}_${ps}`] = v;
            if (v != null) ratings[`${shop} ${ps}`] = v;
          }
          if (rec.STM != null) ratings.Stamina = rec.STM as number;
        }
        push(rec, isP, ratings);
      }
    }
    const cal = envFitMaps(pool, { era: era.rates, park: null, roleTrust: 0.25, eraYear: env.year });
    const raw = envFitMaps(pool, { era: era.rates, park: null, roleTrust: 0.25, calibrate: false });
    const board = job.split === "vL" ? "L" : "R";
    for (const rec of recs) {
      const id = rec.rowid as number;
      rec.m_cal = (board === "L" ? cal.runsL : cal.runsR).get(id) ?? null;
      rec.m_raw = (board === "L" ? raw.runsL : raw.runsR).get(id) ?? null;
      rows.push(rec);
    }
    console.log(`${job.week} ${job.league} ${job.split} (${job.src}${env.themed ? `, ${env.year}` : ""}): ${recs.length} rostered rows`);
  }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, [cols.join(","), ...rows.map((r) => cols.map((c) => { const v = r[c]; return v == null ? "" : typeof v === "string" ? JSON.stringify(v) : String(v); }).join(","))].join("\n") + "\n");
  console.log(`${rows.length} rows -> ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
