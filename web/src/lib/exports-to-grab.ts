/**
 * The tournament exports still to file (L.J., 2026-10-16: "I need to upload
 * tonight, what is the last tourney date or tourney I uploaded"): every
 * non-draft event he played — the results logged from his screenshots and his
 * rows in the community dump — whose export is in no published import yet.
 *
 * An export is "<series>_<run>.csv": the series is the catalogue's slug for the
 * event's slot (the event id's first three digits), the run its last four
 * (1290206 → goldfather_206). Your Tournaments keeps about a week, so an event
 * older than that is marked as probably gone. Drafts (2xxxxxx) aren't filed.
 */

import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { importBatches, myResults, results, tournaments } from "@/db/schema";

export const KEEP_DAYS = 7;
const LOOK_BACK_DAYS = 21;

export interface ExportToGrab {
  eventId: number;
  name: string;
  /** YYYY-MM-DD the event ran. */
  on: string;
  /** "goldfather_206", or null when the slot has no series in the catalogue. */
  file: string | null;
  ageDays: number;
  /** Past the week Your Tournaments keeps. */
  likelyGone: boolean;
}

export interface ExportsToGrab {
  rows: ExportToGrab[];
  /** The newest run date among the events already imported (of those he played), YYYY-MM-DD. */
  newestImported: string | null;
  /** When the last tournament import was published. */
  lastImportAt: Date | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function loadExportsToGrab(now: Date = new Date()): Promise<ExportsToGrab> {
  const since = new Date(now.getTime() - LOOK_BACK_DAYS * 86_400_000);
  const [logged, dumped, cat, batches] = await Promise.all([
    db.select({ eventId: results.eventId, on: results.occurredOn, name: results.name })
      .from(results).where(and(isNotNull(results.eventId), gte(results.occurredOn, ymd(since)))),
    db.select({ eventId: myResults.eventId, at: myResults.startAt, name: myResults.name })
      .from(myResults).where(and(eq(myResults.source, "tournaments"), gte(myResults.startAt, since))),
    db.select({ slot: tournaments.slot, series: tournaments.series, retired: tournaments.retired })
      .from(tournaments).where(and(isNotNull(tournaments.slot), isNotNull(tournaments.series))),
    db.select({ files: importBatches.files, at: importBatches.publishedAt })
      .from(importBatches).where(sql`${importBatches.kind} = 'observed' and ${importBatches.status} = 'published'`),
  ]);

  // The series for each slot, a current event's first.
  const seriesBySlot = new Map<number, string>();
  for (const t of [...cat].sort((a, b) => Number(a.retired) - Number(b.retired))) {
    if (t.slot != null && t.series && !seriesBySlot.has(t.slot)) seriesBySlot.set(t.slot, t.series);
  }
  const filed = new Set<string>();
  let lastImportAt: Date | null = null;
  for (const b of batches) {
    for (const f of b.files ?? []) filed.add(f.name.replace(/\.csv$/i, ""));
    if (b.at && (!lastImportAt || b.at > lastImportAt)) lastImportAt = b.at;
  }

  const played = new Map<number, { name: string; on: string }>();
  for (const r of logged) if (r.eventId != null && r.eventId < 2_000_000) played.set(r.eventId, { name: r.name.replace(/\s*\(\d+\)\s*$/, ""), on: String(r.on).slice(0, 10) });
  for (const r of dumped) {
    const id = Number(r.eventId);
    if (Number.isFinite(id) && id < 2_000_000 && !played.has(id)) played.set(id, { name: r.name, on: ymd(r.at) });
  }

  const rows: ExportToGrab[] = [];
  let newestImported: string | null = null;
  for (const [eventId, p] of played) {
    const series = seriesBySlot.get(Math.floor(eventId / 10_000)) ?? null;
    const file = series ? `${series}_${eventId % 10_000}` : null;
    if (file && filed.has(file)) {
      if (!newestImported || p.on > newestImported) newestImported = p.on;
      continue;
    }
    const ageDays = Math.floor((now.getTime() - new Date(`${p.on}T12:00:00Z`).getTime()) / 86_400_000);
    rows.push({ eventId, name: p.name, on: p.on, file, ageDays, likelyGone: ageDays > KEEP_DAYS });
  }
  rows.sort((a, b) => a.on.localeCompare(b.on) || a.eventId - b.eventId);
  return { rows, newestImported, lastImportAt };
}
