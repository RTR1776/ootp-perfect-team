/**
 * PT 27's road past the PTCS: the PTMS and the PTWC (the rules L.J. shared on
 * 10-16, "PT 27 Road to the Perfect Team World Championship").
 *
 * - PTCS finishes earn ladder points (1st 300 … 65th-128th 1). The tournament
 *   PTCSes and the PD PTCSes are two standings; the top 128 of either makes
 *   the next PTMS. The schedule groups PTCS 6-8 under PTMS 3 and PTCS 9-11
 *   under PTMS 4.
 * - PTWC 2 qualifying adds up: league play (season finish by league tier),
 *   PT Live leaderboard points / 50, weekly leaderboard points (the PTCS
 *   tournament points, Cap and Live left out: "no double- or triple-dipping"),
 *   PTCS 6-11 and PTMS 3-4 finishes.
 *
 * Pure: the page and its loader (lib/qualifying-load) read everything from here.
 */

import { CATEGORIES } from "@/lib/ingest/constants";

/** A PTCS or PTMS finish: the same ladder for both. */
export const LADDER_POINTS: readonly { placement: string; top: number; points: number }[] = [
  { placement: "1st", top: 1, points: 300 },
  { placement: "2nd", top: 2, points: 100 },
  { placement: "3rd-4th", top: 4, points: 75 },
  { placement: "5th-8th", top: 8, points: 40 },
  { placement: "9th-16th", top: 16, points: 20 },
  { placement: "17th-32nd", top: 32, points: 5 },
  { placement: "33rd-64th", top: 64, points: 2 },
  { placement: "65th-128th", top: 128, points: 1 },
];

export const ladderPoints = (placement: string): number | null =>
  LADDER_POINTS.find((p) => p.placement === placement)?.points ?? null;

/** The championship brackets: eight tournaments and two drafts. */
export const BERTHS = CATEGORIES;
export type Standing = "tournament" | "perfect_draft";
export const standingOf = (berth: string): Standing => (berth.startsWith("PD ") ? "perfect_draft" : "tournament");

/** Weekly leaderboard points count toward the PTWC in these categories only. */
export const PTWC_CATEGORIES = CATEGORIES.filter((c) => c !== "Cap" && c !== "Live");

export type LeagueTier = "Perfect" | "High Diamond" | "Low Diamond" | "High Gold" | "Low Gold";

/** "PEL" → Perfect, "HD451" → High Diamond, "LD404" → Low Diamond, "HG…"/"LG…" → the Gold leagues. */
export function leagueTierOf(league: string): LeagueTier | null {
  const l = league.trim().toUpperCase();
  if (l === "PEL" || l.startsWith("PERFECT")) return "Perfect";
  if (l.startsWith("HD")) return "High Diamond";
  if (l.startsWith("LD")) return "Low Diamond";
  if (l.startsWith("HG")) return "High Gold";
  if (l.startsWith("LG")) return "Low Gold";
  return null;
}

/** PTWC points for a league season finish: [last place in the band, points], by tier. */
const LEAGUE_TABLE: Record<LeagueTier, [number, number][]> = {
  Perfect: [[1, 200], [2, 150], [4, 100], [8, 75], [16, 50], [Infinity, 35]],
  "High Diamond": [[1, 100], [2, 75], [4, 50], [8, 35], [16, 20], [Infinity, 10]],
  "Low Diamond": [[1, 50], [2, 35], [4, 25], [8, 20], [16, 10], [Infinity, 5]],
  "High Gold": [[1, 35], [2, 20], [4, 10], [8, 5], [Infinity, 0]],
  "Low Gold": [[1, 20], [2, 10], [4, 5], [Infinity, 0]],
};

export function leaguePoints(tier: LeagueTier, place: number): number {
  if (!(place >= 1)) return 0;
  return LEAGUE_TABLE[tier].find(([last]) => place <= last)![1];
}

/** PT Live leaderboard points count at 1/50. */
export const LIVE_DIVISOR = 50;

export interface Milestone { name: string; on: string; note: string }

/** What's left on the road to PTWC 2, in order. */
export const SCHEDULE: readonly Milestone[] = [
  { name: "PTCS 8", on: "2026-11-07", note: "qualifying Oct 5 – Nov 1" },
  { name: "PTMS 3", on: "2026-11-21", note: "top 128 of PTCS 6–8, tournament or PD" },
  { name: "PTCS 9", on: "2026-12-12", note: "qualifying Nov 2 – Dec 6" },
  { name: "PTCS 10", on: "2027-01-09", note: "qualifying Dec 7 – Jan 3" },
  { name: "PTCS 11", on: "2027-02-06", note: "qualifying Jan 4 – 31" },
  { name: "PTMS 4", on: "2027-02-13", note: "top 128 of PTCS 9–11, tournament or PD" },
  { name: "PTWC 2", on: "2027-02-20", note: "Feb 20–21 (the points table says 21–22)" },
];

/** What feeds PTWC 2. */
export const PTWC2 = {
  ptcs: ["PTCS 6", "PTCS 7", "PTCS 8", "PTCS 9", "PTCS 10", "PTCS 11"],
  ptms: ["PTMS 3", "PTMS 4"],
  /** Weekly leaderboard window (PTWC 1 took up to Aug 2). */
  weekly: { from: "2026-08-04", to: "2027-01-31" },
  /** League weeks by their Sunday: Aug 24's week ends Aug 30; the last counted ends Feb 14. */
  league: { from: "2026-08-30", to: "2027-02-14" },
} as const;

/** The PTCSes that feed each PTMS. */
export const PTMS_FEEDS: Record<string, readonly string[]> = {
  "PTMS 3": ["PTCS 6", "PTCS 7", "PTCS 8"],
  "PTMS 4": ["PTCS 9", "PTCS 10", "PTCS 11"],
};

/** The next milestone on or after `today` (YYYY-MM-DD). */
export const nextMilestone = (today: string): Milestone | null => SCHEDULE.find((m) => m.on >= today) ?? null;

/**
 * A team's place in its league by record, from one export's team totals:
 * win share, then wins. Null when the export has no decisions (early exports
 * carried no W/L) or the team isn't in it.
 */
export function placeByRecord(teams: readonly { org: string; w: number; l: number }[], mine: (org: string) => boolean): { place: number; of: number; w: number; l: number } | null {
  const played = teams.filter((t) => t.w + t.l > 0);
  const me = played.find((t) => mine(t.org));
  if (!me) return null;
  const pct = (t: { w: number; l: number }) => t.w / (t.w + t.l);
  const ahead = played.filter((t) => t !== me && (pct(t) > pct(me) || (pct(t) === pct(me) && t.w > me.w))).length;
  return { place: ahead + 1, of: played.length, w: me.w, l: me.l };
}
