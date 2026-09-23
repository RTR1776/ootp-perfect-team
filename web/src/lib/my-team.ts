/** The org name OOTP writes for L.J.'s team in every league export. */
export const MY_ORG = "Kansas City Torrent";
export const MY_ORG_SHORT = "KC";

/**
 * MATCH THE TEAM, NOT THE STRING. The export appends the CLAN to the team
 * name once the team joins one — "Kansas City Torrent - JW", the same shape
 * as "Ann Arbor Blue - HotL" and "Dallas Skyline Sluggers-CG" on other
 * rosters — so the name is not stable across weeks. Joining JW before the
 * 2026-09-20 export silently emptied every `org === MY_ORG` filter: league:meta
 * and /league reported none of his own lines and did not error, because "no
 * rows" is a legal answer to that question. Compare on the base name instead
 * and let the tag vary.
 */
const CLAN_TAG = /\s*-\s*[A-Za-z0-9]+\s*$/;
const baseOrg = (org: string) => org.replace(CLAN_TAG, "").trim().toLowerCase();
const MINE = baseOrg(MY_ORG);

export const isMyOrg = (org: string | null | undefined): boolean =>
  typeof org === "string" && baseOrg(org) === MINE;

/** Convenience for the many places holding a list of orgs a card sat on. */
export const anyMine = (orgs: readonly (string | null | undefined)[]): boolean => orgs.some(isMyOrg);
