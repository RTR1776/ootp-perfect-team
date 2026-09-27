"use client";

/**
 * Upload surface: drop exports or a league week folder, read each preview,
 * then save.
 *
 * Every file is sent twice: once with `?dryRun=1` for a preview shown before
 * anything is written, and again to save it. The preview is not ceremony —
 * the shop list has a column-offset trap that produces plausible-looking but
 * wrong prices, and the cheapest place to catch it is a glance at the tier
 * bands. It also says what is on file, so a file older than that, or one
 * already saved, is held back instead of rolling data back (UI plan U1).
 *
 * "Previewed" must not pass for "saved" (U2). On 09-26 a league upload was lost
 * to a page that looked done: a previewed file now wears an amber "Not saved"
 * pill, the bar at the bottom counts what is not saved yet, and leaving the
 * page asks first.
 *
 * Save order is forced (upload-rules compareSaveOrder): shop list, collection,
 * standings, league, dump. The collection export carries no Card ID and is
 * matched against the card universe by rating fingerprint, so it waits for
 * the shop list, and is skipped if the shop list fails.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronRight, FileCheck2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import * as format from "@/lib/format";
import {
  defaultSavedAs, type Dropped, folderDateOf, isCsvName, isPending as pending, KIND_LABEL, kindNoun, latestDayFor, leagueWeekCheck, NOT_CSV, readDropped, saveInOrder, type SaveOutcome, savePlan, tooLarge, tooLargeMessage, type UploadKind, willSaveSummary,
} from "@/lib/upload-rules";
import { cn } from "@/lib/utils";

type Status = "previewing" | "ready" | "already" | "saving" | "saved" | "skipped" | "error";

/** What the route says is on file: an upload (or, for league, the newest week of that league and split). */
interface OnFile { id: number; filename: string; date: string | null; rows?: number | null }
interface Week { snapshotId: number; uploadId: number; capturedOn: string; rows: number; filename: string }

interface QueueItem {
  id: string;
  file: File | null;
  name: string;
  /** Folder the file was dropped in, when it was a YYYY-MM-DD week folder. */
  folderDate: string | null;
  /** The file's own timestamp (ms), which dates an export with no date in its name. */
  modified?: number;
  status: Status;
  kind?: UploadKind;
  /** Dumps: tournaments or drafts. */
  source?: string | null;
  stats?: Record<string, unknown>;
  error?: string;
  detail?: string;
  uploadId?: number;
  /** "Saved as": the day the file is filed under. League: the Sunday its week ends. */
  capturedOn?: string;
  onFile?: OnFile | null;
  weeks?: Week[];
  already?: OnFile;
  /** "Include anyway", ticked on a file held back as older or superseded. */
  forced?: boolean;
  /** Opened or closed by hand; unset, a row opens itself on an error or a warning. */
  open?: boolean;
  /** Shop list saves: false when it was older, so card values were left alone. */
  cardsUpdated?: boolean;
  /** The route never read it: not a CSV, too large, unreadable, or the request failed. Such a file isn't "Not recognised". */
  local?: boolean;
}

interface Row {
  it: QueueItem;
  older: boolean;
  supersededBy: QueueItem | null;
  included: boolean;
  /** The snapshot a league file would replace, for the week it is saved as. */
  replaces: Week | null;
  warn: boolean;
}

const num = (value: unknown) => (typeof value === "number" ? value.toLocaleString("en-US") : String(value ?? "—"));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "HD451, HD453 and PEL". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * One request to the route. A request that fails outright (a dropped
 * connection, a file the browser can no longer read) used to leave the card
 * on "parsing" for good, with no error. Give up after 90 s (the route's own
 * limit is 60) and say why. A dropped connection is retried once first: on
 * 2026-09-26 L.J.'s drops failed at random and went through on a second try.
 * A retried save is safe, since the route recognises a file it already has by
 * its sha256. `reached` is false when the route never answered (a 413, a
 * failed request), so the page doesn't call the file "Not recognised".
 */
