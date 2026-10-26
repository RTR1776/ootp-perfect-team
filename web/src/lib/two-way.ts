/**
 * Two-way cards: a card that can both pitch and hit (L.J., 2026-10-16: "how
 * would you not include Shohei - he can pitch and hit? … make sure this is
 * applied to all two way players - there are a lot of older ones that can
 * pitch").
 *
 * The card table lists each card in one role. Ohtani's 2026 Live card is a DH
 * (`is_pitcher` false) with full pitching ratings (Stuff 119, Control 78, pHR
 * 111, Stamina 82), so every builder priced him as a bat only and never saw the
 * best starter on the roster. The same holds the other way round: Ruth's 1916
 * card is an SP with Power vR 133.
 *
 * How it is handled: a pool carries the card's OTHER role as a second form, a
 * copy with `isPitcher` flipped and its own id (`twoWayId`, the card id plus
 * TWO_WAY_OFFSET). The form shares the card's player, so the one-card-per-player
 * rule (`samePlayer`) lets a roster use it one way or the other, not both, and
 * everything downstream (fit maps, fill, climb, objective) works on it as on
 * any card. Anything that leaves the builder — a saved slot, a load file, a
 * price or art lookup, an OOTP filter — goes back through `cardIdOf`.
 *
 * Not modelled: one card filling an arm slot AND a lineup slot at once
 * (Ohtani pitching and DHing on the same roster spot).
 *
 * "Pos Rating P" does not say who can pitch: Sam Bankhead's SS card has P 163
 * and Stuff 38, Ohtani P 72 and Stuff 119. So the gate is the ratings
 * themselves, and the model prices the rest: a hitter with real pitching
 * splits (canPitch) gets an arm form; a pitcher whose bat averages BAT_FLOOR
 * or more over Power, Eye, Avoid Ks, BABIP and Gap gets a bat form (DH, plus
 * any field position the card rates above 0). 130 hitter cards and 204
 * pitcher cards pass on the 2026-10-16 card table.
 */

/** Added to a card id for its other-role form. Card ids are 5 digits. */
export const TWO_WAY_OFFSET = 10_000_000;

/**
 * A pitcher's bat below this average (Power, Eye, Avoid Ks, BABIP, Gap) is
 * left out of the bat pool. Only keeps the pool small: a bat that low never
 * beats a real hitter in any tier, so the model would not pick it anyway.
 */
export const BAT_FLOOR = 40;

const SPLIT_KEYS_ARM = ["Stuff", "Control", "pHR", "pBABIP"] as const;
const BAT_KEYS = ["Power", "Eye", "Avoid Ks", "BABIP", "Gap"] as const;

/** The card id behind a pool id: a two-way form's own card, and a variant form's (negative id) too. */
export function cardIdOf(id: number): number {
  const a = Math.abs(id);
  return a >= TWO_WAY_OFFSET ? a - TWO_WAY_OFFSET : a;
}

export function twoWayId(cardId: number): number {
  return cardId + TWO_WAY_OFFSET;
}

export function isTwoWayForm(id: number): boolean {
  return Math.abs(id) >= TWO_WAY_OFFSET;
}

/** The pool id of a card's other-role form (either way round, variants keep their sign); it may not be in the pool. */
export function otherFormId(id: number): number {
  const a = Math.abs(id), s = id < 0 ? -1 : 1;
  return s * (a >= TWO_WAY_OFFSET ? a - TWO_WAY_OFFSET : a + TWO_WAY_OFFSET);
}

/**
 * A hitter card that can pitch: real pitching splits, pBABIP included. A
 * plain bat reads 1 on all of them; a handful of position players carry
 * mop-up Stuff/Control/pHR (Stuff ~40) with pBABIP left at 1, and the model
 * mis-reads a blank pBABIP, so those are left out (Tyler Fitzgerald, Craig
 * Reynolds, Pepper Martin, George Van Haltren, 2026-10-16).
 */
export function canPitch(ratings: Record<string, number> | null | undefined): boolean {
  const r = ratings ?? {};
  return SPLIT_KEYS_ARM.every((k) => (r[`${k} vL`] ?? 0) > 1 && (r[`${k} vR`] ?? 0) > 1);
}

/** A pitcher card with a bat worth pricing (see BAT_FLOOR). */
export function canHit(ratings: Record<string, number> | null | undefined): boolean {
  const r = ratings ?? {};
  if (!((r["Power vR"] ?? 0) > 1 && (r["Power vL"] ?? 0) > 1)) return false;
  const avg = BAT_KEYS.reduce((s, k) => s + (r[k] ?? 0), 0) / BAT_KEYS.length;
  return avg >= BAT_FLOOR;
}

/** Can this card play the role it is not listed in? */
export function hasOtherRole(c: { isPitcher: boolean | null; ratings: Record<string, number> | null | undefined }): boolean {
  return c.isPitcher ? canHit(c.ratings) : canPitch(c.ratings);
}

/**
 * The card's other-role form, or null. `role` is cleared for an arm form (a
 * hitter card has no pitcher role, so it may start or relieve; stamina sets
 * how the model uses it) and for a bat form.
 */
export function twoWayForm<T extends { cardId: number; isPitcher: boolean | null; role?: string | null; ratings: Record<string, number> }>(c: T): T | null {
  if (isTwoWayForm(c.cardId) || !hasOtherRole(c)) return null;
  return { ...c, cardId: c.cardId < 0 ? -twoWayId(-c.cardId) : twoWayId(c.cardId), isPitcher: !c.isPitcher, role: null };
}

/** A pool with every two-way card's other-role form appended. */
export function withTwoWayForms<T extends { cardId: number; isPitcher: boolean | null; role?: string | null; ratings: Record<string, number> }>(pool: readonly T[]): T[] {
  const out = [...pool];
  for (const c of pool) {
    const f = twoWayForm(c);
    if (f) out.push(f);
  }
  return out;
}

const ARM_SLOT = /^(SP\d+|RP\d+|CL)$/;
export const isArmSlot = (slot: string): boolean => ARM_SLOT.test(slot);

/**
 * The pool id a saved slot means: a saved roster stores the card id, so an
 * arm slot held by a hitter card (or a lineup slot held by a pitcher card)
 * is that card's two-way form when the pool has one.
 */
export function formIdForSlot(cardId: number, slot: string, has: (id: number) => { isPitcher: boolean | null } | undefined): number {
  const c = has(cardId);
  const arm = isArmSlot(slot.includes(":") ? slot.split(":")[1]! : slot);
  if (c && Boolean(c.isPitcher) === arm) return cardId;
  const f = has(twoWayId(cardId));
  return f && Boolean(f.isPitcher) === arm ? twoWayId(cardId) : cardId;
}
