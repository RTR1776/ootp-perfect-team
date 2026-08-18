/**
 * Enumerations used by OOTP Perfect Team exports.
 *
 * Every mapping in this file is VERIFIED against L.J.'s real data, not guessed.
 * The verification is reproducible via `pnpm verify:ingest`.
 */

export const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Perfect"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * `tier` in pt_card_list.csv is a 0-5 code, NOT the mission-value number.
 *
 * Verified on 3,708 cards: the code partitions `Card Value` into six bands with
 * zero overlap — 40-59 / 60-69 / 70-79 / 80-89 / 90-99 / 100-101. If a future
 * export breaks that partition, the offset fix in pt-card-list.ts has failed
 * and every column right of `era` is shifted. verify-ingest.ts asserts this.
 */
export const TIER_BY_CODE: Record<number, Tier> = {
  0: "Iron",
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Diamond",
  5: "Perfect",
};

/** Card Value bands per tier — the cross-check that proves column alignment. */
export const TIER_VALUE_BANDS: Record<Tier, [number, number]> = {
  Iron: [40, 59],
  Bronze: [60, 69],
  Silver: [70, 79],
  Gold: [80, 89],
  Diamond: [90, 99],
  Perfect: [100, 101],
};

export type Position =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "DH";

/** Verified: counts are baseball-plausible and Pitcher Role is non-zero only at 1. */
export const POSITION_BY_CODE: Record<number, Position> = {
  1: "P",
  2: "C",
  3: "1B",
  4: "2B",
  5: "3B",
  6: "SS",
  7: "LF",
  8: "CF",
  9: "RF",
  10: "DH",
};

export type PitcherRole = "SP" | "RP" | "CL" | null;

/** Verified: role is 0 for every non-pitcher, and 11/12/13 only where Position === 1. */
export const PITCHER_ROLE_BY_CODE: Record<number, PitcherRole> = {
  0: null,
  11: "SP",
  12: "RP",
  13: "CL",
};

export const BATS_BY_CODE: Record<number, "R" | "L" | "S"> = { 1: "R", 2: "L", 3: "S" };
export const THROWS_BY_CODE: Record<number, "R" | "L"> = { 1: "R", 2: "L" };

/**
 * `era` is a 0-8 bucket over the card's Year. Verified: the buckets are
 * contiguous and non-overlapping across all 3,708 cards.
 *
 * This is what tournament era restrictions ("<=1920 Era", ">=1930; <=1989")
 * filter on, so it drives roster legality.
 */
export const ERA_BANDS: Array<{ code: number; from: number; to: number; label: string }> = [
  { code: 0, from: 1871, to: 1920, label: "Deadball (1871-1920)" },
  { code: 1, from: 1921, to: 1945, label: "Live Ball (1921-1945)" },
  { code: 2, from: 1946, to: 1960, label: "Integration (1946-1960)" },
  { code: 3, from: 1961, to: 1979, label: "Expansion (1961-1979)" },
  { code: 4, from: 1980, to: 1992, label: "Free Agency (1980-1992)" },
  { code: 5, from: 1993, to: 2004, label: "Steroid (1993-2004)" },
  { code: 6, from: 2005, to: 2014, label: "Post-Steroid (2005-2014)" },
  { code: 7, from: 2015, to: 2025, label: "Modern (2015-2025)" },
  { code: 8, from: 2026, to: 2026, label: "Live (2026)" },
];

/* ------------------------------------------------------------------------- */
/* Standings scoring                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Official PT 27 category-standings points, by FIELD SIZE — not by tier.
 * Source: "PT 27 Road to the Perfect Team World Championship", page 2.
 *
 * Two things that are easy to get wrong and cost real points:
 *  1. A tournament's field size for a given NAME changes over the PT year
 *     (OOTP shrinks events as the season goes on). Always read the field size
 *     off the row being scored; never infer it from a previous day.
 *  2. Points do not change if an event is cut for lack of entrants — the
 *     SCHEDULED size governs.
 */
export const FIELD_SIZES = [256, 128, 64, 32] as const;
export type FieldSize = (typeof FIELD_SIZES)[number];

export const PLACEMENTS = [
  "1st",
  "2nd",
  "3rd-4th",
  "5th-8th",
  "9th-16th",
  "17th-32nd",
  "33rd-64th",
  "65th-128th",
  "129th-256th",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

/** null = that placement cannot occur in that field size. */
export const POINTS_TABLE: Record<Placement, Record<FieldSize, number | null>> = {
  "1st": { 256: 40, 128: 30, 64: 25, 32: 20 },
  "2nd": { 256: 30, 128: 20, 64: 15, 32: 10 },
  "3rd-4th": { 256: 20, 128: 15, 64: 10, 32: 6 },
  "5th-8th": { 256: 15, 128: 10, 64: 6, 32: 3 },
  "9th-16th": { 256: 10, 128: 6, 64: 3, 32: 1 },
  "17th-32nd": { 256: 6, 128: 3, 64: 1, 32: 0 },
  "33rd-64th": { 256: 3, 128: 1, 64: 0, 32: null },
  "65th-128th": { 256: 1, 128: 0, 64: null, 32: null },
  "129th-256th": { 256: 0, 128: null, 64: null, 32: null },
};

/**
 * The ten category standings. Weekly tournaments no longer have their own
 * category in PT 27 — a `TW` tag is NOT a standing and scores nothing on its
 * own. It only pays when Cap or Live is also tagged on the same event.
 */
export const CATEGORIES = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
  "Open",
  "Live",
  "Cap",
  "PD Daily",
  "PD Weekly",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * How the STANDINGS column abbreviates each category. A single event can feed
 * two or three categories at once (`Silver,Cap`) and each one receives the FULL
 * points — this is the single most important scoring mechanic in the game.
 */
export const CATEGORY_BY_TAG: Record<string, Category> = {
  iron: "Iron",
  irn: "Iron",
  bronze: "Bronze",
  brz: "Bronze",
  silver: "Silver",
  slv: "Silver",
  gold: "Gold",
  gld: "Gold",
  diamond: "Diamond",
  dia: "Diamond",
  open: "Open",
  op: "Open",
  live: "Live",
  lv: "Live",
  cap: "Cap",
  cp: "Cap",
  "pd daily": "PD Daily",
  pdd: "PD Daily",
  "pd weekly": "PD Weekly",
  pdw: "PD Weekly",
};

/** Tags that appear in the STANDINGS column but award no points on their own. */
export const NON_SCORING_TAGS = new Set(["tw", "weekly", "tourney weekly"]);
