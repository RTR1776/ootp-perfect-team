// Types matching the actual shape of public/data/projections.json.
// Verified against the real file: top-level { baselines, card_count, cards[] }.
// NOTE: the dataset contains projected OUTCOMES only (slash lines, FIP/K9/BB9),
// not scouting ratings (contact/power/stuff). Charts use outcome components.

export type Tier = "Perfect" | "Diamond" | "Gold" | "Silver" | "Bronze" | "Iron";
export type Bats = "R" | "L" | "S";
export type Throws = "R" | "L";
export type Position =
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "DH"
  | "SP"
  | "RP"
  | "CL";

export interface HitterSplit {
  BA: number;
  OBP: number;
  SLG: number;
  OPS: number;
  ISO: number;
  wOBA: number;
  "K%": number;
  "BB%": number;
  HR_rate: number;
  BABIP: number;
}

export interface PitcherSplit {
  FIP: number;
  "K/9": number;
  "BB/9": number;
  "HR/9": number;
  BABIP_against: number;
  wOBA_against: number;
}

export interface DefensePosition {
  pos: Position;
  position_rating: number;
  def_runs_per_162: number;
  with_position_adj: number;
}

export interface Defense {
  positions: DefensePosition[];
}

export interface Baserun {
  SPE: number; // speed
  STE: number; // stealing
  SR: number; // stealing rating / success
  RUN: number; // baserunning
  bsr_runs_per_162: number;
}

export interface HitterValue {
  wRAA_per_600: number;
  BsR_per_162: number;
  best_def_runs_162: number;
  WAR_per_600: number;
}

export interface PitcherValue {
  RAA_per_180IP: number;
  WAR_per_180IP: number;
}

/**
 * Day-2 calibration evidence (engine/calibrate.py). Values ending in `_rel`
 * are relative to the PT-league environment (1.00 = league average); absolute
 * `woba_blend_*` / `fip_blend_*` are in the modern-PT-league frame. `n_PA_*` /
 * `n_IP_*` are the observed sample behind the blend.
 */
export interface Evidence {
  sources?: string[];
  siera_obs?: number;
  [key: string]: number | string[] | undefined;
}

export interface Card {
  cid: number;
  name: string;
  pos: Position;
  bats: Bats;
  throws: Throws;
  tier: Tier;
  owned?: boolean;
  ratings_source?: string;
  engine?: string;
  evidence?: Evidence;
  buy: string; // space-separated thousands, e.g. "5 555"; "0" = none
  sell: string;
  lock: boolean;
  var: "N" | "Y";
  vlvl: number;

  // Hitter blocks (present on position players / DH)
  hitter_vL?: HitterSplit;
  hitter_vR?: HitterSplit;
  hitter_overall?: HitterSplit;
  defense?: Defense;
  baserun?: Baserun;

  // Pitcher blocks (present on SP/RP/CL)
  pitcher_vL?: PitcherSplit;
  pitcher_vR?: PitcherSplit;
  pitcher_overall?: PitcherSplit;
  stamina?: number;
  hold?: number;

  value: HitterValue | PitcherValue;
}

export interface ProjectionsFile {
  baselines: Record<string, unknown>;
  pt_env?: { wOBA: number; FIP: number };
  card_count: number;
  cards: Card[];
}

export const TIERS: Tier[] = ["Perfect", "Diamond", "Gold", "Silver", "Bronze", "Iron"];

/** Evidence-blended wOBA vs a pitcher hand, falling back to the projection. */
export function blendedWoba(card: Card, hand: "L" | "R"): number | undefined {
  const blend = card.evidence?.[`woba_blend_v${hand}`];
  if (typeof blend === "number") return blend;
  return (hand === "L" ? card.hitter_vL : card.hitter_vR)?.wOBA;
}

/** Evidence-blended FIP vs a batter hand, falling back to the projection. */
export function blendedFip(card: Card, hand: "L" | "R"): number | undefined {
  const blend = card.evidence?.[`fip_blend_v${hand}`];
  if (typeof blend === "number") return blend;
  return (hand === "L" ? card.pitcher_vL : card.pitcher_vR)?.FIP;
}

/** Observed sample size (PA or IP) behind a card's evidence blend. */
export function evidenceN(card: Card): number {
  const e = card.evidence;
  if (!e) return 0;
  const keys = PITCHER_POSITIONS.has(card.pos)
    ? ["n_IP_vL", "n_IP_vR"]
    : ["n_PA_vL", "n_PA_vR"];
  return keys.reduce((s, k) => s + (typeof e[k] === "number" ? (e[k] as number) : 0), 0);
}

export const POSITIONS: Position[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
  "SP",
  "RP",
  "CL",
];

export const PITCHER_POSITIONS = new Set<Position>(["SP", "RP", "CL"]);

export function isPitcher(card: Card): boolean {
  return !!card.pitcher_overall || PITCHER_POSITIONS.has(card.pos);
}

export function isHitter(card: Card): boolean {
  return !!card.hitter_overall;
}

/** Unified WAR accessor across hitter/pitcher value blocks. */
export function cardWAR(card: Card): number {
  const v = card.value as Partial<HitterValue & PitcherValue>;
  return v.WAR_per_600 ?? v.WAR_per_180IP ?? 0;
}

/** Parse the space-separated thousands market string into a number. */
export function parseMarket(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : 0;
}
