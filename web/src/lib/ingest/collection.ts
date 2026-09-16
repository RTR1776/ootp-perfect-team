/**
 * Parser + matcher for the PT collection export (`mycardset.csv`,
 * `KC Torrent Current Cards.csv`).
 *
 * WHY THIS EXISTS when pt_card_list.csv already carries `owned`:
 * the shop list tells us how many copies of the BASE card we own, but it cannot
 * tell us whether we own the boosted VARIANT of it. Only the collection export
 * has the `VAR` column. It also carries `ACT` (is the card on the active roster)
 * and `REL` (when it was acquired). So: shop list = universe + market +
 * base ownership; collection = variant ownership + active roster.
 *
 * The collection export has no Card ID, so we match on a rating fingerprint.
 */

import { num, parseCsv, type Row } from "./csv";
import type { ShopCard } from "./pt-card-list";

export interface CollectionCard {
  pos: string;
  name: string;
  bats: string;
  throws: string;
  cardValue: number | null;
  /** Variant (boosted) copy. */
  isVariant: boolean;
  /** On the active roster. Absent from exports without an ACT column. */
  isActive: boolean | null;
  released: string | null;
  last10: number | null;
  buy: number | null;
  ratings: Record<string, number>;
}

export interface MatchedCollectionCard extends CollectionCard {
  cardId: number | null;
  matchDistance: number | null;
  /** How confident we are, derived from the distance separation described below. */
  matchQuality: "exact" | "variant" | "fuzzy" | "unmatched";
}

export interface CollectionParseResult {
  cards: CollectionCard[];
  stats: {
    total: number;
    variants: number;
    active: number | null;
    hasActiveColumn: boolean;
  };
}

/**
 * The fingerprint.
 *
 * CRITICAL: Contact/BA is deliberately EXCLUDED. The collection export's
 * `BA vL`/`BA vR` do not equal the shop's `Contact vL`/`Contact vR` — they
 * differ by roughly 6 points — while every other rating matches exactly.
 * Including it turns clean zero-distance matches into noise.
 */
const HITTER_FIELDS: Array<[collection: string, shop: string]> = [
  ["GAP vL", "Gap vL"],
  ["POW vL", "Power vL"],
  ["EYE vL", "Eye vL"],
  ["K vL", "Avoid K vL"],
  ["GAP vR", "Gap vR"],
  ["POW vR", "Power vR"],
  ["EYE vR", "Eye vR"],
  ["K vR", "Avoid K vR"],
];

const PITCHER_FIELDS: Array<[collection: string, shop: string]> = [
  ["STU vL", "Stuff vL"],
  ["CON vL", "Control vL"],
  ["PBABIP vL", "pBABIP vL"],
  ["HRA vL", "pHR vL"],
  ["STU vR", "Stuff vR"],
  ["CON vR", "Control vR"],
  ["PBABIP vR", "pBABIP vR"],
  ["HRA vR", "pHR vR"],
];

const PITCHER_POSITIONS = new Set(["SP", "RP", "CL", "P"]);

export function normaliseName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCollection(text: string): CollectionParseResult {
  const parsed = parseCsv(text);
  const hasActiveColumn = parsed.headers.includes("ACT");

  const cards: CollectionCard[] = [];
  let variants = 0;
  let active = 0;

  for (const row of parsed.rows as Row[]) {
    const name = (row["Name"] ?? "").trim();
    if (!name) continue;

    const isVariant = (row["VAR"] ?? "").trim().toUpperCase() === "Y";
    if (isVariant) variants++;
    const isActive = hasActiveColumn
      ? (row["ACT"] ?? "").trim().toLowerCase() === "yes"
      : null;
    if (isActive) active++;

    const ratings: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      const n = num(value);
      if (n != null) ratings[key] = n;
    }

    cards.push({
      pos: (row["POS"] ?? "").trim(),
      name,
      bats: (row["B"] ?? "").trim(),
      throws: (row["T"] ?? "").trim(),
      cardValue: num(row["CVAL"]),
      isVariant,
      isActive,
      released: (row["REL"] ?? "").trim() || null,
      last10: num(row["L10"]),
      buy: num(row["BUY"]),
      ratings,
    });
  }

  return {
    cards,
    stats: {
      total: cards.length,
      variants,
      active: hasActiveColumn ? active : null,
      hasActiveColumn,
    },
  };
}

