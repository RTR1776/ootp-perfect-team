/**
 * Any Perfect Draft in the live helper, set up at draft time.
 *
 * The helper had six formats on file (formats.ts). About three quarters of
 * L.J.'s draft entries are other events: All-Gold, All-Diamond, All-Silver,
 * the Perfectos, the weeklies. Most of those run in a random environment and
 * park, and the catalogue holds no rules for them, so nothing on file could
 * score them. Here he enters what the event screen shows (the tier mix, the
 * run environment, the park, the DH) and the same engine runs on that.
 *
 * A setup lives in the URL, so a reload or a second device opens the same
 * draft settings; the picks stay in the browser, keyed by the setup.
 */
import { isTier, TIER_ORDER, type Tier } from "@/lib/tiers";
import { ALL_GROUPS, type DraftFormat, type RoundKind } from "./formats";

export const TIER_LETTER: Record<Tier, string> = { Perfect: "P", Diamond: "D", Gold: "G", Silver: "S", Bronze: "B", Iron: "I" };
const LETTER_TIER: Record<string, Tier> = Object.fromEntries(Object.entries(TIER_LETTER).map(([t, l]) => [l, t as Tier]));
export const TIERS_HIGH_TO_LOW = (Object.keys(TIER_ORDER) as Tier[]).sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]);

export type TierMix = Partial<Record<Tier, number>>;
/** Cards in a draft: the game's are 20 to 26; the bounds are only a guard on typed input. */
export const MIN_CARDS = 9, MAX_CARDS = 40;
export const YEAR_MIN = 1884, YEAR_MAX = 2026;

export interface CustomDraft {
  mix: TierMix;
  /** Run environment year. */
  year: number;
  dh: boolean;
  /** As the catalogue writes a stadium: "1996 Dodger Stadium", or a bare name. Null is a neutral park. */
  park: string | null;
  /** How every round's pack is put together (formats.ts PackKind). */
  pack: "mixed" | "choose";
  packSize: number;
  name: string;
  /** A catalogue draft whose card rules (types, years) apply, if he picked one. */
  eventId: number | null;
  teams: number;
}

/** "P2,D4,G6,S6,B6,I2" (any order, spaces and case ignored) to counts. Null when it is not a mix. */
export function parseMix(text: string | null | undefined): TierMix | null {
  if (!text) return null;
  const out: TierMix = {};
  for (const part of text.toUpperCase().split(/[\s,+]+/).filter(Boolean)) {
    const m = /^([PDGSBI])(\d{1,2})$/.exec(part);
    if (!m) return null;
    const tier = LETTER_TIER[m[1]];
    out[tier] = (out[tier] ?? 0) + Number(m[2]);
  }
  for (const t of Object.keys(out) as Tier[]) if (!out[t]) delete out[t];
  return Object.keys(out).length ? out : null;
}

export const mixCards = (mix: TierMix): number => Object.values(mix).reduce((a, b) => a + (b ?? 0), 0);

/** The mix as text, highest tier first: "P2,D4,G6,S6,B6,I2". */
export const mixText = (mix: TierMix): string =>
  TIERS_HIGH_TO_LOW.filter((t) => (mix[t] ?? 0) > 0).map((t) => `${TIER_LETTER[t]}${mix[t]}`).join(",");

/** The mix in words: "4 Perfect, 17 Bronze". */
export const mixLabel = (mix: TierMix): string =>
  TIERS_HIGH_TO_LOW.filter((t) => (mix[t] ?? 0) > 0).map((t) => `${mix[t]} ${t}`).join(", ");

