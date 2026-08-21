/**
 * Parser for the 200-column PT league season exports
 * (`pel_all.csv`, `hd450_all.csv`, `hd451_vL.csv`, …).
 *
 * These are the goldmine files: one row per card AS ROSTERED BY ONE TEAM, with
 * identity (CID, ORG, VAL, VAR), the full rating block, AND the season stat
 * line in the same row. They are what makes league-relative analysis possible —
 * who plays what, and how it actually performed.
 *
 * Format notes, all verified against L.J.'s real exports of 2026-08-21:
 * - The header is already de-duplicated at source (`G`, `G_1`, `G_2`;
 *   `HR` batting vs `HR_1` pitching) — address columns by exact name.
 * - `ORG` is the PT team name; `"-"` marks an unrostered/free-agent row.
 * - `IP` uses OOTP's thirds notation: 197.1 = 197⅓ innings. Convert before
 *   summing or dividing, or every rate stat is silently wrong.
 * - `K's` (with apostrophe) is the hitter K-avoid rating.
 * - Clan tags live in the team name suffix (`- CG`, `- HotL`, `GH`, …); they
 *   mark coordinated groups that measurably outperform (+2.4 WAR, p = .04).
 */

import { num, parseCsv } from "./csv";

export type LeagueSplit = "all" | "vL" | "vR";

export interface LeagueStint {
  cid: number | null;
  name: string;
  pos: string;
  org: string;
  clan: string | null;
  isFreeAgent: boolean;
  isPitcher: boolean;
  val: number | null;
  tier: string | null;
  isVariant: boolean;
  cardYear: number | null;
  /** Selected ratings, by our canonical short names. */
  ratings: Record<string, number>;
  /** PA for hitters; innings (decimal, thirds converted) for pitchers. */
  pa: number;
  ip: number;
  /** Usage weight: PA + IP × 4.3 — comparable across roles. */
  use: number;
  war: number;
  /** The stat line kept whole for the analytics layer. */
  stats: Record<string, number>;
}

export interface LeagueParseResult {
  league: string | null;
  split: LeagueSplit;
  stints: LeagueStint[];
  stats: {
    rows: number;
    teams: number;
    freeAgentRows: number;
    uniqueCids: number;
    clanTeams: number;
  };
}

/** OOTP thirds notation: 197.1 = 197⅓, 197.2 = 197⅔. */
export function ipToDecimal(raw: number | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  const whole = Math.trunc(raw);
  const frac = Math.round((raw - whole) * 10);
  return whole + (frac === 1 ? 1 / 3 : frac === 2 ? 2 / 3 : 0);
}

const CLAN_TAGS = ["CG", "HOTL", "GH", "TBD", "BFF", "DGAF", "SOM", "F2P", "DCFC"];

/**
 * Clan tag from the team-name suffix. `Castroville Mashers - CG DCFC` → CG;
 * `Charlotte Hellcats GH` → GH. Conservative on purpose: only known tags, so
 * a team merely named with a dash doesn't get misfiled.
 */
export function clanOf(org: string): string | null {
  if (!org || org === "-") return null;
  const upper = org.toUpperCase();
  for (const tag of CLAN_TAGS) {
    if (tag === "DCFC") continue; // sub-tag of CG in the wild; never alone
    if (new RegExp(`[-–]\\s*${tag}\\b`).test(upper)) return tag === "HOTL" ? "HOTL" : tag;
    if (new RegExp(`\\b${tag}\\b\\s*$`).test(upper)) return tag === "HOTL" ? "HOTL" : tag;
  }
  return null;
}

/** League label + split from the export's filename. */
export function parseLeagueFilename(filename: string): {
  league: string | null;
  split: LeagueSplit;
} {
  const base = filename.toLowerCase();
  const league = /pel/.test(base)
    ? "PEL"
    : (base.match(/hd(\d{3})/)?.[1] && `HD${base.match(/hd(\d{3})/)![1]}`) || null;
  const split: LeagueSplit = /versus_left|_vl\b|_vl\./.test(base)
    ? "vL"
    : /versus_right|_vr\b|_vr\./.test(base)
      ? "vR"
      : "all";
  return { league, split };
}

