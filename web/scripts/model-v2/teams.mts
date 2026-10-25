/**
 * MODEL v2, step 1-2: one row per team-event, across run environments.
 *
 * Sources
 *   - tournament exports on disk: Tourney Data/Cap Exports/*.csv and the six
 *     PTCS 7 Championship brackets (Tourney Data/PTCS7 Championship/<b>_all.csv)
 *   - league seasons from the database (league_snapshots split 'all'), one
 *     row per team per league-week; 2026-10-01 is dropped (a mid-week copy of
 *     the 10-04 season). The week's era is fitted from its own play
 *     (league-era), except 10-04, which L.J. named (1952).
 *
 * Per team: games (sum of starts), runs for/against, the CURRENT model's
 * offence / defence / pitching in runs per game (env-fit in the event's own
 * environment; gloves × gloveScale), and roster traits weighted by playing
 * time. Jim-beater tournament teams are dropped.
 *
 *   node --import tsx scripts/model-v2/teams.mts   → $MV2_DIR/teams.json
 *
 * MV2_TOURDIR=Archive/Completed reads every archived export instead of the Cap
 * Exports (2026-10-25 defence test: 701 exports, the Cap Exports among them);
 * MV2_NO_LEAGUE=1 skips the league seasons. Each team row also carries `dpos`:
 * per position, PA per game ÷ 700 times the rating's gap to the unit's
 * PA-weighted field mean (lin), the part of that gap below −20 (lo) and above
 * +15 (hi), and production's glove runs (prod), all × gloveScale.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, parkFor, eraTable } from "@/lib/analytics/tournament-env";
import { fieldingRuns, framingRuns, gloveScale } from "@/lib/analytics/fielding";
import { parseLeagueExport, collectionVocab, type LeagueStint } from "@/lib/ingest/league";
import { formRatings } from "@/lib/card-forms";
import { scanForJimBeaters } from "@/lib/ingest/jim";
import { fitEraYear } from "@/lib/analytics/league-era";
import { loadObservedBook, observedRunsFrom } from "@/lib/analytics/observed-blend";
const OBS_KS = [20000, 5000, 1500, 500, 150];

const OUT = process.env.MV2_DIR ?? "/tmp/mv2";
mkdirSync(OUT, { recursive: true });
const sql = neon(process.env.DATABASE_URL!);
const ROOT = "..";
const CHAMP: Record<string, number> = { bronze: 9070002, silver: 9070003, gold: 9070004, diamond: 9070005, open: 9070006, cap: 9070008 };

/** A tournament export is parsed when its turn comes (`load`), so 700 archived exports never sit in memory together. */
type Unit = { kind: "tour" | "league"; id: string; year: number; stadium: string | null; stints?: LeagueStint[]; load?: () => LeagueStint[] };
const units: Unit[] = [];

// ---- tournaments
const tours = (await sql.query(`select id, series, env_year, stadium from tournaments`)) as any[];
const bySeries = new Map<string, any>();
for (const t of tours) if (t.series && !bySeries.has(t.series)) bySeries.set(t.series, t);
const capDir = `${ROOT}/${process.env.MV2_TOURDIR ?? "Tourney Data/Cap Exports"}`;
for (const f of readdirSync(capDir).filter((x) => x.endsWith(".csv"))) {
  const slug = f.replace(/_\d+\.csv$/, "");
  const t = bySeries.get(slug);
  if (!t) { console.log(`skip ${f}: no catalogue series ${slug}`); continue; }
  const load = () => parseLeagueExport(readFileSync(`${capDir}/${f}`, "utf8"), f).stints;
  units.push({ kind: "tour", id: f.replace(/\.csv$/, ""), year: t.env_year ?? 2010, stadium: t.stadium, load });
}
for (const [b, tid] of Object.entries(CHAMP)) {
  const t = tours.find((x) => x.id === tid);
  const f = `ptcs7champ${b}_1.csv`;
  const { stints } = parseLeagueExport(readFileSync(`${ROOT}/Tourney Data/PTCS7 Championship/${b}_all.csv`, "utf8"), f);
  units.push({ kind: "tour", id: `ptcs7champ${b}`, year: t.env_year, stadium: t.stadium, stints });
}

