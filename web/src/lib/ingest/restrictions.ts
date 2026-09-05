/**
 * Parse a Perfect Team tournament rules blurb into structured limits.
 *
 * Two dialects say the same things, so one parser handles both:
 *   refresh posts    "64 teams, 1888 Cap, 1998 RE, DH on, Variant Cap 11, Heinsohn Park"
 *   OOTP RESTRICTIONS "Cards <= BRONZE; >=1999" / "<=1920 Era; Variant Limit 9; Slots: P1, D1, G1"
 *
 * Everything is optional — a field stays null when the text does not say.
 * Card tiers map to the value bands in constants.ts, so a tier cap and a raw
 * value cap ("Cards <= 84") both land in valueMin/valueMax.
 */

export interface Restrictions {
  valueMin: number | null;      // card value floor  (MIN GOLD -> 80)
  valueMax: number | null;      // card value ceiling (Cards <= SILVER -> 79)
  yearMin: number | null;
  yearMax: number | null;
  teamCap: number | null;       // total roster value ("1888 Cap")
  variantCap: number | null;    // "Variant Cap 11" / "Variant Limit 9"
  variantsAllowed: boolean | null;
  slots: Record<string, number> | null;  // { P, D, G, S, B, I }
  teams: number | null;
  bestOf: number | null;
  cards: number | null;         // draft roster size
  clockMinutes: number | null;  // speed drafts
  reYear: number | null;        // run environment year; null when Default/random
  reRandom: [number, number] | null;
  park: string | null;
  dh: boolean | null;
  cardTypes: string[] | null;   // "Snapshots cards only" -> ["Snapshots"]
  notes: string[];
}

const TIER_MAX: Record<string, number> = {
  IRON: 59, BRONZE: 69, SILVER: 79, GOLD: 89, DIAMOND: 99, PERFECT: 110,
};
const TIER_MIN: Record<string, number> = {
  IRON: 40, BRONZE: 60, SILVER: 70, GOLD: 80, DIAMOND: 90, PERFECT: 100,
};
const SLOT_KEY: Record<string, string> = {
  perfect: "P", diamond: "D", gold: "G", silver: "S", bronze: "B", iron: "I",
  p: "P", d: "D", g: "G", s: "S", b: "B", i: "I",
};

const empty = (): Restrictions => ({
  valueMin: null, valueMax: null, yearMin: null, yearMax: null, teamCap: null,
  variantCap: null, variantsAllowed: null, slots: null, teams: null, bestOf: null,
  cards: null, clockMinutes: null, reYear: null, reRandom: null, park: null,
  dh: null, cardTypes: null, notes: [],
});

