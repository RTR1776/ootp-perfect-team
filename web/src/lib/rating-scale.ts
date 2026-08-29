/**
 * How long a full rating bar is.
 *
 * OOTP's card face draws every rating against one shared scale, so the app
 * needs a single number too — but the ceiling climbs all season as new card
 * sets land (175 was the top in August 2026; Ted Williams' 295 Eye vL blew
 * past it within weeks). Hard-coding it means bars silently peg.
 *
 * So the scale is read from the card table itself: the 99.9th percentile of
 * every rating the card face draws, rounded up to the next 25. The percentile
 * rather than the max keeps one freak card from squashing everyone else —
 * across 89k rating values only ~48 clear 200, and those clip at a full bar
 * with their number still printed beside it. Each new card import moves the
 * scale on its own.
 *
 * The query expands ~90k jsonb values (~300ms), so it is memoised per server
 * instance; the card table only changes on import, and a stale scale is a
 * few pixels of bar, never a wrong number.
 */

import { db } from "@/db/client";
import { sql } from "drizzle-orm";

/** The rating keys the card-face bars actually draw. */
const DISPLAY_KEYS = [
  "Avoid Ks", "BABIP", "Gap", "Power", "Eye",
  "Stuff", "Movement", "Control", "pHR", "pBABIP", "Stamina",
  "Pos Rating C", "Pos Rating 1B", "Pos Rating 2B", "Pos Rating 3B",
  "Pos Rating SS", "Pos Rating LF", "Pos Rating CF", "Pos Rating RF",
];

/** Used until the first query lands, and if the table is empty. */
export const FALLBACK_RATING_SCALE = 200;

const TTL_MS = 10 * 60 * 1000;
let cached: { value: number; at: number } | null = null;
let inflight: Promise<number> | null = null;

async function query(): Promise<number> {
  const list = sql.raw(`array[${DISPLAY_KEYS.map((k) => `'${k}'`).join(",")}]`);
  const rows = await db.execute<{ p: number | string | null }>(sql`
    select percentile_disc(0.999) within group (order by v) as p
    from (
      select (value)::float as v
      from cards, jsonb_each_text(ratings) as e(key, value)
      where key = any(${list}) and value ~ '^[0-9.]+$' and (value)::float > 0
    ) s
  `);
  const raw = Number((rows as unknown as { p: number | string | null }[])[0]?.p ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_RATING_SCALE;
  return Math.max(100, Math.ceil(raw / 25) * 25);
}

export async function getRatingScale(): Promise<number> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  if (!inflight) {
    inflight = query()
      .then((value) => { cached = { value, at: Date.now() }; return value; })
      .catch(() => cached?.value ?? FALLBACK_RATING_SCALE)
      .finally(() => { inflight = null; });
  }
  return inflight;
}