async function send(file: File, opts: { dryRun: boolean; capturedOn?: string | null }) {
  const body = new FormData();
  body.append("file", file);
  if (opts.capturedOn) body.append("capturedOn", opts.capturedOn);
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const response = await fetch(`/api/upload${opts.dryRun ? "?dryRun=1" : ""}`, { method: "POST", body, signal: ctrl.signal });
      // Vercel turns away a body over 4.5 MB before the route runs, with a bare 413.
      if (response.status === 413) return { ok: false, reached: false, json: { error: tooLargeMessage(file.size) } as Record<string, unknown> };
      // The sign-in check answers before the importer sees the file.
      if (response.status === 401) return { ok: false, reached: false, json: { error: "Signed out, so the file wasn't read. Reload the page to sign in, then drop it again." } as Record<string, unknown> };
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      // The route always says what it read, or why not; a bare hosting error (502, 504) doesn't.
      if (!response.ok && typeof json.kind !== "string" && typeof json.error !== "string") {
        return { ok: false, reached: false, json: { error: `Server error (HTTP ${response.status}); nothing was saved. Try again in a minute.` } as Record<string, unknown> };
      }
      return { ok: response.ok, reached: true, json };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch (first) {
    const aborted = (first as Error)?.name === "AbortError";
    try {
      if (aborted) throw first;
      await new Promise((r) => setTimeout(r, 1500));
      return await attempt();
    } catch (e) {
      const err = e as Error;
      return {
        ok: false,
        reached: false,
        json: {
          error: err?.name === "AbortError" ? "No answer from the server in 90 seconds." : "The file did not reach the server (tried twice).",
          detail: `${err?.message ?? String(e)} — refresh the page and drop the file again.`,
        } as Record<string, unknown>,
      };
    }
  }
}

/** "Older than the shop list on file (Sep 25, pt_card_list.csv). …" */
function olderNote(kind: UploadKind, onFile: OnFile): string {
  const on = `Older than the ${kindNoun(kind)} on file (${format.date(onFile.date)}, ${onFile.filename}).`;
  if (kind === "shop_list") return `${on} Saving it only adds its prices to the history; card values stay with the newer list.`;
  if (kind === "dump") return `${on} Saving it only adds it to the history; PTCS keeps reading the newer one.`;
  return `${on} Saving it makes the app use this older data.`;
}

/* ------------------------------------------------------------------ */
/* Per-kind report                                                     */
/* ------------------------------------------------------------------ */

/** The one fact that says a file read right, for the collapsed row. */
function keyCheck(it: QueueItem): { text: string; bad?: boolean } | null {
  const s = it.stats;
  if (!s || !it.kind) return null;
  if (it.kind === "shop_list") {
    return s.tierBandsValid === false ? { text: "columns shifted", bad: true } : { text: `${num(s.total)} cards · columns OK` };
  }
  if (it.kind === "collection") {
    const rate = typeof s.matchRate === "number" ? s.matchRate : null;
    const unmatched = Number(s.unmatched ?? 0);
    return { text: `${num(s.total)} cards · ${format.pct(rate, 1)} matched${unmatched ? ` · ${unmatched} unmatched` : ""}`, bad: rate != null && rate < 0.98 };
  }
  if (it.kind === "league") {
    return { text: `${s.league ?? "?"} ${s.split ?? "all"} · ${num(s.rows)} rows${s.truncated ? " · pitchers missing" : ""}`, bad: s.truncated === true };
  }
  if (it.kind === "dump") return { text: `${s.source ?? "dump"} · through ${format.date(String(s.dateMax ?? ""))}` };
  return { text: `${s.category ?? "?"} · ${num(s.rows)} rows` };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="label-eyebrow text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm", tone === "good" && "text-positive", tone === "bad" && "text-negative")}>{value}</div>
    </div>
  );
}

