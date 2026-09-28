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
import { CARD_TYPE_NAME, cardTypeNames } from "@/lib/card-sets";
import { evidenceLine, evidenceRule, liveAbsent, setsNarrow, yearSpan, yearsNarrow, type SetEvidence } from "@/lib/set-evidence";

export { CARD_TYPES, CARD_TYPE_NAME, CARD_TYPE_SHORT, cardTypeNames, cardTypeRuleLabel } from "@/lib/card-sets";

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
    /** The import's note on the row ("… CONFIRM ON SCREEN"). */
    refreshNote?: string | null;
    /** Date a value window was set by hand (catalogue:set --value). */
    valueConfirmed?: string | null;
    /** The rules as captured from the game's refresh post or summary screen. */
    refreshText?: string | null;
    /** Provenance lines; L.J.'s confirmations among them. */
    notes?: string[] | null;
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
  const over = slotOverflow(tiers, slots);
  return over ? [{
    code: "tier-slots",
    message: `${over.cards} cards at ${TIER_NAME[over.tier]} or better; this event allows ${over.room} (${over.cards - over.room} too many).`,
  }] : [];
}

/** The first tier, from the top, where the roster overflows its slots; null when it fits. */
export function slotOverflow(tiers: Record<string, number>, slots: Record<string, number>): { tier: TierCode; cards: number; room: number } | null {
  let cards = 0, room = 0;
  for (const t of [...TIER_ORDER].reverse()) {
    cards += tiers[t] ?? 0;
    room += slots[t] ?? 0;
    if (cards > room) return { tier: t, cards, room };
  }
  return null;
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
  snapshot: 7, snapshots: 7, snap: 7, ss: 7,
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

/**
 * An event's card-set rule as set codes, lowest first: [5, 9] for Historical
 * All-Star + Hardware Heroes. Null when it has no rule, or when any part of the
 * rule can't be read (the pool is then not filtered by set; describeRules says
 * so in red).
 */
export function ruleCardTypes(rules: Pick<RosterRules, "restrictions">): number[] | null {
  const labels = rules.restrictions?.cardTypes?.filter((t) => t.trim());
  if (!labels?.length) return null;
  const parsed = labels.map(parseCardTypeRule);
  return parsed.some((p) => p == null) ? null : [...new Set(parsed.flat() as number[])].sort((a, b) => a - b);
}

/* ------------------------------------------------------------- eligibility */

/** Events whose NAME says there is no value window — a confirmed absence, not an unknown. */
const NO_WINDOW_BY_NAME = /\bopen\b|&\s*friends\b|\band friends\b/i;
/** Events whose name promises tier slots ("Daily Open Slots", "Open Slot Quick"). */
export const SLOTS_NAME = /\bslots?\b/i;

/** A Slots event with no slot rule on file: its tiers are capped, but not here. */
export const slotsMissing = (rules: RosterRules) => SLOTS_NAME.test(rules.name ?? "") && !rules.restrictions?.slots;

/**
 * A value window the import could only guess: inferred from the refresh
 * post's section ("name has no tier word - confirm on screen"), or set by hand
 * with a note to confirm it on screen (538, 542). A window read off a tier
 * word in the name ("name: Iron") is taken as known, and one L.J. set by hand
 * (valueConfirmed) is confirmed.
 */
export const valueWindowGuessed = (rules: RosterRules) => {
  const rx = rules.restrictions;
  if (rx?.valueConfirmed || (rules.ratingsMin == null && rules.ratingsMax == null)) return false;
  return /confirm/i.test(rx?.valueWindowFrom ?? "") || noteSaysConfirm(rules);
};
const noteSaysConfirm = (rules: RosterRules) => /\bconfirm\b[^.]*\bon screen\b/i.test(rules.restrictions?.refreshNote ?? "");

export function valueWindowKnown(rules: RosterRules): boolean {
  return rules.ratingsMin != null || rules.ratingsMax != null || !!rules.restrictions?.slots
    || (NO_WINDOW_BY_NAME.test(rules.name ?? "") && !SLOTS_NAME.test(rules.name ?? ""));
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
    else if (!parsed.flat().includes(card.cardType)) {
      fail("card-type", `card set ${CARD_TYPE_NAME[card.cardType] ?? card.cardType} not allowed (allowed: ${cardTypeNames(parsed.flat() as number[])}).`);
    }
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
  if (slotsMissing(rules)) incomplete.push({ code: "unknown-slots", message: "The name says tier slots, but none are on file: the board is not held to any tier counts." });
  else if (!valueWindowKnown(rules)) incomplete.push({ code: "unknown-value-window", message: "Card-value eligibility has not been confirmed for this event." });
  if (valueWindowGuessed(rules)) incomplete.push({ code: "unconfirmed-value-window", message: `Card value ${range2(rules.ratingsMin, rules.ratingsMax)} ${rules.restrictions?.valueWindowFrom ? `was inferred (${rules.restrictions.valueWindowFrom})` : "was set on import with a note to check it"}; confirm it against the event's RESTRICTIONS line.` });
  for (const hand of ["R", "L"]) {
    for (const pos of [...FIELD_POSITIONS, ...(rules.dh === true ? ["DH"] : [])]) {
      if (!occupied.has(`${hand}:${pos}`)) issue("empty-position", `Fill ${pos} vs ${hand}HP.`);
    }
  }
  if (![...unique.keys()].some(id => byId.get(id)?.isPitcher)) issue("no-pitchers", "Add a pitching staff.");
  return { ready: errors.length === 0 && incomplete.length === 0, errors, incomplete,
    counts: { players: unique.size, target, value, variants, tiers } };
}

/* ------------------------------------------------------ describing rules */

/** Event names that usually mean a card-set rule (for flagging a missing one). */
export const SUSPECT_SET_NAME = /all-?star|hardware|snapshot|negro|unsung|rookie|legend|future|veteran|\blive\b/i;
const SET_NAME_NOT_LIVE = /all-?star|hardware|snapshot|negro|unsung|rookie|legend|future|veteran/i;

/**
 * The name suggests a card-set rule that is not on file. "Live" in a name is
 * explained by a card-year rule instead: Daily Live Plus is 2026 cards (L.J.,
 * 09-27), and PTCS 6 Championship - Live is 1920–1989 cards, which no Live
 * card meets.
 */
export function nameSuggestsSets(rules: Pick<RosterRules, "name" | "cardYearMin" | "cardYearMax">): boolean {
  const name = rules.name ?? "";
  return SET_NAME_NOT_LIVE.test(name) || (/\blive\b/i.test(name) && rules.cardYearMin == null && rules.cardYearMax == null);
}

/**
 * A card-set rule stated in the captured rules text, e.g. "Nel-SS-UH-HH, 1969
 * RE, DH off" or "Snapshots and Unsung Heroes cards from 1950-2026, 2026 Globe
 * Life Field": the sets of every comma clause that reads as sets once a
 * trailing year range is cut. Null when no clause does.
 */
export function setRuleFromText(text: string | null | undefined): number[] | null {
  if (!text) return null;
  const codes = new Set<number>();
  for (const raw of text.split(/[,;]/)) {
    const clause = raw.replace(/\s*\b(?:from\s+)?\d{4}\s*[-–]\s*\d{4}.*$/i, "").trim();
    const parsed = clause ? parseCardTypeRule(clause) : null;
    for (const c of parsed ?? []) codes.add(c);
  }
  return codes.size ? [...codes].sort((a, b) => a - b) : null;
}

/** L.J.'s confirmations among the row's notes ("2026-09-25 from L.J.: …"). */
export function confirmedNotes(rules: RosterRules): string[] {
  const notes = rules.restrictions?.notes;
  return Array.isArray(notes) ? notes.filter((n) => typeof n === "string" && /\bL\.J\.|\bconfirmed\b/i.test(n)) : [];
}

/**
 * Who sits in which tier's slots: each tier's cards fill their own slots,
 * then the nearest higher tier with room (a lower card may fill a higher
 * slot). `over`: cards left with no slot, by their tier — the same overflow
 * slotOverflow finds, tier by tier.
 */
export function slotUse(tiers: Record<string, number>, slots: Record<string, number>): { use: Partial<Record<TierCode, number>>; over: Partial<Record<TierCode, number>> } {
  const order = [...TIER_ORDER].reverse();
  const room = Object.fromEntries(order.map((t) => [t, slots[t] ?? 0])) as Record<TierCode, number>;
  const use: Partial<Record<TierCode, number>> = {}, over: Partial<Record<TierCode, number>> = {};
  order.forEach((t, i) => {
    let n = tiers[t] ?? 0;
    for (let j = i; j >= 0 && n > 0; j--) {
      const k = Math.min(n, room[order[j]]);
      if (k > 0) { room[order[j]] -= k; use[order[j]] = (use[order[j]] ?? 0) + k; n -= k; }
    }
    if (n > 0) over[t] = n;
  });
  return { use, over };
}

export type RuleState = "set" | "none" | "unreadable" | "suspect";
export interface RuleItem {
  key: "value" | "slots" | "sets" | "years" | "variants" | "cap" | "size" | "dh";
  label: string;
  text: string;
  /**
   * set: on file. none: no such rule (or not on file — `text` says which).
   * unreadable: on file but not understood, so NOT enforced.
   * suspect: not on file (or only inferred), but the name, the captured text
   * or the field's play says there is one.
   */
  state: RuleState;
  /** Longer explanation for a title or tooltip. */
  detail?: string;
  /** Sets only: the sets "Use these sets" applies, when something names them. */
  propose?: number[];
  /** Slots only, with a board: each tier's slots and who fills them, and cards with no slot. */
  slotRows?: { tier: TierCode; used: number; room: number }[];
  unplaced?: Partial<Record<TierCode, number>>;
}

const range2 = (lo: number | null, hi: number | null) => (lo != null && hi != null ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : lo != null ? `${lo}+` : `up to ${hi}`);
const windowSource = (from: string) => (from.startsWith("name: ") ? `read off the name (${from.slice(6)})` : `inferred: ${from}`);
/** Every set but Live: the rule a field that plays no Live card usually has. */
const NO_LIVE_CODES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * An event's rules as one line of items in a fixed order, for the rules strip
 * on every page that recommends cards (UI plan principle 3). A rule that is
 * missing, or on file but unreadable, is an item too: silence is how the
 * 09-27 Hardware roster went wrong.
 *
 * `used`: the board's cards per tier, for "G 13/13 · I 13/13" (slotUse: a
 * Silver card filling a Gold slot counts in Gold).
 * `evidence`: what the field plays (set-evidence.ts), for a missing set rule;
 * the page leaves it out when the exports predate the event's format.
 */
