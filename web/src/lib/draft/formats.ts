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

/**
 * One of the game's rounds as its event screen lists it ("Round 5: Pick 1 of
 * 12 cards (Bronze 60-69)"): the round kind it deals from and how many cards
 * are kept from its pack. The pack size is the format's.
 */
export interface Screen {
  round: string;
  keep: number;
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
  /**
   * The game's rounds in order, when the event screen lists them. Then they
   * are the truth: each kind's count is the picks its screens keep, the
   * format is dealt in this order, and each pick keeps (and is priced at) its
   * own screen's count, so PD 3's "pick 1 of 12" rounds price at the best of
   * 12 and its "pick 2 of 12" rounds at about the best of 8 each.
   */
  screens?: Screen[];
  /** Cards a pack (one round's screen) shows; the page can change it. */
  packSize: number;
  /**
   * Cards kept from each pack. 1 unless said: L.J.'s game saves show the
   * ladder and Perfectly-X drafts as rounds of about 12 cards with 2 kept
   * (lib/draft/live-state withPick keeps the pack up for the second pick).
   * Round counts stay in picks, not screens. A format with `screens` keeps
   * each round's own count (keepFor); this is then only the fallback.
   */
  keep?: number;
  /** One line each: what the data or L.J. has confirmed, and what is assumed. */
  confirmed: string[];
  assumed: string[];
}

const bronzeAt = (g: DraftGroup, count = 1, also: DraftGroup[] = []): RoundKind => ({
  key: `B-${g}`, label: `Bronze ${[g, ...also].join("/")}`, tier: "Bronze", groups: [g, ...also], count, pack: "fixed",
});

