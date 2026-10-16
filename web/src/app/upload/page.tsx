/**
 * /upload — drop new exports, and see how fresh everything the app knows is.
 *
 * Order (UI plan U4): the status of every source in the header, the drop zone,
 * what is on file with how to refresh each source, then the last few uploads.
 * On 2026-09-17 a collection and a shop list were uploaded through this page
 * and nothing landed, and nobody could tell from the app; so every source says
 * how old it is, and every upload attempt is listed with its outcome
 * (import_batches, written by the route, success or failure).
 */
import { UploadQueue } from "@/components/upload-queue";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { freshnessSummary, loadFreshness, loadUploadHistory, type Source } from "@/lib/freshness";
import { KEEP_DAYS, loadExportsToGrab, type ExportToGrab } from "@/lib/exports-to-grab";
import * as format from "@/lib/format";
import { KIND_LABEL, type UploadKind } from "@/lib/upload-rules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ATTEMPT_STATUS: Record<string, string> = { published: "Saved", failed: "Failed", staged: "Did not finish" };

function SourceRow({ s }: { s: Source }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-4">
      <div className="text-sm font-medium">{s.label}</div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:hidden">
        <SourceStatus s={s} />
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="hidden items-center gap-2 sm:flex">
          <SourceStatus s={s} />
        </div>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere] sm:mt-1" title={s.detailTitle}>{s.detail}</p>
        <details open={s.stale} className="group mt-1 text-xs">
          <summary className="w-fit cursor-pointer select-none font-medium text-foreground/80 hover:text-foreground">How to refresh</summary>
          <p className="mt-1 text-muted-foreground">{s.you}</p>
          <details className="mt-1">
            <summary className="w-fit cursor-pointer select-none text-muted-foreground hover:text-foreground">Developer</summary>
            <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground [overflow-wrap:anywhere]">{s.dev}</code>
          </details>
        </details>
      </div>
    </div>
  );
}

function SourceStatus({ s }: { s: Source }) {
  return (
    <>
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.stale ? "bg-warning/15 text-warning" : "bg-positive/15 text-positive")}>
        {s.asOf == null ? "None" : s.stale ? "Stale" : "Current"}
      </span>
      {s.asOf != null && <span className="font-mono text-xs text-muted-foreground">{s.when}</span>}
    </>
  );
}

export default async function UploadPage() {
  const [sources, attempts, grab] = await Promise.all([loadFreshness(), loadUploadHistory(), loadExportsToGrab()]);
  const staleCount = sources.filter((s) => s.stale).length;
  const newestFailed = attempts[0]?.status === "failed";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Upload"
        description="What's fresh; drop new exports. Nothing is saved until you press Save."
        about="Each file is previewed first: what it holds and what it would replace. A file already on record is recognised and not saved twice, and a file older than what is on file is left out unless you include it."
        actions={
          <p className={cn("flex max-w-md items-start gap-2 text-sm", staleCount ? "text-warning" : "text-positive")}>
            <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", staleCount ? "bg-warning" : "bg-positive")} />
            <span>{freshnessSummary(sources)}</span>
          </p>
        }
      />

      <UploadQueue />

      <ExportsToGrab grab={grab} />

      <Card>
        <CardContent className="pt-4">
          <h2 className="text-sm font-semibold">Data on file</h2>
          <div className="mt-1 divide-y divide-border/60">
            {sources.map((s) => <SourceRow key={s.key} s={s} />)}
          </div>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <details open={newestFailed} className="group rounded-xl border border-border bg-card px-5 py-3">
          <summary className="cursor-pointer select-none text-sm font-semibold">
            Recent uploads
            {newestFailed && <span className="ml-2 text-xs font-medium text-negative">the last one failed</span>}
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {attempts.map((a) => (
              <li key={a.id} className={cn("[overflow-wrap:anywhere]", a.status === "failed" ? "text-negative" : "text-muted-foreground")}>
                <span className="font-medium text-foreground">{a.file ?? "?"}</span>
                {" · "}{KIND_LABEL[a.kind as UploadKind] ?? a.kind}
                {" · "}{ATTEMPT_STATUS[a.status] ?? a.status}
                {a.rows != null && ` · ${a.rows.toLocaleString("en-US")} rows`}
                {" · "}{format.date(a.startedAt)}
                {a.error && ` — ${a.error}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * The tournament exports still to file (lib/exports-to-grab): the events he
 * played whose export no import holds, oldest first because Your Tournaments
 * drops them as they age. Only logged and dumped events can be listed.
 */
function ExportsToGrab({ grab }: { grab: Awaited<ReturnType<typeof loadExportsToGrab>> }) {
  const live = grab.rows.filter((r) => !r.likelyGone);
  const gone = grab.rows.filter((r) => r.likelyGone);
  const row = (r: ExportToGrab) => (
    <tr key={r.eventId} className={cn("border-t border-border/60", r.likelyGone && "text-muted-foreground")}>
      <td className="py-1 pr-3 font-mono text-xs">{r.on.slice(5)}</td>
      <td className="py-1 pr-3">{r.name} <span className="font-mono text-[11px] text-muted-foreground">{r.eventId}</span></td>
      <td className="py-1 font-mono text-xs">{r.file ?? "?"}</td>
    </tr>
  );
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Tournament exports to grab</h2>
          <span className="text-xs text-muted-foreground">
            last import {grab.lastImportAt ? format.date(grab.lastImportAt) : "never"}
            {grab.newestImported && <> · newest game in it {grab.newestImported.slice(5)}</>}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {live.length
            ? <>{live.length} event{live.length === 1 ? "" : "s"} you played {live.length === 1 ? "isn't" : "aren't"} filed yet. Grab them oldest first — Your Tournaments keeps about {KEEP_DAYS} days — then double-click File OOTP Exports.command.</>
            : "Every event you played in the last week is filed."}
          {" "}Only events in your logged results or the community dump are listed, so log today&apos;s screenshot to see today&apos;s.
        </p>
        {live.length > 0 && (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="pb-1 font-medium">Played</th><th className="pb-1 font-medium">Event</th><th className="pb-1 font-medium">File it becomes</th></tr></thead>
            <tbody>{live.map(row)}</tbody>
          </table>
        )}
        {gone.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">{gone.length} older than {KEEP_DAYS} days, probably gone from Your Tournaments</summary>
            <table className="mt-1 w-full"><tbody>{gone.map(row)}</tbody></table>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
