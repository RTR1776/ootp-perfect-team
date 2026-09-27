/**
 * What the app knows, source by source: how fresh it is and how to refresh it.
 *
 * On 2026-09-17 a collection and a shop list were uploaded and nothing landed;
 * the newest rows were two days old and nobody could tell from the app. So
 * /upload leads with this, and the sidebar's freshness card (UI plan G5, PR 8)
 * reads the same rows. Moved here from app/upload/page.tsx in PR 7.
 *
 * Each source is "latest by the date it was saved under" — the same order
 * every reader uses (uploaded_at, then id), so an older file saved later
 * never shows here as the current one.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { importBatches, tournaments, uploads } from "@/db/schema";
import { CALIBRATION } from "@/lib/analytics/calibration";
import { ago, chicagoDay, daysAgo, date as shortDate } from "@/lib/format";
import { lastSunday } from "@/lib/upload-rules";

type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));

export type SourceKey = "shop" | "collection" | "play" | "dump" | "league" | "catalogue" | "calibration";

export interface Source {
  key: SourceKey;
  label: string;
  /** The Chicago day of what is on file; null when nothing is. */
  asOf: string | null;
  /** Whole days since asOf. Null for League week, which reads by its week. */
  age: number | null;
  /** Older than this many days is worth a nudge. */
  staleAfter: number;
  stale: boolean;
  /** "today", "2d", or "week ending 2026-09-27". */
  when: string;
  detail: string;
  /** Hover text for the detail, when there is more (the calibration slopes). */
  detailTitle?: string;
  /** What L.J. does to refresh it, in plain words. */
  you: string;
  /** The command line behind it, for the Developer details. */
  dev: string;
}

export interface UploadAttempt {
  id: number;
  kind: string;
  status: "published" | "failed" | "staged" | string;
  rows: number | null;
  file: string | null;
  startedAt: string;
  error: string | null;
}

const newest = async (kind: string) =>
  (await db.select().from(uploads).where(eq(uploads.kind, kind)).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1))[0] ?? null;

