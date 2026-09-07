/**
 * Import league season exports (`pel_*.csv`, `hd45x_*.csv`) into
 * league_snapshots / league_stints — the same work `/api/upload` does for kind
 * "league", but from the command line, where a whole week's folder goes in one
 * shot and 3.5MB of CSV never has to cross the network to be parsed.
 *
 *   pnpm import:league "../League Data/2026-09-06"
 *   pnpm import:league "../League Data/2026-09-06/hd452_all.csv" ...
 *   pnpm import:league "../League Data/2026-09-06" --dry
 *   pnpm import:league <paths...> --on 2026-08-30
 *
 * capturedOn: `--on YYYY-MM-DD`, else a YYYY-MM-DD folder name (that is what
 * `League Data/<date>/` is for), else today. It is the week the season covers,
 * not the download time — a backfill must say so or /market and /meta read the
 * history wrong.
 *
 * League and split come from the FILENAME (`hd452_vL.csv` → HD452 / vL), so
 * exports keep their original names. Files whose league cannot be read are
 * refused rather than guessed at.
 *
 * Idempotent: a snapshot with the same (league, split, capturedOn) is replaced,
 * not stacked — the new rows land first, the superseded upload is dropped after
 * (cascading to its snapshot and stints), so a failed run leaves the old data
 * intact.
 *
 * Needs DATABASE_URL; .env.local is read for it when it is not already exported.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { leagueSnapshots, leagueStints, uploads } from "../src/db/schema";
import { looksLikeLeagueExport, parseLeagueExport } from "../src/lib/ingest/league";

/* DATABASE_URL: exported by the shell, or read out of web/.env.local here.
   The db client builds lazily on first query, so filling process.env after the
   imports above is in time. */
