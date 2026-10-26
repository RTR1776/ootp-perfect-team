/**
 * Perfect Draft formats for the live draft helper (/draft/live).
 *
 * A Perfect Draft is solo: each round the game shows L.J. a pack of cards and
 * he keeps one. Nobody else drafts from his packs. In the 10-22..10-25 exports
 * the same card sits on ~20 teams of one event, so other drafters' picks never
 * change what he can get, and the helper never asks for them.
 *
 * A format is the multiset of its rounds: each round's tier, the position
 * groups its pack can hold, and how the pack is put together. The order the
 * rounds come in is not on file for either Laptophound event, so the helper
 * works from what is left, not from a round number: a pick uses up the
 * round its card fits.
 *
 * WHAT THE EXPORTS SAY (scripts/draft-study.ts; Docs/Draft Helper 2026-10-26.md).
 *
 * 6L Power Play, 304 full 26-card teams in runs 222-225, by listed position:
 *   Bronze C 608 (2 a team), Bronze 1B+DH 304, Bronze 2B / 3B / SS / LF / CF /
 *   RF 304 each, Bronze SP 1,520 (5), Bronze RP+CL 1,520 (5), Iron bats 912
 *   (3, never a catcher, never an arm), Silver 608 and Gold 608 (2 each, any
 *   position). Every count is exact, team by team: those Bronze rounds are
 *   locked to a position. The Iron, Silver and Gold rounds are not.
 * 5L Deadball, 175 full 21-card teams in runs 222-225: 17 Bronze, 3 Iron,
 *   1 Silver, with no position fixed at all (a team's Bronze arms run from 3
 *   to 9). Every team has a catcher and 82% have two, so the drafter steers
 *   the positions: either he picks the position each round, or the packs are
 *   mixed. L.J. thinks it goes position by position; that is the default here
 *   and the page can switch it.
 * Pack size is not in the exports. The most-drafted card at each 6L Bronze
 * position went to 11-20% of teams from pools of 38-67, which puts the packs
 * at about 6-9 cards; L.J.'s 07-06 note says packs usually show 6.
 */
import type { Tier } from "@/lib/tiers";

