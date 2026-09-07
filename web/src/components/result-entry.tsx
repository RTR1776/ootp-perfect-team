"use client";

/**
 * Paste-and-preview result entry for the PTCS ledger.
 *
 * Rows from the Your Tournaments screen go in the box exactly as read; the
 * preview scores each one (points × categories) and marks what is new, what
 * is already logged (by event id) and what could not be read. Nothing is
 * written until "Log" - and even then the event id makes a second paste of
 * the same screen a no-op.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EntryResponse, EntryRow } from "@/lib/result-entry";

export interface LoggedEvent {
  eventId: number | null;
  name: string;
  occurredOn: string;
  categories: string[];
  points: number;
  placement: string | null;
  fieldSize: number | null;
  eliminated: boolean;
}

const PLACEHOLDER = [
  "Paste rows from the Your Tournaments screen, one per line, in the screen's own order — for example:",
  "",
  "Daily Perfectly Gold (2220177)  PD Daily  64 / 64 - Bo7  1999/DH/BP  100 CS, HDPk  Yesterday  5th-8th Place",
  "Sunday High Iron Floor and Gold Ceiling (1600025)  Gld,Cp,TW  128 / 128 - Bo7  <=GOLD; MIN 50  DH  400 CS  Yesterday  5th-8th Place",
  "",
  "Tabs, pipes or spaces all work. The (id), the n / n field, the tag and the placement are what get read.",
].join("\n");

export function ResultEntry({ asOfDefault, periodName, recent }: { asOfDefault: string; periodName: string; recent: LoggedEvent[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [asOf, setAsOf] = useState(asOfDefault);
  const [preview, setPreview] = useState<EntryResponse | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "save");
    setMsg(null);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, asOf, dryRun }),
      });
      const data = (await res.json()) as EntryResponse & { error?: string };
      if (!res.ok) { setMsg(data.error ?? `Request failed (${res.status}).`); return; }
      setPreview(data);
      if (!dryRun) {
        const pts = Object.entries(data.summary.byCategory).map(([c, v]) => `+${v} ${c}`).join(", ");
        setMsg(`Logged ${data.saved} result${data.saved === 1 ? "" : "s"}${pts ? ` — ${pts}` : ""}${data.summary.duplicates ? `; ${data.summary.duplicates} already on file` : ""}.`);
        setText("");
        router.refresh();
      }
    } catch (e) {
      setMsg(`Could not reach the server: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(eventId: number) {
    setBusy(eventId);
    setMsg(null);
    try {
      const res = await fetch(`/api/results?eventId=${eventId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setMsg(data.error ?? `Delete failed (${res.status}).`); return; }
      setMsg(`Removed event ${eventId}.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const newRows = preview?.rows.filter((r) => r.status === "new") ?? [];
  const canSave = newRows.length > 0 && busy == null;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setPreview(null); }}
        placeholder={PLACEHOLDER}
        rows={6}
        spellCheck={false}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Screen read on
          <Input type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); setPreview(null); }} className="h-8 w-40 text-xs" />
        </label>
        <span className="text-[11px] text-muted-foreground">(&ldquo;Yesterday&rdquo; and &ldquo;Today&rdquo; resolve against this date)</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={!text.trim() || busy != null}>
            {busy === "preview" ? "Scoring…" : "Preview"}
          </Button>
          <Button size="sm" onClick={() => submit(false)} disabled={!canSave || !preview}>
            {busy === "save" ? "Logging…" : `Log ${newRows.length || ""} new result${newRows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      {preview && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5">Event</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Categories</th>
                <th className="px-2 py-1.5 text-right">Field</th>
                <th className="px-2 py-1.5">Finish</th>
                <th className="px-2 py-1.5 text-right">Pts each</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px] tabular-nums">
              {preview.rows.map((r, i) => <PreviewRow key={`${r.eventId ?? "x"}-${i}`} r={r} />)}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{preview.summary.new}</span> new</span>
            <span><span className="font-semibold text-foreground">{preview.summary.duplicates}</span> already logged</span>
            <span><span className={cn("font-semibold", preview.summary.problems ? "text-amber-500" : "text-foreground")}>{preview.summary.problems}</span> unreadable</span>
            {Object.keys(preview.summary.byCategory).length > 0 && (
              <span className="ml-auto">
                would add {Object.entries(preview.summary.byCategory).map(([c, v]) => `+${v} ${c}`).join(" · ")}
              </span>
            )}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {recent.length} event{recent.length === 1 ? "" : "s"} logged in {periodName} — expand to correct one
          </summary>
          <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-border/50 rounded-md border border-border">
            {recent.map((e) => (
              <li key={e.eventId ?? e.name} className="flex items-center gap-2 px-2 py-1 font-mono text-[12px]">
                <span className="w-20 shrink-0 text-muted-foreground">{e.occurredOn.slice(5)}</span>
                <span className="min-w-0 flex-1 truncate font-sans">{e.name}{e.eventId != null ? ` (${e.eventId})` : ""}</span>
                <span className="shrink-0 text-muted-foreground">{e.eliminated ? "elim." : e.placement}{e.fieldSize ? ` / ${e.fieldSize}` : ""}</span>
                <span className="w-28 shrink-0 text-right">{e.points > 0 ? e.categories.map((c) => `+${e.points} ${c}`).join(", ") : "0"}</span>
                {e.eventId != null && (
                  <button
                    type="button"
                    onClick={() => remove(e.eventId!)}
                    disabled={busy != null}
                    className="shrink-0 rounded px-1.5 text-muted-foreground hover:bg-accent hover:text-red-500 disabled:opacity-50"
                    title="Remove this logged result"
                    aria-label={`Remove ${e.name}`}
                  >
                    {busy === e.eventId ? "…" : "✕"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PreviewRow({ r }: { r: EntryRow }) {
  const chip =
    r.status === "new"
      ? { label: "new", cls: "border-emerald-500/50 text-emerald-500" }
      : r.status === "duplicate"
        ? { label: "already logged", cls: "border-border text-muted-foreground" }
        : { label: "unreadable", cls: "border-amber-500/50 text-amber-500" };
  return (
    <>
      <tr className={cn("border-b border-border/50", r.status !== "new" && "text-muted-foreground")}>
        <td className="max-w-[260px] truncate px-2 py-1.5 font-sans" title={r.line}>
          {r.name}{r.eventId != null && <span className="ml-1 text-[11px] text-muted-foreground">({r.eventId})</span>}
        </td>
        <td className="px-2 py-1.5">{r.occurredOn?.slice(5) ?? "—"}</td>
        <td className="px-2 py-1.5 font-sans">{r.categories.join(", ") || "—"}</td>
        <td className="px-2 py-1.5 text-right">{r.fieldSize ?? "—"}</td>
        <td className="px-2 py-1.5">{r.eliminated ? "eliminated" : r.placement ?? "—"}</td>
        <td className={cn("px-2 py-1.5 text-right", r.points >= 10 && r.status === "new" && "font-semibold text-emerald-500")}>
          {r.points}{r.categories.length > 1 ? ` ×${r.categories.length}` : ""}
        </td>
        <td className="px-2 py-1.5 font-sans">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", chip.cls)}>{chip.label}</span>
        </td>
      </tr>
      {r.problems.length > 0 && (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="px-2 pb-1.5 font-sans text-[11px] text-amber-600 dark:text-amber-400">
            {r.problems.join(" ")}
          </td>
        </tr>
      )}
    </>
  );
}
