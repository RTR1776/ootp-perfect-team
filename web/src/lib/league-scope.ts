/**
 * Which league, which team, which week, which collection — RESOLVED, not
 * hardcoded.
 *
 * Every league tool needs the same four, and every one of them had been
 * pinned to the week it was written: league-best to HD453 / 2026-09-13 /
 * upload 65, park-sweep to HD451 / 2026-09-20. Both go stale in place, and
 * the failure is silent — a run scores a months-old collection against a team
 * that has since moved leagues and prints a confident board anyway.
 *
 * Neither the league nor the team name is stable. The team climbs a weekly
 * ladder (LD404 on 2026-09-06, HD453 on 09-13, HD451 on 09-20), and the
 * export appends the clan tag to the org once the team joins one, so the
 * match goes through `isMyOrg` rather than an equality on the name.
 *
 * Callers pass whatever flags the user gave and take the rest from here, then
 * PRINT `summary` and any `notes` so the scope a board was built on is visible
 * in the output instead of assumed.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { MY_ORG, isMyOrg } from "@/lib/my-team";

const asRows = <T,>(r: unknown): T[] =>
  Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []);

export interface ScopeArgs {
  league?: string | null;
  team?: string | null;
  on?: string | null;
  upload?: number | null;
  /** The comparison set of leagues; defaults to every league captured that week. */
  field?: string[] | null;
}

export interface LeagueScope {
  league: string;
  team: string;
  on: string;
  upload: number;
  field: string[];
  /** Warnings worth printing — an empty roster, or the team in two leagues. */
  notes: string[];
  /** One line naming what this run is actually scoped to. */
  summary: string;
}

export async function resolveLeagueScope(a: ScopeArgs = {}): Promise<LeagueScope> {
  const on =
    a.on ??
    String(
      asRows<{ d: string | null }>(
        await db.execute(sql`select max(captured_on)::text d from league_snapshots`),
      )[0]?.d ?? "",
    );
  const upload =
    a.upload ??
    Number(
      asRows<{ id: number | null }>(
        await db.execute(sql`select max(id) id from uploads where kind = 'collection'`),
      )[0]?.id ?? 0,
    );
  const rows = asRows<{ league: string; org: string; n: number }>(
    await db.execute(sql`
      select ls.league, st.org, count(*)::int n
      from league_stints st join league_snapshots ls on ls.id = st.snapshot_id
      where ls.captured_on = ${on} and ls.split = 'all'
      group by 1, 2`),
  );
  const mine = rows.filter((r) => isMyOrg(r.org)).sort((x, y) => y.n - x.n);
  const league = a.league ?? mine[0]?.league ?? "";
  const team = a.team ?? mine[0]?.org ?? MY_ORG;
  const field = a.field ?? [...new Set(rows.map((r) => r.league))].sort();

  const notes: string[] = [];
  if (!mine.length) notes.push(`no roster for ${MY_ORG} in the ${on} exports — anything measured against "the roster now" will be empty`);
  else if (mine.length > 1) notes.push(`${MY_ORG} appears in ${mine.length} leagues that week (${mine.map((m) => m.league).join(", ")}); using ${league}`);
  if (!on) notes.push("no league snapshots in the database at all");

  const forced = a.league != null || a.team != null || a.on != null || a.upload != null || a.field != null;
  const summary =
    `scope: ${league || "?"} · ${team} · week ${on || "?"} · collection upload ${upload}` +
    (forced ? "  (partly from flags)" : "  (all resolved from newest data)");
  return { league, team, on, upload, field, notes, summary };
}
