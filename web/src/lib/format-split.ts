/**
 * Where an export of a weekly that changed format belongs (L.J., 2026-10-01:
 * Splendid Silver's 09-24 run is the new format, the three before it the old).
 * A run before its event's format date goes to "<slug>-preYYYYMMDD": still
 * every card's play elsewhere, no longer this event's own. A run with no known
 * date, or of an event with no format date, stays in its slug.
 */
export function formatSplitSeries(slug: string, runOn: string | null | undefined, since: string | null | undefined): string {
  if (!runOn || !since || runOn >= since) return slug;
  return `${slug}-pre${since.replaceAll("-", "")}`;
}
