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