/** Ratings we carry forward, keyed by canonical short name → export column. */
const RATING_COLS: Array<[key: string, col: string]> = [
  ["POW", "POW"],
  ["EYE", "EYE"],
  ["Kav", "K's"],
  ["BABr", "BABIP"],
  ["GAP", "GAP"],
  ["SPE", "SPE"],
  ["STU", "STU"],
  ["CON", "CON"],
  ["PBAB", "PBABIP"],
  ["HRA", "HRA"],
  ["STM", "STM"],
  ["CABI", "C ABI"],
  ["CFRM", "C FRM"],
  ["CARM", "C ARM"],
  ["IFRNG", "IF RNG"],
  ["IFERR", "IF ERR"],
  ["IFARM", "IF ARM"],
  ["TDP", "TDP"],
  ["OFRNG", "OF RNG"],
  ["OFERR", "OF ERR"],
  ["OFARM", "OF ARM"],
];

const STAT_COLS: Array<[key: string, col: string]> = [
  // batting
  ["PA", "PA"],
  ["AB", "AB"],
  ["H", "H"],
  ["b1", "1B_1"],
  ["b2", "2B_1"],
  ["b3", "3B_1"],
  ["HR", "HR"],
  ["BB", "BB"],
  ["IBB", "IBB"],
  ["HP", "HP"],
  ["SF", "SF"],
  ["K", "K"],
  ["SB", "SB"],
  ["CS", "CS"],
  ["wRAA", "wRAA"],
  ["WAR_h", "WAR"],
  // pitching
  ["IP_raw", "IP"],
  ["BF", "BF"],
  ["HRa", "HR_1"],
  ["BBa", "BB_1"],
  ["HPa", "HP_1"],
  ["Ka", "K_1"],
  ["ER", "ER"],
  ["WAR_p", "WAR_1"],
  ["SIERA", "SIERA"],
  // fielding
  ["ZR", "ZR"],
  ["EFF", "EFF"],
  ["E", "E"],
];

const PITCHER_POS = new Set(["SP", "RP", "CL"]);

export function parseLeagueExport(text: string, filename = ""): LeagueParseResult {
  const meta = parseLeagueFilename(filename);
  const parsed = parseCsv(text, { extraFields: "drop" });

  const stints: LeagueStint[] = [];
  const teams = new Set<string>();
  const clans = new Set<string>();
  const cids = new Set<number>();
  let freeAgentRows = 0;

  for (const row of parsed.rows) {
    const name = (row["Name"] ?? "").trim();
    const pos = (row["POS"] ?? "").trim();
    if (!name || !pos) continue;

    const org = (row["ORG"] ?? "").trim();
    const isFreeAgent = org === "-" || org === "";
    if (isFreeAgent) freeAgentRows++;
    else teams.add(org);

    const clan = isFreeAgent ? null : clanOf(org);
    if (clan) clans.add(org);

    const cid = num(row["CID"]);
    if (cid != null) cids.add(cid);

    const ratings: Record<string, number> = {};
    for (const [key, col] of RATING_COLS) {
      const v = num(row[col]);
      if (v != null) ratings[key] = v;
    }

    const stats: Record<string, number> = {};
    for (const [key, col] of STAT_COLS) {
      const v = num(row[col]);
      if (v != null) stats[key] = v;
    }

    const isPitcher = PITCHER_POS.has(pos);
    const pa = stats.PA ?? 0;
    const ip = ipToDecimal(stats.IP_raw ?? null);
    stats.IP = Math.round(ip * 100) / 100;

    stints.push({
      cid,
      name,
      pos,
      org,
      clan,
      isFreeAgent,
      isPitcher,
      val: num(row["VAL"]),
      tier: (row["Tier"] ?? "").trim() || null,
      isVariant: (row["VAR"] ?? "").trim().toUpperCase() === "Y",
      cardYear: num(row["CYear"]),
      ratings,
      pa,
      ip,
      use: pa + ip * 4.3,
      war: (isPitcher ? stats.WAR_p : stats.WAR_h) ?? 0,
      stats,
    });
  }

  return {
    league: meta.league,
    split: meta.split,
    stints,
    stats: {
      rows: stints.length,
      teams: teams.size,
      freeAgentRows,
      uniqueCids: cids.size,
      clanTeams: clans.size,
    },
  };
}

/**
 * Sniff: the league export is the only PT file whose header carries ORG and
 * CID and a WAR column together.
 */
export function looksLikeLeagueExport(headerLine: string): boolean {
  return /(^|,)ORG(,|$)/.test(headerLine) && /(^|,)CID(,|$)/.test(headerLine) && /,WAR(,|$)/.test(headerLine);
}
