/**
 * Perfect Draft formats for the live draft helper (/draft/live).
 *
 * A Perfect Draft is solo: each round the game shows L.J. a pack of cards and
 * he keeps one. Nobody else drafts from his packs. In the 10-22..10-25 exports
 * the same card sits on ~20 teams of one event, so other drafters' picks never
 * change what he can get, and the helper never asks for them.
 *
 * A format is the multiset of its rounds: each round's tier, the position
 * groups its pack can hold, and how the pack is put together. A pick uses up
 * the round its card fits, so the helper works from what is left, not from a
 * round number. Where the order is known or likely (`ordered`: most ladder
 * drafts in L.J.'s game saves deal Perfect first, then down the tiers) the
 * next round is the next kind in the list; the 6L's is not.
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
  /**
   * The card values this round deals, when it is narrower than its tier: a
   * Low of Lows round deals only its tier's bottom band (Diamond 90-94), a
   * 101+ round only Perfects of 101 or more. The band shapes the pool the
   * board shows and the rounds to come are priced from. It does not decide
   * where a typed pick goes (fitsRound is by tier), so a card outside the
   * band can still be entered if the band turns out wrong.
   */
  valueMin?: number;
  valueMax?: number;
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
  /** When it starts, as the event screen gives it. */
  starts?: string;
  /**
   * The rounds are listed in the order the game deals them, so the round
   * after the last pick is the next kind with rounds left. 6 of the 8 ladder
   * drafts in L.J.'s game saves (11-11..11-17) dealt their tiers top down,
   * Perfect first; the 6L dealt Bronze first, so it is not marked.
   */
  ordered?: boolean;
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
  ptcs8pdweekly: {
    series: "ptcs8pdweekly",
    eventId: 9080010,
    name: "PTCS 8 Championship - PD Weekly",
    short: "PTCS 8 PD Weekly",
    cards: 21,
    envYear: 1919,
    dh: false,
    teams: 128,
    mode: "Bo9",
    ordered: true,
    rounds: [
      { key: "P", label: "Perfect", tier: "Perfect", groups: ALL_GROUPS, count: 8, pack: "mixed" },
      { key: "I", label: "Iron", tier: "Iron", groups: ALL_GROUPS, count: 13, pack: "mixed" },
    ],
    packSize: 2,
    confirmed: [
      "Modified Perfectly Iron PD: 1919 run environment, no DH, 1914 Griffith Stadium, Bo9 (catalogue).",
      "21 cards, the Perfect rounds first (L.J., 11-03).",
      "8 Perfect and 13 Iron: the team L.J. drafted (his 11-07 screenshots) had 8 Perfect cards (Trout, Yastrzemski, Gibson, Hornsby, Jeter, Will Clark, Jud Wilson, Cedeno) and 13 Iron. This file said 4 and 17 until 11-17.",
      "Packs usually show 2 cards, hitters and pitchers mixed (L.J., 11-03).",
    ],
    assumed: [
      "128 teams. No exports of this event on file, so the field's hands are defaults.",
    ],
  },
  /*
   * PTMS 3 (Saturday 2026-11-21). The catalogue rows are 9130004-06
   * (src/db/seed/ptms3.json). Environments, parks, card pools, 128 teams and
   * start times are from the event screens L.J. sent on 11-17. The screens do
   * not give the PD 1 and PD 2 rounds, so each says what it borrowed them from
   * (Docs/PTMS 3 Drafts 2026-11-17 (Claude).md has the evidence).
   */
  ptms3pd1: {
    series: "ptms3pd1",
    eventId: 9130004,
    name: "PTMS 3 PD 1 - Low of Lows",
    short: "PTMS 3 PD 1 Low of Lows",
    cards: 26,
    envYear: 1986,
    dh: true,
    teams: 128,
    mode: "Bo9, sims every 10 minutes",
    starts: "Sat 21 Nov, 07:59 AM",
    ordered: true,
    rounds: [
      { key: "P", label: "Perfect", tier: "Perfect", groups: ALL_GROUPS, count: 2, pack: "choose" },
      { key: "D", label: "Diamond 90-94", tier: "Diamond", groups: ALL_GROUPS, count: 4, pack: "choose", valueMax: 94 },
      { key: "G", label: "Gold 80-84", tier: "Gold", groups: ALL_GROUPS, count: 6, pack: "choose", valueMax: 84 },
      { key: "S", label: "Silver 70-74", tier: "Silver", groups: ALL_GROUPS, count: 6, pack: "choose", valueMax: 74 },
      { key: "B", label: "Bronze 60-64", tier: "Bronze", groups: ALL_GROUPS, count: 6, pack: "choose", valueMax: 64 },
      { key: "I", label: "Iron 40-49", tier: "Iron", groups: ALL_GROUPS, count: 2, pack: "choose", valueMax: 49 },
    ],
    packSize: 6,
    confirmed: [
      "Low of Lows, cards up to 1986, 1986 run environment, DH, 1985 Veterans Stadium (AVG 1.007/1.027, HR 1.030/.982, 2B 1.073, 3B 1.119), 128 teams, Bo9, starts Sat 21 Nov 07:59 (event screen, 11-17).",
      "Each tier's bottom band is the game's own \"Low\" band: Daily Low Diamond Only is 90-94, Low Gold Only 80-84, Low Silver Only 70-74, Low Bronze Only 60-64 and Low Iron Quick 49 and under (catalogue).",
    ],
    assumed: [
      "Rounds come top tier first: 6 of the 8 ladder drafts in L.J.'s game saves (11-11..11-17) went Perfect, Diamond, Gold, Silver, Bronze, Iron; one mixed Perfect and Diamond picks, one came in no order. Typing the pack's first card sets the round either way.",
      "26 rounds: 2 Perfect, 4 Diamond, 6 Gold, 6 Silver, 6 Bronze, 2 Iron, as in the Double 101+ draft on file (strugglingsleep_170). Two of L.J.'s recent ladder drafts ran 4/4/4/6/6/2 instead. If the screen shows another split, set it under Rounds.",
      "Perfect rounds are not capped: no game event defines a low Perfect band. L.J. read Low of Lows as 94 and under for Perfect and 84 for Diamond; the game's bands put 94 on Diamond and 84 on Gold.",
      "You pick the position each round, packs of 6.",
    ],
  },
  ptms3pd2: {
    series: "ptms3pd2",
    eventId: 9130005,
    name: "PTMS 3 PD 2 - Double 101+",
    short: "PTMS 3 PD 2 Double 101+",
    cards: 26,
    envYear: 2015,
    dh: true,
    teams: 128,
    mode: "Bo9, sims every 10 minutes",
    starts: "Sat 21 Nov, 08:30 AM",
    ordered: true,
    rounds: [
      { key: "P101", label: "101+ (round 1)", tier: "Perfect", groups: ALL_GROUPS, count: 1, pack: "mixed", valueMin: 101 },
      { key: "P", label: "Perfect", tier: "Perfect", groups: ALL_GROUPS, count: 1, pack: "choose" },
      { key: "D", label: "Diamond", tier: "Diamond", groups: ALL_GROUPS, count: 4, pack: "choose" },
      { key: "G", label: "Gold", tier: "Gold", groups: ALL_GROUPS, count: 6, pack: "choose" },
      { key: "S", label: "Silver", tier: "Silver", groups: ALL_GROUPS, count: 6, pack: "choose" },
      { key: "B", label: "Bronze", tier: "Bronze", groups: ALL_GROUPS, count: 6, pack: "choose" },
      { key: "I", label: "Iron", tier: "Iron", groups: ALL_GROUPS, count: 2, pack: "choose" },
    ],
    packSize: 6,
    confirmed: [
      "Double PD, cards from 1970 on, 2015 run environment, DH, 2015 Angel Stadium of Anaheim (AVG 1.004/.950, HR .973/.998, 2B .968, 3B .827), 128 teams, Bo9, starts Sat 21 Nov 08:30 (event screen, 11-17).",
      "The Double 101+ draft on file drafted exactly 2 Perfect, 4 Diamond, 6 Gold, 6 Silver, 6 Bronze, 2 Iron on all 3 full teams (strugglingsleep_170, Daily Struggling to Sleep - DBL, 101+ RD1).",
    ],
    assumed: [
      "Rounds come top tier first, as in 6 of the 8 ladder drafts in L.J.'s game saves (11-11..11-17). Typing the pack's first card sets the round either way.",
      "The same rounds here, with a 101+ first round: the 11-10 announcement called it Double 101+; the 11-17 screen says only Double PD. The helper takes a Perfect card of any value in either Perfect round.",
      "\"Double\" is not defined on file. Every tier count in the double draft on file is even, as in every ladder in L.J.'s saves, so it may mean two picks a round. If a pick gives you both cards, enter both.",
    ],
  },
  ptms3pd3: {
    series: "ptms3pd3",
    eventId: 9130006,
    name: "PTMS 3 PD 3 - Modified Perfectly Bronze",
    short: "PTMS 3 PD 3 Perfectly Bronze",
    cards: 21,
    envYear: 1939,
    dh: false,
    teams: 128,
    mode: "Bo9, sims every 10 minutes",
    starts: "Sat 21 Nov, 08:49 AM",
    ordered: true,
    rounds: [
      { key: "P", label: "Perfect", tier: "Perfect", groups: ALL_GROUPS, count: 8, pack: "mixed" },
      { key: "B", label: "Bronze", tier: "Bronze", groups: ALL_GROUPS, count: 13, pack: "mixed" },
    ],
    packSize: 2,
    confirmed: [
      "Modified Perfectly Bronze, 21 cards, 1939 run environment, no DH, 1940 Braves Field (AVG .995/.969, HR .829/.906, 2B 1.014, 3B .905), 128 teams, Bo9, starts Sat 21 Nov 08:49 (event screen, 11-17).",
      "8 Perfect, then 13 Bronze. \"Four rounds of Perfect, then nine of Bronze\" is 13 rounds of two picks: the 26-card Perfectly Iron in L.J.'s 11-11 game save dealt 8 Perfect then 18 Iron. Stopping at 21 cards leaves 13 Bronze. PTCS 8's Modified Perfectly Iron came out the same: L.J.'s team had 8 Perfect and 13 Iron.",
    ],
    assumed: [
      "Packs show 2 cards, hitters and pitchers mixed (L.J. on Modified Perfectly Iron, 11-03).",
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

/** Can a card come out of a round of this kind? By tier and group; the value band only shapes the pool (inBand). */
export const fitsRound = (r: RoundKind, c: { tier: Tier; group: DraftGroup }): boolean =>
  r.tier === c.tier && r.groups.includes(c.group);

/** Is a card's value inside the band its round deals (RoundKind.valueMin / valueMax)? */
export const inBand = (r: Pick<RoundKind, "valueMin" | "valueMax">, c: { val: number }): boolean =>
  (r.valueMin == null || c.val >= r.valueMin) && (r.valueMax == null || c.val <= r.valueMax);

/** A round's pool: its tier, inside its value band. */
export const inPool = (r: RoundKind, c: { tier: Tier; val: number }): boolean => r.tier === c.tier && inBand(r, c);

/**
 * The format with the round counts L.J. set on the page (the screen showed a
 * different split than the one on file). Unknown keys are ignored; the
 * roster size follows the counts.
 */
export function withCounts(f: DraftFormat, counts: Record<string, number> | null | undefined): DraftFormat {
  if (!counts || !f.rounds.some((r) => counts[r.key] != null && counts[r.key] !== r.count)) return f;
  const rounds = f.rounds.map((r) => (counts[r.key] != null ? { ...r, count: Math.max(0, Math.round(counts[r.key])) } : r));
  return { ...f, rounds, cards: rounds.reduce((a, r) => a + r.count, 0) };
}

/**
 * The round the game deals next when nothing says otherwise: in an ordered
 * format the first kind in order with rounds left; else, with one kind left
 * or three kinds at most, the one with most left; else unknown (null).
 */
export function nextRound(f: DraftFormat, rem: Remaining): RoundKind | null {
  const open = f.rounds.filter((r) => (rem[r.key] ?? 0) > 0);
  if (f.ordered) return open[0] ?? null;
  if (open.length === 1 || f.rounds.length <= 3) return [...open].sort((a, b) => (rem[b.key] ?? 0) - (rem[a.key] ?? 0))[0] ?? null;
  return null;
}

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
