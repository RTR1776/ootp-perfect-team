/**
 * The game's ten card sets (cards.card_type), cross-checked against the shop
 * export: 1 Live · 2 Negro League Star · 3 Rookie Sensation · 4 All-Time
 * Legend · 5 Historical All-Star · 6 Future Legend · 7 Snapshot · 8 Unsung
 * Heroes · 9 Hardware Heroes · 10 Veteran Presence. Sub-types (LE, HOF, BBR,
 * UTIL, PTMS, WBC, VB, HFL) are orthogonal and not a set.
 *
 * Its own module so roster-rules and set-evidence can both use it without
 * importing each other.
 */

export const CARD_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** The game's name for each card set. */
export const CARD_TYPE_NAME: Record<number, string> = {
  1: "Live", 2: "Negro League Star", 3: "Rookie Sensation", 4: "All-Time Legend", 5: "Historical All-Star",
  6: "Future Legend", 7: "Snapshot", 8: "Unsung Heroes", 9: "Hardware Heroes", 10: "Veteran Presence",
};
/** Short tags for chips. Snapshot is "Snap", not "SS", which reads as shortstop. */
export const CARD_TYPE_SHORT: Record<number, string> = {
  1: "Live", 2: "NLS", 3: "RS", 4: "ATL", 5: "HAS", 6: "FL", 7: "Snap", 8: "UH", 9: "HH", 10: "VP",
};

/** A set rule in the form the catalogue stores and parseCardTypeRule reads: [5, 9] → "Historical All-Star+Hardware Heroes". */
export function cardTypeRuleLabel(codes: readonly number[]): string {
  return [...new Set(codes)].sort((a, b) => a - b).map((c) => CARD_TYPE_NAME[c] ?? String(c)).join("+");
}

/** "Historical All-Star, Hardware Heroes" for people. */
export function cardTypeNames(codes: readonly number[]): string {
  return [...new Set(codes)].sort((a, b) => a - b).map((c) => CARD_TYPE_NAME[c] ?? `set ${c}`).join(", ");
}
