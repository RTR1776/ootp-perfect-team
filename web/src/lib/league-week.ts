/**
 * The week a league export belongs to.
 *
 * A PT league season ends on Sunday, and league data is keyed by that Sunday:
 * `League Data/<Sunday>/` on the Mac, `league_snapshots.captured_on` in the
 * database. A part-played export pulled Tuesday to Saturday and the finished
 * one pulled Sunday or Monday must share the key. Readers keep the newest
 * snapshot per week, league and split, so the finished week then replaces the
 * part-played one instead of the same games counting twice.
 *
 * Local calendar date, like the rest of /upload.
 */
export function leagueWeekOf(when: Date): string {
  const d = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const dow = d.getDay(); // 0 = Sunday, 1 = Monday
  d.setDate(d.getDate() + (dow === 1 ? -1 : (7 - dow) % 7));
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