const ENV_LOCAL = resolve(__dirname, "..", ".env.local");
if (!process.env.DATABASE_URL && existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH = 100;

/** The Neon HTTP driver drops a large insert as "fetch failed" now and then. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 500 * (i + 1))); }
  }
  throw last;
}

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}\n`);
  console.error('usage: pnpm import:league <folder|file...> [--on YYYY-MM-DD] [--dry]');
  process.exit(msg ? 1 : 0);
}

function collect(paths: string[]): string[] {
  const files: string[] = [];
  for (const p of paths) {
    if (!existsSync(p)) usage(`no such path: ${p}`);
    if (statSync(p).isDirectory()) {
      const csvs = readdirSync(p).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
      if (!csvs.length) usage(`no CSVs in ${p}`);
      files.push(...csvs.map((f) => join(p, f)));
    } else files.push(p);
  }
  return files;
}

/** The folder a week's exports live in names the week: League Data/2026-09-06. */
function dateFromPath(file: string): string | null {
  const dir = basename(dirname(resolve(file)));
  return DATE_RE.test(dir) ? dir : null;
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) usage();

  const dry = argv.includes("--dry");
  const onIdx = argv.indexOf("--on");
  const onFlag = onIdx >= 0 ? argv[onIdx + 1] : undefined;
  if (onIdx >= 0 && (!onFlag || !DATE_RE.test(onFlag))) usage("--on wants YYYY-MM-DD");

  const paths = argv.filter((a, i) => !a.startsWith("--") && !(onIdx >= 0 && i === onIdx + 1));
  const files = collect(paths);

  /* Parse everything before writing anything: a folder with one bad file
     should fail with nothing half-imported. */
  const jobs = files.map((file) => {
    const text = readFileSync(file, "utf8");
    const header = text.slice(0, text.indexOf("\n"));
    if (!looksLikeLeagueExport(header)) {
      usage(`${basename(file)} is not a league export (no ORG + CID + WAR in the header)`);
    }
    const parsed = parseLeagueExport(text, basename(file));
    if (!parsed.league) usage(`cannot read the league from the filename ${basename(file)} — expected pel_* or hd45x_*`);
    if (!parsed.stints.length) usage(`${basename(file)} parsed to zero rows`);
    const capturedOn = onFlag ?? dateFromPath(file) ?? new Date().toISOString().slice(0, 10);
    return { file, parsed, capturedOn };
  });

  for (const { file, parsed, capturedOn } of jobs) {
    const label = `${parsed.league} ${parsed.split} ${capturedOn}`;
    const s = parsed.stats;
    const summary = `${s.rows} rows · ${s.teams} teams · ${s.uniqueCids} cards · ${s.freeAgentRows} FA · ${s.clanTeams} clan teams`;
    /* Loud, but not fatal: the file is still worth having, it just must not be
       taken as a league's current picture. The readers skip it themselves. */
    if (s.truncated) {
      console.warn(
        `  ! ${label}: only ${s.pitcherRows} pitcher rows in ${s.rows} ` +
          `(${(s.pitcherShare * 100).toFixed(1)}%) — the pitching block looks missing. ` +
          `Importing anyway; readers will fall back to the previous complete week. ` +
          `Re-export this view with pitchers included.`,
      );
    }

    if (dry) {
      console.log(`would import ${label.padEnd(22)} ${summary}   (${basename(file)})`);
      continue;
    }

    const report = {
      league: parsed.league,
      split: parsed.split,
      ...s,
      capturedOn,
      capturedOnWasSupplied: true,
      source: "import-league",
    } as unknown as Record<string, unknown>;

    const [upload] = await db.insert(uploads).values({
      kind: "league",
      filename: basename(file),
      rowCount: parsed.stints.length,
      report,
      uploadedAt: new Date(`${capturedOn}T12:00:00Z`),
    }).returning();

    let snapshotId: number | null = null;
    let replaced = 0;
    try {
      const [snapshot] = await db.insert(leagueSnapshots).values({
        uploadId: upload.id,
        league: parsed.league!,
        split: parsed.split,
        capturedOn,
        teams: s.teams,
        rows: parsed.stints.length,
      }).returning();
      snapshotId = snapshot.id;

      const rows = parsed.stints.map((st) => ({
        snapshotId: snapshot.id,
        cid: st.cid, name: st.name, pos: st.pos, org: st.org, clan: st.clan,
        isFreeAgent: st.isFreeAgent, isPitcher: st.isPitcher,
        val: st.val, tier: st.tier, isVariant: st.isVariant, cardYear: st.cardYear,
        pa: st.pa, ip: st.ip, use: st.use, war: st.war,
        ratings: st.ratings, stats: st.stats,
      }));
      /* Every row carries two JSONB blobs. Over the Neon HTTP driver a
         200-row batch intermittently dies as "fetch failed" mid-import, so:
         100 at a time, each retried. */
      for (let i = 0; i < rows.length; i += BATCH) {
        await withRetry(() => db.insert(leagueStints).values(rows.slice(i, i + BATCH)));
      }

      /* Only now drop any earlier snapshot of the same week+league+split.
         Deleting the upload cascades to its snapshot and stints. */
      const prior = await withRetry(() => db
        .select({ id: leagueSnapshots.id, uploadId: leagueSnapshots.uploadId })
        .from(leagueSnapshots)
        .where(and(
          eq(leagueSnapshots.league, parsed.league!),
          eq(leagueSnapshots.split, parsed.split),
          eq(leagueSnapshots.capturedOn, capturedOn),
        )));
      const stale = prior.filter((p) => p.id !== snapshot.id);
      if (stale.length) {
        await withRetry(() => db.delete(uploads).where(inArray(uploads.id, stale.map((p) => p.uploadId))));
        replaced = stale.length;
      }
    } catch (err) {
      /* A half-written snapshot is worse than none: it looks complete to
         /meta and /market. Roll this file back and stop. */
      await db.delete(uploads).where(eq(uploads.id, upload.id)).catch(() => {});
      console.error(`${label}: import failed after ${snapshotId ? "the snapshot row" : "the upload row"} — rolled back, nothing kept.`);
      throw err;
    }

    console.log(
      `${label.padEnd(22)} snapshot ${String(snapshotId).padStart(3)} · ${summary}` +
      (replaced ? ` · replaced ${replaced} earlier snapshot${replaced > 1 ? "s" : ""}` : ""),
    );
  }

  if (dry) console.log(`\ndry run — nothing written (${jobs.length} file${jobs.length > 1 ? "s" : ""} parsed clean)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
