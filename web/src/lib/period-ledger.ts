/**
 * One PTCS period's points, day by day, from every source (lib/result-ledger
 * mergeDays): the imported tracker totals (`daily_totals`), the events logged
 * on /ptcs (`results`) and the community dump's events never logged
 * (`my_results`). /ptcs reads a period through this, and /qualifying sums the
 * same days for the PTWC weekly points, so the two can't disagree.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyTotals, myResults, results } from "@/db/schema";
import { CATEGORIES } from "@/lib/ingest/constants";
import { periodCalendar } from "@/lib/ptcs-progress";
import { dumpEvent, mergeDays, type DumpRow, type LedgerEvent, type MergedDay } from "@/lib/result-ledger";

export interface PeriodRef { id: number; startsOn: string; endsOn: string }

export interface PeriodLedger {
  /** The imported tracker rows (oldest first). */
  imported: (typeof dailyTotals.$inferSelect)[];
  /** Events logged on /ptcs, newest first. */
  events: LedgerEvent[];
  /** The dump's events inside the period (logged or not; mergeDays drops the logged ones). */
  dumpEvents: LedgerEvent[];
  calendar: ReturnType<typeof periodCalendar>;
  /** Every day of the period so far. */
  days: MergedDay[];
}

/** `myRows` is every my_results row; pass it when the caller has it already. */
export async function loadPeriodLedger(period: PeriodRef, myRows?: readonly DumpRow[]): Promise<PeriodLedger> {
  const [imported, ledger, dump] = await Promise.all([
    db.select().from(dailyTotals).where(eq(dailyTotals.periodId, period.id)).orderBy(asc(dailyTotals.occurredOn)),
    db.select().from(results).where(eq(results.periodId, period.id)).orderBy(desc(results.occurredOn), desc(results.id)),
    myRows ? Promise.resolve(myRows) : db.select().from(myResults).orderBy(desc(myResults.startAt)),
  ]);
  const events: LedgerEvent[] = ledger.map((r) => ({
    eventId: r.eventId, name: r.name, occurredOn: r.occurredOn, categories: r.categories,
    points: r.points, fieldSize: r.fieldSize, placement: r.placement, eliminated: r.eliminated,
  }));
  const dumpEvents = dump
    .filter((r) => r.categories !== "")
    .map(dumpEvent)
    .filter((e) => period.startsOn <= e.occurredOn && e.occurredOn <= period.endsOn);
  const calendar = periodCalendar(period.startsOn, period.endsOn);
  // One source per day for the imported tracker; logged events and the dump's
  // never-logged ones count together, each event once.
  const days = mergeDays(
    calendar.dates, CATEGORIES,
    imported.map((r) => ({ occurredOn: r.occurredOn, category: r.category, points: r.points, note: r.note })),
    [...events, ...dumpEvents],
  );
  return { imported, events, dumpEvents, calendar, days };
}
