/**
 * Aggregate L.J.'s per-tournament stat exports (Archive/Completed/*.csv) into
 * observed_card_stats: one row per (series, cardId, variant) with summed
 * counters, precomputed wOBA / FIP, and the ratings the copies played with
 * (a card's variant copies are their own row since 2026-10-17: they run 4-5
 * points over the base card, and a quarter of all play is variants).
 *
 * The files are the same 200-column export family as league exports, so the
 * league parser does the row work; the filename supplies the series
 * (earlygold_125.csv → series "earlygold", instance 125). CID in these
 * exports IS the shop's Card ID (verified 237/237 on real data), so the rows
 * join straight onto `cards`.
 *
 * Idempotent, and safe to fail: rows are STAGED against an import_batches
 * record, published with one upsert statement (a single statement is atomic
 * in Postgres, transactions or not), and only then are the rows the batch no
 * longer contains removed - so the live table is never empty or half-built
 * for a series, and replaying the same files changes no totals. Run on the
 * machine that has Archive/ (it is gitignored):
 *   pnpm import:observed                       # every series on disk
 *   pnpm import:observed --series slug,slug    # only those (what the filer
 *                                              # runs the moment a file lands)
 * With --series nothing outside those series is touched. A batch that fails
 * is recorded as failed and leaves the previous complete series in place.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { db } from "../src/db/client";
import {
  importBatches,
  observedCardStatsStage,
  seriesMeta,
  type ImportFile,
  type SeriesTopCard,
} from "../src/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { collectionVocab, parseLeagueExport, looksLikeLeagueExport } from "../src/lib/ingest/league";
import { ensureObservedVariantColumns } from "../src/lib/ingest/observed-schema";
import { wobaOf, fipOf } from "../src/lib/analytics/league";
import { scanForJimBeaters } from "../src/lib/ingest/jim";
import { summariseSeries, teamBuilds, type SeriesBuild, type TeamBuild } from "../src/lib/field-construction";
import { tournaments } from "../src/db/schema";
import { parseDump } from "../src/lib/analytics/dumps";
import { chicagoDay } from "../src/lib/format";
import { formatSplitSeries } from "../src/lib/format-split";
import { isMyOrg } from "../src/lib/my-team";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIR = join(ROOT, "Archive/Completed");
/** Bump when the aggregation changes meaning, so batches are comparable. */
const PARSER_VERSION = "observed/4 (variant copies their own row, with the ratings played, 2026-10-17)";

interface Agg {
  series: string;
  cardId: number;
  isVariant: boolean;
  isPitcher: boolean;
  name: string;
  pos: string;
  instances: number;
  pa: number;
  ip: number;
  war: number;
  counters: Record<string, number>;
  /** The copies' ratings (collection vocabulary), summed × playing time, and that time. */
  ratingSum: Record<string, number>;
  ratingW: number;
}

/** Per-series usage meta (roster shape + card popularity), built per file. */
interface Meta {
  files: number;
  teamStints: number;
  sp: number;
  rp: number;
  bats: number;
}

/** Result rows from db.execute, whichever driver answered. */
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const r = result as { rows?: Array<Record<string, unknown>> };
  return r.rows ?? [];
}

/**
 * A batch still "staged" hours later is a process that died between staging
 * and publish. Mark it failed and drop its staging rows (and any left behind
 * by an already-finished batch) so the stage table cannot grow unbounded.
 */