function distance(
  collection: CollectionCard,
  shop: ShopCard,
  fields: Array<[string, string]>,
): number | null {
  let sum = 0;
  let n = 0;
  for (const [cKey, sKey] of fields) {
    const a = collection.ratings[cKey];
    const b = shop.ratings[sKey];
    if (a == null || b == null) continue;
    sum += Math.abs(a - b);
    n++;
  }
  return n === 0 ? null : sum / n;
}

/**
 * Match a parsed collection to the shop list at CARD level, not player level —
 * most players have two or more cards at different overalls, so name-only
 * matching picks the wrong one.
 *
 * The distance separation is clean and worth knowing: non-variant cards land at
 * distance EXACTLY 0, variants land around 5.75-9.25 because their ratings are
 * boosted. There is no overlap, so distance alone also identifies variants —
 * which is a useful cross-check on the `VAR` column.
 */
export function matchCollectionToShop(
  collection: CollectionCard[],
  shop: ShopCard[],
): { matched: MatchedCollectionCard[]; matchRate: number } {
  const byName = new Map<string, ShopCard[]>();
  for (const card of shop) {
    const key = normaliseName(card.name);
    const list = byName.get(key);
    if (list) list.push(card);
    else byName.set(key, [card]);
  }

  const matched = collection.map<MatchedCollectionCard>((card) => {
    const candidates = byName.get(normaliseName(card.name)) ?? [];
    const wantPitcher = PITCHER_POSITIONS.has(card.pos.toUpperCase());
    const fields = wantPitcher ? PITCHER_FIELDS : HITTER_FIELDS;

    const pool = candidates.filter((c) => c.isPitcher === wantPitcher);
    const searchIn = pool.length > 0 ? pool : candidates;

    let best: ShopCard | null = null;
    let bestDistance = Infinity;
    let bestValueGap = Infinity;

    for (const candidate of searchIn) {
      const d = distance(card, candidate, fields);
      if (d == null) continue;
      const valueGap =
        card.cardValue == null ? 0 : Math.abs(candidate.cardValue - card.cardValue);
      if (d < bestDistance || (d === bestDistance && valueGap < bestValueGap)) {
        best = candidate;
        bestDistance = d;
        bestValueGap = valueGap;
      }
    }

    if (!best) {
      return { ...card, cardId: null, matchDistance: null, matchQuality: "unmatched" };
    }

    const quality: MatchedCollectionCard["matchQuality"] =
      bestDistance === 0 ? "exact" : bestDistance <= 12 ? "variant" : "fuzzy";

    return {
      ...card,
      cardId: best.cardId,
      matchDistance: bestDistance,
      matchQuality: quality,
    };
  });

  const hits = matched.filter((m) => m.cardId != null).length;
  return { matched, matchRate: collection.length ? hits / collection.length : 0 };
}

export function looksLikeCollection(headerLine: string): boolean {
  return /(^|,)POS(,|$)/.test(headerLine) && /CVAL/.test(headerLine) && /VAR/.test(headerLine);
}

/**
 * Per-copy ratings — what a VARIANT actually is.
 *
 * `cards.ratings` is the base card from the shop list. A variant is matched to
 * that base card, so joining collection → cards and reading the base ratings
 * scores every variant on numbers it does not have: the Cy Young variant carries
 * Stuff vR 126 against the base card's 117, and across L.J.'s high-value variants
 * the gap runs to 7.5 rating points. The collection export is the only source for
 * the boosted line, which is why collection_cards.ratings exists.
 *
 * The two exports agree EXACTLY on every field below — mean difference 0.00 with
 * zero variance over 471 base cards — so the overlay is a rename, not a
 * conversion. Fields the collection does not carry (Pos Rating *, the overall
 * composites, pitch types) are left as the base card's, which is correct: a
 * variant plays the same positions.
 *
 * Note BA maps to BABIP, not Contact. The two are different ratings and
 * matching on Contact is what the fingerprint deliberately avoids.
 */