export function parseRestrictions(raw: string | null | undefined): Restrictions {
  const r = empty();
  const s = (raw ?? "").trim();
  if (!s) return r;

  // ---- card value: tier words or a bare number -------------------------
  let m = s.match(/(?:cards?\s*)?<=\s*([A-Za-z]+)\b/i);
  if (m && TIER_MAX[m[1].toUpperCase()]) r.valueMax = TIER_MAX[m[1].toUpperCase()];
  m = s.match(/cards?\s*<=\s*(\d{2,3})\b/i);
  if (m) r.valueMax = Number(m[1]);
  m = s.match(/\bMIN\s+([A-Za-z]+)\b/i);
  if (m && TIER_MIN[m[1].toUpperCase()]) r.valueMin = TIER_MIN[m[1].toUpperCase()];
  m = s.match(/\bMIN\s+(\d{2,3})\b/i);
  if (m) r.valueMin = Number(m[1]);

  // ---- card year -------------------------------------------------------
  // "<=1920 Era" is an era band; PT stores it as an upper year bound.
  m = s.match(/<=\s*(\d{4})\s*Era\b/i) || s.match(/cards?\s+up\s*to\s*(\d{4})/i) || s.match(/<=\s*(\d{4})(?!\s*(?:RE|Cap))\b/i);
  if (m) { r.yearMax = Number(m[1]); r.yearMin ??= 1800; }
  m = s.match(/>=\s*(\d{4})(?!\s*(?:RE|Cap))\b/i);
  if (m) r.yearMin = Number(m[1]);
  m = s.match(/(?<!random\s)(?<!randomized\s)\b(\d{4})\s*-\s*(\d{4})\b(?!\s*RE)/);
  if (m && r.yearMax == null) { r.yearMin = Number(m[1]); r.yearMax = Number(m[2]); }

  // ---- caps and variants ----------------------------------------------
  m = s.match(/\b(\d{3,5})\s*cap\b/i);
  if (m) r.teamCap = Number(m[1]);
  m = s.match(/variant\s*(?:cap|limit)\s*(\d+)/i);
  if (m) r.variantCap = Number(m[1]);
  if (/variants?\s+on\b/i.test(s)) r.variantsAllowed = true;
  if (/variants?\s+off\b/i.test(s)) r.variantsAllowed = false;

  // ---- slots -----------------------------------------------------------
  // "SLOTS: 1 Perfect, 1 Diamond, 21 Silver" or "Slots: P1, D18, G0, S0, B0"
  const slotBlock = s.match(/slots?\s*[:\-]?\s*\(?([^)\n]*?)(?:\)|$|;)/i);
  const slots: Record<string, number> = {};
  const source = slotBlock ? slotBlock[1] : s;
  for (const mm of Array.from(source.matchAll(/\b([PDGSBI])\s*(\d+)\b/g))) slots[mm[1].toUpperCase()] = Number(mm[2]);
  for (const mm of Array.from(source.matchAll(/\b(\d+)\s+(Perfect|Diamond|Gold|Silver|Bronze|Iron)s?\b/gi))) {
    slots[SLOT_KEY[mm[2].toLowerCase()]] = Number(mm[1]);
  }
  if (Object.keys(slots).length) r.slots = slots;

  // ---- shape -----------------------------------------------------------
  m = s.match(/\b(\d+)\s*teams?\b/i);          if (m) r.teams = Number(m[1]);
  m = s.match(/best\s*(?:of)?\s*(\d+)/i);       if (m) r.bestOf = Number(m[1]);
  m = s.match(/\b(\d+)\s*cards?\b/i);           if (m) r.cards = Number(m[1]);
  m = s.match(/\b(\d{1,2})\s*-?\s*minute\b/i);   if (m) r.clockMinutes = Number(m[1]);

  // ---- run environment -------------------------------------------------
  m = s.match(/random(?:ized)?\s+(\d{4})\s*-\s*(\d{4})(?:\s*RE)?/i);
  if (m) r.reRandom = [Number(m[1]), Number(m[2])];
  else if (/default\s+RE/i.test(s)) r.notes.push("default RE");
  else if (/random[^,;]*RE/i.test(s)) r.notes.push("random RE");
  else { m = s.match(/\b(\d{4})\s*RE\b/i); if (m) r.reYear = Number(m[1]); }

  // ---- park ------------------------------------------------------------
  m = s.match(/\b((?:\d{4}\s+)?[A-Z][A-Za-z'.]*(?:\s+[A-Z][A-Za-z'.]*)*\s+(?:Park|Stadium|Field|Grounds|Yards))\b/);
  if (m) r.park = m[1].trim();
  else if (/random[^,;]*stadiums?/i.test(s)) r.notes.push("random park");

  // ---- DH and card types ----------------------------------------------
  if (/\bDH\s*on\b/i.test(s)) r.dh = true;
  if (/\bDH\s*off\b/i.test(s)) r.dh = false;
  m = s.match(/([A-Za-z][\w' -]*?)\s+cards?\s+only/i);
  if (m) {
    // "UH-SS-RS" is a list of abbreviations; "Historical Legend-All-Star-Future
    // Legend" is a list of names that themselves contain hyphens. Only split on
    // hyphens when every piece is a short code.
    const raw = m[1].trim();
    const byHyphen = raw.split("-").map((x) => x.trim()).filter(Boolean);
    const allCodes = byHyphen.length > 1 && byHyphen.every((x) => /^[A-Za-z]{2,4}$/.test(x));
    r.cardTypes = allCodes ? byHyphen : raw.split(/,|\band\b/).map((x) => x.trim()).filter(Boolean);
  }
  if (/\bnon-live\b/i.test(s)) r.notes.push("non-LIVE");
  if (/\bhistorical\b/i.test(s) && !r.cardTypes) r.notes.push("historical only");
  if (/\bLE\s*on\b/i.test(s)) r.notes.push("legends on");

  return r;
}

/**
 * Derive a card-value window from a tournament's NAME.
 *
 * The rules blurbs never restate the tier for a tier-named event - "Daily
 * Bronze OOTP Era" and "PTCS 6 Championship - Bronze" carry the restriction in
 * the title, so parseRestrictions finds no value clause and the event lands in
 * the database with no ceiling at all. /build then treats every card as legal
 * and happily recommends Perfects for a Bronze event.
 *
 * The convention is databotai's own (`ratings_cap` on the tourney-details
 * crawl), read off 65 catalogued events:
 *
 *   Bronze / Silver / Gold / Diamond      a CEILING, no floor  (Bronze -> 40-69)
 *   Low <tier>                            ceiling at the tier's lower half
 *                                         (Low Gold -> 40-84, Low Iron -> 40-49)
 *   <tier> Only                           floor at the tier's own minimum
 *                                         (Low Bronze Only -> 60-64)
 *   <tier> Floor                          a FLOOR, no ceiling  (Gold Floor -> 80-105)
 *   <tier> Ceiling                        a ceiling only
 *   High <tier>                           the tier's upper half (High Iron -> 50+)
 *   Open                                  no window at all - deliberately absent below
 *
 * Two catalogued events the name alone cannot reach: "Daily Dank Iron" is
 * 40-49 (community slang for low iron) and "Monday Gold Floor Cap" tops out at
 * 105. Both carry a stated ratings_cap, so the fallback never fires on them -
 * which is the point of it being a fallback.
 *
 * This is a FALLBACK. It is only ever consulted when the rules text and the
 * databotai catalog both leave the column null; a stated window always wins.
 * Drafts are excluded - their pool is a per-round sequence (DRAFT_FORMATS),
 * not one roster-wide band.
 */
export interface TierWindow {
  min: number | null;
  max: number | null;
  /** The phrase in the name this came from, for the audit trail. */
  basis: string;
}

const TIER_WORD_RE =
  /\b(?:(low|high)\s+)?(iron|bronze|silver|gold|diamond|perfect)s?\b(?:\s+(only|floor|ceiling))?/gi;

export function tierWindowFromName(name: string, opts?: { isDraft?: boolean }): TierWindow | null {
  if (opts?.isDraft) return null;
  if (/\bPD\b|\bdraft\b/i.test(name)) return null;
  // "<tier> & Friends" is a deliberately mixed pool - the friends of Iron are
  // the tiers ABOVE it - so the tier word is not a ceiling. Those events carry
  // a slots spec instead; say nothing rather than lock the pool down wrongly.
  if (/&\s*friends\b/i.test(name)) return null;

  let min: number | null = null;
  let max: number | null = null;
  const basis: string[] = [];

  for (const m of Array.from(name.matchAll(TIER_WORD_RE))) {
    const half = (m[1] ?? "").toLowerCase();       // low | high | ""
    const tier = m[2].toUpperCase();               // IRON | BRONZE | ... (plural stripped)
    const role = (m[3] ?? "").toLowerCase();       // only | floor | ceiling | ""
    const lo = TIER_MIN[tier], hi = TIER_MAX[tier];
    if (lo == null || hi == null) continue;

    // Iron spans 40-59, every other tier ten points; "low"/"high" split
    // whatever the band actually is rather than assuming a width.
    const step = Math.floor((hi - lo + 1) / 2);
    const bandLo = half === "high" ? lo + step : lo;
    const bandHi = half === "low" ? lo + step - 1 : hi;

    if (role === "floor") min = Math.max(min ?? 0, bandLo);
    else if (role === "ceiling") max = Math.min(max ?? 999, bandHi);
    else if (role === "only") { min = bandLo; max = bandHi; }
    else { max = Math.min(max ?? 999, bandHi); if (half === "high") min = Math.max(min ?? 0, bandLo); }

    basis.push(m[0].trim());
  }

  if (!basis.length) return null;
  if (min != null && max != null && min > max) return null; // contradictory, say nothing
  return { min, max, basis: basis.join(" + ") };
}

/**
 * Perfect Draft formats.
 *
 * A format is not one card pool, it is a SEQUENCE of pools - one per round.
 * "All-Gold" is the degenerate case (every round the same); "Orderly" walks
 * down the tiers in pairs; "Ladder" climbs and comes back. Modifiers like
 * "101+ Round 1" override a single round's floor on top of the sequence.
 *
 * `rounds: null` means the sequence is not yet known - do not guess it.
 */
export interface RoundPool {
  tier?: "Perfect" | "Diamond" | "Gold" | "Silver" | "Bronze" | "Iron";
  half?: "high" | "low";        // "high diamond" / "low diamond" rounds
  position?: string;            // around-the-horn drafts lock a round to a position
  valueMin?: number;
  valueMax?: number;
  cardType?: string;
}

export interface DraftFormat {
  rounds: RoundPool[] | null;   // null = unknown, do not guess
  totalRounds?: number;
  repeatEvery?: number;         // sequence repeats every N rounds
  structure?: string;           // how picks are presented, when it differs
  note?: string;
}

const T = (tier: RoundPool["tier"], half?: RoundPool["half"]): RoundPool => ({ tier, ...(half ? { half } : {}) });
const rep = (r: RoundPool, n: number): RoundPool[] => Array.from({ length: n }, () => ({ ...r }));
const all = (tier: RoundPool["tier"]): DraftFormat => ({ rounds: [T(tier)], repeatEvery: 1 });

/** Perfect is the 100+ band, so "Perfecto" and "all cards 100 or higher" are one rule. */
const PERFECT: RoundPool = { tier: "Perfect", valueMin: 100 };

export const DRAFT_FORMATS: Record<string, DraftFormat> = {
  "All-Iron": all("Iron"),
  "All-Bronze": all("Bronze"),
  "All-Silver": all("Silver"),
  "All-Gold": all("Gold"),
  "All-Diamond": all("Diamond"),

  // Every Perfecto draft is Perfect cards only, 100+.
  "Perfecto": { rounds: [PERFECT], repeatEvery: 1 },
  "Up Late with Perfecto": { rounds: [PERFECT], repeatEvery: 1 },

  // Blocks, not an interleave: seven Perfect rounds then six of the tier.
  "Perfectly Iron":   { rounds: [...rep(PERFECT, 7), ...rep(T("Iron"), 6)],   totalRounds: 13 },
  "Perfectly Bronze": { rounds: [...rep(PERFECT, 7), ...rep(T("Bronze"), 6)], totalRounds: 13 },
  "Perfectly Silver": { rounds: [...rep(PERFECT, 7), ...rep(T("Silver"), 6)], totalRounds: 13 },
  "Perfectly Gold":   { rounds: [...rep(PERFECT, 7), ...rep(T("Gold"), 6)],   totalRounds: 13 },

  // Descending tiers in high/low pairs. Shape confirmed; start and end tier
  // vary by event, so the length here is indicative.
  "Orderly": {
    rounds: [T("Diamond", "high"), T("Diamond", "low"), T("Gold", "high"), T("Gold", "low"),
             T("Silver", "high"), T("Silver", "low"), T("Bronze", "high"), T("Bronze", "low")],
    note: "descending high/low pairs; start and end tier vary by event",
  },

  // Up from Iron to a peak, then back down. Peak is Diamond or Perfect
  // depending on the event.
  "Ladder": {
    rounds: [T("Iron"), T("Bronze"), T("Silver"), T("Gold"), T("Diamond"),
             T("Gold"), T("Silver"), T("Bronze"), T("Iron")],
    note: "up then back down; peak tier and length vary by event",
  },

  "Historical": { rounds: [{ cardType: "Historical" }], repeatEvery: 1 },
  "High Heat":  { rounds: [{ cardType: "High Heat" }],  repeatEvery: 1 },
  "Mixed Bag":  { rounds: null, note: "mixed tiers per round; sequence unknown" },

  // Structure only - these change how picks are presented, not the pool.
  "Original PD": { rounds: null, structure: "one card per pick" },
  "Double PD":   { rounds: null, structure: "two cards per pick" },
  "Pick 12":     { rounds: null, structure: "choose 1 of 12 offered" },
};

/**
 * Named Perfect Drafts whose pool is set by the event rather than a format
 * word. Keyed by the slug the exports are filed under.
 */
export const DRAFT_EVENTS: Record<string, DraftFormat> = {
  // 21 cards drawn from Silver, Bronze and Iron. Per-round order not yet known.
  "5ldeadball": {
    rounds: null, totalRounds: 21,
    note: "Silver / Bronze / Iron pool, 21 cards; round order unknown",
  },
  // Around the horn: a round per position, tiers running Gold down to Iron.
  // Known to open on a Bronze catcher round and to end with a thin Silver
  // round and a Gold one. Middle rounds UNVERIFIED.
  "6lpowerplay": {
    rounds: [{ tier: "Bronze", position: "C" }],
    note: "around the horn, Gold->Iron, one position per round; opens Bronze C, " +
          "ends with a thin Silver round then Gold; middle rounds unverified",
  },
};

/**
 * "101+ Round 1", "100 Round 2", "101+ RD1" - a raised value floor on one
 * round, layered over whatever the format's sequence says.
 */
export function parseRoundFloors(text: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of Array.from(text.matchAll(/(\d{2,3})\+?\s*(?:Round|RD)\s*(\d)/gi))) {
    out[Number(m[2])] = Number(m[1]);
  }
  return out;
}