// ---- league seasons
const snaps = process.env.MV2_NO_LEAGUE ? [] : (await sql.query(`select id, league, captured_on::date::text on_ from league_snapshots where split = 'all' and captured_on::date <> '2026-10-01' order by captured_on, league`)) as any[];
const eraOf = new Map<string, number>();
for (const s of snaps) {
  if (eraOf.has(s.on_)) continue;
  if (s.on_ === "2026-10-04") { eraOf.set(s.on_, 1952); continue; }
  const fit = await fitEraYear(s.on_);
  eraOf.set(s.on_, fit ? Number(fit.year) || 2010 : 2010);
}
for (const s of snaps) {
  const rows = (await sql.query(`select cid, name, pos, org, is_pitcher, is_free_agent, is_variant, val, pa, ip, ratings, stats from league_stints where snapshot_id = $1`, [s.id])) as any[];
  let stints = rows.filter((r) => !r.is_free_agent).map((r) => ({ cid: r.cid, name: r.name, pos: r.pos, org: r.org, isPitcher: r.is_pitcher, isVariant: r.is_variant, pa: r.pa, ip: r.ip, ratings: r.ratings, stats: r.stats })) as unknown as LeagueStint[];
  // Snapshots imported before the parser kept R / Ra / GS: re-read the week's file from disk.
  if (!stints.some((x) => x.isPitcher && x.stats.GS_p != null)) {
    const folder = s.on_ === "2026-06-28" ? "2026-07-06" : s.on_;
    let files: string[] = [];
    try { files = readdirSync(`${ROOT}/League Data/${folder}`); } catch { /* no folder */ }
    const f = files.find((x) => x.toLowerCase().includes(String(s.league).toLowerCase()) && /_all\.csv/i.test(x));
    if (!f) { console.log(`skip ${s.league}@${s.on_}: no R/GS in the DB and no file on disk`); continue; }
    stints = parseLeagueExport(readFileSync(`${ROOT}/League Data/${folder}/${f}`, "utf8"), f).stints.filter((x) => !x.isFreeAgent);
  }
  units.push({ kind: "league", id: `${s.league}@${s.on_}`, year: eraOf.get(s.on_)!, stadium: null, stints });
}
console.log(`units: ${units.filter((u) => u.kind === "tour").length} tournament exports, ${units.filter((u) => u.kind === "league").length} league seasons; league eras ${JSON.stringify(Object.fromEntries(eraOf))}`);

// ---- card table
type CardRow = typeof cards.$inferSelect;
const card = new Map<number, CardRow>();
const tried = new Set<number>();
async function ensureCards(st: LeagueStint[]) {
  const ids = [...new Set(st.map((s) => s.cid).filter((x): x is number => x != null && !tried.has(x)))];
  ids.forEach((x) => tried.add(x));
  for (let i = 0; i < ids.length; i += 2000) for (const c of await db.select().from(cards).where(inArray(cards.cardId, ids.slice(i, i + 2000)))) card.set(c.cardId, c);
}