export const BAT_GROUPS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;
/** A card's pack group: its listed position, or SP / RP (closers with the relievers). */
export type DraftGroup = (typeof BAT_GROUPS)[number] | "SP" | "RP";
export const ALL_GROUPS: readonly DraftGroup[] = [...BAT_GROUPS, "SP", "RP"];
const NON_CATCHER_BATS: readonly DraftGroup[] = ["1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

/**
 * How a round's pack is put together:
 * - fixed:  the pack is cards of the round's group(s) only (6L "Bronze SS")
 * - choose: L.J. picks one group, then sees a pack of it
 * - mixed:  a pack drawn from every group the round allows
 */
export type PackKind = "fixed" | "choose" | "mixed";

export interface RoundKind {
  key: string;
  label: string;
  tier: Tier;
  groups: readonly DraftGroup[];
  /** How many rounds of this kind the draft has. */
  count: number;
  pack: PackKind;
}

export interface DraftFormat {
  /** The export slug the event is filed under. */
  series: string;
  /** Catalogue id (tournaments.id). */
  eventId: number;
  name: string;
  short: string;
  /** Roster size: one card a round. */
  cards: number;
  /**
   * The run environment and DH as L.J. gave them on 10-25. The catalogue row
   * still had the August format (5L 1907; 6L 1999 with no DH) and the session
   * that found it could not write the database, so the page uses these and
   * shows the difference (Docs/Draft Helper 2026-10-26.md has the fix).
   */
  envYear: number;
  dh: boolean;
  teams: number;
  mode: string;
  rounds: RoundKind[];
  /** Cards a pack shows; the page can change it. */
  packSize: number;
  /** One line each: what the data or L.J. has confirmed, and what is assumed. */
  confirmed: string[];
  assumed: string[];
}

const bronzeAt = (g: DraftGroup, count = 1, also: DraftGroup[] = []): RoundKind => ({
  key: `B-${g}`, label: `Bronze ${[g, ...also].join("/")}`, tier: "Bronze", groups: [g, ...also], count, pack: "fixed",
});

export const DRAFT_FORMATS: Record<string, DraftFormat> = {
  "6lpowerplay": {
    series: "6lpowerplay",
    eventId: 555,
    name: "Laptophound's Daily 6L Power Play",
    short: "6L Power Play",
    cards: 26,
    envYear: 1996,
    dh: true,
    teams: 128,
    mode: "Bo7, final Bo9",
    rounds: [
      bronzeAt("C", 2),
      bronzeAt("1B", 1, ["DH"]),
      bronzeAt("2B"), bronzeAt("3B"), bronzeAt("SS"), bronzeAt("LF"), bronzeAt("CF"), bronzeAt("RF"),
      bronzeAt("SP", 5),
      bronzeAt("RP", 5),
      { key: "I-bat", label: "Iron bat (no C)", tier: "Iron", groups: NON_CATCHER_BATS, count: 3, pack: "mixed" },
      { key: "S-any", label: "Silver", tier: "Silver", groups: ALL_GROUPS, count: 2, pack: "mixed" },
      { key: "G-any", label: "Gold", tier: "Gold", groups: ALL_GROUPS, count: 2, pack: "mixed" },
    ],
    packSize: 6,
    confirmed: [
      "1996 run environment with DH, 128 teams, Bo7 with a Bo9 final (L.J., 10-25).",
      "DH: pitchers took ~1% of plate appearances in every export on file.",
      "26 rounds: 2 Bronze C; one Bronze 1B/DH, 2B, 3B, SS, LF, CF and RF; 5 Bronze SP; 5 Bronze RP; 3 Iron bats (no C); 2 Silver; 2 Gold (exact on all 304 full teams, 10-22..10-25).",
    ],
    assumed: [
      "Iron, Silver and Gold packs mix positions (they could be pick-a-position).",
      "Packs show 6 cards (L.J.'s July note; the 10-22..25 exports fit 6-9).",
      "Park: 1984 Olympic Stadium, from the catalogue.",
    ],
  },
  "5ldeadball": {
    series: "5ldeadball",
    eventId: 554,
    name: "Laptophound's Daily 5L Deadball",
    short: "5L Deadball",
    cards: 21,
    envYear: 1916,
    dh: false,
    teams: 128,
    mode: "Bo7, final Bo9",
    rounds: [
      { key: "B", label: "Bronze", tier: "Bronze", groups: ALL_GROUPS, count: 17, pack: "choose" },
      { key: "I", label: "Iron", tier: "Iron", groups: ALL_GROUPS, count: 3, pack: "choose" },
      { key: "S", label: "Silver", tier: "Silver", groups: ALL_GROUPS, count: 1, pack: "choose" },
    ],
    packSize: 6,
    confirmed: [
      "1916 run environment, no DH, 128 teams, Bo7 with a Bo9 final (L.J., 10-25).",
      "The October exports' rates match 1916 at 1936 Crosley (HR/PA .0043 against .0044); August's match 1907.",
      "21 rounds: 17 Bronze, 3 Iron, 1 Silver, positions free (175 full teams, 10-22..10-25).",
    ],
    assumed: [
      "Each round you pick the position, then see a pack of it (L.J.'s read). Switch to mixed packs on the page if not.",
      "Packs show 6 cards (L.J.'s July note).",
      "Park: 1936 Crosley Field, from the catalogue.",
    ],
  },
};

export const formatFor = (series: string | null | undefined): DraftFormat | null =>
  series ? DRAFT_FORMATS[series] ?? null : null;

/** A card's pack group: hitters by listed position, arms SP or RP (a CL card is a reliever). */
export function groupOf(c: { isPitcher: boolean; position: string | null; role: "SP" | "RP" | null }): DraftGroup | null {
  if (c.isPitcher) return c.role === "SP" ? "SP" : "RP";
  const p = c.position ?? "";
  return (BAT_GROUPS as readonly string[]).includes(p) ? (p as DraftGroup) : null;
}

/** The rounds still to come: each kind with what is left of its count. */
export type Remaining = Record<string, number>;

export const allRounds = (f: DraftFormat): Remaining =>
  Object.fromEntries(f.rounds.map((r) => [r.key, r.count]));

/** Rounds left in all. */
export const roundsLeft = (rem: Remaining): number => Object.values(rem).reduce((a, b) => a + Math.max(0, b), 0);

/** Can a card come out of a round of this kind? */
export const fitsRound = (r: RoundKind, c: { tier: Tier; group: DraftGroup }): boolean =>
  r.tier === c.tier && r.groups.includes(c.group);

/**
 * The round a drafted card used up: the most specific remaining kind it fits
 * (a Bronze SS takes "Bronze SS" before any open Bronze round). Null when no
 * round left can have held it, which the page reports instead of guessing.
 */
export function roundFor(f: DraftFormat, rem: Remaining, c: { tier: Tier; group: DraftGroup }): RoundKind | null {
  const open = f.rounds.filter((r) => (rem[r.key] ?? 0) > 0 && fitsRound(r, c));
  open.sort((a, b) => a.groups.length - b.groups.length);
  return open[0] ?? null;
}

/** The remaining rounds after a draft's picks, in pick order; `unplaced` are picks no round could hold. */
export function replay(f: DraftFormat, picks: readonly { tier: Tier; group: DraftGroup }[]): { rem: Remaining; used: (string | null)[]; unplaced: number } {
  const rem = allRounds(f);
  const used: (string | null)[] = [];
  let unplaced = 0;
  for (const c of picks) {
    const r = roundFor(f, rem, c);
    if (r) rem[r.key] -= 1; else unplaced++;
    used.push(r?.key ?? null);
  }
  return { rem, used, unplaced };
}
