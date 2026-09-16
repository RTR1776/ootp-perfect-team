/**
 * Hand-entered position ratings read off the game's own defense page.
 *
 * The shop dumps list a card's rated positions only (Nimmala: 3B 119 / SS 108)
 * and the collection export carries just DEF, the rating at the listed POS.
 * The game rates every card at every position, and for a variant it rates all
 * of them higher than the base — variant Nimmala is 1B 105 / 2B 126 / 3B 128 /
 * SS 116 / LF 84 / CF 60 / RF 75 in-game. `card-forms.ts` scales the LISTED
 * positions by the DEF boost (verified on SS 116); the unlisted ones can only
 * come from the game itself, so they are entered here, one card form per row,
 * and stamped onto that copy's ratings as `POS <pos>` keys at collection import
 * (`pnpm positions:apply` stamps the current upload without re-uploading).
 * `formRatings` / `mergeCopyRatings` turn `POS <pos>` into `Pos Rating <pos>`,
 * and an explicit in-game number beats the scaled estimate.
 */
import overrides from "@/data/position-overrides.json";

export interface PositionOverride {
  cardId: number;
  name?: string;
  /** true = the owned VARIANT copy; false/absent = the base copy. */
  variant?: boolean;
  positions: Record<string, number>;
  source?: string;
}

export const POSITION_OVERRIDES: PositionOverride[] = overrides as PositionOverride[];

const key = (cardId: number, variant: boolean) => `${cardId}:${variant ? "v" : "b"}`;
const byForm = new Map(POSITION_OVERRIDES.map((o) => [key(o.cardId, !!o.variant), o]));

export function positionOverride(cardId: number | null | undefined, variant: boolean): PositionOverride | undefined {
  return cardId == null ? undefined : byForm.get(key(cardId, variant));
}

/** Stamp `POS <pos>` keys onto a copy's exported ratings when an override exists. */
export function stampPositionOverrides<T extends { cardId: number | null; isVariant: boolean; ratings: Record<string, number> }>(rows: T[]): number {
  let n = 0;
  for (const r of rows) {
    const o = positionOverride(r.cardId, r.isVariant);
    if (!o) continue;
    for (const [p, v] of Object.entries(o.positions)) r.ratings[`POS ${p}`] = v;
    n++;
  }
  return n;
}
