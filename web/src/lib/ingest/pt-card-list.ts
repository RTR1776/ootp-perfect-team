/**
 * Parser for `pt_card_list.csv` — the full PT card shop export.
 *
 * This file is the spine of the whole app. One upload gives us, for all ~3,700
 * cards in the game: identity, tier, position, era, every rating, how many
 * copies L.J. owns, and the live market (buy / sell / last-10 / variant last-10).
 *
 * It replaces the old fingerprint-matching pipeline for the base collection,
 * because it carries `Card ID` and `owned` directly — no matching required.
 */

import { num, numOr0, parseCsv, type Row } from "./csv";
import {
  BATS_BY_CODE,
  ERA_BANDS,
  PITCHER_ROLE_BY_CODE,
  POSITION_BY_CODE,
  TIER_BY_CODE,
  TIER_VALUE_BANDS,
  type PitcherRole,
  type Position,
  type Tier,
  THROWS_BY_CODE,
} from "./constants";

export interface ShopCard {
  cardId: number;
  title: string;
  firstName: string;
  lastName: string;
  nickName: string | null;
  /** "Ben Zobrist" — convenience for display and for collection matching. */
  name: string;

  tier: Tier;
  cardValue: number;
  position: Position;
  pitcherRole: PitcherRole;
  isPitcher: boolean;
  bats: "R" | "L" | "S" | null;
  throws: "R" | "L" | null;

  year: number | null;
  eraCode: number | null;
  eraLabel: string | null;
  team: string | null;
  franchise: string | null;
  series: string | null;
  badge: string | null;
  cardType: number | null;
  cardSubType: string | null;
  brefId: string | null;
  /** Date the card was released/added to the shop list. */
  date: string | null;

  /** Copies owned. 0 = not owned. Verified totals: 3,015 cards / 3,069 copies. */
  owned: number;
  missionValue: number | null;
  /** Semantics unconfirmed with L.J. — mostly 0, occasionally 40-120. */
  limit: number | null;
  packs: number | null;

  market: {
    /** Highest bid — what you RECEIVE if you sell instantly. */
    buyOrderHigh: number | null;
    /** Lowest ask — what you PAY to buy instantly. */
    sellOrderLow: number | null;
    /** Fair market value. */
    last10: number | null;
    /**
     * Variant acquisition cost. The variant is a SEPARATE, much pricier
     * listing — typically 5-15x base, and 0/absent when no variant is on the
     * market. Pricing a variant card at its base price is simply wrong.
     */
    last10Variant: number | null;
  };

  /** Every remaining column, verbatim, so nothing is lost on ingest. */
  ratings: Record<string, number>;
}

export interface ShopParseResult {
  cards: ShopCard[];
  /** Rows we could not read (missing Card ID or unknown tier code). */
  skipped: Array<{ line: number; reason: string }>;
  stats: {
    total: number;
    ownedCards: number;
    ownedCopies: number;
    byTier: Record<string, number>;
    ownedByTier: Record<string, number>;
    withVariantListing: number;
    /** True when tier codes partition Card Value exactly as expected. */
    tierBandsValid: boolean;
    headerFields: number;
    dataFields: number | null;
  };
}

/** Columns promoted to first-class fields, so they are not repeated in `ratings`. */
const STRUCTURAL = new Set([
  "Card Title",
  "Card ID",
  "Card Value",
  "Card Type",
  "Card Sub Type",
  "Card Badge",
  "Card Series",
  "Year",
  "Peak",
  "Team",
  "Franchise",
  "LastName",
  "FirstName",
  "NickName",
  "Nation",
  "UniformNumber",
  "DayOB",
  "MonthOB",
  "YearOB",
  "Bats",
  "Throws",
  "Position",
  "Pitcher Role",
  "era",
  "tier",
  "MissionValue",
  "limit",
  "owned",
  "brefid",
  "Buy Order High",
  "Sell Order Low",
  "Last 10 Price",
  "Last 10 Price(VAR)",
  "date",
  "packs",
]);

function eraLabel(code: number | null): string | null {
  if (code == null) return null;
  return ERA_BANDS.find((b) => b.code === code)?.label ?? null;
}

function fullName(row: Row): string {
  const first = (row["FirstName"] ?? "").trim();
  const last = (row["LastName"] ?? "").trim();
  const joined = `${first} ${last}`.trim();
  return joined || (row["Card Title"] ?? "").trim();
}