function Report({ kind, stats }: { kind: UploadKind; stats: Record<string, unknown> }) {
  if (kind === "league") {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Teams" value={num(stats.teams)} />
        <Stat label="Unique cards" value={num(stats.uniqueCids)} />
        <Stat label="Clan teams" value={num(stats.clanTeams)} />
        <Stat label="Free-agent rows" value={num(stats.freeAgentRows)} />
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
        <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs [overflow-wrap:anywhere]", valid ? "border-border text-muted-foreground" : "border-negative/30 bg-negative/5 text-negative")}>
          {valid ? <Check className="mt-px size-3.5 shrink-0 text-positive" /> : <AlertTriangle className="mt-px size-3.5 shrink-0" />}
          <span>
            {valid
              ? <>Column alignment OK — tier codes partition Card Value cleanly ({num(stats.headerFields)}-field header, {num(stats.dataFields)}-field rows).</>
              : <>Columns are shifted. Tier codes do not partition Card Value, so every price and ownership count in this file is wrong. It will be refused.</>}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 text-left font-medium">Tier</th>
                {tiers.map((t) => <th key={t} className="py-1.5 text-right font-medium">{t}</th>)}
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-left font-sans text-muted-foreground">Cards</td>
                {tiers.map((t) => <td key={t} className="py-1.5 text-right">{num(byTier[t] ?? 0)}</td>)}
              </tr>
              <tr>
                <td className="py-1.5 text-left font-sans text-muted-foreground">Owned</td>
                {tiers.map((t) => <td key={t} className="py-1.5 text-right">{num(ownedByTier[t] ?? 0)}</td>)}
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
          <Stat label="Match rate" value={format.pct(rate, 1)} tone={rate === 1 ? "good" : rate != null && rate < 0.98 ? "bad" : undefined} />
          <Stat label="Unmatched" value={num(unmatched)} tone={unmatched > 0 ? "bad" : "good"} />
        </div>
        {unmatched > 0 && <p className="text-xs text-warning">Cards the shop list on file doesn&apos;t have: save a fresh shop list with it.</p>}
        {stats.hasActiveColumn === false && (
          <p className="text-xs text-warning">
            This export has no ACT column, so the active roster cannot be read from it. Re-export with active status included if you want the roster flag populated.
          </p>
        )}
      </div>
    );
  }

  if (kind === "dump") {
    return (
      <p className="text-xs text-muted-foreground">
        {String(stats.source ?? "Community")} dump: {num(stats.events)} events, {format.range(String(stats.dateMin ?? ""), String(stats.dateMax ?? ""))}
        {stats.period ? `, scored for ${String(stats.period)}` : ""}.
      </p>
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
            rank {rank}: <span className="font-mono text-foreground">{num(cutoffs[String(rank)])}</span>
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Save it as the day the export was pulled: the filename names the period, not that day, and the cutoff projection counts elapsed days from it.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One file                                                            */
/* ------------------------------------------------------------------ */

const PILL: Record<Status, [label: string, className: string]> = {
  previewing: ["Previewing…", "bg-muted text-muted-foreground"],
  ready: ["Not saved", "bg-warning/15 text-warning"],
  already: ["Already saved", "bg-muted text-muted-foreground"],
  saving: ["Saving…", "bg-primary/15 text-primary"],
  saved: ["Saved", "bg-positive/15 text-positive"],
  skipped: ["Skipped", "bg-warning/15 text-warning"],
  error: ["Failed", "bg-negative/15 text-negative"],
};

/** Each status in one word, for the icon's label and tooltip. A previewed file's pill says "Not saved"; its icon says "Previewed". */
const STATUS_WORD: Record<Status, string> = {
  previewing: "Previewing…",
  ready: "Previewed",
  already: "Already saved",
  saving: "Saving…",
  saved: "Saved",
  skipped: "Skipped",
  error: "Failed",
};

const STATUS_ICON: Record<Status, [icon: typeof Check, className: string]> = {
  previewing: [Loader2, "animate-spin text-muted-foreground"],
  ready: [FileCheck2, "text-muted-foreground"],
  already: [Check, "text-muted-foreground"],
  saving: [Loader2, "animate-spin text-muted-foreground"],
  saved: [Check, "text-positive"],
  skipped: [AlertTriangle, "text-warning"],
  error: [X, "text-negative"],
};

function StatusIcon({ status }: { status: Status }) {
  const [Icon, className] = STATUS_ICON[status];
  // lucide appends children to its own keyed paths, so the title needs a key too.
  return (
    <Icon role="img" aria-label={STATUS_WORD[status]} className={cn("mt-0.5 size-4 shrink-0", className)}>
      <title key="status">{STATUS_WORD[status]}</title>
    </Icon>
  );
}

const dateInput = "rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground disabled:opacity-60";

/**
 * A date field that commits a whole date, not each keystroke: a native date
 * input reports a full date after every typed part ("1" in the month gives
 * 2026-01-20), so typing commits on blur or Enter; a day picked from the
 * calendar commits at once. Nothing after `max` (latestDayFor) is taken.
 */
function DateField({ value, max, disabled, onCommit }: { value: string; max: string; disabled?: boolean; onCommit: (day: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const typing = useRef(false);
  const commit = (day: string | null) => {
    setDraft(null);
    typing.current = false;
    if (day && day !== value && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= max) onCommit(day);
  };
  return (
    <input
      type="date"
      value={draft ?? value}
      max={max}
      disabled={disabled}
      className={dateInput}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(draft); return; }
        if (e.key === "Escape") { setDraft(null); typing.current = false; return; }
        typing.current = true;
      }}
      onChange={(e) => (typing.current ? setDraft(e.target.value) : commit(e.target.value))}
      onBlur={() => commit(draft)}
    />
  );
}

function ItemRow({
  row, saving, shopGoes, inGroup, onToggle, onRemove, onDate, onForce,
}: {
  row: Row;
  saving: boolean;
  /** A shop list is set to save in this batch (a skipped collection goes after it). */
  shopGoes: boolean;
  /** League files in a week group take the group's date. */
  inGroup?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDate: (value: string) => void;
  onForce: (value: boolean) => void;
}) {
  const { it, older, supersededBy: by, replaces, warn } = row;
  const open = it.open ?? (it.status === "error" || (pending(it) && warn));
  const check = it.status === "already" && it.already
    ? { text: `upload #${it.already.id}, ${format.date(it.already.date)}` }
    : keyCheck(it);
  // In a week group every row is a league export; the group says so once.
  const kindText = inGroup && it.kind === "league" ? null : it.kind ? KIND_LABEL[it.kind] : it.status === "error" && !it.local ? "Not recognised" : null;
  const writing = it.status === "saving";
  const [pillText, pillClass] = PILL[it.status];

  return (
    <li className={cn("rounded-lg border bg-card", it.status === "error" ? "border-negative/40" : pending(it) && warn ? "border-warning/40" : "border-border")}>
      <div className="flex items-start gap-2 px-3 py-2">
        <StatusIcon status={it.status} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 max-w-full items-center gap-1 text-left text-sm font-medium hover:text-primary">
            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
            <span className="truncate">{it.name}</span>
          </button>
          {(kindText || check) && (
            // In a week group the filename already names league and split, so a phone keeps each row to one line.
            <span className={cn("text-xs text-muted-foreground", inGroup && !check?.bad && "hidden sm:inline")}>
              {kindText}
              {kindText && check && " · "}
              {check && <span className={cn(check.bad && "text-negative")}>{check.text}</span>}
            </span>
          )}
          {!inGroup && it.kind && pending(it) && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Saved as
              <DateField value={it.capturedOn ?? ""} max={latestDayFor(it.kind, format.chicagoDay(new Date())!)} disabled={saving} onCommit={onDate} />
            </label>
          )}
          {!inGroup && it.kind && it.status === "saved" && it.capturedOn && (
            <span className="text-xs text-muted-foreground">Saved as {format.date(it.capturedOn)}</span>
          )}
          <span title={it.status === "ready" ? "Previewed, not saved yet" : undefined} className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", pillClass)}>
            {pillText}
          </span>
          {pending(it) && !row.included && <span className="text-xs text-warning">left out</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-my-1 -mr-1.5 size-8 shrink-0"
          aria-label={`Remove ${it.name}`}
          title={writing ? "Saving this file now" : saving && pending(it) ? "Remove (won't be saved)" : "Remove"}
          disabled={writing}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 sm:pl-9">
          {it.error && (
            <div className="rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-xs text-negative [overflow-wrap:anywhere]">
              <div className="font-medium">{it.error}</div>
              {it.detail && <div className="mt-1 opacity-80">{it.detail}</div>}
            </div>
          )}
          {pending(it) && older && it.kind && it.onFile && (
            <Warning text={olderNote(it.kind, it.onFile)} forced={!!it.forced} onForce={onForce} disabled={saving} />
          )}
          {pending(it) && !older && by && (
            <Warning text={`Superseded by ${by.name} in this batch.`} forced={!!it.forced} onForce={onForce} disabled={saving} />
          )}
          {it.status === "skipped" && (shopGoes
            ? <p className="text-xs text-warning">Skipped: the shop list did not save. It saves after the shop list this time.</p>
            : <Warning text="Skipped: the shop list did not save. Drop the shop list again to save both." forced={!!it.forced} onForce={onForce} disabled={saving} />)}
          {it.status === "already" && it.already && (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Already saved (upload #{it.already.id}, {format.date(it.already.date)}) as {it.already.filename}. It won&apos;t be saved twice.
            </p>
          )}
          {it.status === "saved" && (
            <p className="text-xs text-positive">
              Saved (upload #{it.uploadId}).
              {it.kind === "shop_list" && it.cardsUpdated === false && <span className="text-muted-foreground"> Its prices went into the history; card values stay with the newer shop list.</span>}
            </p>
          )}
          {it.kind === "league" && replaces && pending(it) && (
            <p className="text-xs text-muted-foreground">
              Replaces the {String(it.stats?.league)} {String(it.stats?.split)} snapshot for the week ending {format.date(replaces.capturedOn)} ({num(replaces.rows)} rows).
            </p>
          )}
          {it.stats && it.kind && <Report kind={it.kind} stats={it.stats} />}
        </div>
      )}
    </li>
  );
}

function Warning({ text, forced, onForce, disabled }: { text: string; forced: boolean; onForce: (value: boolean) => void; disabled: boolean }) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs [overflow-wrap:anywhere]">
      <p className="flex items-start gap-2 text-warning">
        <AlertTriangle className="mt-px size-3.5 shrink-0" />
        <span>{text}</span>
      </p>
      <label className="mt-2 flex w-fit items-center gap-2 pl-5 text-foreground">
        <input type="checkbox" checked={forced} disabled={disabled} onChange={(e) => onForce(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
        Include anyway
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A league week                                                       */
/* ------------------------------------------------------------------ */

function LeagueGroup({
  week, rows, saving, onWeek, children,
}: {
  week: string;
  rows: Row[];
  saving: boolean;
  onWeek: (value: string) => void;
  children: React.ReactNode;
}) {
  const known = rows.filter((r) => r.it.kind === "league");
  const check = leagueWeekCheck(known.map((r) => ({ league: r.it.stats?.league as string | undefined, split: r.it.stats?.split as string | undefined })));
  // Read the week back only once every file in it has been previewed.
  const done = !rows.some((r) => r.it.status === "previewing");
  const open = rows.filter((r) => pending(r.it) && r.it.kind === "league");
  const replacing = open.filter((r) => r.replaces).length;
  // Leagues with a newer week on file: for them this week is a backfill, and the newer one stays current.
  const newer = [...new Set(open.filter((r) => (r.it.onFile?.date ?? "") > week).map((r) => String(r.it.stats?.league)))].sort();
  const all = new Set(open.map((r) => String(r.it.stats?.league))).size;
  const note = !open.length || !done ? null
    : [
      replacing === 0 ? "Nothing on file for this week yet."
        : replacing === open.length ? `Replaces the ${plural(replacing, "snapshot")} on file for this week.`
          : `${replacing} of ${open.length} replace a snapshot on file for this week.`,
      !newer.length ? null
        : newer.length === all ? "Each league has a newer week on file, which stays current."
          : `${andList(newer)} ${newer.length === 1 ? "has" : "have"} a newer week on file, which stays current.`,
    ].filter(Boolean).join(" ");

  return (
    <section className="rounded-xl border border-border bg-card/40" aria-label={`League week ending ${week}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          League week ending
          <DateField value={week} max={latestDayFor("league", format.chicagoDay(new Date())!)} disabled={saving || !done || !open.length} onCommit={onWeek} />
        </label>
        <span className="text-xs text-muted-foreground">
          <span aria-hidden className="hidden sm:inline">· </span>
          {plural(rows.length, "file")}
          {done ? check.leagues.length > 0 && `: ${check.leagues.join(", ")} × ${check.splits.join("/")}` : " · previewing…"}
        </span>
      </div>
      <div className="space-y-1 px-3 pb-2 pt-1.5 text-xs">
        {done && check.problems.map((p) => <p key={p} className="text-warning">{p}</p>)}
        <p className="text-muted-foreground">
          {note && <>{note} </>}
          The Sunday the league week ends: a part-played export and the finished one share it, and the newer replaces the older.
        </p>
      </div>
      <ul className="space-y-1.5 px-2 pb-2">{children}</ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function UploadQueue() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Requests go one at a time, previews and saves alike: parsing several
      1.5MB files at once on one serverless instance can hit its memory ceiling. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** Files removed while queued or while a save runs; the loops skip them. */
  const removed = useRef<Set<string>>(new Set());

  const enqueue = (task: () => Promise<void>) => {
    chain.current = chain.current.then(task, task);
  };
  const patch = (id: string, next: Partial<QueueItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  // What Save sends (older, superseded, Include anyway, a skipped collection waiting on its shop list): upload-rules savePlan.
  const { rows, shopGoes } = useMemo(() => {
    const plan = savePlan(items);
    const rows: Row[] = items.map((it) => {
      const older = plan.older.has(it.id);
      const by = plan.superseded.get(it.id) ?? null;
      const replaces = it.kind === "league" ? it.weeks?.find((w) => w.capturedOn === it.capturedOn) ?? null : null;
      const warn = older || !!by || it.status === "skipped" || it.stats?.truncated === true || it.stats?.tierBandsValid === false || Number(it.stats?.unmatched ?? 0) > 0;
      return { it, older, supersededBy: by, replaces, warn, included: plan.included.has(it.id) };
    });
    return { rows, shopGoes: plan.shopGoes };
  }, [items]);

  const pendingCount = items.filter(pending).length;
  const included = rows.filter((r) => r.included).map((r) => r.it);
  const previewing = items.some((it) => it.status === "previewing");
  const clearable = items.filter((it) => it.status === "saved" || it.status === "already").length;
  const dirty = pendingCount > 0 || saving != null;
  const leaveMessage = saving
    ? "Files are still saving. Leave anyway?"
    : `${plural(pendingCount, "file")} previewed, not saved yet. Leave without saving?`;

  /* Leaving with previewed files asks first: closing or reloading the tab
     (beforeunload), and following a link inside the app, which beforeunload
     never sees. */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
      if (!window.confirm(leaveMessage)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, leaveMessage]);

  /* Back and Forward are history moves, which neither listener above sees
     (the 09-26 way of losing a queue). While anything is unsaved, one extra
     entry for this page sits on top: Back lands on it and asks; staying puts
     it back, leaving goes on back. Once nothing is unsaved, it comes off. */
  const guarded = useRef(false);
  useEffect(() => {
    if (!dirty) {
      if (guarded.current && (window.history.state as { uploadGuard?: boolean } | null)?.uploadGuard) window.history.back();
      guarded.current = false;
      return;
    }
    const arm = () => window.history.pushState({ ...(window.history.state ?? {}), uploadGuard: true }, "", window.location.href);
    if (!guarded.current) { arm(); guarded.current = true; }
    const onPop = () => {
      if (!guarded.current) return;
      if (window.confirm(leaveMessage)) { guarded.current = false; window.history.back(); }
      else arm();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty, leaveMessage]);

  /* The Save bar pins to the bottom of the screen; toasts sit above it, not on it. */
  const bar = useRef<HTMLDivElement>(null);
  const showBar = pendingCount > 0 || saving != null || previewing || clearable > 0;
  useEffect(() => {
    const el = bar.current;
    if (!showBar || !el) return;
    const root = document.documentElement;
    const lift = () => root.style.setProperty("--toast-lift", `${el.offsetHeight + 8}px`);
    lift();
    const ro = new ResizeObserver(lift);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--toast-lift"); };
  }, [showBar]);

  const preview = async (item: QueueItem) => {
    if (removed.current.has(item.id) || !item.file) return;
    const { ok, reached, json } = await send(item.file, { dryRun: true, capturedOn: item.folderDate });
    const kind = json.kind as UploadKind | undefined;
    const stats = json.stats as Record<string, unknown> | undefined;
    if (!ok) {
      patch(item.id, { status: "error", local: !reached, kind, stats, error: String(json.error ?? "Preview failed."), detail: json.detail || json.hint ? String(json.detail ?? json.hint) : undefined });
      return;
    }
    const source = typeof stats?.source === "string" ? stats.source : null;
    const already = json.alreadyImported as OnFile | undefined;
    if (already && typeof already === "object") {
      patch(item.id, { status: "already", kind, stats, source, already, uploadId: already.id, capturedOn: typeof stats?.capturedOn === "string" ? stats.capturedOn : already.date ?? undefined });
      return;
    }
    patch(item.id, {
      status: "ready",
      kind,
      stats,
      source,
      onFile: (json.onFile as OnFile | null) ?? null,
      weeks: json.weeks as Week[] | undefined,
      capturedOn: kind ? defaultSavedAs(kind, item.name, item.folderDate, new Date(), item.modified != null ? new Date(item.modified) : null) : undefined,
    });
  };

  const addDropped = (list: Dropped[]) => {
    if (!list.length) return;
    const queued: QueueItem[] = list.map((d) => {
      const name = d.path.split("/").pop() || d.path;
      const base = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, file: d.file, name, folderDate: folderDateOf(d.path), modified: d.file?.lastModified };
      if (!d.file) return { ...base, status: "error", local: true, error: d.error ?? `Could not read ${d.path}.` };
      if (!isCsvName(name)) return { ...base, status: "error", local: true, error: NOT_CSV };
      if (tooLarge(d.file.size)) return { ...base, status: "error", local: true, error: tooLargeMessage(d.file.size) };
      return { ...base, status: "previewing" };
    });
    setItems((prev) => [...prev, ...queued]);
    for (const item of queued) if (item.status === "previewing") enqueue(() => preview(item));
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dt = event.dataTransfer;
    // Entries have to be taken now; the list is emptied once this handler returns.
    const entries = Array.from(dt.items ?? []).filter((i) => i.kind === "file").map((i) => i.webkitGetAsEntry?.() ?? null);
    if (entries.length && entries.every((e): e is FileSystemEntry => e != null)) {
      void readDropped(entries).then(addDropped);
    } else {
      addDropped(Array.from(dt.files).map((file) => ({ path: file.name, file })));
    }
  };

  const commitAll = () => {
    const queue = included.filter((it) => it.file);
    if (!queue.length || saving) return;
    setSaving({ done: 0, total: queue.length });
    const step = () => setSaving((s) => (s ? { ...s, done: s.done + 1 } : s));
    enqueue(async () => {
      let tally: Awaited<ReturnType<typeof saveInOrder>>;
      try {
        tally = await saveInOrder(queue, async (item): Promise<SaveOutcome> => {
          patch(item.id, { status: "saving" });
          const { ok, json } = await send(item.file!, { dryRun: false, capturedOn: item.capturedOn });
          step();
          const already = json.alreadyImported;
          if (ok && already && typeof already === "object") {
            patch(item.id, { status: "already", already: already as OnFile, uploadId: Number(json.uploadId) });
            return "already";
          }
          if (ok) {
            patch(item.id, { status: "saved", uploadId: Number(json.uploadId), stats: json.stats as Record<string, unknown>, cardsUpdated: json.cardsUpdated as boolean | undefined, open: undefined });
            return "saved";
          }
          patch(item.id, { status: "error", error: String(json.error ?? "Save failed."), detail: json.detail || json.hint ? String(json.detail ?? json.hint) : undefined });
          return "failed";
        }, {
          cancelled: (id) => removed.current.has(id),
          onSkip: (item) => { patch(item.id, { status: "skipped" }); step(); },
          // Removed while waiting its turn: it never goes, so the count moves past it.
          onCancel: step,
        });
      } catch (e) {
        toast({ message: `Saving stopped: ${(e as Error)?.message ?? String(e)}. Check the rows above.`, tone: "error" });
        return;
      } finally {
        // Whatever happened, the Save bar comes back and the status above is re-read.
        setSaving(null);
        router.refresh();
      }
      const went = tally.saved + tally.already + tally.failed + tally.skipped;
      const parts = went === 0 ? ["Nothing was saved."] : [
        tally.saved ? `Saved ${plural(tally.saved, "file")}.` : null,
        tally.already ? `${tally.already} already saved.` : null,
        tally.failed ? `${tally.failed} failed; see the red ${tally.failed === 1 ? "row" : "rows"}.` : null,
        tally.skipped ? `${tally.skipped} skipped.` : null,
        "Status above updated.",
      ].filter(Boolean);
      toast({ message: parts.join(" "), tone: tally.failed ? "error" : went ? "success" : "info" });
    });
  };

  const remove = (id: string) => {
    const at = items.findIndex((it) => it.id === id);
    const item = items[at];
    if (!item || item.status === "saving") return;
    removed.current.add(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (pending(item)) {
      toast({
        message: `Removed ${item.name}${saving ? "; it won't be saved" : ""}.`,
        action: {
          label: "Undo",
          onClick: () => {
            removed.current.delete(id);
            setItems((prev) => (prev.some((it) => it.id === id) ? prev : [...prev.slice(0, at), item, ...prev.slice(at)]));
          },
        },
      });
    }
  };

  const toggle = (row: Row) => {
    const open = row.it.open ?? (row.it.status === "error" || (pending(row.it) && row.warn));
    patch(row.it.id, { open: !open });
  };
  const setWeek = (week: string, value: string) =>
    setItems((prev) => prev.map((it) => (it.kind === "league" && pending(it) && it.capturedOn === week ? { ...it, capturedOn: value } : it)));

  const itemRow = (row: Row, inGroup = false) => (
    <ItemRow
      key={row.it.id}
      row={row}
      saving={saving != null}
      shopGoes={shopGoes}
      inGroup={inGroup}
      onToggle={() => toggle(row)}
      onRemove={() => remove(row.it.id)}
      onDate={(value) => patch(row.it.id, { capturedOn: value })}
      onForce={(value) => patch(row.it.id, { forced: value })}
    />
  );

  /* League files sit in one group per week. A file still previewing from a
     week folder waits in its folder's group, so the list doesn't jump. */
  const weekOf = (it: QueueItem) =>
    it.kind === "league" ? it.capturedOn ?? (typeof it.stats?.capturedOn === "string" ? it.stats.capturedOn : null)
      : !it.kind && it.status === "previewing" ? it.folderDate : null;
  const loose = rows.filter((r) => !weekOf(r.it));
  const weeks = [...new Set(rows.map((r) => weekOf(r.it)).filter((w): w is string => !!w))].sort().reverse();
  const busy = previewing || saving != null;

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add exports: drop files or a league week folder here, or press Enter to choose files"
        aria-describedby="upload-drop-hint"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50 hover:bg-accent/30",
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <div className="text-sm font-medium">Drop exports or a league week folder here, or click to choose files</div>
        <div id="upload-drop-hint" className="space-y-0.5 text-xs text-muted-foreground">
          <p>Shop list (pt_card_list.csv) · Manage Cards export · league _all / _vL / _vR files, or the week&apos;s folder</p>
          <p>Community dumps: use Load Tourney Dumps.command</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          addDropped(Array.from(e.target.files ?? []).map((file) => ({ path: file.webkitRelativePath || file.name, file })));
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <div className="space-y-3">
          {loose.length > 0 && <ul className="space-y-1.5">{loose.map((r) => itemRow(r))}</ul>}
          {weeks.map((week) => (
            <LeagueGroup key={week} week={week} rows={rows.filter((r) => weekOf(r.it) === week)} saving={saving != null} onWeek={(value) => setWeek(week, value)}>
              {rows.filter((r) => weekOf(r.it) === week).map((r) => itemRow(r, true))}
            </LeagueGroup>
          ))}

          {showBar && (
            <div ref={bar} className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border-t border-border bg-card px-4 py-3 shadow-[0_-6px_16px_-10px_rgb(0_0_0/0.5)]">
              <div className="min-w-0 flex-1 basis-56 text-sm" aria-live="polite">
                {saving ? (
                  <span>Saving {Math.min(saving.done + 1, saving.total)} of {saving.total}…</span>
                ) : pendingCount > 0 ? (
                  <>
                    <div className="font-medium text-warning">{plural(pendingCount, "file")} previewed, not saved yet</div>
                    <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {included.length ? `Will save: ${willSaveSummary(included)}.` : "Nothing is set to save; tick Include anyway on a file to save it."}
                    </div>
                  </>
                ) : previewing ? (
                  <span className="text-muted-foreground">Previewing…</span>
                ) : (
                  <span className="text-muted-foreground">Nothing left to save.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {clearable > 0 && !saving && (
                  <Button variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((it) => it.status !== "saved" && it.status !== "already"))}>
                    Clear saved
                  </Button>
                )}
                {(pendingCount > 0 || saving) && (
                  <Button onClick={commitAll} disabled={busy || included.length === 0}>
                    {saving ? "Saving…" : `Save ${plural(included.length, "file")}`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
