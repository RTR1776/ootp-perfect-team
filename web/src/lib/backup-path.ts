/**
 * A backup file's path, or the same path with -2, -3, … before the extension
 * when that name is taken: a second backup on a day never overwrites the first,
 * which holds what the day's first save was about to replace.
 *
 * The suffix goes on the whole name. The first version (2026-11-12) swapped a
 * trailing "-<digits>" for it, and the day of a dated name is exactly that:
 * saved-rosters-2026-11-12.json.gz was followed by saved-rosters-2026-11-2.json.gz,
 * a file that reads as another date.
 */
export function freeBackupPath(path: string, exists: (p: string) => boolean): string {
  if (!exists(path)) return path;
  const m = /^(.*?)(\.json\.gz|\.[^./\\]+)?$/.exec(path)!;
  const base = m[1], ext = m[2] ?? "";
  for (let n = 2; ; n++) {
    const next = `${base}-${n}${ext}`;
    if (!exists(next)) return next;
  }
}