const PER_COPY: Array<[collection: string, model: string]> = [
  ["BA vL", "BABIP vL"], ["BA vR", "BABIP vR"],
  ["GAP vL", "Gap vL"], ["GAP vR", "Gap vR"],
  ["POW vL", "Power vL"], ["POW vR", "Power vR"],
  ["EYE vL", "Eye vL"], ["EYE vR", "Eye vR"],
  ["K vL", "Avoid K vL"], ["K vR", "Avoid K vR"],
  ["STU vL", "Stuff vL"], ["STU vR", "Stuff vR"],
  ["CON vL", "Control vL"], ["CON vR", "Control vR"],
  ["PBABIP vL", "pBABIP vL"], ["PBABIP vR", "pBABIP vR"],
  ["HRA vL", "pHR vL"], ["HRA vR", "pHR vR"],
  ["STM", "Stamina"], ["SPE", "Speed"], ["STE", "Stealing"],
  ["SR", "Steal Rate"], ["RUN", "Baserunning"],
  ["IF RNG", "Infield Range"], ["IF ERR", "Infield Error"], ["IF ARM", "Infield Arm"],
  ["TDP", "DP"], ["OF RNG", "OF Range"], ["OF ERR", "OF Error"], ["OF ARM", "OF Arm"],
  ["C ARM", "Catcher Arm"],
];

/**
 * The overall composites the model also reads. The collection export has no
 * both-hands column, so they are rebuilt from the split the same way the rest of
 * the codebase blends one: 70% vs RHP.
 */
const COMPOSITES: Array<[model: string, vl: string, vr: string]> = [
  ["BABIP", "BABIP vL", "BABIP vR"], ["Gap", "Gap vL", "Gap vR"],
  ["Power", "Power vL", "Power vR"], ["Eye", "Eye vL", "Eye vR"],
  ["Avoid Ks", "Avoid K vL", "Avoid K vR"], ["Stuff", "Stuff vL", "Stuff vR"],
  ["Control", "Control vL", "Control vR"], ["pBABIP", "pBABIP vL", "pBABIP vR"],
  ["pHR", "pHR vL", "pHR vR"],
];

export function mergeCopyRatings(
  base: Record<string, number> | null | undefined,
  copy: Record<string, number> | null | undefined,
  pos?: string | null,
): Record<string, number> {
  const out: Record<string, number> = { ...(base ?? {}) };
  if (!copy) return out;
  // Positions: the export has only DEF (the rating at the listed POS); a
  // variant's other listed positions scale by the same factor. See the
  // position note in card-forms.ts for the evidence.
  const at = pos ? out[`Pos Rating ${pos}`] : undefined;
  if (pos && pos !== "DH" && pos !== "P" && Number.isFinite(copy.DEF) && copy.DEF > 0 && at != null && at > 0 && copy.DEF !== at) {
    const k = copy.DEF / at;
    for (const key of Object.keys(out)) {
      if (key.startsWith("Pos Rating ") && key !== "Pos Rating P" && out[key] > 0) out[key] = Math.round(out[key] * k);
    }
    out[`Pos Rating ${pos}`] = copy.DEF;
  }
  for (const [k, v] of Object.entries(copy)) {
    if (k.startsWith("POS ") && Number.isFinite(v)) out[`Pos Rating ${k.slice(4)}`] = v;
  }
  let touched = false;
  for (const [c, m] of PER_COPY) {
    const v = copy[c];
    if (typeof v === "number") { if (out[m] !== v) touched = true; out[m] = v; }
  }
  // Only rebuild the composites if the split actually moved, so a base card's
  // own overall ratings are never replaced by a reconstruction of themselves.
  if (touched) {
    for (const [m, l, r] of COMPOSITES) {
      const a = out[l], b = out[r];
      if (typeof a === "number" && typeof b === "number") out[m] = 0.3 * a + 0.7 * b;
    }
  }
  return out;
}
