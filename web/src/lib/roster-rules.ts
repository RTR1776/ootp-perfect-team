/**
 * Shared roster validation — the ONE place that says whether a roster is legal
 * for an event. Used by /build (pool filter, auto-fill, the rule panel), the
 * /api/rosters save endpoint, and scripts that build rosters offline.
 *
 * Two grains: `cardEligibility` (may this card enter this event at all) and
 * `validateRoster` (is this whole roster legal). A rule the catalog cannot
 * express with confidence is reported as `incomplete`, never silently passed —
 * a roster is `ready` only when errors AND incomplete are both empty.
 *
 * Rule facts confirmed by L.J.:
 *  - 2026-09-05: a tier word in an event name is a value CEILING (tier and
 *    below) — that lives in tierWindowFromName, upstream of here.
 *  - 2026-09-07: SLOT counts ("8 Perfect, 7 Diamond, …") are per-tier
 *    MAXIMUMS and a lower-tier card may fill a higher slot. Every catalogued
 *    slot rule sums to 26, so the test is cumulative from the top: for every
 *    tier T, cards of tier ≥ T must not exceed slots of tier ≥ T.
 */
export const FIELD_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;

/** Low → high. Slot keys and `tierCode` both use these single letters. */
export const TIER_ORDER = ["I", "B", "S", "G", "D", "P"] as const;
export type TierCode = (typeof TIER_ORDER)[number];
export const TIER_NAME: Record<TierCode, string> = {
  I: "Iron", B: "Bronze", S: "Silver", G: "Gold", D: "Diamond", P: "Perfect",
};

export interface RosterRules {
  /** Event name — read only to recognise "Open" / "& Friends" (no value window by design). */
  name?: string | null;
  dh: boolean | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  isDraft: boolean;
  restrictions: {
    slots?: Record<string, number> | null;
    teamCap?: number | null;
    variantCap?: number | null;
    variantsAllowed?: boolean | null;
    cardTypes?: string[] | null;
    cards?: number | null;
    valueWindowFrom?: string;
  } | null;
}

export interface RosterCard {
  cardId: number;
  name: string;
  val: number | null;
  year: number | null;
  isPitcher: boolean;
  role: string | null;
  cardType?: number | null;
  ratings: Record<string, number>;
  baseOwned: boolean;
  variantOwned: boolean;
}

export interface RosterSlot {
  cardId: number;
  slot: string;
  versusHand: string | null;
  lineupOrder: number | null;
  useVariant: boolean;
}

export interface RuleIssue { code: string; message: string; cardId?: number }
export interface RosterValidation {
  ready: boolean;
  errors: RuleIssue[];
  incomplete: RuleIssue[];
  counts: { players: number; target: number | null; value: number; variants: number; tiers: Record<string, number> };
}

export function tierCode(value: number): TierCode {
  return value >= 100 ? "P" : value >= 90 ? "D" : value >= 80 ? "G" : value >= 70 ? "S" : value >= 60 ? "B" : "I";
}

/* ------------------------------------------------------------------ slots */

const tierRank = (t: string) => TIER_ORDER.indexOf(t as TierCode);

/** Slots at or above this tier exist, so the card has somewhere to sit. */
export function tierFitsSlots(tier: TierCode, slots: Record<string, number>): boolean {
  return Object.entries(slots).some(([t, n]) => tierRank(t) >= tierRank(tier) && n > 0);
}

/**
 * Cumulative capacity check for per-tier maximums (lower may fill higher).
 * `tiers` = how many rostered cards sit at each tier code. Reports the first
 * tier at which the roster overflows, from the top down.
 */
export function slotCapacityIssues(tiers: Record<string, number>, slots: Record<string, number>): RuleIssue[] {
  let cards = 0, room = 0;
  for (const t of [...TIER_ORDER].reverse()) {
    cards += tiers[t] ?? 0;
    room += slots[t] ?? 0;
    if (cards > room) {
      return [{
        code: "tier-slots",
        message: `${cards} cards at ${TIER_NAME[t]} or better; this event allows ${room} (${cards - room} too many).`,
      }];
    }
  }
  return [];
}

/* ------------------------------------------------------------- card types */

