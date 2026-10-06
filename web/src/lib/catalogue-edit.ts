/**
 * One catalogue event's rules, changed by hand: run environment, park, DH,
 * value and card-year windows, and the free-form restrictions. Weekly
 * "variety" events rotate their format, and the game changes other events'
 * rules without a new id; scripts/catalogue-set.ts applies this to a row.
 *
 * The row's previous rules are kept under restrictions.previousFormat (the
 * latest one only), so a change can be read back and undone by hand.
 */
import { chicagoDay } from "@/lib/format";

export interface CatalogueRules {
  envYear: number | null;
  stadium: string | null;
  parkName: string | null;
  dh: boolean | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  restrictions: Record<string, unknown> | null;
}

export interface CatalogueEdit {
  envYear?: number;
  /** As the game shows it, "1958 Tiger Stadium"; the park name drops the year. */
  stadium?: string;
  dh?: boolean;
  value?: [number, number];
  /** null clears the window. */
  cardYears?: [number, number] | null;
  /** Restriction keys to remove, e.g. cardTypes when a card-kind rule ends. */
  drop?: string[];
  /** A card-set rule as roster-rules reads it, e.g. ["Historical All-Star+Hardware Heroes"] or ["Live"]. */
  cardTypes?: string[];
  /** Per-tier maximums, parseSlots' output. */
  slots?: Record<string, number>;
  /** The cap on the roster's total card value, restrictions.teamCap; null clears it. */
  teamCap?: number | null;
  /** At most this many variants, restrictions.variantCap; null clears it. */
  variantCap?: number | null;
  /** "No LE": true bars Limited Edition cards (restrictions.noLimitedEdition), false lifts the bar. */
  noLimitedEdition?: boolean;
  text?: string;
  /** Where the change came from; stored as restrictions.textFrom. */
  note?: string;
  /**
   * The Chicago day the current format first ran, YYYY-MM-DD (null clears
   * it). While any export of the series was filed before it, /build leaves
   * the series out as this event's own play (exportsPredate). A weekly's new
   * format starts about a week after PT's post, because the next run was
   * already scheduled under the old rules.
   */
  formatSince?: string | null;
  /** Date of the change, stamped on previousFormat. */
  at: string;
}

/**
 * The format date and its source (formatSinceFrom) move together: a new date
 * drops the old date's source, and the note, if any, becomes the new one.
 * Undefined leaves both alone; catalogue:set makes the caller say which it is
 * whenever the format itself changes.
 */
function applyFormatSince(r: Record<string, unknown>, e: CatalogueEdit) {
  if (e.formatSince === undefined) return;
  if (e.formatSince === null) { delete r.formatSince; delete r.formatSinceFrom; return; }
  if (r.formatSince !== e.formatSince) delete r.formatSinceFrom;
  r.formatSince = e.formatSince;
  if (e.note != null) r.formatSinceFrom = e.note;
}

export function editCatalogueRules(row: CatalogueRules, e: CatalogueEdit): CatalogueRules {
  // A format date on its own is bookkeeping, not a new format: the rules, their
  // source (textFrom) and the kept previous format stay as they are.
  const onlyDate = e.formatSince !== undefined
    && [e.envYear, e.stadium, e.dh, e.value, e.cardYears, e.drop, e.cardTypes, e.slots, e.teamCap, e.variantCap, e.noLimitedEdition, e.text].every((v) => v === undefined);
  if (onlyDate) {
    const r: Record<string, unknown> = { ...(row.restrictions ?? {}) };
    applyFormatSince(r, e);
    return { ...row, restrictions: r };
  }
  const old = { ...(row.restrictions ?? {}) };
  delete old.previousFormat;
  const next: Record<string, unknown> = { ...old };
  for (const k of e.drop ?? []) delete next[k];
  // A value window set by hand is confirmed, not inferred from the name; the
  // date keeps a later refresh import from putting the guess back.
  if (e.value) { delete next.valueWindowFrom; next.valueConfirmed = e.at; }
  if (e.cardTypes?.length) next.cardTypes = e.cardTypes;
  if (e.slots) next.slots = e.slots;
  if (e.teamCap === null) delete next.teamCap;
  else if (e.teamCap !== undefined) next.teamCap = e.teamCap;
  if (e.variantCap === null) delete next.variantCap;
  else if (e.variantCap !== undefined) { next.variantCap = e.variantCap; delete next.variantsAllowed; }
  if (e.noLimitedEdition === true) next.noLimitedEdition = true;
  else if (e.noLimitedEdition === false) delete next.noLimitedEdition;
  if (e.text != null) next.text = e.text;
  if (e.note != null) next.textFrom = e.note;
  applyFormatSince(next, e);
  next.previousFormat = {
    changedOn: e.at, envYear: row.envYear, stadium: row.stadium, dh: row.dh,
    ratingsMin: row.ratingsMin, ratingsMax: row.ratingsMax,
    cardYearMin: row.cardYearMin, cardYearMax: row.cardYearMax, restrictions: old,
  };
  return {
    envYear: e.envYear ?? row.envYear,
    stadium: e.stadium ?? row.stadium,
    parkName: e.stadium != null ? e.stadium.replace(/^\d{4}\s+/, "") : row.parkName,
    dh: e.dh ?? row.dh,
    ratingsMin: e.value ? e.value[0] : row.ratingsMin,
    ratingsMax: e.value ? e.value[1] : row.ratingsMax,
    cardYearMin: e.cardYears === undefined ? row.cardYearMin : e.cardYears?.[0] ?? null,
    cardYearMax: e.cardYears === undefined ? row.cardYearMax : e.cardYears?.[1] ?? null,
    restrictions: next,
  };
}

