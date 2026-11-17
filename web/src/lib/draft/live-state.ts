/**
 * A live draft's state as the browser keeps it (components/draft/use-live-draft),
 * and the pure steps that change it, so they can be tested off the page.
 */
import type { DraftGroup, PackKind } from "@/lib/draft/formats";

export interface LiveSaved {
  /** Card ids, in pick order. */
  picks: number[];
  /** Card ids in the pack on screen. */
  pack: number[];
  /** Picks already taken from the pack on screen (a round that keeps 2 stays up after the first). */
  packTaken?: number;
  /** The round kind chosen by hand (null: the next round, or the first card typed, decides). */
  round: string | null;
  /** In a pick-a-position round, the position whose pack is open. */
  group: DraftGroup | null;
  /** Cards a pack (a round's screen) shows. */
  packSize: number;
  /** Cards kept from each pack, over the format's (DraftFormat.keep). */
  keep?: number;
  /** Pack kind per round key, over the format's (the 5L's pick-a-position or mixed). */
  kinds: Record<string, PackKind>;
  /** Picks per round kind, over the format's, when the draft screen shows another split. */
  counts?: Record<string, number>;
}

export function freshDraft(packSize: number): LiveSaved {
  return { picks: [], pack: [], round: null, group: null, packSize, kinds: {} };
}

/**
 * A pick taken. In a round that keeps more than one card, a card taken from
 * the pack on screen leaves the rest of the pack up (and the round with it)
 * until the round's last pick; otherwise the pack and the hand-chosen round
 * clear, so the next round comes up.
 */
export function withPick(s: LiveSaved, id: number, keep = 1): LiveSaved {
  const taken = (s.pack.length ? s.packTaken ?? 0 : 0) + 1;
  if (keep > 1 && taken < keep && s.pack.includes(id)) {
    const rest = s.pack.filter((x) => x !== id);
    if (rest.length) return { ...s, picks: [...s.picks, id], pack: rest, packTaken: taken };
  }
  return { ...s, picks: [...s.picks, id], pack: [], packTaken: 0, round: null, group: null };
}
