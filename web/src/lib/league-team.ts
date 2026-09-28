/**
 * L.J.'s league team as he set it in game: the 26, both lineups (in batting
 * order) and the staff roles, in src/data/league-team.json.
 *
 * The league export only lists who played for him the week before, so after a
 * trade or a new season it is a week behind. When the sheet is newer than the
 * newest export, the Card Model offers it in the export's place, lineups and
 * staff roles included; once an export of a later week lands, the export wins
 * again. Entries are "Name#cardId", the export's own form, so the two lists
 * compare player for player.
 */
import sheet from "@/data/league-team.json";
import { rosterSource, type ArmLocks, type Family, type LeagueExport, type Locks } from "@/lib/league-card-state";

export interface LeagueTeam {
  /** The day the roster was read off the game, YYYY-MM-DD. */
  asOf: string;
  from: string;
  family: Family;
  bats: string[];
  arms: string[];
  /** Per board, slot → entry, in batting order. */
  lineups: Locks;
  /** SP1–SP5, CL, RP1… → entry. */
  staff: ArmLocks;
}

export const leagueTeam = sheet as LeagueTeam;

/** The sheet as the Card Model takes a list, when it is newer than the export of `exportOn`; else null. */
export function newerTeamSheet(exportOn: string | null, team: LeagueTeam = leagueTeam): LeagueExport | null {
  if (exportOn && team.asOf <= exportOn) return null;
  return {
    source: rosterSource(team.asOf), roster: [...team.bats], arms: [...team.arms], family: team.family,
    locks: { vR: { ...team.lineups.vR }, vL: { ...team.lineups.vL } }, armLocks: { ...team.staff },
  };
}
