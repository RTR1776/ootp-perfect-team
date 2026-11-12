/**
 * Buy Plan's arithmetic (L.J., 2026-11-08: "put this page on the app and we can
 * update as needed when new cards come out"). Pure, so it is tested on its own;
 * lib/buy-plan-load does the reading.
 *
 *   weight   — his entries per week in each event, off logged results
 *   net gain — Card Fit's one swap: the gain where the card starts, or, in a
 *              slots or cap event, what it adds after paying for the room it needs
 *   buy call — buy at the ask when the ask is near the last sales, else bid
 *   sell call — take the bid when it is near the last sales, else list
 */

/** The tiers results are counted under, in ladder order. Cap and Live ride along with one of these. */
export const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open"] as const;
export type PlanTier = (typeof TIERS)[number];

/** A result's tier: the first ladder tier among its categories; null for drafts and Live-only events. */
export function tierOf(categories: readonly string[]): PlanTier | null {
  return TIERS.find((t) => categories.includes(t)) ?? null;
}

/** A draft result: its points go to PD Daily or PD Weekly, and cards don't help there. */
export const isDraftResult = (categories: readonly string[]) => categories.some((c) => /^PD\b/.test(c));

/** "Daily Iron Lunch (2200239)" → "Daily Iron Lunch": the event without its daily instance id. */
export const eventName = (name: string) => name.replace(/\s*\(\d+\)\s*$/, "").trim();

/** One Card Fit read: where the card would start and what it adds (status, gain, slots or cap room). */
export interface FitRead {
  status: "on" | "start" | "bench";
  gain: number;
  room?: { gross: number; cost: number | null } | null;
}

/**
 * What a card adds in one event: its swap gain where it starts; in a slots or
 * cap event where it only fits once room is made, the gain less the room's
 * cost; nothing where it can't start.
 */
export function netGain(r: FitRead): number {
  if (r.status === "start") return r.gain;
  if (r.room && r.room.cost != null && r.room.gross > r.room.cost) return r.room.gross - r.room.cost;
  return 0;
}

/** Runs a card adds a week: each event's gain times his entries a week there. */
export function weightedGain(rows: readonly { eventId: number; gain: number }[], perWeek: ReadonlyMap<number, number>): number {
  return rows.reduce((s, r) => s + r.gain * (perWeek.get(r.eventId) ?? 0), 0);
}

const pos = (x: number | null | undefined) => (x != null && x > 0 ? x : null);
const down1k = (x: number) => Math.max(1000, Math.floor(x / 1000) * 1000);
const up1k = (x: number) => Math.max(1000, Math.ceil(x / 1000) * 1000);

/**
 * How to buy: at the ask when it is within 10% of recent sales (or there are
 * none), else bid the last-10 average (rounded up to the thousand) and wait,
 * since asks swing and the low comes round again. With neither an ask nor any
 * sales (a release the market hasn't priced, a Clubhouse card that doesn't
 * trade) there is nothing to call: "none".
 */
export function buyCall(ask: number | null | undefined, last10: number | null | undefined): { call: "buy" | "bid" | "none"; target: number | null } {
  const a = pos(ask), l = pos(last10);
  if (a != null && (l == null || a <= l * 1.1)) return { call: "buy", target: a };
  if (l != null) return { call: "bid", target: up1k(l) };
  return { call: "none", target: null };
}

/**
 * How to sell: take the instant bid when it is at least 85% of recent sales;
 * otherwise list just under the lower of the ask and the last-10 average.
 */
export function sellCall(bid: number | null | undefined, ask: number | null | undefined, last10: number | null | undefined): { call: "take" | "list"; target: number | null } {
  const b = pos(bid), a = pos(ask), l = pos(last10);
  if (b != null && l != null && b >= l * 0.85) return { call: "take", target: b };
  const ref = a != null && l != null ? Math.min(a, l) : a ?? l;
  return { call: "list", target: ref != null ? down1k(ref * 0.98) : null };
}

/** The median of PP-per-CS over Clubhouse cards that also trade for PP: what one CS is worth. A card with no CS price on file doesn't count. */
export function ppPerCs(pairs: readonly { cs: number | null; pp: number | null }[]): number | null {
  const r = pairs.filter((p) => p.cs != null && p.cs > 0 && p.pp != null && p.pp > 0).map((p) => p.pp! / p.cs!).sort((a, b) => a - b);
  if (!r.length) return null;
  const m = Math.floor(r.length / 2);
  return r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2;
}

/**
 * The set a Clubhouse card belongs to, as the screenshots name it: the title
 * less "Clubhouse - " and the trailing "POS Name TEAM YEAR"
 * ("Clubhouse - Baseball Reference 10 SP Sandy Koufax LAD 1963" → "Baseball
 * Reference 10"). The whole remainder when the name isn't where it's expected.
 */
export function clubhouseSet(title: string, pos: string, name: string): string {
  const rest = title.replace(/^clubhouse\s*-\s*/i, "").trim();
  const at = rest.indexOf(` ${pos} ${name}`);
  return at > 0 ? rest.slice(0, at).trim() : rest;
}

/** Does a Clubhouse card title name this screenshot row? Name and value already match; position and year settle copies. */
export function clubhouseTitleMatches(title: string, row: { pos: string; year: string }): boolean {
  if (!title.toLowerCase().startsWith("clubhouse")) return false;
  if (!new RegExp(`\\b${row.pos}\\b`).test(title)) return false;
  return row.year === "Peak" ? /\bPeak\b/.test(title) : title.includes(row.year);
}
