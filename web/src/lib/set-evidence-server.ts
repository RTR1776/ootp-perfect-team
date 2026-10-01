/**
 * Loads the card sets and years a series' field played (lib/set-evidence.ts
 * reads them). Server only: it queries the database.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, observedCardStats } from "@/db/schema";
import { summariseSetEvidence, type SetEvidence } from "@/lib/set-evidence";
import { chicagoDay } from "@/lib/format";

/** One series' evidence, or null when it has no exports on file. */
export async function loadSetEvidence(series: string): Promise<SetEvidence | null> {
  return (await loadSetEvidenceMany([series])).get(series) ?? null;
}

/** Evidence for many series in one query, keyed by series. */
export async function loadSetEvidenceMany(series: readonly string[]): Promise<Map<string, SetEvidence>> {
  const out = new Map<string, SetEvidence>();
  if (!series.length) return out;
  // (series, card_id) is the table's key, so each card counts once per series.
  const rows = await db
    .select({ series: observedCardStats.series, cardId: observedCardStats.cardId, cardType: cards.cardType, year: cards.year })
    .from(observedCardStats)
    .innerJoin(cards, eq(cards.cardId, observedCardStats.cardId))
    .where(inArray(observedCardStats.series, [...series]));
  const bySeries = new Map<string, { cardType: number | null; year: number | null }[]>();
  for (const r of rows) {
    const list = bySeries.get(r.series) ?? [];
    list.push({ cardType: r.cardType, year: r.year });
    bySeries.set(r.series, list);
  }
  for (const [s, list] of bySeries) {
    const e = summariseSetEvidence(list);
    if (e) out.set(s, e);
  }
  return out;
}

/**
 * Whether a series' exports on file predate an event's format change
 * (restrictions.formatSince), so its field play describes another event.
 *
 * observed_card_stats sums every export of a series, so the answer is for the
 * whole series: stale if ANY of its current files was imported before `since`.
 * Files are dated by the first import batch that carried them (import_batches,
 * kept since 2026-09-07). The filer imports each file on its own right after
 * the event, so that date is the event's; a file first seen in a bulk import
 * (many series at once, the 09-27 full re-import) can't be dated and counts
 * as old. series_meta.updated_at can't answer this: every import refreshes it.
 */
export async function exportsPredate(series: string, since: string): Promise<{ stale: boolean; files: number; before: number; undated: number }> {
  const pattern = `^${series.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_[0-9]+\\.csv$`;
  const res = await db.execute(sql`
    select f->>'name' as name, f->>'runOn' as run_on, f->>'series' as filed_as, b.id, b.started_at as at, jsonb_array_length(b.scope) as width
    from import_batches b, jsonb_array_elements(b.files) f
    where b.kind = 'observed' and b.status = 'published' and f->>'name' ~ ${pattern}
    order by b.id`);
  const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { name: string; run_on: string | null; filed_as: string | null; id: number; at: string | Date; width: number }[];
  if (!rows.length) return { stale: true, files: 0, before: 0, undated: 0 };
  const latest = Math.max(...rows.map((r) => Number(r.id)));
  // A file the importer filed under another series (an old-format run split off
  // to "<slug>-preYYYYMMDD", lib/format-split) is not this series' play.
  const newest = rows.filter((r) => Number(r.id) === latest && (!r.filed_as || r.filed_as === series));
  const current = new Set(newest.map((r) => r.name));
  if (!current.size) return { stale: true, files: 0, before: 0, undated: 0 };
  let before = 0, undated = 0;
  for (const name of current) {
    // The run's own day when the importer recorded it; else the day it was first filed.
    const runOn = newest.find((r) => r.name === name)!.run_on;
    if (runOn) { if (runOn < since) before++; continue; }
    const first = rows.find((r) => r.name === name)!;
    if (Number(first.width) > 3) undated++;
    else if ((chicagoDay(new Date(first.at)) ?? "") < since) before++;
  }
  return { stale: before + undated > 0, files: current.size, before, undated };
}
