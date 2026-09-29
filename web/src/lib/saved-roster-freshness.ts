/**
 * Is a saved roster behind the collection? A saved roster keeps the cards it
 * was saved with; the collection moves on. Each save records the collection
 * upload it was checked against (notes.collectionUploadId), so /build can
 * name the cards owned now that weren't then and that this event takes.
 *
 * L.J., 2026-09-29, after pulling the Pearce and Dugan variants: "how do we
 * make sure everything else is updated, like recommended buys, lineups, etc
 * based on new cards?" The pages that score the pool pick new cards up on
 * their own; a saved roster doesn't, so Build says when one is behind.
 *
 * What counts as new is what the event could use that it couldn't before:
 * - a variant owned now and not then (where variants are allowed);
 * - a card owned now in neither form then;
 * - where variants are barred, a base copy owned now and not then.
 * A base copy of a card whose variant was already owned adds nothing where
 * variants are allowed, so it is not listed there.
 */

export interface OwnedForms { base: ReadonlySet<number>; variant: ReadonlySet<number> }
export interface NewCard { cardId: number; variant: boolean }

/** Read a saved roster's notes for the collection it was saved against. */
export function savedCollectionId(notes: string | null | undefined): number | null {
  if (!notes) return null;
  try {
    const id = (JSON.parse(notes) as { collectionUploadId?: unknown }).collectionUploadId;
    return typeof id === "number" && Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export function newSince(
  pool: readonly { cardId: number; baseOwned: boolean; variantOwned: boolean }[],
  then: OwnedForms,
  variantsAllowed: boolean,
): NewCard[] {
  const out: NewCard[] = [];
  for (const c of pool) {
    if (variantsAllowed) {
      if (c.variantOwned && !then.variant.has(c.cardId)) out.push({ cardId: c.cardId, variant: true });
      else if (c.baseOwned && !then.base.has(c.cardId) && !then.variant.has(c.cardId)) out.push({ cardId: c.cardId, variant: false });
    } else if (c.baseOwned && !then.base.has(c.cardId)) {
      out.push({ cardId: c.cardId, variant: false });
    }
  }
  return out;
}
