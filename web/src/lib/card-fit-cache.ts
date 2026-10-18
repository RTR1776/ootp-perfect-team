/**
 * Card Fit's reads, cached for the pages that show them: /cards (the New
 * table and one card's fit) and /cards/highlights (the same new cards as
 * tiles). Both read one cache entry, so whichever page loads first warms the
 * other.
 *
 * Card Fit scores every card in every current event (seven seconds and up),
 * so each entry is keyed by everything it reads (card-fit-load fitVersion):
 * a new import, collection, shop list, rule change or saved roster makes a
 * new one. Server only.
 */
import { unstable_cache } from "next/cache";
import { fitVersion, loadCardFit, newCardIds, type CardFitData } from "@/lib/card-fit-load";

/** Bump when Card Fit's scoring changes, so cached results from the old code aren't served. */
const FIT_CODE = "fit-v2";
/** Bump when newCardIds' result changes shape (v2: `variants`). */
const IDS_CODE = "new-ids-v2";

const cached = <T,>(fn: () => Promise<T>, key: string[]) => unstable_cache(fn, [FIT_CODE, ...key], { revalidate: 86_400, tags: ["card-fit"] })();

export interface NewCardsFit {
  /** Cards and variants new to his collection since the one before. */
  pulled: number[];
  /** Of those, the ones whose variant is what's new. */
  variants: number[];
  /** The newest week of shop lists. */
  shop: number[];
  /** Every one of them placed in every current event: the pulled first, then the shop's. */
  data: CardFitData;
}

/** The new card ids (shop and pulled), one cache entry per data version. */
export async function newIds(version?: string[]) {
  const v = version ?? (await fitVersion());
  const ids = await cached(newCardIds, [IDS_CODE, ...v]);
  return { ...ids, variants: ids.variants ?? [] };
}

/** The new cards (shop and pulled) with their fit, one cache entry per data version. */
export async function newCardsFit(version?: string[]): Promise<NewCardsFit> {
  const v = version ?? (await fitVersion());
  const ids = await newIds(v);
  const all = [...ids.pulled, ...ids.shop.filter((id) => !ids.pulled.includes(id))];
  const data = await cached(() => loadCardFit(all), ["new-fit", ...v]);
  return { pulled: ids.pulled, variants: ids.variants, shop: ids.shop, data };
}

/** One card's fit: a new card reads the new cards' entry; any other is scored on its own. */
export async function cardFit(id: number): Promise<CardFitData> {
  const version = await fitVersion();
  const ids = await newIds(version);
  return ids.pulled.includes(id) || ids.shop.includes(id)
    ? (await newCardsFit(version)).data
    : cached(() => loadCardFit([id]), ["card", String(id), ...version]);
}
