/**
 * /upload — the drop zone, and above it what the app currently knows.
 *
 * On 2026-09-17 a collection and a shop list were uploaded through this page
 * and nothing landed; the newest rows were two days old and nobody could
 * tell from the app. So the page now leads with the freshness of every
 * source the model reads, each with the exact way to refresh it, and the
 * last few upload attempts with their outcome (recorded in import_batches
 * by the route, success or failure, so a silent failure cannot recur).
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { importBatches, leagueSnapshots, tournaments, uploads } from "@/db/schema";
import { CALIBRATION } from "@/lib/analytics/calibration";
import { UploadQueue } from "@/components/upload-queue";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));

interface Source {
  label: string;
  /** What is on file, or null when nothing is. */
  asOf: string | null;
  detail: string;
  /** Days since asOf; null when unknown. */
  age: number | null;
  /** Older than this many days is worth a nudge. */
  staleAfter: number;
  refresh: string;
}

const day = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);
const ageOf = (d: string | null): number | null => (d ? Math.floor((Date.now() - new Date(`${d}T12:00:00Z`).getTime()) / 86_400_000) : null);

async function loadFreshness(): Promise<{ sources: Source[]; attempts: Row[] }> {
  const latest = async (kind: string) =>
    (await db.select().from(uploads).where(eq(uploads.kind, kind)).orderBy(desc(uploads.id)).limit(1))[0] ?? null;
  const [shop, collection, dump] = await Promise.all([latest("shop_list"), latest("collection"), latest("dump")]);
  const [observed] = await db.select().from(importBatches)
    .where(sql`${importBatches.kind} = 'observed' and ${importBatches.status} = 'published'`)
    .orderBy(desc(importBatches.id)).limit(1);
  const obsTotals = asRows(await db.execute(sql`select count(distinct series)::int series, count(*)::int rows, sum(pa)::bigint pa from observed_card_stats`))[0];
  const [league] = await db.select({ on: sql<string | null>`max(${leagueSnapshots.capturedOn})` }).from(leagueSnapshots);
  const [catalogue] = await db.select({ at: sql<string | null>`max(${tournaments.updatedAt})`, n: sql<number>`count(*)::int` }).from(tournaments);
  const attempts = asRows(await db.execute(sql`
    select id, kind, status, rows, started_at, files->0->>'name' as file, left(error, 160) as error
    from import_batches where kind like 'upload:%' order by id desc limit 6`));

  const shopOn = day(shop?.uploadedAt), collOn = day(collection?.uploadedAt), dumpOn = day(dump?.uploadedAt);
  const obsOn = day(observed?.publishedAt), leagueOn = league?.on ? String(league.on).slice(0, 10) : null;
  const catOn = catalogue?.at ? day(String(catalogue.at)) : null;
  const unmatched = Number((collection?.report as Record<string, unknown> | null)?.unmatched ?? 0);

  const sources: Source[] = [
    {
      label: "Card shop list", asOf: shopOn, age: ageOf(shopOn), staleAfter: 7,
      detail: shop ? `${shop.filename} · ${shop.rowCount?.toLocaleString()} cards` : "none on file",
      refresh: "Export the card list in OOTP, then drop it here or run pnpm import:cards SHOP COLLECTION DATE --commit",
    },
    {
      label: "Collection", asOf: collOn, age: ageOf(collOn), staleAfter: 3,
      detail: collection ? `${collection.filename} · ${collection.rowCount?.toLocaleString()} cards${unmatched ? ` · ${unmatched} unmatched (shop list older than the collection)` : ""}` : "none on file",
      refresh: "Export your collection in OOTP after buying or selling, then drop it here with a fresh shop list",
    },
    {
      label: "Tournament play", asOf: obsOn, age: ageOf(obsOn), staleAfter: 4,
      detail: observed ? `${Number(obsTotals?.series ?? 0)} series · ${Number(obsTotals?.rows ?? 0).toLocaleString()} card lines · ${Number(obsTotals?.pa ?? 0).toLocaleString()} PA (batch #${observed.id})` : "none imported",
      refresh: "File OOTP Exports.command on the Mac after every tournament (imports and recalibrates on quit)",
    },
    {
      label: "Community dump", asOf: dumpOn, age: ageOf(dumpOn), staleAfter: 8,
      detail: dump ? `${dump.filename} · ${dump.rowCount?.toLocaleString()} events` : "none on file",
      refresh: "Load Tourney Dumps.command on Monday after the dump posts",
    },
    {
      label: "League week", asOf: leagueOn, age: ageOf(leagueOn), staleAfter: 8,
      detail: leagueOn ? "newest complete snapshot per league" : "none on file",
      refresh: "cd web && pnpm import:league \"../League Data/YYYY-MM-DD\" on Sunday",
    },
    {
      label: "Tournament catalogue", asOf: catOn, age: ageOf(catOn), staleAfter: 8,
      detail: `${Number(catalogue?.n ?? 0)} events`,
      refresh: "pnpm catalogue:sync after the dump loads (field sizes, renames, new slots)",
    },
    {
      label: "Model calibration", asOf: CALIBRATION.fittedAt, age: ageOf(CALIBRATION.fittedAt), staleAfter: 8,
      detail: `bats ×${CALIBRATION.hit.slope} · arms ×${CALIBRATION.pit.slope}${CALIBRATION.hit.applied ? " (applied)" : " (recorded, not applied)"}`,
      refresh: "pnpm model:calibrate after new exports land, then commit web/src/data/model-calibration.json",
    },
  ];
  return { sources, attempts };
}

export default async function UploadPage() {
  const { sources, attempts } = await loadFreshness();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Upload"
        description="Drop the card shop list, a collection export, a league export or category standings — the file type is detected from its header."
        about="Every file is parsed and reported before anything is written, and a file already on record is recognised and skipped."
      />

      <Card>
        <CardContent className="pt-4">
          <div className="mb-2 text-sm font-semibold">What the app knows right now</div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border text-left">
                <th className="py-1.5 font-medium">Source</th>
                <th className="py-1.5 font-medium">As of</th>
                <th className="py-1.5 font-medium">On file</th>
                <th className="py-1.5 font-medium">How to refresh</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const stale = s.asOf == null || (s.age != null && s.age >= s.staleAfter);
                return (
                  <tr key={s.label} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-3 font-medium">{s.label}</td>
                    <td className={cn("py-1.5 pr-3 font-mono whitespace-nowrap", stale ? "text-warning" : "text-positive")}>
                      {s.asOf ?? "—"}{s.age != null ? ` (${s.age}d)` : ""}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{s.detail}</td>
                    <td className="py-1.5 text-muted-foreground">{s.refresh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {attempts.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold">Last uploads through this page</div>
              <div className="space-y-0.5 font-mono text-[11px]">
                {attempts.map((a) => (
                  <div key={String(a.id)} className={cn(String(a.status) === "failed" ? "text-negative" : "text-muted-foreground")}>
                    #{String(a.id)} {String(a.kind).replace("upload:", "")} · {String(a.file ?? "?")} · {String(a.status)}
                    {a.rows != null ? ` · ${Number(a.rows).toLocaleString()} rows` : ""} · {day(String(a.started_at))}
                    {a.error ? ` — ${String(a.error)}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadQueue />
    </div>
  );
}
