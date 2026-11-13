/**
 * Put the harvested position ratings back on the base cards.
 *
 * The shop list carries only the positions printed on a card; the game rates
 * every card at all eight, and `positions:harvest` reads those off the stat
 * exports into `card_positions` and fills `cards.ratings`. But every card-list
 * import overwrites `cards.ratings`, and the harvest needs the export archive,
 * which only the Mac has. So from each import until the next Monday's harvest
 * the fills were gone: on 2026-11-12, 2,717 ratings on 859 hitters read 0,
 * 934 of them 60 or better (Carson Williams' 139 at second base, the 2003
 * Alex Rodriguez's 132 at third), and no roster built in that window could
 * use those positions.
 *
 * `card_positions` already holds the answer, so this needs no archive: one
 * statement, run after every card-list import and by the harvest itself. The
 * shop stays the authority for a position it lists; only a rating of 0 (or
 * none) is filled. Pitchers are left alone, as in the harvest.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const rowsOf = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));

/** The (card, position) pairs a re-apply would fill, as one subquery. */
const MISSING = sql`
  select cp.card_id, e.key as pos, e.value as rating
  from card_positions cp
  join cards c on c.card_id = cp.card_id
  cross join lateral jsonb_each(cp.positions) e
  where not cp.variant and not c.is_pitcher
    and jsonb_typeof(e.value) = 'number' and (e.value)::text::numeric > 0
    and coalesce(nullif(c.ratings->>('Pos Rating ' || e.key), '')::numeric, 0) <= 0`;

export interface ReapplyResult { cards: number; ratings: number }

/** What a re-apply would fill, without writing. */
export async function countMissingPositions(): Promise<ReapplyResult> {
  const [r] = rowsOf<{ cards: string | number; ratings: string | number }>(await db.execute(
    sql`select count(distinct card_id) cards, count(*) ratings from (${MISSING}) m`));
  return { cards: Number(r?.cards ?? 0), ratings: Number(r?.ratings ?? 0) };
}

/** Fill every base hitter's unlisted positions from `card_positions`. Safe to run any number of times. */
export async function reapplyHarvestedPositions(): Promise<ReapplyResult> {
  const filled = rowsOf<{ n: string | number }>(await db.execute(sql`
    with m as (${MISSING}),
    f as (select card_id, jsonb_object_agg('Pos Rating ' || pos, rating) fill, count(*) n from m group by card_id)
    update cards c set ratings = c.ratings || f.fill
    from f where f.card_id = c.card_id
    returning f.n`));
  return { cards: filled.length, ratings: filled.reduce((s, r) => s + Number(r.n), 0) };
}
