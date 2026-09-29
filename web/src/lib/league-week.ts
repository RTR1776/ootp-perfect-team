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

/**
 * The run environment a league week was played in (`league_snapshots.env_year`).
 * Ordinary weeks play PT's default, listed as 2010 (L.J. confirmed; the fit's
 * 2010-2013 spread is noise). A THEME WEEK runs another year for the whole
 * week (2026-08-23 ran 1959, 2026-09-20 ran 1989), and anything that pools
 * weeks has to keep the two apart.
 */
export const LEAGUE_ENV_YEAR = 2010;
/** The years the era table can price. league-week.test.ts holds this to the table. */
export const ENV_YEAR_MIN = 1884;
export const ENV_YEAR_MAX = 2026;

/** A typed env year, or null when it isn't a year the app can price. */
export function parseEnvYear(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!/^\d{4}$/.test(s)) return null;
  const year = Number(s);
  return year >= ENV_YEAR_MIN && year <= ENV_YEAR_MAX ? year : null;
}
