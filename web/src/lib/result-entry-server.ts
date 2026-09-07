/**
 * The PTCS result ledger, server side: score pasted rows, dedupe on event id,
 * write. Used by /api/results (the page) and scripts/log-results.ts (the CLI)
 * so both paths are the same code.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { periods, results } from "@/db/schema";
import { parseResultLines } from "@/lib/result-lines";
import { scoreResult, type ResultRow } from "@/lib/scoring";
import { todayInChicago } from "@/lib/ptcs-progress";
import type { EntryResponse, EntryRow } from "@/lib/result-entry";

export interface EnterResultsInput {
  text: string;
  /** YYYY-MM-DD the screen was read; resolves "Yesterday". Default: today, Central. */
  asOf?: string | null;
  /** Score and dedupe, write nothing. */
  dryRun: boolean;
}

export type EnterResultsOutcome = { ok: true; value: EntryResponse } | { ok: false; error: string; status: 400 };

/** Warnings from the scorer that make a row unsafe to log. */
function blocking(scored: ResultRow): string[] {
  return scored.warnings.filter((w) => !(scored.eliminated && /placement|scoring category/i.test(w)));
}

export async function enterResults(input: EnterResultsInput): Promise<EnterResultsOutcome> {
  if (typeof input.text !== "string" || !input.text.trim()) return { ok: false, error: "Paste at least one result row.", status: 400 };
  if (input.text.length > 40_000) return { ok: false, error: "That is more than one screen - paste fewer rows at a time.", status: 400 };
  const asOf =
    typeof input.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.asOf) && Number.isFinite(Date.parse(`${input.asOf}T00:00:00Z`))
      ? input.asOf
      : todayInChicago();
  const dryRun = input.dryRun === true;

  const allPeriods = await db.select().from(periods);
  const periodFor = (date: string) => allPeriods.find((p) => p.startsOn <= date && date <= p.endsOn) ?? null;

  const parsed = parseResultLines(input.text, asOf);
  const scored = parsed.map((p) => ({ p, s: p.input ? scoreResult(p.input) : null }));
  const ids = scored.map((x) => x.s?.eventId).filter((id): id is number => id != null);
  const already = new Set(
    ids.length
      ? (await db.select({ eventId: results.eventId }).from(results).where(inArray(results.eventId, ids))).map((r) => r.eventId)
      : [],
  );

  const seenInPaste = new Set<number>();
  const rows: EntryRow[] = [];
  const byCategory: Record<string, number> = {};
  const toInsert: (typeof results.$inferInsert)[] = [];

  for (const { p, s } of scored) {
    const problems = [...p.problems];
    const occurredOn = p.occurredOn ?? asOf;
    if (!p.occurredOn && p.input) problems.push(`No date on the row - assumed the screen date, ${asOf}.`);
    const period = periodFor(occurredOn);
    const base: EntryRow = {
      line: p.line, eventId: s?.eventId ?? null, name: s?.name ?? p.line.slice(0, 60), occurredOn, periodName: period?.name ?? null,
      categories: s?.categories ?? [], points: s?.points ?? 0, totalPoints: s?.totalPoints ?? 0,
      fieldSize: s?.fieldSize ?? null, placement: s?.placement ?? null, eliminated: s?.eliminated ?? false,
      status: "problem", problems,
    };
    if (!s) { rows.push(base); continue; }
    problems.push(...blocking(s));
    if (!period) problems.push(`No PTCS period covers ${occurredOn} - create it first (pnpm period:new).`);
    if (s.eventId == null) { rows.push(base); continue; }
    // Duplicates win over problems: an already-logged row needs no re-reading.
    if (already.has(s.eventId) || seenInPaste.has(s.eventId)) {
      rows.push({ ...base, status: "duplicate", problems: [] });
      continue;
    }
    if (problems.length) { rows.push(base); continue; }
    seenInPaste.add(s.eventId);
    rows.push({ ...base, status: "new", problems: [] });
    for (const c of s.categories) byCategory[c] = (byCategory[c] ?? 0) + s.points;
    toInsert.push({
      periodId: period!.id, eventId: s.eventId, occurredOn, name: s.name, standingsTag: s.standingsTag,
      categories: s.categories, fieldSize: s.fieldSize, placement: s.placement, eliminated: s.eliminated, points: s.points,
    });
  }

  let saved: number | null = null;
  if (!dryRun && toInsert.length) {
    // One statement: all the new rows land or none do. A concurrent paste of the
    // same screen loses the race on event_id, which is exactly what we want.
    const inserted = await db.insert(results).values(toInsert).onConflictDoNothing({ target: results.eventId }).returning({ id: results.id });
    saved = inserted.length;
  } else if (!dryRun) saved = 0;

  return {
    ok: true,
    value: {
      asOf,
      rows,
      summary: {
        new: rows.filter((r) => r.status === "new").length,
        duplicates: rows.filter((r) => r.status === "duplicate").length,
        problems: rows.filter((r) => r.status === "problem").length,
        byCategory,
      },
      saved,
    },
  };
}

/** Remove one logged event. Returns how many rows went (0 or 1). */
export async function deleteResult(eventId: number): Promise<number> {
  const gone = await db.delete(results).where(eq(results.eventId, eventId)).returning({ id: results.id });
  return gone.length;
}
