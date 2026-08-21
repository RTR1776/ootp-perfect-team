"use client";

/**
 * Upload surface.
 *
 * Every file is parsed twice: once with `?dryRun=1` to produce a report that is
 * shown before anything is written, and again for real once the report has been
 * eyeballed. The dry run is not ceremony — the shop list has a column-offset
 * trap that produces plausible-looking but completely wrong prices, and the
 * cheapest place to catch it is a human glancing at the tier bands.
 *
 * Commit order is forced: shop list, then collection, then standings. The
 * collection export carries no Card ID and is matched against the card universe
 * by rating fingerprint, so it is meaningless until the shop list has landed.
 */

import { useCallback, useRef, useState } from "react";
import { Upload, FileCheck2, AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Kind = "shop_list" | "collection" | "standings" | "league";
type Status = "analyzing" | "ready" | "committing" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
  status: Status;
  kind?: Kind;
  stats?: Record<string, unknown>;
  error?: string;
  detail?: string;
  uploadId?: number;
  /** Standings only — the date the export was taken. See the note on the field. */
  capturedOn?: string;
}

/**
 * Local calendar date, not UTC. `toISOString()` would roll over to tomorrow for
 * anyone uploading in the evening west of Greenwich — which is when a PT export
 * actually gets pulled.
 */