const out: any[] = [];
for (const u of units) {
  const era = eraFor(u.year) ?? { row: eraTable["0"] };
  const park = u.stadium ? parkFor(u.stadium).row : null;
  const uStints = u.stints ?? u.load!();
  await ensureCards(uStints);
  let stints = uStints.filter((s) => s.cid != null && card.has(s.cid));
  if (u.kind === "tour") {
    const jim = scanForJimBeaters(uStints);
    const bad = new Set(jim.flagged.map((x) => x.org));
    stints = stints.filter((s) => !bad.has(s.org));
  }
  /*
   * Variant copies as their own form (2026-10-17 audit: a quarter of tournament
   * play is variants, 4-5 points over the base card): id −cid, rated
   * formRatings(base, the copy's exported ratings). Before this every copy was
   * scored at the base card's ratings.
   */
  const fid = (s: LeagueStint) => (s.isVariant ? -s.cid! : s.cid!);
  const formRatingsOf = new Map<number, Record<string, number>>();
  for (const s of stints) {
    const id = fid(s);
    if (formRatingsOf.has(id)) continue;
    const c = card.get(s.cid!)!;
    const base = c.ratings as Record<string, number>;
    formRatingsOf.set(id, s.isVariant ? formRatings(base, collectionVocab(s.ratings ?? {}), c.position) : base);
  }
  const ids = [...formRatingsOf.keys()];
  // the field's handedness, from playing time
  let bfL = 0, bf = 0, paL = 0, pa = 0;
  for (const s of stints) {
    const c = card.get(s.cid!)!;
    if (s.isPitcher) { const b = s.stats.BF ?? 0; bf += b; if (c.throws === "L") bfL += b; }
    else { const p = s.stats.PA ?? 0; pa += p; paL += p * (c.bats === "L" ? 1 : c.bats === "S" ? 0.5 : 0); }
  }
  const lhp = bf ? bfL / bf : 0.3, lhb = pa ? paL / pa : 0.35;
  const pool = ids.map((id) => { const c = card.get(Math.abs(id))!; return { cardId: id, isPitcher: !!c.isPitcher, bats: c.bats, ratings: formRatingsOf.get(id)!, role: c.pitcherRole }; });
  const fits = envFitMaps(pool, { era: era.row.rates, park, eraYear: u.year, roleTrust: 0.25, leagueLhbShare: lhb, pitchLhbShare: lhb, tournamentTerms: u.kind === "tour" });
  const gs = gloveScale(era.row.rates);
  // Track record from OTHER event types only (this unit's own series excluded), tournaments only.
  let obs: Map<number, { runs: number; n: number }> | null = null;
  if (u.kind === "tour" && process.env.MV2_OBS) {
    const series = u.id.startsWith("ptcs7champ") ? u.id : u.id.replace(/_\d+$/, "");
    const exclude = u.id.startsWith("ptcs7champ") ? Object.keys(CHAMP).map((b) => `ptcs7champ${b}`) : [series];
    const both = (id: number) => { const r = fits.runsR.get(id), l = fits.runsL.get(id); return r == null || l == null ? null : (1 - lhp) * r + lhp * l; };
    obs = observedRunsFrom(await loadObservedBook(ids.filter((id) => id > 0), exclude), both);
  }
  const blend = (id: number, model: number, K: number) => { const o = obs?.get(id); return o && o.n > 0 ? (o.n * o.runs + K * model) / (o.n + K) : model; };
  // the field's glove at each position: PA-weighted rating at the listed position
  const fieldPos = new Map<string, number>();
  { const acc = new Map<string, [number, number]>();
    for (const s of stints) { if (s.isPitcher) continue; const rt = formRatingsOf.get(fid(s))![`Pos Rating ${s.pos}`]; const p = s.stats.PA ?? 0; if (!rt || !p) continue; const a = acc.get(s.pos) ?? [0, 0]; a[0] += p * rt; a[1] += p; acc.set(s.pos, a); }
    for (const [k, [a, b]] of acc) fieldPos.set(k, a / b); }
  const teams = new Map<string, any>();
  const T = (org: string) => { let t = teams.get(org); if (!t) { t = { unit: u.id, kind: u.kind, year: u.year, org, G: 0, W: 0, L: 0, R: 0, RA: 0, off: 0, def: 0, pit: 0, pitSP: 0, pitRP: 0, nSP: 0, nRP: 0, zr: 0, wraa: 0, pa: 0, bf: 0, bfSP: 0, lhbPA: 0, lhpBF: 0, tr: {} as Record<string, number> }; teams.set(org, t); } return t; };
  const addTr = (t: any, k: string, v: number | undefined, w: number) => { if (v == null || !Number.isFinite(v)) return; t.tr[k] = (t.tr[k] ?? 0) + v * w; t.tr[k + "#w"] = (t.tr[k + "#w"] ?? 0) + w; };
  for (const s of stints) {
    const c = card.get(s.cid!)!; const r = formRatingsOf.get(fid(s))!; const t = T(s.org);
    const R = fits.runsR.get(fid(s)), L = fits.runsL.get(fid(s));
    if (s.isPitcher) {
      const b = s.stats.BF ?? 0; t.G += s.stats.GS_p ?? 0; t.W += s.stats.W ?? 0; t.L += s.stats.L ?? 0; t.RA += s.stats.Ra ?? 0; t.bf += b;
      const starter = (s.stats.G_p ?? 0) > 0 ? (s.stats.GS_p ?? 0) >= 1 && (s.stats.GS_p ?? 0) >= 0.5 * (s.stats.G_p ?? 0) : s.pos === "SP";
      if (b > 0) { if (starter) t.nSP++; else t.nRP++; }
      if (R != null) { t.pit += (b * R) / 700; if (starter) t.pitSP += (b * R) / 700; else t.pitRP += (b * R) / 700; if (obs) for (const K of OBS_KS) t[`pit${K}`] = (t[`pit${K}`] ?? 0) + (b * blend(fid(s), R, K)) / 700; }
      if ((s.stats.GS_p ?? 0) > 0) t.bfSP += b;
      if (c.throws === "L") t.lhpBF += b;
      for (const k of ["Stuff", "Control", "pHR", "pBABIP", "Stamina"]) addTr(t, `arm ${k}`, r[k], b);
    } else {
      const p = s.stats.PA ?? 0; t.R += s.stats.R ?? 0; t.pa += p; t.zr += s.stats.ZR ?? 0; t.wraa += s.stats.wRAA ?? 0;
      if (R != null && L != null) { const m = (1 - lhp) * R + lhp * L; t.off += (p * m) / 700; if (obs) for (const K of OBS_KS) t[`off${K}`] = (t[`off${K}`] ?? 0) + (p * blend(fid(s), m, K)) / 700; }
      const rating = r[`Pos Rating ${s.pos}`];
      if (rating) t.def += (p * fieldingRuns(s.pos, rating) * gs) / 700;
      if (rating && fieldPos.has(s.pos)) {
        const rel = rating - fieldPos.get(s.pos)!, d = (t.dpos ??= {})[s.pos] ??= { lin: 0, lo: 0, hi: 0, prod: 0 };
        d.lin += (p * rel * gs) / 700; d.lo += (p * Math.min(rel + 20, 0) * gs) / 700; d.hi += (p * Math.max(rel - 15, 0) * gs) / 700; d.prod += (p * fieldingRuns(s.pos, rating) * gs) / 700;
      }
      // Catcher framing, kept apart from the glove so its own weight can be fitted (2026-10-18).
      if (s.pos === "C") t.frm = (t.frm ?? 0) + (p * framingRuns(r.CatcherFrame, u.year)) / 700;
      t.lhbPA += p * (c.bats === "L" ? 1 : c.bats === "S" ? 0.5 : 0);
      for (const k of ["Speed", "Stealing", "Baserunning", "Avoid Ks", "Power", "Eye", "BABIP", "Gap"]) addTr(t, `bat ${k}`, r[k], p);
    }
  }
  for (const t of teams.values()) {
    if (t.G < 5 || t.pa <= 0 || t.bf <= 0) continue;
    const tr: Record<string, number> = {};
    for (const k of Object.keys(t.tr)) if (!k.endsWith("#w")) tr[k] = t.tr[k] / t.tr[k + "#w"];
    tr["starter BF share"] = t.bfSP / t.bf; tr["LHB share"] = t.lhbPA / t.pa; tr["LHP share"] = t.lhpBF / t.bf;
    const ob: Record<string, number> = {};
    if (obs) for (const K of OBS_KS) { ob[`off${K}`] = (t[`off${K}`] ?? 0) / t.G; ob[`pit${K}`] = (t[`pit${K}`] ?? 0) / t.G; }
    out.push({ unit: t.unit, kind: t.kind, year: t.year, org: t.org, G: t.G, W: t.W, L: t.L, R: t.R, RA: t.RA, off: t.off / t.G, def: t.def / t.G, frm: (t.frm ?? 0) / t.G, pit: t.pit / t.G, pitSP: t.pitSP / t.G, pitRP: t.pitRP / t.G, nSP: t.nSP, nRP: t.nRP, zr: t.zr / t.G, wraa: t.wraa / t.G, tr, ob, dpos: Object.fromEntries(Object.entries(t.dpos ?? {}).map(([k, v]: [string, any]) => [k, { lin: v.lin / t.G, lo: v.lo / t.G, hi: v.hi / t.G, prod: v.prod / t.G }])) });
  }
  console.log(`${u.id.padEnd(34)} ${u.year} ${u.stadium ?? "neutral"}  teams ${[...teams.values()].filter((t) => t.G >= 5).length}`);
}
writeFileSync(`${OUT}/teams.json`, JSON.stringify(out));
console.log(`wrote ${out.length} team rows → ${OUT}/teams.json`);
process.exit(0);
