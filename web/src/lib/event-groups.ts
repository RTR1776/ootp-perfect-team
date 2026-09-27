/**
 * The tournament catalogue grouped for the event pickers (Build, Played):
 * dailies by tier, weeklies by day, quicks, drafts, specials last.
 *
 * EF events (default-rules H2H/4T) are hidden. Retired events stay in the
 * database - their history still feeds /meta and the environment search - but
 * they leave the pickers. They remain reachable by id, so a link to an old
 * build keeps working.
 */

const DAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/;
const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface CatalogRow { name: string; isDraft: boolean; retired: boolean }

/** The picker group an event sits in; null for events no picker lists. */
export function eventGroupOf(t: CatalogRow): string | null {
  if (/^EF\b/.test(t.name)) return null;
  if (t.retired) return null;
  if (t.isDraft) return "Perfect Drafts";
  if (/\bQuick\b/i.test(t.name)) return "Quicks";
  const day = t.name.match(DAY_RE)?.[1];
  if (day) return `Weeklies — ${day}`;
  if (/^Dail?y\b/i.test(t.name)) {
    for (const tier of TIERS) if (t.name.includes(tier)) return `Dailies — ${tier}`;
    if (/\bLive\b/.test(t.name)) return "Dailies — Live";
    return "Dailies — Other";
  }
  return "Specials";
}

export const EVENT_GROUP_ORDER = [
  ...TIERS.map((t) => `Dailies — ${t}`),
  "Dailies — Live",
  "Dailies — Other",
  ...DAYS.map((d) => `Weeklies — ${d}`),
  "Quicks",
  "Perfect Drafts",
  "Specials",
];

/**
 * The catalogue as picker groups, in EVENT_GROUP_ORDER, each event made into
 * the picker's item by `item`. `first` moves groups to the top (Played, built
 * for drafts, leads with Perfect Drafts).
 */
export function groupEvents<C extends CatalogRow, T>(
  catalog: readonly C[],
  item: (c: C) => T,
  opts: { first?: string[] } = {},
): { label: string; items: T[] }[] {
  const byGroup = new Map<string, T[]>();
  for (const c of catalog) {
    const g = eventGroupOf(c);
    if (!g) continue;
    byGroup.set(g, [...(byGroup.get(g) ?? []), item(c)]);
  }
  const first = opts.first ?? [];
  const order = [...first, ...EVENT_GROUP_ORDER.filter((g) => !first.includes(g))];
  return order.filter((g) => byGroup.has(g)).map((g) => ({ label: g, items: byGroup.get(g)! }));
}
