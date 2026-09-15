/**
 * JIM TEAMS — the placeholder rosters that poison a tournament export.
 *
 * When an entrant never sets a roster, OOTP fields a team of generic "Jim"
 * players and the games end 50-0, 56-0. Those placeholder players do not
 * appear in the sortable-stats export at all (712,205 rows across 346
 * archived exports, not one row without a card id) — but the REAL team that
 * drew them does, carrying four games of batting practice in its season line:
 * Hudson Railers, Gold Floor Cap run 19, 8 games, 296 runs scored, 30
 * allowed. Across the archive 176,006 of 1,537,971 runs scored — 11.4% —
 * were scored off pitchers who are not in the file, sitting on 2.7% of the
 * team-events.
 *
 * The export is season totals, so a Jim series cannot be subtracted from a
 * hitter's line. What CAN be done is to find the teams that played one and
 * leave every one of their stints out of observed_card_stats. The cost is
 * their real games too — ~3.4% of all team-games — which is cheap against
 * keeping the contamination.
 *
 * Detection is by run environment, not names, because the names are not
 * there. Two signals, either one condemns:
 *   - runs per game at 3x the field's median or more. A round-two exit that
 *     swept a Jim series runs 5-9x; a forty-game run that did dilutes to
 *     ~2.3x, which is why the second signal exists;
 *   - a season run differential of +150 or more. A Bo7 sweep alone is
 *     +160-280; a real team needs forty games at an elite +4 a game to get
 *     there on merit.
 * Against the count the field size implies (128 or 64 entrants minus teams
 * in the export) this flags the exact number in 246 of 336 files and within
 * one in 314, over-flagging exactly one file. The under-flags are mostly
 * fields that simply were not full, which is not a Jim.
 */
import type { LeagueStint } from "./league";

export interface OrgLine {
  org: string;
  games: number;
  runsFor: number;
  runsAgainst: number;
  pa: number;
}

export interface JimScan {
  /** Teams to drop, with the line that condemned them. */
  flagged: Array<OrgLine & { rpgMultiple: number; diff: number }>;
  /** Field median runs per game among teams with a decision. */
  medianRpg: number;
  teams: number;
}

export const JIM_RPG_MULTIPLE = 3.0;
export const JIM_TOTAL_DIFF = 150;

/** Per-org totals from one export's stints. */
export function orgLines(stints: readonly LeagueStint[]): OrgLine[] {
  const by = new Map<string, OrgLine>();
  for (const s of stints) {
    if (!s.org) continue;
    const o = by.get(s.org) ?? { org: s.org, games: 0, runsFor: 0, runsAgainst: 0, pa: 0 };
    if (s.isPitcher) {
      o.games += (s.stats["W"] ?? 0) + (s.stats["L"] ?? 0);
      o.runsAgainst += s.stats["Ra"] ?? 0;
    } else {
      o.runsFor += s.stats["R"] ?? 0;
      o.pa += s.pa;
    }
    by.set(s.org, o);
  }
  return [...by.values()];
}

export function scanForJimBeaters(stints: readonly LeagueStint[]): JimScan {
  const lines = orgLines(stints).filter((o) => o.games > 0);
  if (lines.length < 8) return { flagged: [], medianRpg: 0, teams: lines.length };
  const rpgs = lines.map((o) => o.runsFor / o.games).sort((a, b) => a - b);
  const mid = rpgs.length >> 1;
  const medianRpg = rpgs.length % 2 ? rpgs[mid] : (rpgs[mid - 1] + rpgs[mid]) / 2;
  const flagged = lines
    .map((o) => ({
      ...o,
      rpgMultiple: medianRpg > 0 ? o.runsFor / o.games / medianRpg : 0,
      diff: o.runsFor - o.runsAgainst,
    }))
    .filter((o) => o.rpgMultiple >= JIM_RPG_MULTIPLE || o.diff >= JIM_TOTAL_DIFF)
    .sort((a, b) => b.rpgMultiple - a.rpgMultiple);
  return { flagged, medianRpg, teams: lines.length };
}