async function sweepAbandonedBatches() {
  await db
    .update(importBatches)
    .set({ status: "failed", error: "abandoned: still staged 2h after start (process died before publish)" })
    .where(and(eq(importBatches.status, "staged"), lt(importBatches.startedAt, new Date(Date.now() - 2 * 3600_000))));
  await db.execute(sql`
    DELETE FROM observed_card_stats_stage s USING import_batches b
    WHERE b.id = s.batch_id AND b.status <> 'staged'`);
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`No ${DIR} on this machine — run where the Archive lives.`);
    process.exit(1);
  }
  /*
   * FORMAT SPLIT (2026-10-01). A weekly that changed format keeps its slug, so
   * its old runs and new runs used to land in one series and /build had to set
   * the whole series aside (Splendid Silver's run #27, Deadball's run #27).
   * Each file's run date comes from the newest tournaments dump (event id =
   * slot x 10000 + run); a run before its event's restrictions.formatSince is
   * filed under "<slug>-preYYYYMMDD", where it still counts as each card's play
   * elsewhere but is no longer this event's own. Each file records its run day
   * and the series it went to (exportsPredate reads both).
   */
  const dated = await db.select({ series: tournaments.series, slot: tournaments.slot, restrictions: tournaments.restrictions }).from(tournaments);
  const split = new Map<string, { slot: number; since: string }>();
  for (const t of dated) {
    const since = (t.restrictions as { formatSince?: string } | null)?.formatSince;
    if (t.series && t.slot != null && since) split.set(t.series, { slot: t.slot, since });
  }
  const runStart = new Map<number, number>();
  const dumpDir = join(ROOT, "Tourney Data");
  const dumpFile = existsSync(dumpDir) ? readdirSync(dumpDir).filter((x) => /^pt27_tournaments_.*\.csv$/.test(x)).sort().at(-1) : undefined;
  if (dumpFile) for (const e of parseDump(readFileSync(join(dumpDir, dumpFile), "utf8"))?.events ?? []) runStart.set(Number(e.id), e.start);
  const runOnOf = (slug: string, run: number): string | null => {
    const s = split.get(slug);
    const at = s ? runStart.get(s.slot * 10000 + run) : undefined;
    return at != null ? chicagoDay(new Date(at * 1000)) : null;
  };

  const onlyArg = process.argv[process.argv.indexOf("--series") + 1];
  // --dated: every series whose event has a format date (the ones the split can move).
  const only = process.argv.includes("--dated")
    ? new Set(split.keys())
    : process.argv.includes("--series") && onlyArg
      ? new Set(onlyArg.split(",").map((x) => x.trim()).filter(Boolean))
      : null;
  const files = readdirSync(DIR).filter((f) => f.endsWith(".csv") && (!only || only.has(f.replace(/_\d+\.csv$/i, ""))));
  if (only && !files.length) { console.error(`no files in ${DIR} for series ${[...only].join(", ")}`); process.exit(1); }
  const aggs = new Map<string, Agg>();
  const metas = new Map<string, Meta>();
  const fileMeta: Array<ImportFile & { series?: string; runOn?: string; mine?: Array<{ cid: number; name: string; pos: string; variant: boolean; pa: number; ip: number; war: number }>; dropped?: Array<{ org: string; games: number; rs: number; ra: number }> }> = [];
  let parsed = 0, skipped = 0, droppedTeams = 0, droppedStints = 0;
  /** Per series, each run's teams: which tiers went to bats, bench, SP and RP (field-construction.ts). */
  const builds = new Map<string, TeamBuild[][]>();

  for (const f of files) {
    const slug = f.replace(/_\d+\.csv$/i, "");
    if (slug === f) { skipped++; continue; }
    const run = Number(/_(\d+)\.csv$/i.exec(f)?.[1]);
    const runOn = runOnOf(slug, run);
    const since = split.get(slug)?.since;
    const series = formatSplitSeries(slug, runOn, since);
    const raw = readFileSync(join(DIR, f));
    const text = raw.toString("utf8");
    const headerLine = text.slice(0, text.indexOf("\n"));
    if (!looksLikeLeagueExport(headerLine)) { skipped++; continue; }
    const { stints: allStints } = parseLeagueExport(text, f);
    parsed++;
    /**
     * JIM TEAMS. A team that drew a no-roster opponent carries four games of
     * 50-0 in every hitter's line and four shutouts in every pitcher's. The
     * placeholder players are not in the file, so the only clean cut is the
     * whole team (src/lib/ingest/jim.ts has the numbers). Which teams were
     * dropped is kept on the batch record, per file.
     */
    const jim = scanForJimBeaters(allStints);
    const jimOrgs = new Set(jim.flagged.map((x) => x.org));
    const stints = jimOrgs.size ? allStints.filter((s) => !s.org || !jimOrgs.has(s.org)) : allStints;
    droppedTeams += jimOrgs.size;
    droppedStints += allStints.length - stints.length;
    fileMeta.push({
      name: f, bytes: raw.byteLength, sha256: createHash("sha256").update(raw).digest("hex"),
      ...(runOn ? { runOn } : {}), ...(series !== slug ? { series } : {}),
      // L.J.'s own team in this run (L.J., 2026-10-01: "check what I ran last week").
      ...(() => {
        const mine = stints.filter((s) => isMyOrg(s.org) && s.cid != null && (s.pa > 0 || s.ip > 0))
          .map((s) => ({ cid: s.cid!, name: s.name, pos: s.pos, variant: !!s.isVariant, pa: Math.round(s.pa), ip: Math.round(s.ip * 10) / 10, war: Math.round(s.war * 100) / 100 }));
        return mine.length ? { mine } : {};
      })(),
      ...(jim.flagged.length ? { dropped: jim.flagged.map((x) => ({ org: x.org, games: x.games, rs: x.runsFor, ra: x.runsAgainst })) } : {}),
    });
    builds.set(series, [...(builds.get(series) ?? []), teamBuilds(stints)]);
    const perOrg = new Map<string, { sp: number; rp: number; bats: number }>();
    for (const s of stints) {
      if (s.cid == null) continue;
      if (s.pa <= 0 && s.ip <= 0) continue;
      const key = `${series} ${s.cid} ${s.isVariant ? "v" : "b"}`;
      let a = aggs.get(key);
      if (!a) {
        a = { series, cardId: s.cid, isVariant: !!s.isVariant, isPitcher: s.isPitcher, name: s.name, pos: s.pos, instances: 0, pa: 0, ip: 0, war: 0, counters: {}, ratingSum: {}, ratingW: 0 };
        aggs.set(key, a);
      }
      // The ratings this copy played with, weighted by its playing time (Live cards' move with updates).
      const use = s.pa + s.ip * 4.3;
      if (use > 0) {
        for (const [k, v] of Object.entries(collectionVocab(s.ratings ?? {}))) a.ratingSum[k] = (a.ratingSum[k] ?? 0) + v * use;
        a.ratingW += use;
      }
      a.instances += 1;
      a.pa += s.pa;
      a.ip += s.ip;
      a.war += s.war;
      for (const [k, v] of Object.entries(s.stats)) {
        if (k === "IP_raw" || k === "IP") continue; // decimal ip tracked separately
        a.counters[k] = (a.counters[k] ?? 0) + v;
      }
      if (s.org) {
        const o = perOrg.get(s.org) ?? { sp: 0, rp: 0, bats: 0 };
        if (s.isPitcher) {
          if (s.pos === "SP") o.sp += 1;
          else o.rp += 1; // RP + CL
        } else o.bats += 1;
        perOrg.set(s.org, o);
      }
    }
    const m = metas.get(series) ?? { files: 0, teamStints: 0, sp: 0, rp: 0, bats: 0 };
    m.files += 1;
    m.teamStints += perOrg.size;
    for (const o of perOrg.values()) { m.sp += o.sp; m.rp += o.rp; m.bats += o.bats; }
    metas.set(series, m);
  }

  const rows = [...aggs.values()].map((a) => {
    const stintLike = {
      stats: a.counters, ip: a.ip, pa: a.pa, use: a.pa + a.ip * 4.3,
      isPitcher: a.isPitcher, isFreeAgent: false, org: "", cid: a.cardId,
      name: "", pos: "", clan: null, val: null, tier: null, isVariant: false,
      cardYear: null, ratings: {}, war: a.war,
    };
    return {
      series: a.series,
      cardId: a.cardId,
      isVariant: a.isVariant,
      isPitcher: a.isPitcher,
      instances: a.instances,
      pa: Math.round(a.pa),
      ip: Math.round(a.ip * 100) / 100,
      war: Math.round(a.war * 100) / 100,
      woba: !a.isPitcher && a.pa > 0 ? Math.round(wobaOf([stintLike as never]) * 1000) / 1000 : null,
      fip: a.isPitcher && a.ip > 0 ? Math.round(fipOf([stintLike as never]) * 100) / 100 : null,
      counters: a.counters,
      ratings: a.ratingW > 0 ? Object.fromEntries(Object.entries(a.ratingSum).map(([k, v]) => [k, Math.round((v / a.ratingW) * 10) / 10])) : null,
    };
  });

  const seriesList = [...new Set(rows.map((r) => r.series))];

  /* ---------------- stage, then publish ----------------
   * observed_card_stats is untouched until every row of this batch is staged.
   * The publish is ONE upsert statement, atomic on its own even over Neon's
   * HTTP driver (which has no transactions), so a reader sees a series either
   * as it was or as it is now - never empty, never half-built. Rows the new
   * batch no longer carries (a file re-filed under another series) are swept
   * afterwards, and only inside the series in scope. */
  await ensureObservedVariantColumns();
  await sweepAbandonedBatches();
  const [batch] = await db
    .insert(importBatches)
    .values({ kind: "observed", scope: seriesList, files: fileMeta, parserVersion: PARSER_VERSION, status: "staged" })
    .returning({ id: importBatches.id });
  let swept = 0;
  try {
    // 100-row chunks: each carries a jsonb counters blob and larger payloads
    // periodically exceed what the Neon HTTP driver accepts. A chunk that
    // fails after four tries fails the batch - nothing has been published.
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => ({ batchId: batch.id, ...r }));
      let lastErr: unknown;
      for (let attempt = 0; attempt < 4; attempt++) {
        try { await db.insert(observedCardStatsStage).values(chunk); lastErr = undefined; break; }
        catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
      }
      if (lastErr) throw lastErr;
    }
    const staged = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(observedCardStatsStage)
      .where(eq(observedCardStatsStage.batchId, batch.id));
    if (Number(staged[0]?.n ?? 0) !== rows.length) {
      throw new Error(`staged ${staged[0]?.n ?? 0} rows but built ${rows.length} - refusing to publish`);
    }
    await db.execute(sql`
      INSERT INTO observed_card_stats (series, card_id, is_variant, is_pitcher, instances, pa, ip, war, woba, fip, counters, ratings)
      SELECT series, card_id, is_variant, is_pitcher, instances, pa, ip, war, woba, fip, counters, ratings
      FROM observed_card_stats_stage
      WHERE batch_id = ${batch.id}
      ON CONFLICT (series, card_id, is_variant) DO UPDATE SET
        is_pitcher = excluded.is_pitcher, instances = excluded.instances, pa = excluded.pa,
        ip = excluded.ip, war = excluded.war, woba = excluded.woba, fip = excluded.fip,
        counters = excluded.counters, ratings = excluded.ratings`);
    const inScope = sql.join(seriesList.map((s) => sql`${s}`), sql`, `);
    const staleWhere = sql`o.series IN (${inScope}) AND NOT EXISTS (
        SELECT 1 FROM observed_card_stats_stage s
        WHERE s.batch_id = ${batch.id} AND s.series = o.series AND s.card_id = o.card_id AND s.is_variant = o.is_variant)`;
    const staleCount = await db.execute(sql`SELECT count(*)::int AS n FROM observed_card_stats o WHERE ${staleWhere}`);
    swept = Number(rowsOf(staleCount)[0]?.n ?? 0);
    if (swept > 0) await db.execute(sql`DELETE FROM observed_card_stats o WHERE ${staleWhere}`);
    await db
      .update(importBatches)
      .set({ status: "published", rows: rows.length, publishedAt: new Date() })
      .where(eq(importBatches.id, batch.id));
    await db.delete(observedCardStatsStage).where(eq(observedCardStatsStage.batchId, batch.id));
  } catch (e) {
    await db
      .update(importBatches)
      .set({ status: "failed", error: String(e).slice(0, 2000) })
      .where(eq(importBatches.id, batch.id))
      .catch(() => undefined);
    console.error(`batch #${batch.id} FAILED before publish - observed_card_stats left as it was`);
    throw e;
  }
  /* ---------------- per-series usage meta ---------------- */
  const metaRows = [...metas.entries()].map(([series, m]) => {
    const cards = [...aggs.values()].filter((x) => x.series === series);
    const top = (want: boolean) => cards
      .filter((c) => c.isPitcher === want)
      .sort((x, y) => y.instances - x.instances)
      .slice(0, 12)
      .map((c): SeriesTopCard => ({
        cardId: c.cardId, name: c.name, pos: c.pos, isPitcher: c.isPitcher,
        teams: c.instances,
        pct: m.teamStints ? Math.round((c.instances / m.teamStints) * 1000) / 10 : 0,
        pa: Math.round(c.pa), ip: Math.round(c.ip),
      }));
    return {
      series, files: m.files, teamStints: m.teamStints,
      avgTeams: m.files ? Math.round((m.teamStints / m.files) * 10) / 10 : null,
      avgSp: m.teamStints ? Math.round((m.sp / m.teamStints) * 10) / 10 : null,
      avgRp: m.teamStints ? Math.round((m.rp / m.teamStints) * 10) / 10 : null,
      avgBats: m.teamStints ? Math.round((m.bats / m.teamStints) * 10) / 10 : null,
      topCards: [...top(false), ...top(true)],
    };
  });
  for (let i = 0; i < metaRows.length; i += 50) {
    await db.insert(seriesMeta).values(metaRows.slice(i, i + 50)).onConflictDoUpdate({
      target: seriesMeta.series,
      set: {
        files: sql`excluded.files`, teamStints: sql`excluded.team_stints`,
        avgTeams: sql`excluded.avg_teams`, avgSp: sql`excluded.avg_sp`,
        avgRp: sql`excluded.avg_rp`, avgBats: sql`excluded.avg_bats`,
        topCards: sql`excluded.top_cards`, updatedAt: sql`now()`,
      },
    });
  }
  /**
   * How each field is handed, off the same rows just published: the share of
   * batters faced thrown by left-handers and the share of PA taken by
   * left-handed bats (switch hitters at 0.7). The roster objective weights
   * its two lineups by the first and blends an arm's park by the second; the
   * fixed 0.30 / 0.35 were wrong by a third of a lineup in a third of the
   * catalogue (Sandlot 0.58 LHP, the deadball events 0.10).
   */
  await db.execute(sql`alter table series_meta add column if not exists lhp_bf_share real, add column if not exists lhb_pa_share real`);
  const metaScope = sql.join(seriesList.map((s) => sql`${s}`), sql`, `);
  await db.execute(sql`
    with h as (
      select o.series,
        sum(case when c.throws = 'L' then (o.counters->>'BF')::float else 0 end)
          / nullif(sum(case when o.is_pitcher then (o.counters->>'BF')::float else 0 end), 0) as lhp,
        sum(case when not o.is_pitcher and c.bats = 'L' then o.pa when not o.is_pitcher and c.bats = 'S' then o.pa * 0.7 else 0 end)
          / nullif(sum(case when not o.is_pitcher then o.pa else 0 end), 0) as lhb
      from observed_card_stats o join cards c on c.card_id = o.card_id
      where o.series in (${metaScope}) group by o.series)
    update series_meta m set lhp_bf_share = round(h.lhp::numeric, 4), lhb_pa_share = round(h.lhb::numeric, 4)
    from h where h.series = m.series`);
  console.log(`series meta: ${metaRows.length} series (roster shape, top cards, field handedness)`);
  /*
   * How the field spends its tiers, per series, for /build. It goes to
   * src/data/field-construction.json, which Push to GitHub commits, rather
   * than the database: the teams' names and records never leave the Mac
   * except as these averages. A --series run replaces only its own series.
   */
  const outPath = join(process.cwd(), "src", "data", "field-construction.json");
  let stored: { generated: string; series: Record<string, SeriesBuild> } = { generated: "", series: {} };
  if (only && existsSync(outPath)) {
    try { stored = JSON.parse(readFileSync(outPath, "utf8")); } catch { /* rebuilt below */ }
  }
  for (const [series, runs] of builds) stored.series[series] = summariseSeries(runs);
  stored.generated = new Date().toISOString().slice(0, 10);
  stored.series = Object.fromEntries(Object.entries(stored.series).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(outPath, JSON.stringify(stored, null, 1) + "\n");
  console.log(`field construction: ${builds.size} series -> src/data/field-construction.json (commit it with Push to GitHub)`);
  console.log(`batch #${batch.id} published: ${rows.length} rows across ${seriesList.length} series; ${swept} stale row(s) swept; ${fileMeta.length} files hashed`);
  console.log(`observed: ${rows.length} (series×card) rows from ${parsed} files across ${seriesList.length} series; skipped ${skipped}`);
  console.log(`Jim-beater teams dropped: ${droppedTeams} teams / ${droppedStints} stints across ${fileMeta.filter((m) => m.dropped).length} files`);
  if (only) for (const m of metaRows) console.log(`  ${m.series}: ${m.files} file(s), ${rows.filter((r) => r.series === m.series).length} card rows, ${m.avgTeams} teams/run`);
  const top = seriesList
    .map((s) => ({ s, n: rows.filter((r) => r.series === s).length }))
    .sort((a, b) => b.n - a.n).slice(0, 5);
  console.log("  biggest series:", top.map((t) => `${t.s} (${t.n})`).join(", "));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