/** Mixes for the drafts he enters. The environment is still his to set: most of these are random. */
export const DRAFT_PRESETS: { name: string; mix: string; note?: string }[] = [
  { name: "All-Gold", mix: "G26" },
  { name: "All-Diamond", mix: "D26" },
  { name: "All-Silver", mix: "S26" },
  { name: "Perfectly Bronze", mix: "P14,B12", note: "14 Perfect, 12 Bronze (the daily, per the 11-10 handoff)" },
  { name: "Standard 26", mix: "P2,D4,G6,S6,B6,I2", note: "the usual 26-card ladder" },
];

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** A setup read off the page's query string. `errors` says what to fix; `draft` is null until there are none. */
export function customFromParams(q: Query): { draft: CustomDraft | null; errors: string[]; started: boolean } {
  const mixRaw = one(q.mix), yearRaw = one(q.year);
  const started = mixRaw != null || yearRaw != null;
  if (!started) return { draft: null, errors: [], started };
  const errors: string[] = [];
  const mix = parseMix(mixRaw);
  if (!mix) errors.push("Enter the rounds as tier letters and counts, like G26 or P2,D4,G6,S6,B6,I2.");
  else if (mixCards(mix) < MIN_CARDS || mixCards(mix) > MAX_CARDS) errors.push(`The rounds add up to ${mixCards(mix)} cards; a draft is ${MIN_CARDS} to ${MAX_CARDS}.`);
  const year = Number(yearRaw);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) errors.push(`Enter the run environment's year, ${YEAR_MIN} to ${YEAR_MAX}.`);
  const packSize = Math.max(2, Math.min(15, Math.round(Number(one(q.n)) || 6)));
  const eventId = Number(one(q.ev));
  const teams = Number(one(q.teams));
  if (errors.length || !mix) return { draft: null, errors, started };
  const park = (one(q.park) ?? "").trim();
  return {
    started, errors,
    draft: {
      mix, year, dh: one(q.dh) === "1", park: park || null,
      pack: one(q.pack) === "choose" ? "choose" : "mixed", packSize,
      name: (one(q.name) ?? "").trim().slice(0, 80) || `Draft: ${mixLabel(mix)}`,
      eventId: Number.isInteger(eventId) && eventId > 0 ? eventId : null,
      teams: [32, 64, 128, 256].includes(teams) ? teams : 64,
    },
  };
}

/** The setup as a query string for /draft/live. */
export function customQuery(d: CustomDraft): string {
  const p = new URLSearchParams({ e: "custom", mix: mixText(d.mix), year: String(d.year), dh: d.dh ? "1" : "0", pack: d.pack, n: String(d.packSize), teams: String(d.teams) });
  if (d.park) p.set("park", d.park);
  if (d.name) p.set("name", d.name);
  if (d.eventId) p.set("ev", String(d.eventId));
  return p.toString();
}

/** What a setup's picks are stored under: the settings that change which cards score how. */
export const customKey = (d: CustomDraft): string =>
  `custom:${mixText(d.mix)}:${d.year}:${d.dh ? "dh" : "nodh"}:${(d.park ?? "neutral").toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${d.eventId ?? 0}`;

/** The format the engine runs: one kind of round per tier, any position. */
export function customFormat(d: CustomDraft): DraftFormat {
  const rounds: RoundKind[] = TIERS_HIGH_TO_LOW.filter((t) => isTier(t) && (d.mix[t] ?? 0) > 0).map((t) => ({
    key: TIER_LETTER[t], label: t, tier: t, groups: ALL_GROUPS, count: d.mix[t]!, pack: d.pack,
  }));
  return {
    series: customKey(d),
    eventId: d.eventId ?? 0,
    name: d.name,
    short: d.name,
    cards: mixCards(d.mix),
    envYear: d.year,
    dh: d.dh,
    teams: d.teams,
    mode: "as you set it",
    rounds,
    packSize: d.packSize,
    confirmed: [],
    assumed: [
      `Rounds, run environment, park and DH are what you entered: ${mixLabel(d.mix)}; ${d.year}; ${d.park ?? "neutral park"}; ${d.dh ? "DH" : "no DH"}.`,
      `Every round's pack is taken to be ${d.pack === "choose" ? "one position you choose" : "mixed positions"}, ${d.packSize} cards. Both can be changed on the page.`,
      "No export of this format is on file, so the field's handedness and staff weights are the defaults, and no card is flagged as out of the pool.",
    ],
  };
}