/**
 * True when a slot's newest run in the community dump started before the
 * event's current format (restrictions.formatSince, a Chicago day). The dump
 * then only knows the old event: its title and field size describe the
 * format that was replaced, so catalogue:sync must not write them over a
 * rename made by hand for the new one. On 2026-09-29 it did: the dump's
 * newest Monday and Tuesday runs were from 09-22, and it put "Monday Gold
 * Floor Cap" and "Tuesday Up to 1969" back over the Dregs and Dead Silver
 * Walking.
 */
export function dumpPredatesFormat(formatSince: unknown, newestRunStart: number): boolean {
  if (typeof formatSince !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(formatSince)) return false;
  const day = chicagoDay(new Date(newestRunStart * 1000));
  return day != null && day < formatSince;
}

/**
 * Restriction keys set by hand (catalogue:set, L.J.'s confirmations) or by
 * the format tracker, which no refresh post carries. An import that rebuilds
 * `restrictions` from a post keeps these unless the post states the same key
 * itself; without this, the next `import:refresh` erased every card-set rule
 * confirmed on 2026-09-27 (and would have erased the slot rules from his
 * screenshots: the Open Slots posts don't restate them).
 */
export const HAND_KEPT_KEYS = ["cardTypes", "slots", "valueConfirmed", "text", "textFrom", "previousFormat", "formatSince", "formatSinceFrom"] as const;

/** A note that records L.J.'s own word ("2026-09-25 from L.J.: …"), which no post restates. */
export const isHandNote = (n: unknown) => typeof n === "string" && /\bL\.J\.|\bconfirmed\b/i.test(n);

export function keepHandRules(old: Record<string, unknown> | null | undefined, fresh: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fresh };
  for (const k of HAND_KEPT_KEYS) if (out[k] == null && old?.[k] != null) out[k] = old[k];
  // His notes ride along with whatever the post says.
  const mine = Array.isArray(old?.notes) ? old.notes.filter(isHandNote) : [];
  if (mine.length) {
    const post = Array.isArray(out.notes) ? (out.notes as unknown[]) : [];
    out.notes = [...post, ...mine.filter((n) => !post.includes(n))];
  }
  return out;
}

const TIERS = ["P", "D", "G", "S", "B", "I"] as const;
const TIER_WORD: Record<string, (typeof TIERS)[number]> = { perfect: "P", diamond: "D", gold: "G", silver: "S", bronze: "B", iron: "I" };

/**
 * A slot line as the game shows it — "P6, D4, G4, S4, B4" in the list, or
 * "6 Perfect, 4 Diamond, …" in the summary — as per-tier maximums over a
 * roster of `size`. Tiers above the highest one listed get 0. The roster spots
 * the line leaves over go to the tier just below the lowest one listed, since
 * a lower card may fill a higher slot ("unfilled slots may use extra lower
 * tier cards"): Daily Open Slots' P6 D4 G4 S4 B4 is 4 Iron. Throws on a line
 * that names no tier or adds up to more than the roster.
 */
export function parseSlots(line: string, size = 26): Record<string, number> {
  const got = new Map<string, number>();
  for (const m of line.matchAll(/\b([PDGSBI])\s*(\d+)\b/gi)) got.set(m[1].toUpperCase(), Number(m[2]));
  for (const m of line.matchAll(/\b(\d+)\s*(perfect|diamond|gold|silver|bronze|iron)\b/gi)) got.set(TIER_WORD[m[2].toLowerCase()], Number(m[1]));
  if (!got.size) throw new Error(`no tier in the slot line "${line}" (e.g. "P6, D4, G4, S4, B4")`);
  const sum = [...got.values()].reduce((a, b) => a + b, 0);
  if (sum > size) throw new Error(`the slot line "${line}" adds up to ${sum}, more than a ${size}-card roster`);
  const lowest = Math.max(...[...got.keys()].map((t) => TIERS.indexOf(t as (typeof TIERS)[number])));
  const out: Record<string, number> = {};
  TIERS.forEach((t, i) => { out[t] = got.get(t) ?? (i === lowest + 1 ? size - sum : 0); });
  return out;
}
