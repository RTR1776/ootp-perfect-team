/**
 * Which tournament exports count as filed (lib/exports-to-grab reads this).
 * Kept apart from the loader so it is testable without a database.
 */

export interface BatchFiles {
  id: number;
  scope: string[];
  files: { name: string; noStats?: boolean }[];
}

/** "goldfather_235.csv" -> "goldfather". */
const slugOf = (file: string) => file.replace(/\.csv$/i, "").replace(/_\d+$/, "");

/**
 * Which exports count as filed, from the published observed batches.
 *
 * Every import of a series reads all of that series' files, so the NEWEST
 * batch whose scope holds a series is the truth for it: a file it lists with
 * play is filed; one it lists as noStats, or one an older batch listed that it
 * no longer does, needs exporting again. (Taking the union of every batch, as
 * this used to, kept counting a file as filed after it was found unusable.)
 */
export function filedState(batches: BatchFiles[]): { filed: Set<string>; redo: Map<string, "no-stats" | "removed"> } {
  const newest = new Map<string, BatchFiles>();
  for (const b of [...batches].sort((x, y) => x.id - y.id)) for (const s of b.scope) newest.set(s, b);
  const filed = new Set<string>(), flagged = new Set<string>(), ever = new Set<string>();
  for (const b of batches) for (const f of b.files) ever.add(f.name.replace(/\.csv$/i, ""));
  for (const name of ever) {
    const latest = newest.get(slugOf(name));
    const hit = latest ? latest.files.find((f) => f.name.replace(/\.csv$/i, "") === name) : undefined;
    if (!latest) filed.add(name);                 // no batch scoped to its series: trust any listing
    else if (hit && !hit.noStats) filed.add(name);
    else if (hit?.noStats) flagged.add(name);
  }
  const redo = new Map<string, "no-stats" | "removed">();
  for (const name of ever) if (!filed.has(name)) redo.set(name, flagged.has(name) ? "no-stats" : "removed");
  return { filed, redo };
}