export function parseShopList(text: string): ShopParseResult {
  // `extraFields: "drop"` is the whole ballgame here. Data rows carry 123
  // fields against a 122-field header (one trailing empty). Read naively, every
  // column right of `era` shifts one to the left and `tier`, `owned` and all
  // four price columns land in the wrong place — silently, with plausible-looking
  // values. The tierBandsValid check below is the tripwire.
  const parsed = parseCsv(text, { extraFields: "drop" });

  const cards: ShopCard[] = [];
  const skipped: ShopParseResult["skipped"] = [];
  const byTier: Record<string, number> = {};
  const ownedByTier: Record<string, number> = {};
  let ownedCopies = 0;
  let ownedCards = 0;
  let withVariantListing = 0;
  let tierBandsValid = true;

  parsed.rows.forEach((row, i) => {
    const cardId = num(row["Card ID"]);
    if (cardId == null) {
      skipped.push({ line: i + 2, reason: "missing Card ID" });
      return;
    }

    const tierCode = num(row["tier"]);
    const tier = tierCode == null ? undefined : TIER_BY_CODE[tierCode];
    if (!tier) {
      skipped.push({ line: i + 2, reason: `unknown tier code ${row["tier"]}` });
      return;
    }

    const cardValue = numOr0(row["Card Value"]);
    const [lo, hi] = TIER_VALUE_BANDS[tier];
    if (cardValue < lo || cardValue > hi) tierBandsValid = false;

    const posCode = num(row["Position"]);
    const position = (posCode == null ? undefined : POSITION_BY_CODE[posCode]) ?? "DH";
    const roleCode = num(row["Pitcher Role"]);
    const pitcherRole = roleCode == null ? null : (PITCHER_ROLE_BY_CODE[roleCode] ?? null);

    const owned = numOr0(row["owned"]);
    ownedCopies += owned;
    if (owned > 0) {
      ownedCards++;
      ownedByTier[tier] = (ownedByTier[tier] ?? 0) + 1;
    }
    byTier[tier] = (byTier[tier] ?? 0) + 1;

    const last10Variant = num(row["Last 10 Price(VAR)"]);
    if (last10Variant != null && last10Variant > 0) withVariantListing++;

    const ratings: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      if (STRUCTURAL.has(key) || key.startsWith("_extra_")) continue;
      const n = num(value);
      if (n != null) ratings[key] = n;
    }

    const eraCode = num(row["era"]);

    cards.push({
      cardId,
      title: (row["Card Title"] ?? "").trim(),
      firstName: (row["FirstName"] ?? "").trim(),
      lastName: (row["LastName"] ?? "").trim(),
      nickName: (row["NickName"] ?? "").trim() || null,
      name: fullName(row),
      tier,
      cardValue,
      position,
      pitcherRole,
      isPitcher: position === "P",
      bats: BATS_BY_CODE[num(row["Bats"]) ?? -1] ?? null,
      throws: THROWS_BY_CODE[num(row["Throws"]) ?? -1] ?? null,
      year: num(row["Year"]),
      eraCode,
      eraLabel: eraLabel(eraCode),
      team: (row["Team"] ?? "").trim() || null,
      franchise: (row["Franchise"] ?? "").trim() || null,
      series: (row["Card Series"] ?? "").trim() || null,
      badge: (row["Card Badge"] ?? "").trim() || null,
      cardType: num(row["Card Type"]),
      cardSubType: (row["Card Sub Type"] ?? "").trim() || null,
      brefId: (row["brefid"] ?? "").trim() || null,
      date: (row["date"] ?? "").trim() || null,
      owned,
      missionValue: num(row["MissionValue"]),
      limit: num(row["limit"]),
      packs: num(row["packs"]),
      market: {
        buyOrderHigh: num(row["Buy Order High"]),
        sellOrderLow: num(row["Sell Order Low"]),
        last10: num(row["Last 10 Price"]),
        last10Variant,
      },
      ratings,
    });
  });

  return {
    cards,
    skipped,
    stats: {
      total: cards.length,
      ownedCards,
      ownedCopies,
      byTier,
      ownedByTier,
      withVariantListing,
      tierBandsValid,
      headerFields: parsed.headers.length,
      dataFields: parsed.fieldCount,
    },
  };
}

/** Cheap sniff so the upload endpoint can route a file without being told. */
export function looksLikeShopList(headerLine: string): boolean {
  return /Card Title/i.test(headerLine) && /Card ID/i.test(headerLine);
}
