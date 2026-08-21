/**
 * League analytics — pure functions over league stints.
 *
 * Everything here is league-relative on purpose. The PT engine normalizes:
 * a rating only matters relative to the ratings actually rostered around it,
 * so every environment, profile, and percentile below is computed against
 * usage-weighted ROSTERED rows (free agents excluded), never the card pool.
 *
 * Findings this module exists to keep live (from the 2026-08-21 study, 150
 * teams): EYE is the top hitting lever (r=.46), HR-avoid the top pitching
 * lever (−10.5/SD, ahead of Stuff); usage-weighted card value correlates
 * r=.50 with team WAR (creep); clan-tagged teams (+CG/HotL/GH…) run +2.4 WAR.
 */

export interface StintLike {
  cid: number | null;
  name: string;
  pos: string;
  org: string;
  clan: string | null;
  isFreeAgent: boolean;
  isPitcher: boolean;
  val: number | null;
  isVariant: boolean;
  cardYear: number | null;
  ratings: Record<string, number>;
  pa: number;
  ip: number;
  use: number;
  war: number;
  stats: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Outcome math                                                        */
/* ------------------------------------------------------------------ */

const W = { BB: 0.69, HB: 0.72, b1: 0.888, b2: 1.271, b3: 1.616, HR: 2.101 };
export const FIP_CONSTANT = 3.47;

function sum(rows: StintLike[], key: string): number {
  let total = 0;
  for (const r of rows) total += r.stats[key] ?? 0;
  return total;
}

export interface LeagueEnv {
  league: string;
  teams: number;
  pa: number;
  ip: number;
  woba: number;
  kPct: number;
  bbPct: number;
  hrPa: number;
  babip: number;
  fip: number;
  k9: number;
  bb9: number;
  hr9: number;
  /** Usage share on VAL >= 101 cards — the creep gauge. */
  v101Share: number;
  varShare: number;
}

export function wobaOf(rows: StintLike[]): number {
  const numer =
    W.BB * (sum(rows, "BB") - sum(rows, "IBB")) +
    W.HB * sum(rows, "HP") +
    W.b1 * sum(rows, "b1") +
    W.b2 * sum(rows, "b2") +
    W.b3 * sum(rows, "b3") +
    W.HR * sum(rows, "HR");
  const denom = sum(rows, "AB") + sum(rows, "BB") - sum(rows, "IBB") + sum(rows, "SF") + sum(rows, "HP");
  return denom > 0 ? numer / denom : 0;
}

export function fipOf(rows: StintLike[]): number {
  const ip = rows.reduce((s, r) => s + r.ip, 0);
  if (ip <= 0) return 0;
  return (13 * sum(rows, "HRa") + 3 * (sum(rows, "BBa") + sum(rows, "HPa")) - 2 * sum(rows, "Ka")) / ip + FIP_CONSTANT;
}

export function leagueEnv(league: string, stints: StintLike[]): LeagueEnv {
  const rostered = stints.filter((s) => !s.isFreeAgent);
  const hitters = rostered.filter((s) => !s.isPitcher && s.pa > 0);
  const pitchers = rostered.filter((s) => s.isPitcher && s.ip > 0);
  const pa = hitters.reduce((s, r) => s + r.pa, 0);
  const ip = pitchers.reduce((s, r) => s + r.ip, 0);
  const use = rostered.reduce((s, r) => s + r.use, 0);
  const ab = sum(hitters, "AB");
  const h = sum(hitters, "H");
  const hr = sum(hitters, "HR");
  const k = sum(hitters, "K");
  return {
    league,
    teams: new Set(rostered.map((s) => s.org)).size,
    pa,
    ip: Math.round(ip),
    woba: wobaOf(hitters),
    kPct: pa > 0 ? k / pa : 0,
    bbPct: pa > 0 ? sum(hitters, "BB") / pa : 0,
    hrPa: pa > 0 ? hr / pa : 0,
    babip: ab - k - hr + sum(hitters, "SF") > 0 ? (h - hr) / (ab - k - hr + sum(hitters, "SF")) : 0,
    fip: fipOf(pitchers),
    k9: ip > 0 ? (9 * sum(pitchers, "Ka")) / ip : 0,
    bb9: ip > 0 ? (9 * sum(pitchers, "BBa")) / ip : 0,
    hr9: ip > 0 ? (9 * sum(pitchers, "HRa")) / ip : 0,
    v101Share: use > 0 ? rostered.filter((s) => (s.val ?? 0) >= 101).reduce((s, r) => s + r.use, 0) / use : 0,
    varShare: use > 0 ? rostered.filter((s) => s.isVariant).reduce((s, r) => s + r.use, 0) / use : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Team profiles                                                       */
/* ------------------------------------------------------------------ */

export interface TeamProfile {
  league: string;
  org: string;
  clan: string | null;
  roster: number;
  hitters: number;
  pitchers: number;
  sps: number;
  pa: number;
  ip: number;
  woba: number;
  fip: number;
  war: number;
  warHit: number;
  warPit: number;
  /** PA-weighted hitter ratings / IP-weighted pitcher ratings. */
  mix: Record<string, number>;
  varShare: number;
  valW: number;
  /** Usage-weighted mean card year — proxy for era mix, not release date. */
  zr: number;
}

function wavg(rows: StintLike[], key: string, weight: (s: StintLike) => number): number {
  let n = 0;
  let d = 0;
  for (const r of rows) {
    const v = r.ratings[key];
    const w = weight(r);
    if (v != null && Number.isFinite(v) && w > 0) {
      n += v * w;
      d += w;
    }
  }
  return d > 0 ? n / d : 0;
}

export function teamProfiles(league: string, stints: StintLike[]): TeamProfile[] {
  const byOrg = new Map<string, StintLike[]>();
  for (const s of stints) {
    if (s.isFreeAgent) continue;
    const list = byOrg.get(s.org);
    if (list) list.push(s);
    else byOrg.set(s.org, [s]);
  }
  const out: TeamProfile[] = [];
  for (const [org, rows] of byOrg) {
    const hitters = rows.filter((r) => !r.isPitcher);
    const pitchers = rows.filter((r) => r.isPitcher);
    const use = rows.reduce((s, r) => s + r.use, 0);
    const mix: Record<string, number> = {
      POW: wavg(hitters, "POW", (s) => s.pa),
      EYE: wavg(hitters, "EYE", (s) => s.pa),
      Kav: wavg(hitters, "Kav", (s) => s.pa),
      BABr: wavg(hitters, "BABr", (s) => s.pa),
      GAP: wavg(hitters, "GAP", (s) => s.pa),
      STU: wavg(pitchers, "STU", (s) => s.ip),
      CON: wavg(pitchers, "CON", (s) => s.ip),
      PBAB: wavg(pitchers, "PBAB", (s) => s.ip),
      HRA: wavg(pitchers, "HRA", (s) => s.ip),
    };
    out.push({
      league,
      org,
      clan: rows[0].clan,
      roster: rows.length,
      hitters: hitters.length,
      pitchers: pitchers.length,
      sps: pitchers.filter((p) => p.pos === "SP").length,
      pa: hitters.reduce((s, r) => s + r.pa, 0),
      ip: Math.round(pitchers.reduce((s, r) => s + r.ip, 0) * 10) / 10,
      woba: wobaOf(hitters),
      fip: fipOf(pitchers),
      war: rows.reduce((s, r) => s + r.war, 0),
      warHit: hitters.reduce((s, r) => s + r.war, 0),
      warPit: pitchers.reduce((s, r) => s + r.war, 0),
      mix,
      varShare: use > 0 ? rows.filter((r) => r.isVariant).reduce((s, r) => s + r.use, 0) / use : 0,
      valW:
        use > 0
          ? rows.reduce((s, r) => s + (r.val ?? 0) * r.use, 0) / use
          : 0,
      zr: rows.reduce((s, r) => s + (r.stats.ZR ?? 0), 0),
    });
  }
  return out.sort((a, b) => b.war - a.war);
}

/* ------------------------------------------------------------------ */
/* Percentiles — the normalization frame made concrete                 */
/* ------------------------------------------------------------------ */

/**
 * A usage-weighted percentile function for one metric over one population.
 * `pct(v)` answers: what share of the usage at this position belongs to cards
 * rated below v? That is the bar the sim actually judges a card against.
 */
export function usagePercentile(
  pop: Array<{ value: number; weight: number }>,
): (v: number) => number {
  const rows = pop
    .filter((p) => Number.isFinite(p.value) && p.weight > 0)
    .sort((a, b) => a.value - b.value);
  const total = rows.reduce((s, r) => s + r.weight, 0);
  if (rows.length === 0 || total <= 0) return () => NaN;
  const values: number[] = [];
  const cum: number[] = [];
  let running = 0;
  for (const r of rows) {
    running += r.weight;
    values.push(r.value);
    cum.push(((running - r.weight / 2) / total) * 100);
  }
  return (v: number) => {
    if (!Number.isFinite(v)) return NaN;
    if (v <= values[0]) return cum[0] * (v < values[0] ? 0.5 : 1);
    if (v >= values[values.length - 1]) return cum[cum.length - 1];
    let lo = 0;
    let hi = values.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (values[mid] <= v) lo = mid;
      else hi = mid;
    }
    const span = values[hi] - values[lo];
    const t = span > 0 ? (v - values[lo]) / span : 0;
    return cum[lo] + t * (cum[hi] - cum[lo]);
  };
}

export interface PositionPercentiles {
  pos: string;
  metric: (name: string) => (v: number) => number;
}

/** Build per-position percentile functions for a set of rating keys. */
export function positionPercentiles(
  stints: StintLike[],
  keys: string[],
): Map<string, Map<string, (v: number) => number>> {
  const byPos = new Map<string, StintLike[]>();
  for (const s of stints) {
    if (s.isFreeAgent || s.use <= 0) continue;
    const list = byPos.get(s.pos);
    if (list) list.push(s);
    else byPos.set(s.pos, [s]);
  }
  const out = new Map<string, Map<string, (v: number) => number>>();
  for (const [pos, rows] of byPos) {
    const metricMap = new Map<string, (v: number) => number>();
    for (const key of keys) {
      metricMap.set(
        key,
        usagePercentile(rows.map((r) => ({ value: r.ratings[key] ?? NaN, weight: r.use }))),
      );
    }
    out.set(pos, metricMap);
  }
  return out;
}

/**
 * Audit-composite weights, derived from the 150-team league regression.
 * Hitters: EYE .30 / K-avoid .22 / POW .21 / GAP .10 / defense .17.
 * Pitchers: HR-avoid .33 / Stuff .31 / Control .28 / pBABIP .08.
 */
export const HITTER_WEIGHTS = { EYE: 0.3, Kav: 0.22, POW: 0.21, GAP: 0.1, DEF: 0.17 } as const;
export const PITCHER_WEIGHTS = { HRA: 0.33, STU: 0.31, CON: 0.28, PBAB: 0.08 } as const;

export const DEF_KEYS_BY_POS: Record<string, string[]> = {
  C: ["CABI", "CFRM", "CARM"],
  "1B": ["IFRNG", "IFERR", "IFARM", "TDP"],
  "2B": ["IFRNG", "IFERR", "IFARM", "TDP"],
  "3B": ["IFRNG", "IFERR", "IFARM", "TDP"],
  SS: ["IFRNG", "IFERR", "IFARM", "TDP"],
  LF: ["OFRNG", "OFERR", "OFARM"],
  CF: ["OFRNG", "OFERR", "OFARM"],
  RF: ["OFRNG", "OFERR", "OFARM"],
};

export interface AuditRow {
  pos: string;
  name: string;
  cardId: number | null;
  val: number | null;
  isVariant: boolean;
  score: number;
  defPct: number | null;
  parts: Record<string, number>;
}

/**
 * Score one card (by its ratings) against the league percentile machinery.
 * Ratings use the same canonical keys as the stints.
 */
export function auditCard(
  pos: string,
  ratings: Record<string, number>,
  pcts: Map<string, Map<string, (v: number) => number>>,
): { score: number; defPct: number | null; parts: Record<string, number> } {
  const posMap = pcts.get(pos);
  if (!posMap) return { score: NaN, defPct: null, parts: {} };
  const parts: Record<string, number> = {};
  const p = (key: string) => {
    const fn = posMap.get(key);
    const v = ratings[key];
    if (!fn || v == null) return NaN;
    const r = fn(v);
    if (Number.isFinite(r)) parts[key] = Math.round(r);
    return r;
  };
  const isPitcher = pos === "SP" || pos === "RP" || pos === "CL";
  if (isPitcher) {
    const score =
      PITCHER_WEIGHTS.HRA * p("HRA") +
      PITCHER_WEIGHTS.STU * p("STU") +
      PITCHER_WEIGHTS.CON * p("CON") +
      PITCHER_WEIGHTS.PBAB * p("PBAB");
    return { score, defPct: null, parts };
  }
  const defKeys = DEF_KEYS_BY_POS[pos] ?? [];
  const defVals = defKeys.map((k) => p(k)).filter((v) => Number.isFinite(v));
  const defPct = defVals.length ? defVals.reduce((s, v) => s + v, 0) / defVals.length : NaN;
  const score =
    HITTER_WEIGHTS.EYE * p("EYE") +
    HITTER_WEIGHTS.Kav * p("Kav") +
    HITTER_WEIGHTS.POW * p("POW") +
    HITTER_WEIGHTS.GAP * p("GAP") +
    HITTER_WEIGHTS.DEF * (Number.isFinite(defPct) ? defPct : 50);
  return { score, defPct: Number.isFinite(defPct) ? defPct : null, parts };
}

/* ------------------------------------------------------------------ */
/* Clans                                                               */
/* ------------------------------------------------------------------ */

export interface ClanSummary {
  clan: string;
  teams: number;
  avgWar: number;
  bestOrg: string;
  bestWar: number;
}

export function clanSummaries(profiles: TeamProfile[]): {
  clans: ClanSummary[];
  clanAvgWar: number;
  soloAvgWar: number;
  clanTeams: number;
  soloTeams: number;
} {
  const clanTeams = profiles.filter((p) => p.clan);
  const soloTeams = profiles.filter((p) => !p.clan);
  const byClan = new Map<string, TeamProfile[]>();
  for (const p of clanTeams) {
    const list = byClan.get(p.clan!);
    if (list) list.push(p);
    else byClan.set(p.clan!, [p]);
  }
  const clans: ClanSummary[] = [...byClan.entries()]
    .map(([clan, rows]) => {
      const best = rows.reduce((a, b) => (a.war >= b.war ? a : b));
      return {
        clan,
        teams: rows.length,
        avgWar: rows.reduce((s, r) => s + r.war, 0) / rows.length,
        bestOrg: best.org,
        bestWar: best.war,
      };
    })
    .sort((a, b) => b.avgWar - a.avgWar);
  const avg = (rows: TeamProfile[]) =>
    rows.length ? rows.reduce((s, r) => s + r.war, 0) / rows.length : 0;
  return {
    clans,
    clanAvgWar: avg(clanTeams),
    soloAvgWar: avg(soloTeams),
    clanTeams: clanTeams.length,
    soloTeams: soloTeams.length,
  };
}