/** Every source the model reads, in the order the page lists them. */
export async function loadFreshness(now: Date = new Date()): Promise<Source[]> {
  const [shop, collection, dump, observedRows, obsTotalsRows, leagueRows, catalogueRows] = await Promise.all([
    newest("shop_list"),
    newest("collection"),
    newest("dump"),
    db.select().from(importBatches)
      .where(sql`${importBatches.kind} = 'observed' and ${importBatches.status} = 'published'`)
      .orderBy(desc(importBatches.id)).limit(1),
    db.execute(sql`select count(distinct series)::int series, count(*)::int rows, sum(pa)::bigint pa from observed_card_stats`),
    // Each league's newest week: the week folders are often filed a league at a time.
    db.execute(sql`select league, max(captured_on)::text as on from league_snapshots where split = 'all' group by league order by league`),
    db.select({ at: sql<string | null>`max(${tournaments.updatedAt})`, n: sql<number>`count(*)::int` }).from(tournaments),
  ]);
  const observed = observedRows[0] ?? null;
  const obsTotals = asRows(obsTotalsRows)[0];
  const leagues = asRows(leagueRows).map((r) => ({ league: String(r.league), on: String(r.on) }));
  const catalogue = catalogueRows[0];

  const today = chicagoDay(now)!;
  const n = (x: unknown) => Number(x ?? 0).toLocaleString("en-US");
  const dated = (asOf: string | null, staleAfter: number) => {
    const age = daysAgo(asOf, now);
    return { asOf, age, staleAfter, stale: asOf == null || (age != null && age >= staleAfter), when: asOf == null ? "none" : ago(asOf, now) };
  };

  const shopOn = chicagoDay(shop?.uploadedAt), collOn = chicagoDay(collection?.uploadedAt), dumpOn = chicagoDay(dump?.uploadedAt);
  const obsOn = chicagoDay(observed?.publishedAt);
  const catOn = catalogue?.at ? chicagoDay(String(catalogue.at)) : null;
  const unmatched = Number((collection?.report as Row | null)?.unmatched ?? 0);

  // League week: read by its week, not by age. Stale once a newer Sunday has come.
  const leagueOn = leagues.reduce<string | null>((max, l) => (max == null || l.on > max ? l.on : max), null);
  const current = leagues.filter((l) => l.on === leagueOn).map((l) => l.league);
  const behind = leagues.filter((l) => l.on !== leagueOn);
  const behindText = [...new Set(behind.map((l) => l.on))].sort().reverse()
    .map((on) => `${behind.filter((l) => l.on === on).map((l) => l.league).join(", ")} still on ${shortDate(on, now)}`).join(" · ");

  return [
    {
      key: "shop", label: "Shop list", ...dated(shopOn, 7),
      detail: shop ? `${shop.filename} · ${n(shop.rowCount)} cards` : "none on file",
      you: "Export the card list in OOTP and drop pt_card_list.csv here.",
      dev: "cd web && pnpm import:cards SHOP COLLECTION YYYY-MM-DD --commit",
    },
    {
      key: "collection", label: "Collection", ...dated(collOn, 3),
      detail: collection
        ? `${collection.filename} · ${n(collection.rowCount)} cards${unmatched ? ` · ${unmatched} unmatched (shop list older than the collection)` : ""}`
        : "none on file",
      you: "Export Manage Cards after buying or selling and drop it here with a fresh shop list.",
      dev: "cd web && pnpm import:cards SHOP COLLECTION YYYY-MM-DD --commit",
    },
    {
      key: "play", label: "Tournament play", ...dated(obsOn, 4),
      detail: observed ? `${n(obsTotals?.series)} series · ${n(obsTotals?.rows)} card lines · ${n(obsTotals?.pa)} PA` : "none imported",
      you: "Double-click File OOTP Exports.command on the Mac after each tournament.",
      dev: "cd web && pnpm import:observed",
    },
    {
      key: "dump", label: "Community dump", ...dated(dumpOn, 8),
      detail: dump ? `${dump.filename} · ${n(dump.rowCount)} events` : "none on file",
      you: "Monday: save the dump anywhere and double-click Load Tourney Dumps.command.",
      dev: "cd web && pnpm dumps:load",
    },
    {
      key: "league", label: "League week", asOf: leagueOn, age: null, staleAfter: 7,
      stale: leagueOn == null || leagueOn < lastSunday(today),
      when: leagueOn ? `week ending ${leagueOn}` : "none",
      detail: leagueOn ? [current.join(", "), behindText].filter(Boolean).join(" · ") : "none on file",
      you: "Sunday: drop the League Data/<date> folder here.",
      dev: 'cd web && pnpm import:league "../League Data/YYYY-MM-DD"',
    },
    {
      key: "catalogue", label: "Tournament catalogue", ...dated(catOn, 8),
      detail: `${Number(catalogue?.n ?? 0)} events`,
      you: "Synced by Load Tourney Dumps.command.",
      dev: "cd web && pnpm catalogue:sync",
    },
    {
      key: "calibration", label: "Model calibration", ...dated(chicagoDay(CALIBRATION.fittedAt), 8),
      detail: `Model tuned to your tournament results${CALIBRATION.hit.applied ? " (applied)" : " (recorded, not applied)"}`,
      detailTitle: `bats ×${CALIBRATION.hit.slope} · arms ×${CALIBRATION.pit.slope}`,
      you: "Recalibrated when File OOTP Exports.command quits; ask Claude to commit it.",
      dev: "cd web && pnpm model:calibrate, then commit web/src/data/model-calibration.json",
    },
  ];
}

/** "All 7 sources current", or "2 stale: Community dump 6 days, League week ending Sep 20". */
export function freshnessSummary(sources: Source[], now: Date = new Date()): string {
  const stale = sources.filter((s) => s.stale);
  if (!stale.length) return `All ${sources.length} sources current`;
  const what = (s: Source) =>
    s.asOf == null ? `${s.label}: none on file`
      : s.key === "league" ? `League week ending ${shortDate(s.asOf, now)}`
        : `${s.label} ${s.age} day${s.age === 1 ? "" : "s"}`;
  return `${stale.length} stale: ${stale.map(what).join(", ")}`;
}

/** The last few uploads through /upload, failed ones included (import_batches). */
export async function loadUploadHistory(limit = 8): Promise<UploadAttempt[]> {
  const rows = asRows(await db.execute(sql`
    select id, kind, status, rows, started_at, files->0->>'name' as file, left(error, 200) as error
    from import_batches where kind like 'upload:%' order by id desc limit ${limit}`));
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind).replace(/^upload:/, ""),
    status: String(r.status),
    rows: r.rows == null ? null : Number(r.rows),
    file: r.file == null ? null : String(r.file),
    startedAt: String(r.started_at),
    error: r.error == null ? null : String(r.error),
  }));
}