const screensOf = (...list: [string, number][]): Screen[] => list.map(([round, keep]) => ({ round, keep }));

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
    ordered: true,
    // L.J.'s 11-22 draft, screen by screen: 13 rounds of 12 cards in this order, keeping 2, 1 x7, 3, 5, 5, 2, 2.
    screens: screensOf(["B-C", 2], ["B-1B", 1], ["B-2B", 1], ["B-3B", 1], ["B-SS", 1], ["B-LF", 1], ["B-CF", 1], ["B-RF", 1],
      ["I-bat", 3], ["B-SP", 5], ["B-RP", 5], ["S-any", 2], ["G-any", 2]),
    packSize: 12,
    confirmed: [
      "13 rounds of 12 cards, in this order (L.J.'s 11-22 draft screens): Bronze C keep 2; Bronze 1B/DH, 2B, 3B, SS, LF, CF, RF keep 1 each; Iron bats keep 3; Bronze SP keep 5; Bronze RP keep 5; Silver keep 2; Gold keep 2. The Silver and Gold packs mix bats and arms.",
      "1996 run environment with DH, 128 teams, Bo7 with a Bo9 final (L.J., 10-25).",
      "DH: pitchers took ~1% of plate appearances in every export on file.",
      "26 rounds: 2 Bronze C; one Bronze 1B/DH, 2B, 3B, SS, LF, CF and RF; 5 Bronze SP; 5 Bronze RP; 3 Iron bats (no C); 2 Silver; 2 Gold (exact on all 304 full teams, 10-22..10-25).",
    ],
    assumed: [
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
   * (src/db/seed/ptms3.json). Everything below, the round lists included, is
   * from the event screens L.J. sent on 11-17 ("Round 1: Pick 2 of 12 cards
   * (Perfect) 100" and so on); `screens` copies each draft's 13 rounds.
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
      { key: "P", label: "Perfect 100", tier: "Perfect", groups: ALL_GROUPS, count: 2, pack: "mixed", valueMin: 100, valueMax: 100 },
      { key: "D", label: "Low Diamond 90-94", tier: "Diamond", groups: ALL_GROUPS, count: 4, pack: "mixed", valueMin: 90, valueMax: 94 },
      { key: "G", label: "Low Gold 80-84", tier: "Gold", groups: ALL_GROUPS, count: 6, pack: "mixed", valueMin: 80, valueMax: 84 },
      { key: "S", label: "Low Silver 70-74", tier: "Silver", groups: ALL_GROUPS, count: 6, pack: "mixed", valueMin: 70, valueMax: 74 },
      { key: "B", label: "Low Bronze 60-64", tier: "Bronze", groups: ALL_GROUPS, count: 6, pack: "mixed", valueMin: 60, valueMax: 64 },
      { key: "I", label: "Low Iron 40-49", tier: "Iron", groups: ALL_GROUPS, count: 2, pack: "mixed", valueMin: 40, valueMax: 49 },
    ],
    screens: screensOf(["P", 2], ["D", 2], ["D", 2], ["G", 2], ["G", 2], ["G", 2], ["S", 2], ["S", 2], ["S", 2], ["B", 2], ["B", 2], ["B", 2], ["I", 2]),
    packSize: 12,
    keep: 2,
    confirmed: [
      "Low of Lows, cards up to 1986, 1986 run environment, DH, 1985 Veterans Stadium (AVG 1.007/1.027, HR 1.030/.982, 2B 1.073, 3B 1.119), Bo9, starts Sat 21 Nov 07:59 (event screen, 11-17).",
      "13 rounds, each pick 2 of 12: round 1 Perfect 100; 2-3 Low Diamond 90-94; 4-6 Low Gold 80-84; 7-9 Low Silver 70-74; 10-12 Low Bronze 60-64; 13 Low Iron 40-49 (event screen, 11-17). 2 P, 4 D, 6 G, 6 S, 6 B, 2 I.",
    ],
    assumed: [
      "128 teams (a guess; no export of this event on file).",
      "Each pack mixes positions (the screen doesn't say).",
    ],
  },
  ptms3pd2: {
    series: "ptms3pd2",
    eventId: 9130005,
    name: "PTMS 3 PD 2 - Double PD",
    short: "PTMS 3 PD 2 Double",
    cards: 26,
    envYear: 2015,
    dh: true,
    teams: 128,
    mode: "Bo9, sims every 10 minutes",
    starts: "Sat 21 Nov, 08:29 AM",
    ordered: true,
    rounds: [
      { key: "P101", label: "Perfect 101+", tier: "Perfect", groups: ALL_GROUPS, count: 2, pack: "mixed", valueMin: 101 },
      { key: "P", label: "Perfect 100", tier: "Perfect", groups: ALL_GROUPS, count: 2, pack: "mixed", valueMin: 100, valueMax: 100 },
      { key: "D", label: "Diamond 90-99", tier: "Diamond", groups: ALL_GROUPS, count: 4, pack: "mixed" },
      { key: "G", label: "Gold 80-89", tier: "Gold", groups: ALL_GROUPS, count: 4, pack: "mixed" },
      { key: "S", label: "Silver 70-79", tier: "Silver", groups: ALL_GROUPS, count: 6, pack: "mixed" },
      { key: "B", label: "Bronze 60-69", tier: "Bronze", groups: ALL_GROUPS, count: 6, pack: "mixed" },
      { key: "I", label: "Iron 40-59", tier: "Iron", groups: ALL_GROUPS, count: 2, pack: "mixed", valueMin: 40 },
    ],
    screens: screensOf(["P101", 2], ["P", 2], ["D", 2], ["D", 2], ["G", 2], ["G", 2], ["S", 2], ["S", 2], ["S", 2], ["B", 2], ["B", 2], ["B", 2], ["I", 2]),
    packSize: 12,
    keep: 2,
    confirmed: [
      "Double PD, cards from 1970 on, 2015 run environment, DH, 2015 Angel Stadium of Anaheim (AVG 1.004/.950, HR .973/.998, 2B .968, 3B .827), Bo9, starts Sat 21 Nov 08:29 (event screen, 11-17).",
      "13 rounds, each pick 2 of 12: round 1 Perfect 101+; 2 Perfect 100; 3-4 Diamond 90-99; 5-6 Gold 80-89; 7-9 Silver 70-79; 10-12 Bronze 60-69; 13 Iron 40-59 (event screen, 11-17). 4 P (2 of them 101+), 4 D, 4 G, 6 S, 6 B, 2 I.",
    ],
    assumed: [
      "128 teams (a guess; no export of this event on file).",
      "Each pack mixes positions (the screen doesn't say).",
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
      { key: "P", label: "Perfect", tier: "Perfect", groups: ALL_GROUPS, count: 7, pack: "mixed" },
      { key: "B", label: "Bronze 60-69", tier: "Bronze", groups: ALL_GROUPS, count: 14, pack: "mixed" },
    ],
    screens: screensOf(["P", 1], ["P", 2], ["P", 2], ["P", 2], ["B", 1], ["B", 1], ["B", 1], ["B", 2], ["B", 2], ["B", 2], ["B", 2], ["B", 2], ["B", 1]),
    packSize: 12,
    keep: 2,
    confirmed: [
      "Modified Perfectly Bronze, 21 cards, 1939 run environment, no DH, 1940 Braves Field (AVG .995/.969, HR .829/.906, 2B 1.014, 3B .905), Bo9, starts Sat 21 Nov 08:49 (event screen, 11-17).",
      "13 rounds of 12 cards: round 1 Perfect, pick 1; 2-4 Perfect, pick 2; 5-7 Bronze 60-69, pick 1; 8-12 Bronze, pick 2; 13 Bronze, pick 1 (event screen, 11-17). 7 Perfect, 14 Bronze. The 8 and 13 on file before this were a guess from the 26-card Perfectly Iron.",
    ],
    assumed: [
      "128 teams (a guess; no export of this event on file).",
      "Each pack mixes positions (the screen doesn't say).",
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

/**
 * The pack the rounds to come are priced at, per pick: keeping k of a pack of
 * N is worth about the best of n with n/(n+1) the mean of the top k of N
 * (uniform order statistics), n = (N − (k−1)/2) / ((k+1)/2). Keep 2 of 12 is
 * about the best of 8 for each pick.
 */
export const pricedPack = (packSize: number, keep = 1): number =>
  Math.max(1, Math.round((packSize - (keep - 1) / 2) / ((keep + 1) / 2)));

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
  // The screen list no longer adds up, so it goes: keep falls back to the format's (or the page's).
  return { ...f, rounds, cards: rounds.reduce((a, r) => a + r.count, 0), screens: undefined };
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
 * The round a drafted card used up: of the remaining kinds it fits, one whose
 * value band holds it (PD 2's 102 goes to the 101+ round, its 100 to the 100
 * round), then the most specific (a Bronze SS takes "Bronze SS" before any
 * open Bronze round). Null when no round left can have held it, which the
 * page reports instead of guessing.
 */
export function roundFor(f: DraftFormat, rem: Remaining, c: { tier: Tier; group: DraftGroup; val?: number }): RoundKind | null {
  const open = f.rounds.filter((r) => (rem[r.key] ?? 0) > 0 && fitsRound(r, c));
  const band = (r: RoundKind) => (c.val == null || inBand(r, { val: c.val }) ? 0 : 1);
  open.sort((a, b) => band(a) - band(b) || a.groups.length - b.groups.length);
  return open[0] ?? null;
}

/* ------------------------------------------- the game's rounds (screens) */

export interface ScreenAt {
  /** The game's round number, 1-based. */
  no: number;
  screen: Screen;
  /** Picks already taken from this round's pack. */
  taken: number;
}

/**
 * The round of the game's list the next pick comes from, counted by picks
 * made: PD 3's pick 2 is round 2's first, pick 3 its second. Null with no
 * screen list, or once the list is used up.
 */
export function screenAt(f: DraftFormat, picksMade: number): ScreenAt | null {
  if (!f.screens) return null;
  let before = 0;
  for (const [k, screen] of f.screens.entries()) {
    if (picksMade < before + screen.keep) return { no: k + 1, screen, taken: picksMade - before };
    before += screen.keep;
  }
  return null;
}

/**
 * Cards kept from the pack on screen: the game's round for this pick when the
 * format lists them, else the page's setting, else the format's.
 */
export function keepFor(f: DraftFormat, picksMade: number, pageKeep?: number): number {
  if (f.screens) return screenAt(f, picksMade)?.screen.keep ?? f.keep ?? 1;
  return pageKeep ?? f.keep ?? 1;
}

/**
 * The picks left, in the game's order, each with its round kind and the
 * cards its screen keeps. Each kind's picks are used up from the front, so
 * the ones left are its last `rem[kind]` in the list; a card typed into the
 * wrong round costs that round, not the order. Null with no screen list.
 */
export function stepsLeft(f: DraftFormat, rem: Remaining): { key: string; keep: number }[] | null {
  if (!f.screens) return null;
  const all = f.screens.flatMap((s) => Array.from({ length: s.keep }, () => ({ key: s.round, keep: s.keep })));
  const left = new Map(Object.entries(rem).map(([k, v]) => [k, Math.max(0, v)]));
  const out: { key: string; keep: number }[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const n = left.get(all[i].key) ?? 0;
    if (n > 0) { out.push(all[i]); left.set(all[i].key, n - 1); }
  }
  return out.reverse();
}

/** The screen list the way the event screen reads, runs of alike rounds joined: "R1 Perfect, keep 1 · R2-4 Perfect, keep 2 · …". */
export function screensText(f: DraftFormat): string | null {
  if (!f.screens?.length) return null;
  const label = (key: string) => f.rounds.find((r) => r.key === key)?.label ?? key;
  const parts: string[] = [];
  let from = 0;
  for (let k = 1; k <= f.screens.length; k++) {
    const a = f.screens[from], b = f.screens[k];
    if (b && b.round === a.round && b.keep === a.keep) continue;
    parts.push(`R${from + 1}${k - 1 > from ? `-${k}` : ""} ${label(a.round)}, keep ${a.keep}`);
    from = k;
  }
  return `${f.screens.length} rounds of ${f.packSize}: ${parts.join(" · ")}`;
}

/** The remaining rounds after a draft's picks, in pick order; `unplaced` are picks no round could hold. */
export function replay(f: DraftFormat, picks: readonly { tier: Tier; group: DraftGroup; val?: number }[]): { rem: Remaining; used: (string | null)[]; unplaced: number } {
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
