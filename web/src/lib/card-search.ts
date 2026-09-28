/**
 * Finding a card by part of its name (UI plan C9): the Card Model's "Add a
 * player" and "Card" boxes. The old exact-match datalist found nothing for
 * "Dave Winfield" + Enter; this matches any part of any word, ignoring case
 * and accents, and puts the cards L.J. owns first.
 *
 * Pure, so the ranking is tested without a browser.
 */

/** A name as one comparable string: lower case, no accents, letters and single spaces only. */
export const normName = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Like normName, but keeps digits, so "aaron 1971" can tell two Hank Aarons
 * apart. Apostrophes and dots join ("o'neil", "jd"); other marks split words.
 */
export const searchKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\u2019.]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Owned in the newest collection upload: a base copy, or a variant (a variant counts as owned). */
export type Owned = "base" | "variant" | null;

export interface SearchCard {
  name: string;
  /** What the list shows, e.g. "Dave Winfield 97 · 1979 RF"; its words are searched too. */
  label: string;
  owned?: Owned;
}

export interface CardIndex<T extends SearchCard> {
  rows: Array<{ card: T; text: string; name: string; order: number }>;
}

/** Built once per list; matching a keystroke then only scans strings. */
export function cardIndex<T extends SearchCard>(cards: T[]): CardIndex<T> {
  return { rows: cards.map((card, order) => ({ card, text: searchKey(`${card.name} ${card.label}`), name: searchKey(card.name), order })) };
}

/**
 * The best `limit` cards whose name or label contains every word typed, as
 * part of any word: "winf" finds Dave Winfield, "aaron 1971" one Hank
 * Aaron. Owned cards first; then names with a word that starts with the
 * first word typed ("ott" puts Mel Ott before Scott Rolen); then the list's
 * own order (the page sends it by card value).
 */
export function matchCards<T extends SearchCard>(index: CardIndex<T>, query: string, limit = 8): T[] {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const first = words[0];
  const hits: Array<{ card: T; rank: number; order: number }> = [];
  for (const r of index.rows) {
    if (!words.every((w) => r.text.includes(w))) continue;
    const owned = r.card.owned ? 0 : 1;
    const wordStart = r.name.startsWith(first) || r.name.includes(` ${first}`) ? 0 : 1;
    hits.push({ card: r.card, rank: owned * 2 + wordStart, order: r.order });
  }
  hits.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return hits.slice(0, limit).map((h) => h.card);
}
