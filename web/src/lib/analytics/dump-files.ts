import { readdirSync } from "node:fs";

/**
 * The newest competitive community dump of a kind, by file name.
 *
 * Since 2026-10-19 the data push also carries Quick dumps
 * (pt27_tournaments_quick_dump_*.csv) that hold only Quick and EF events.
 * "quick" sorts after "competitve", so a plain sort().at(-1) over
 * pt27_tournaments_*.csv picked the Quick dump: the format split lost its
 * run dates, current-rosters saw only Quicks, and catalogue:sync added Q-/EF-
 * rows. Every "newest dump" lookup goes through here.
 */
export function newestDumpFile(dir: string, kind: "tournaments" | "drafts"): string | undefined {
  const prefix = `pt27_${kind}_competitve_dump_`;
  return readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".csv")).sort().at(-1);
}

/** A competitive dump's file name ("competitve" is the publisher's spelling). The Quick dumps are not one. */
export function isCompetitiveDumpFile(file: string): boolean {
  return /^pt27_(tournaments|drafts)_competitve_dump_.*\.csv$/i.test(file);
}

/**
 * Quick and EF events: Q-Gold-Bo5-T16-ID12, EF-4T-Challenge-Diamond-ID3,
 * PD-Q-Bo5-T16-ID7, PD-EF-H2H-Challenge-ID2. They score in no PTCS category
 * (the game's Your Tournaments screen shows no STANDINGS tag for them), and
 * only the Quick dumps carry them.
 */
export function isQuickEvent(name: string): boolean {
  return /^(PD-)?(EF|Q)-/i.test(name.trim());
}

export interface PeriodWindow { name: string; startsOn: string; endsOn: string }

const DAY_MS = 86_400_000;
const ymdMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** The period in play on a day (YYYY-MM-DD), if any. */
export function periodInPlay<P extends PeriodWindow>(periods: readonly P[], day: string): P | undefined {
  return periods.find((p) => p.startsOn <= day && day <= p.endsOn);
}

/**
 * The periods a dump that reaches `reach` (YYYY-MM-DD) is scored in: the one
 * in play that day, and one that closed within the week before it, since the
 * first dump after a period ends is that period's final board. Oldest first.
 *
 * The loader used to be told the period by name, and the name was typed into
 * Load Tourney Dumps.command. It still said "PTCS 8" on 11-02 and 11-09, so
 * no dump carried the PTCS 9 window and /ptcs had no rank or line for it.
 */
export function periodsForDump<P extends PeriodWindow>(periods: readonly P[], reach: string, graceDays = 7): P[] {
  const at = ymdMs(reach);
  return periods
    .filter((p) => (p.startsOn <= reach && reach <= p.endsOn) || (p.endsOn < reach && at - ymdMs(p.endsOn) <= graceDays * DAY_MS))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/** The capture date in a dump's file name (…_dump_20261109.csv → 2026-11-09). */
export function dumpFileDate(file: string): string | undefined {
  const m = /(\d{4})(\d{2})(\d{2})\.csv$/i.exec(file);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
