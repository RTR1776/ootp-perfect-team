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
  if (m) r.cardTypes = m[1].split(/[-,]/).map((x) => x.trim()).filter(Boolean);
  if (/\bnon-live\b/i.test(s)) r.notes.push("non-LIVE");
  if (/\bhistorical\b/i.test(s) && !r.cardTypes) r.notes.push("historical only");
  if (/\bLE\s*on\b/i.test(s)) r.notes.push("legends on");

  return r;
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
  valueMin?: number;
  valueMax?: number;
  cardType?: string;
}

export interface DraftFormat {
  rounds: RoundPool[] | null;   // null = unknown, needs the in-game rules panel
  repeatEvery?: number;         // sequence repeats every N rounds
  structure?: string;           // how picks are presented, when it differs
  note?: string;
}

const T = (tier: RoundPool["tier"], half?: RoundPool["half"]): RoundPool => ({ tier, ...(half ? { half } : {}) });
const all = (tier: RoundPool["tier"]): DraftFormat => ({ rounds: [T(tier)], repeatEvery: 1 });

export const DRAFT_FORMATS: Record<string, DraftFormat> = {
  "All-Iron": all("Iron"),
  "All-Bronze": all("Bronze"),
  "All-Silver": all("Silver"),
  "All-Gold": all("Gold"),
  "All-Diamond": all("Diamond"),
  "Perfecto": all("Perfect"),

  // "Only Perfect & Iron rounds" - the post is explicit that it is both tiers,
  // but not how they interleave. Order UNVERIFIED.
  "Perfectly Iron":   { rounds: [T("Perfect"), T("Iron")],   repeatEvery: 2, note: "interleave unverified" },
  "Perfectly Bronze": { rounds: [T("Perfect"), T("Bronze")], repeatEvery: 2, note: "interleave unverified" },
  "Perfectly Silver": { rounds: [T("Perfect"), T("Silver")], repeatEvery: 2, note: "interleave unverified" },
  "Perfectly Gold":   { rounds: [T("Perfect"), T("Gold")],   repeatEvery: 2, note: "interleave unverified" },

  // Descending tiers in high/low pairs. Shape confirmed, LENGTH unverified -
  // where it starts and stops depends on the event.
  "Orderly": {
    rounds: [T("Diamond", "high"), T("Diamond", "low"), T("Gold", "high"), T("Gold", "low"),
             T("Silver", "high"), T("Silver", "low"), T("Bronze", "high"), T("Bronze", "low")],
    note: "descending high/low pairs; start and end tier vary by event",
  },

  // Up from Iron to the top, then back down. Peak (Diamond or Perfect) and
  // round count vary by event - UNVERIFIED.
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