// Card Type codes cross-checked against the shop export (cards.card_type):
// 1 Live · 2 Negro League Star · 3 Rookie Sensation · 4 All-Time Legend
// 5 Historical All-Star · 6 Future Legend · 7 Snapshot · 8 Unsung Heroes
// 9 Hardware Heroes · 10 Veteran Presence. Sub-types (LE, HOF, BBR, UTIL,
// PTMS, WBC, VB, HFL) are orthogonal and not a card-type rule.
const TYPE_CODES: Record<string, number> = {
  live: 1, "negro league star": 2, "negro league stars": 2, "negro leagues": 2, "negro league": 2, nel: 2, nls: 2,
  "rookie sensation": 3, "rookie sensations": 3, rs: 3,
  "all-time legend": 4, "all time legend": 4, "historical legend": 4, "historical legends": 4, atl: 4,
  "historical all-star": 5, "historical all star": 5, "historical all-stars": 5, "all-star": 5, "all star": 5, "all-stars": 5, "all stars": 5, has: 5,
  "future legend": 6, "future legends": 6, fl: 6,
  snapshot: 7, snapshots: 7, ss: 7,
  "unsung heroes": 8, "unsung hero": 8, uh: 8,
  "hardware heroes": 9, "hardware hero": 9, hh: 9,
  "veteran presence": 10, vp: 10,
};
const TYPE_KEYS = Object.keys(TYPE_CODES).sort((a, b) => b.length - a.length);
const SEP = /[\s\-\/,&+]/;

/**
 * Read a card-type rule label into type codes. Labels arrive in several shapes —
 * "Snapshots", ["UH","SS","RS"], "Historical Legend-All-Star-Future Legend cards
 * only" — so tokenise longest-known-name-first rather than splitting on dashes
 * (which would cut "All-Star" and "All-Time Legend" in half). Returns null when
 * any part of the label is not a known type, so the caller can leave the rule
 * unverified instead of guessing.
 */
export function parseCardTypeRule(label: string): number[] | null {
  const s = label.toLowerCase().replace(/\s+/g, " ").trim();
  const codes = new Set<number>();
  let i = 0;
  while (i < s.length) {
    if (SEP.test(s[i])) { i++; continue; }
    const rest = s.slice(i);
    const key = TYPE_KEYS.find((k) => rest.startsWith(k) && (rest.length === k.length || SEP.test(rest[k.length])));
    if (key) { codes.add(TYPE_CODES[key]); i += key.length; continue; }
    const filler = /^(and|or|cards?|only)(?![a-z])/.exec(rest);
    if (filler) { i += filler[0].length; continue; }
    return null;
  }
  return codes.size ? [...codes] : null;
}

/* ------------------------------------------------------------- eligibility */

/** Events whose NAME says there is no value window — a confirmed absence, not an unknown. */
const NO_WINDOW_BY_NAME = /\bopen\b|&\s*friends\b|\band friends\b/i;

export function valueWindowKnown(rules: RosterRules): boolean {
  return rules.ratingsMin != null || rules.ratingsMax != null || !!rules.restrictions?.slots
    || NO_WINDOW_BY_NAME.test(rules.name ?? "");
}

export function cardEligibility(card: RosterCard, rules: RosterRules): { errors: RuleIssue[]; incomplete: RuleIssue[] } {
  const errors: RuleIssue[] = [], incomplete: RuleIssue[] = [];
  const fail = (code: string, message: string) => errors.push({ code, message: `${card.name}: ${message}`, cardId: card.cardId });
  const unknown = (code: string, message: string) => incomplete.push({ code, message: `${card.name}: ${message}`, cardId: card.cardId });
  if (card.val == null) unknown("missing-value", "card value is missing.");
  else {
    if (rules.ratingsMin != null && card.val < rules.ratingsMin) fail("value-min", `value is below ${rules.ratingsMin}.`);
    if (rules.ratingsMax != null && card.val > rules.ratingsMax) fail("value-max", `value exceeds ${rules.ratingsMax}.`);
    const slots = rules.restrictions?.slots;
    if (slots && !tierFitsSlots(tierCode(card.val), slots)) fail("tier-excluded", "no slot at this tier or above in this event.");
  }
  if (rules.cardYearMin != null || rules.cardYearMax != null) {
    if (card.year == null) unknown("missing-year", "card year is missing.");
    else if ((rules.cardYearMin != null && card.year < rules.cardYearMin) || (rules.cardYearMax != null && card.year > rules.cardYearMax)) fail("card-year", "card year is outside this event's range.");
  }
  const types = rules.restrictions?.cardTypes;
  if (types?.length) {
    const parsed = types.map(parseCardTypeRule);
    if (parsed.some((p) => p == null)) unknown("unknown-card-type-rule", `unverified card-type rule: ${types.join(" / ")}.`);
    else if (card.cardType == null) unknown("missing-card-type", "card type is missing.");
    else if (!parsed.flat().includes(card.cardType)) fail("card-type", "card type is not allowed.");
  }
  return { errors, incomplete };
}

export function rosterSize(rules: RosterRules): number | null {
  const explicit = rules.restrictions?.cards;
  if (explicit != null) return Number.isInteger(explicit) && explicit > 0 ? explicit : null;
  const slots = rules.restrictions?.slots;
  if (slots) return Object.values(slots).reduce((a, b) => a + b, 0);
  return rules.isDraft ? null : 26;
}