export function describeRules(rules: RosterRules, opts: { used?: Record<string, number>; evidence?: SetEvidence | null } = {}): RuleItem[] {
  const out: RuleItem[] = [];
  const rx = rules.restrictions;
  const missingSlots = slotsMissing(rules);

  if (rules.ratingsMin != null || rules.ratingsMax != null) {
    const from = rx?.valueWindowFrom, guessed = valueWindowGuessed(rules), win = range2(rules.ratingsMin, rules.ratingsMax);
    out.push({
      key: "value", label: "Value", text: guessed ? `${win} — inferred, confirm` : win, state: guessed ? "suspect" : "set",
      detail: `Card value ${win}${from ? `, ${windowSource(from)}` : ""}.${noteSaysConfirm(rules) && !rx?.valueConfirmed ? " The import's note asks to confirm it on screen." : ""}${guessed ? " Confirm it against the event's RESTRICTIONS line in game." : ""}`,
    });
  } else if (!rx?.slots && !missingSlots) {
    out.push(valueWindowKnown(rules)
      ? { key: "value", label: "Value", text: "any", state: "none", detail: "No value window: an Open or & Friends event." }
      : { key: "value", label: "Value", text: rules.isDraft ? "draft" : "not on file — every card shown", state: rules.isDraft ? "none" : "suspect", detail: "No card-value window on file, so every card is shown. Check the event's RESTRICTIONS line in game." });
  }

  if (rx?.slots) {
    const slots = rx.slots, tiers = [...TIER_ORDER].reverse().filter((t) => (slots[t] ?? 0) > 0);
    const fill = opts.used ? slotUse(opts.used, slots) : null;
    const unplaced = fill && Object.keys(fill.over).length ? fill.over : undefined;
    const extra = unplaced ? Object.entries(unplaced).map(([t, n]) => `${t} +${n} no slot`) : [];
    out.push({
      key: "slots", label: "Slots", state: "set",
      text: [...tiers.map((t) => (fill ? `${t} ${fill.use[t] ?? 0}/${slots[t]}` : `${t}${slots[t]}`)), ...extra].join(" · "),
      slotRows: fill ? tiers.map((t) => ({ tier: t, used: fill.use[t] ?? 0, room: slots[t] })) : undefined,
      unplaced,
      detail: `Per-tier maximums: ${tiers.map((t) => `${slots[t]} ${TIER_NAME[t]}`).join(", ")}. A lower-tier card may fill a higher slot, and counts where it sits.${unplaced ? ` ${Object.entries(unplaced).map(([t, n]) => `${n} ${TIER_NAME[t as TierCode]} card${n === 1 ? "" : "s"}`).join(", ")} with no slot left: take ${Object.values(unplaced).reduce((a, b) => a + b, 0)} off.` : ""}`,
    });
  } else if (missingSlots) {
    out.push({ key: "slots", label: "Slots", text: "not on file — the name says Slots", state: "suspect", detail: "The name says tier slots, but no slot rule is on file: every tier is shown, and nothing holds the board to tier counts. Check the event's RESTRICTIONS line in game." });
  }

  const types = rx?.cardTypes?.filter((t) => t.trim()) ?? [];
  const e = opts.evidence ?? null;
  const field = e ? ` The field has played ${evidenceLine(e)}.` : "";
  const fromText = types.length ? null : setRuleFromText(rx?.refreshText);
  let setsFromField = false;
  if (types.length) {
    const parsed = types.map(parseCardTypeRule);
    if (parsed.some((p) => p == null)) {
      out.push({ key: "sets", label: "Sets", text: `rule not understood: “${types.join(" / ")}” — pool not filtered`, state: "unreadable", detail: `Card-set rule on file but not understood: "${types.join(" / ")}". The pool is NOT filtered by set.${field}` });
    } else {
      out.push({ key: "sets", label: "Sets", text: cardTypeNames(parsed.flat() as number[]), state: "set", detail: `Only these card sets may enter.${field}` });
    }
  } else if (fromText) {
    out.push({ key: "sets", label: "Sets", text: `not on file — rules text says ${cardTypeNames(fromText)}`, state: "suspect", propose: fromText, detail: `The captured rules text ("${rx?.refreshText}") names card sets, but no card-set rule is on file, so the pool is not filtered by set.${field}` });
  } else if (e && setsNarrow(e)) {
    setsFromField = true;
    out.push({ key: "sets", label: "Sets", text: `not on file — field plays only ${evidenceLine(e)}`, state: "suspect", propose: [...e.types].sort((a, b) => a - b), detail: `No card-set rule on file, but the field has played only ${evidenceRule(e).replace(/\+/g, ", ")}. The pool may include cards the game refuses.` });
  } else if (e && liveAbsent(e) && (rules.cardYearMax == null || rules.cardYearMax >= 2026)) {
    out.push({ key: "sets", label: "Sets", text: `not on file — field has played no Live card`, state: "suspect", propose: NO_LIVE_CODES, detail: `No card-set rule on file, but the field has played ${e.n} cards and not one Live card: usually a rule of every set but Live.${field}` });
  } else if (nameSuggestsSets(rules)) {
    out.push({ key: "sets", label: "Sets", text: "not on file — the name suggests a rule", state: "suspect", detail: `The name suggests a card-set rule, but none is on file. The pool may include cards the game refuses.${field}` });
  } else {
    out.push({ key: "sets", label: "Sets", text: "any", state: "none", detail: `No card-set rule on file.${field}` });
  }

  if (rules.cardYearMin != null || rules.cardYearMax != null) {
    out.push({ key: "years", label: "Years", text: range2(rules.cardYearMin, rules.cardYearMax), state: "set", detail: `Card years ${range2(rules.cardYearMin, rules.cardYearMax)}.` });
  } else if (e && !types.length && !setsFromField && yearsNarrow(e)) {
    // A field narrow in sets is narrow in years for that reason (a Live-only
    // field plays 2026 cards): the set rule is the one to file.
    out.push({ key: "years", label: "Years", text: `not on file — field plays only ${yearSpan(e)} cards`, state: "suspect", detail: `No card-year rule on file, but every card the field has played is from ${yearSpan(e)}.` });
  }

  if (rx?.variantsAllowed === false) out.push({ key: "variants", label: "Variants", text: "none", state: "set" });
  else if (rx?.variantCap != null) out.push({ key: "variants", label: "Variants", text: `≤ ${rx.variantCap}`, state: "set" });
  if (rx?.teamCap != null) out.push({ key: "cap", label: "Cap", text: rx.teamCap.toLocaleString("en-US"), state: "set", detail: "Total card value of the roster." });
  const size = rosterSize(rules);
  out.push({ key: "size", label: "Roster", text: size == null ? "not on file" : String(size), state: size == null ? "suspect" : "set" });
  out.push({ key: "dh", label: "DH", text: rules.dh == null ? "not on file" : rules.dh ? "yes" : "no", state: rules.dh == null ? "suspect" : "set" });
  return out;
}