function today(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Commit order. The collection is matched against the card universe. */
const KIND_ORDER: Record<Kind, number> = { shop_list: 0, collection: 1, standings: 2, league: 3 };

const KIND_LABEL: Record<Kind, string> = {
  shop_list: "Card shop list",
  collection: "Collection export",
  standings: "Category standings",
  league: "League season export",
};

function num(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString() : String(value ?? "—");
}

/* ------------------------------------------------------------------ */
/* Per-kind report rendering                                           */
/* ------------------------------------------------------------------ */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="label-eyebrow text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sm",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Report({
  kind,
  stats,
  capturedOn,
  onCapturedOn,
}: {
  kind: Kind;
  stats: Record<string, unknown>;
  capturedOn?: string;
  onCapturedOn?: (value: string) => void;
}) {
  if (kind === "league") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="League" value={String(stats.league ?? "?")} />
          <Stat label="Split" value={String(stats.split ?? "all")} />
          <Stat label="Teams" value={num(stats.teams)} />
          <Stat label="Rows" value={num(stats.rows)} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Unique cards" value={num(stats.uniqueCids)} />
          <Stat label="Clan teams" value={num(stats.clanTeams)} />
          <Stat label="Free-agent rows" value={num(stats.freeAgentRows)} />
          <Stat label="Snapshot week" value={String(stats.capturedOn ?? "today")} />
        </div>
        {onCapturedOn && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Captured on
            <input
              type="date"
              value={capturedOn ?? ""}
              onChange={(e) => onCapturedOn(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
            <span>— set this when backfilling an older week&apos;s export.</span>
          </label>
        )}
      </div>
    );
  }

  if (kind === "shop_list") {
    const valid = stats.tierBandsValid === true;
    const byTier = (stats.byTier ?? {}) as Record<string, number>;
    const ownedByTier = (stats.ownedByTier ?? {}) as Record<string, number>;
    const tiers = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Perfect"];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Cards" value={num(stats.total)} />
          <Stat label="Owned" value={num(stats.ownedCards)} />
          <Stat label="Copies" value={num(stats.ownedCopies)} />
          <Stat label="Variant listings" value={num(stats.withVariantListing)} />
        </div>

        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            valid
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
              : "border-red-500/30 bg-red-500/5 text-red-500",
          )}
        >
          {valid ? (
            <Check className="mt-px size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
          )}
          <span>
            {valid ? (
              <>
                Column alignment OK — tier codes partition Card Value cleanly (
                {num(stats.headerFields)}-field header, {num(stats.dataFields)}-field rows).
              </>
            ) : (
              <>
                Columns are shifted. Tier codes do not partition Card Value, so every price and
                ownership count in this file is wrong. This will be refused.
              </>
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 text-left font-medium">Tier</th>
                {tiers.map((t) => (
                  <th key={t} className="py-1.5 text-right font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-left font-sans text-muted-foreground">Cards</td>
                {tiers.map((t) => (
                  <td key={t} className="py-1.5 text-right">
                    {num(byTier[t] ?? 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 text-left font-sans text-muted-foreground">Owned</td>
                {tiers.map((t) => (
                  <td key={t} className="py-1.5 text-right">
                    {num(ownedByTier[t] ?? 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (kind === "collection") {
    const rate = typeof stats.matchRate === "number" ? stats.matchRate : null;
    const unmatched = typeof stats.unmatched === "number" ? stats.unmatched : 0;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Cards" value={num(stats.total)} />
          <Stat label="Variants owned" value={num(stats.variants)} />
          <Stat
            label="Match rate"
            value={rate == null ? "—" : `${(rate * 100).toFixed(1)}%`}
            tone={rate === 1 ? "good" : rate != null && rate < 0.98 ? "bad" : undefined}
          />
          <Stat label="Unmatched" value={num(unmatched)} tone={unmatched > 0 ? "bad" : "good"} />
        </div>
        {stats.hasActiveColumn === false && (
          <p className="text-xs text-amber-500">
            This export has no ACT column, so the active roster cannot be read from it. Re-export
            with active status included if you want the roster flag populated.
          </p>
        )}
      </div>
    );
  }

  const cutoffs = (stats.cutoffs ?? {}) as Record<string, number | null>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Category" value={String(stats.category ?? "—")} />
        <Stat label="Period" value={num(stats.period)} />
        <Stat label="Weeks" value={String(stats.weeks ?? "—")} />
        <Stat label="Rows" value={num(stats.rows)} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {[32, 64, 128, 256].map((rank) => (
          <span key={rank} className="text-muted-foreground">
            rank {rank}:{" "}
            <span className="font-mono text-foreground">{num(cutoffs[String(rank)])}</span>
          </span>
        ))}
      </div>

      {onCapturedOn && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <label className="flex flex-wrap items-center gap-2 text-xs text-amber-500">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Export taken on</span>
            <input
              type="date"
              value={capturedOn ?? ""}
              onChange={(e) => onCapturedOn(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
            />
          </label>
          <p className="mt-1.5 pl-5 text-[11px] leading-relaxed text-muted-foreground">
            These lines are a snapshot as of that date, not the period&rsquo;s final result — the
            filename names the period, not when the file was pulled. Set it correctly or the cutoff
            projection will be measured over the wrong number of elapsed days.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function UploadPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }, []);

  const send = useCallback(async (file: File, dryRun: boolean, capturedOn?: string) => {
    const body = new FormData();
    body.append("file", file);
    if (capturedOn) body.append("capturedOn", capturedOn);
    const response = await fetch(`/api/upload${dryRun ? "?dryRun=1" : ""}`, {
      method: "POST",
      body,
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, json };
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const queued: QueueItem[] = files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "analyzing" as Status,
      }));
      setItems((prev) => [...prev, ...queued]);

      // Sequential: the shop list is 1.5MB and parsing several at once on a
      // serverless function is a good way to hit the memory ceiling.
      for (const item of queued) {
        const { ok, json } = await send(item.file, true);
        if (!ok) {
          patch(item.id, {
            status: "error",
            error: String(json.error ?? "Upload failed."),
            detail: String(json.detail ?? json.hint ?? ""),
            stats: json.stats as Record<string, unknown> | undefined,
            kind: json.kind as Kind | undefined,
          });
        } else {
          const kind = json.kind as Kind;
          patch(item.id, {
            status: "ready",
            kind,
            stats: json.stats as Record<string, unknown>,
            capturedOn: kind === "standings" || kind === "league" ? today() : undefined,
          });
        }
      }
    },
    [patch, send],
  );

  const commitAll = useCallback(async () => {
    const ready = items
      .filter((it) => it.status === "ready" && it.kind)
      .sort((a, b) => KIND_ORDER[a.kind!] - KIND_ORDER[b.kind!]);

    for (const item of ready) {
      patch(item.id, { status: "committing" });
      const { ok, json } = await send(item.file, false, item.capturedOn);
      patch(
        item.id,
        ok
          ? {
              status: "done",
              uploadId: json.uploadId as number,
              stats: json.stats as Record<string, unknown>,
            }
          : {
              status: "error",
              error: String(json.error ?? "Write failed."),
              detail: String(json.detail ?? json.hint ?? ""),
            },
      );
    }
  }, [items, patch, send]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer.files).filter((f) => /\.csv$/i.test(f.name));
      if (files.length) void addFiles(files);
    },
    [addFiles],
  );

  const readyCount = items.filter((it) => it.status === "ready").length;
  const busy = items.some((it) => it.status === "analyzing" || it.status === "committing");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Upload</h1>
        <p className="text-sm text-muted-foreground">
          Drop the card shop list, a collection export, or category standings. The file type is
          detected from its header — nothing to choose. Every file is parsed and reported before
          anything is written.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-accent/30",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <div className="text-sm font-medium">Drop CSV exports here</div>
        <div className="text-xs text-muted-foreground">
          pt_card_list.csv · mycardset.csv · pt_standings_*.csv
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void addFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 truncate">
                    {item.status === "analyzing" || item.status === "committing" ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : item.status === "error" ? (
                      <X className="size-4 shrink-0 text-red-500" />
                    ) : item.status === "done" ? (
                      <Check className="size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <FileCheck2 className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{item.file.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {item.kind ? KIND_LABEL[item.kind] : "Detecting…"}
                    {" · "}
                    {(item.file.size / 1024).toFixed(0)} KB
                    {item.status === "analyzing" && " · parsing"}
                    {item.status === "ready" && " · previewed, not yet written"}
                    {item.status === "committing" && " · writing"}
                    {item.status === "done" && ` · written (upload #${item.uploadId})`}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                >
                  <X />
                </Button>
              </CardHeader>

              {(item.stats || item.error) && (
                <CardContent className="space-y-3">
                  {item.error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                      <div className="font-medium">{item.error}</div>
                      {item.detail && <div className="mt-1 opacity-80">{item.detail}</div>}
                    </div>
                  )}
                  {item.stats && item.kind && (
                    <Report
                      kind={item.kind}
                      stats={item.stats}
                      capturedOn={item.capturedOn}
                      onCapturedOn={
                        item.kind === "standings" && item.status === "ready"
                          ? (value) => patch(item.id, { capturedOn: value })
                          : undefined
                      }
                    />
                  )}
                </CardContent>
              )}
            </Card>
          ))}

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {readyCount > 0 ? (
                <>
                  {readyCount} file{readyCount === 1 ? "" : "s"} previewed. Commit order is forced:
                  shop list, then collection, then standings.
                </>
              ) : (
                "Nothing staged."
              )}
            </p>
            <Button onClick={() => void commitAll()} disabled={busy || readyCount === 0}>
              {busy ? "Working…" : `Commit ${readyCount || ""}`.trim()}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