export function fitsPosition(card: RosterCard, slot: string): boolean {
  if (/^SP[1-9]\d*$/.test(slot)) return card.isPitcher && (card.role === "SP" || card.role == null);
  if (/^RP[1-9]\d*$/.test(slot) || slot === "CL") return card.isPitcher;
  if (/^BN[1-9]\d*$/.test(slot) || slot === "DH") return !card.isPitcher;
  return (FIELD_POSITIONS as readonly string[]).includes(slot) && !card.isPitcher && (card.ratings[`Pos Rating ${slot}`] ?? 0) > 0;
}

/* -------------------------------------------------------------- the roster */

export function validateRoster(slots: RosterSlot[], cards: RosterCard[], rules: RosterRules): RosterValidation {
  const errors: RuleIssue[] = [], incomplete: RuleIssue[] = [];
  const byId = new Map(cards.map(c => [c.cardId, c]));
  const unique = new Map<number, RosterSlot>();
  const occupied = new Set<string>(), assignments = new Set<string>();
  const issue = (code: string, message: string, cardId?: number) => errors.push({ code, message, ...(cardId == null ? {} : { cardId }) });
  for (const s of slots) {
    const c = byId.get(s.cardId);
    if (!c) { issue("missing-card", `Card ${s.cardId} is not in the current collection.`, s.cardId); continue; }
    const isLineup = (FIELD_POSITIONS as readonly string[]).includes(s.slot) || s.slot === "DH";
    const hand = isLineup ? s.versusHand : "both";
    if (isLineup && hand !== "L" && hand !== "R") issue("lineup-hand", `${s.slot} needs a left- or right-handed lineup.`);
    if (!isLineup && s.versusHand !== "both" && s.versusHand != null) issue("staff-hand", `${s.slot} belongs to the shared roster.`);
    const key = `${hand}:${s.slot}`;
    if (occupied.has(key)) issue("duplicate-slot", `${key} is assigned more than once.`);
    occupied.add(key);
    const group = c.isPitcher ? "staff" : /^BN/.test(s.slot) ? "R" : hand;
    const assignment = `${group}:${s.cardId}`;
    if (assignments.has(assignment)) issue("duplicate-player", `${c.name} occupies more than one slot in the same lineup or staff.`, c.cardId);
    assignments.add(assignment);
    if (!fitsPosition(c, s.slot)) issue("position", `${c.name} cannot fill ${s.slot}.`, c.cardId);
    if (s.slot === "DH" && rules.dh === false) issue("dh-off", "This tournament does not use a DH.");
    if (s.useVariant ? !c.variantOwned : !c.baseOwned) issue("not-owned", `${c.name}: selected ${s.useVariant ? "variant" : "base"} copy is not owned in the latest collection.`, c.cardId);
    const previous = unique.get(c.cardId);
    if (previous && previous.useVariant !== s.useVariant) issue("mixed-form", `${c.name} must use the same card form in both lineups.`, c.cardId);
    unique.set(c.cardId, s);
  }
  let value = 0, variants = 0;
  const tiers: Record<string, number> = {};
  for (const [id, s] of unique) {
    const c = byId.get(id)!;
    const eligible = cardEligibility(c, rules);
    errors.push(...eligible.errors); incomplete.push(...eligible.incomplete);
    value += c.val ?? 0;
    if (s.useVariant) variants++;
    if (c.val != null) { const tier = tierCode(c.val); tiers[tier] = (tiers[tier] ?? 0) + 1; }
  }
  const rx = rules.restrictions;
  const target = rosterSize(rules);
  if (target == null) incomplete.push({ code: "unknown-roster-size", message: "Confirm this draft format's roster size." });
  else if (unique.size !== target) issue("roster-size", `${unique.size} unique players selected; this event needs ${target}.`);
  if (rx?.teamCap != null && value > rx.teamCap) issue("team-cap", `Roster value ${value} exceeds the ${rx.teamCap} cap by ${value - rx.teamCap}.`);
  const variantLimit = rx?.variantsAllowed === false ? 0 : rx?.variantCap;
  if (variantLimit != null && variants > variantLimit) issue("variant-cap", `${variants} variants selected; at most ${variantLimit} allowed.`);
  if (rx?.slots) errors.push(...slotCapacityIssues(tiers, rx.slots));
  if (rules.dh == null) incomplete.push({ code: "unknown-dh", message: "DH rule has not been confirmed." });
  if (!valueWindowKnown(rules)) incomplete.push({ code: "unknown-value-window", message: "Card-value eligibility has not been confirmed for this event." });
  for (const hand of ["R", "L"]) {
    for (const pos of [...FIELD_POSITIONS, ...(rules.dh === true ? ["DH"] : [])]) {
      if (!occupied.has(`${hand}:${pos}`)) issue("empty-position", `Fill ${pos} vs ${hand}HP.`);
    }
  }
  if (![...unique.keys()].some(id => byId.get(id)?.isPitcher)) issue("no-pitchers", "Add a pitching staff.");
  return { ready: errors.length === 0 && incomplete.length === 0, errors, incomplete,
    counts: { players: unique.size, target, value, variants, tiers } };
}
