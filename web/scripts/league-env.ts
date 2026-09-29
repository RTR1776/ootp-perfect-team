/**
 * A league week's run environment (league_snapshots.env_year): read every
 * week's tag against what its play fits, or retag one week.
 *
 * Ordinary weeks are the league's 2010. A THEME WEEK runs another year for the
 * whole week (2026-08-23 played like 1959, 2026-09-20 ran 1989), and every
 * reader that pools weeks leaves it out by its tag. /upload and
 * `import:league --env` tag a week as it goes in; this fixes one already on
 * file, which /upload can't (it won't take the same file twice).
 *
 *   pnpm league:env                                        every week, read-only
 *   pnpm league:env --week 2026-08-23 --env 1959           what would change
 *   pnpm league:env --week 2026-08-23 --env 1959 --commit  write it
 *
 * The fit is league-era's: the week's hitter line against each era's baseline.
 * It identifies a theme week well (they fit decades from 2010) but it is a best
 * fit, not the game's setting: tag the year the game announced.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { fitEraYear } from "@/lib/analytics/league-era";
import { ENV_YEAR_MAX, ENV_YEAR_MIN, LEAGUE_ENV_YEAR, parseEnvYear } from "@/lib/league-week";

const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));
const argv = process.argv.slice(2);
const flag = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const WEEK = flag("week"), ENV_RAW = flag("env"), COMMIT = argv.includes("--commit");

type Snap = { id: number; league: string; split: string; env_year: number };

async function list() {
  const rows = asRows<{ wk: string; env_year: number; n: number; leagues: string }>(await db.execute(sql`
    select captured_on::text wk, env_year, count(*)::int n, string_agg(distinct league, ',' order by league) leagues
    from league_snapshots group by 1, 2 order by 1, 2`));
  for (const wk of [...new Set(rows.map((r) => r.wk))]) {
    const tags = rows.filter((r) => r.wk === wk);
    const fit = await fitEraYear(wk).catch(() => null);
    const tagged = tags.map((t) => `${t.env_year} (${t.n}: ${t.leagues})`).join(", ");
    const untagged = fit?.offNorm && tags.every((t) => Number(t.env_year) === LEAGUE_ENV_YEAR);
    console.log(
      `${wk}  tagged ${tagged.padEnd(38)} plays like ${fit ? `${fit.year} (${fit.distance.toFixed(2)})` : "?"}` +
        (untagged ? "   <- untagged theme week?" : ""),
    );
  }
}

async function set(week: string, env: number) {
  const snaps = asRows<Snap>(await db.execute(sql`
    select id, league, split, env_year from league_snapshots where captured_on = ${week} order by league, split, id`));
  if (!snaps.length) throw new Error(`no league snapshots for the week of ${week}`);
  const fit = await fitEraYear(week).catch(() => null);
  if (fit) console.log(fit.summary);
  const change = snaps.filter((s) => Number(s.env_year) !== env);
  for (const s of snaps) console.log(`  ${s.league.padEnd(6)} ${s.split.padEnd(3)} #${s.id}  ${s.env_year}${Number(s.env_year) !== env ? ` -> ${env}` : ""}`);
  if (!change.length) { console.log(`${week}: no change, all ${snaps.length} snapshots are ${env}`); return; }
  if (!COMMIT) { console.log(`Dry run: would set ${change.length} of ${snaps.length} snapshots of ${week} to ${env}. Add --commit to write.`); return; }
  const done = asRows<{ id: number }>(await db.execute(sql`
    update league_snapshots set env_year = ${env} where captured_on = ${week} and env_year <> ${env} returning id`));
  console.log(`${week}: set ${done.length} snapshots to ${env}`);
}

async function main() {
  if (!WEEK && !ENV_RAW) return list();
  if (!WEEK || !/^\d{4}-\d{2}-\d{2}$/.test(WEEK)) throw new Error("--week wants the league week's Sunday, YYYY-MM-DD");
  const env = parseEnvYear(ENV_RAW);
  if (env == null) throw new Error(`--env wants a year the app can price, ${ENV_YEAR_MIN}-${ENV_YEAR_MAX} (${LEAGUE_ENV_YEAR} is an ordinary week)`);
  return set(WEEK, env);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
