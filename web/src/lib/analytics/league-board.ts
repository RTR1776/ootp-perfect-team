/**
 * League board — card-level lines pooled from league season exports.
 *
 * LEAGUE DATA ONLY. Tournament exports never enter this module: leagues
 * normalise stats to the rostered talent around them, tournaments do not
 * (see ootp normalization), so the two must never be pooled.
 *
 * One league week is one full simulated season per league (2049 = the week
 * of Aug 24-30 2026). A snapshot is that week's season-to-date line, one row
 * per card per team, so "this week" = the newest snapshot of each league and
 * "all weeks" = every snapshot summed. Pooling is by card id across teams and
 * weeks: 25 copies of Mel Ott on 25 rosters become one line with 25 "teams".
 *
 * Splits are the export's own: for hitters vL = vs LHP, for pitchers vL = vs
 * LHB. Rates are computed from summed counting stats, never averaged.
 */

import { fipOf, wobaOf, type StintLike } from "./league";

export interface BoardStint extends StintLike {
  tier?: string | null;
  league: string;
  split: string;
  capturedOn: string;
}
type Row = StintLike & { tier?: string | null };

export interface HitterLine {
  key: string;
  cid: number | null;
  name: string;
  pos: string;
  val: number | null;
  tier: string | null;
  isVariant: boolean;
  cardYear: number | null;
  teams: number;
  orgs: string[];
  pa: number; ab: number; h: number; b1: number; b2: number; b3: number; hr: number;
  bb: number; ibb: number; hp: number; sf: number; k: number; sb: number; cs: number;
  wraa: number; war: number;
  avg: number; obp: number; slg: number; ops: number; woba: number;
  bbPct: number; kPct: number; hr600: number; babip: number; xbhPct: number; sb600: number;
  wraa600: number; war600: number;
  /** DEF composite (ZR summed) - informational only. */
  zr: number;
  /** wOBA shrunk toward the pool mean over one season of PA - what the "best" lists sort by. */
  wobaReg: number;
}

export interface PitcherLine {
  key: string;
  cid: number | null;
  name: string;
  pos: string;
  role: "SP" | "RP";
  val: number | null;
  tier: string | null;
  isVariant: boolean;
  cardYear: number | null;
  teams: number;
  orgs: string[];
  ip: number; bf: number; ka: number; bba: number; hpa: number; hra: number; er: number;
  war: number;
  era: number; fip: number; siera: number; kPct: number; bbPct: number; hr9: number; k9: number;
  war200: number;
  /** FIP shrunk toward the pool mean over one season of IP. */
  fipReg: number;
}

/**
 * A variant shares its CID with the base card (Cy Young 86572 is VAR=Y on one
 * roster and VAR=N on four others) but is a different card with different
 * ratings, so the variant flag is part of the line's identity.
 */
const hitKey = (s: StintLike) => `${s.cid != null ? `c${s.cid}` : `n${s.name}|${s.pos}`}${s.isVariant ? "v" : ""}`;

function mode<T>(xs: T[]): T { const m = new Map<T, number>(); let best: T = xs[0]; let n = 0; for (const x of xs) { const c = (m.get(x) ?? 0) + 1; m.set(x, c); if (c > n) { n = c; best = x; } } return best; }

/** Pool hitter stints into one line per card. Free agents are dropped: an unrostered card has no line. */
export function hitterLines(stints: Row[]): HitterLine[] {
  const groups = new Map<string, Row[]>();
  for (const s of stints) {
    if (s.isPitcher || s.isFreeAgent || s.pa <= 0) continue;
    const k = hitKey(s); (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }
  const out: HitterLine[] = [];
  for (const [key, rows] of groups) {
    const S = (k: string) => rows.reduce((a, r) => a + (r.stats[k] ?? 0), 0);
    const pa = S("PA"), ab = S("AB"), h = S("H"), b1 = S("b1"), b2 = S("b2"), b3 = S("b3"), hr = S("HR");
    const bb = S("BB"), ibb = S("IBB"), hp = S("HP"), sf = S("SF"), k = S("K"), sb = S("SB"), cs = S("CS");
    const war = rows.reduce((a, r) => a + r.war, 0), wraa = S("wRAA");
    const obpDen = ab + bb + hp + sf, tb = b1 + 2 * b2 + 3 * b3 + 4 * hr, bipDen = ab - k - hr + sf;
    const r0 = rows[0];
    const orgs = [...new Set(rows.map((r) => r.org))];
    const avg = ab > 0 ? h / ab : 0, obp = obpDen > 0 ? (h + bb + hp) / obpDen : 0, slg = ab > 0 ? tb / ab : 0;
    out.push({
      key, cid: r0.cid, name: r0.name, pos: mode(rows.map((r) => r.pos)), val: Math.max(...rows.map((r) => r.val ?? 0)) || null,
      tier: r0.tier ?? null, isVariant: r0.isVariant, cardYear: r0.cardYear, teams: orgs.length, orgs,
      pa, ab, h, b1, b2, b3, hr, bb, ibb, hp, sf, k, sb, cs, wraa, war,
      avg, obp, slg, ops: obp + slg, woba: wobaOf(rows),
      bbPct: pa > 0 ? bb / pa : 0, kPct: pa > 0 ? k / pa : 0, hr600: pa > 0 ? (600 * hr) / pa : 0,
      babip: bipDen > 0 ? (h - hr) / bipDen : 0, xbhPct: h > 0 ? (b2 + b3 + hr) / h : 0, sb600: pa > 0 ? (600 * sb) / pa : 0,
      wraa600: pa > 0 ? (600 * wraa) / pa : 0, war600: pa > 0 ? (600 * war) / pa : 0,
      zr: S("ZR"), wobaReg: 0,
    });
  }
  return out;
}

/** Pool pitcher stints into one line per card; role = SP when the card's most common listing is SP. */
export function pitcherLines(stints: Row[]): PitcherLine[] {
  const groups = new Map<string, Row[]>();
  for (const s of stints) {
    if (!s.isPitcher || s.isFreeAgent || s.ip <= 0) continue;
    const k = hitKey(s); (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }
  const out: PitcherLine[] = [];
  for (const [key, rows] of groups) {
    const S = (k: string) => rows.reduce((a, r) => a + (r.stats[k] ?? 0), 0);
    const ip = rows.reduce((a, r) => a + r.ip, 0), bf = S("BF"), ka = S("Ka"), bba = S("BBa"), hpa = S("HPa"), hra = S("HRa"), er = S("ER");
    const war = rows.reduce((a, r) => a + r.war, 0);
    const sieraW = rows.reduce((a, r) => a + (r.stats.SIERA ?? 0) * r.ip, 0);
    const r0 = rows[0]; const pos = mode(rows.map((r) => r.pos));
    const orgs = [...new Set(rows.map((r) => r.org))];
    out.push({
      key, cid: r0.cid, name: r0.name, pos, role: pos === "SP" ? "SP" : "RP", val: Math.max(...rows.map((r) => r.val ?? 0)) || null,
      tier: r0.tier ?? null, isVariant: r0.isVariant, cardYear: r0.cardYear, teams: orgs.length, orgs,
      ip, bf, ka, bba, hpa, hra, er, war,
      era: ip > 0 ? (9 * er) / ip : 0, fip: fipOf(rows), siera: ip > 0 ? sieraW / ip : 0,
      kPct: bf > 0 ? ka / bf : 0, bbPct: bf > 0 ? bba / bf : 0, hr9: ip > 0 ? (9 * hra) / ip : 0, k9: ip > 0 ? (9 * ka) / ip : 0,
      war200: ip > 0 ? (200 * war) / ip : 0, fipReg: 0,
    });
  }
  return out;
}

/**
 * Shrink every line's headline rate toward the pool's PA/IP-weighted mean,
 * with one season (600 PA / 150 IP) of prior weight: a .383 wOBA on 621 PA
 * from a single roster regresses to ~.360, while J.D. Martinez's .351 over
 * 7,540 PA on 22 rosters barely moves. That is the order the "best" lists
 * use; the raw rate is still what the table shows.
 */
export const REG = { pa: 600, ip: 150 } as const;
export function withRegression(hit: HitterLine[], pit: PitcherLine[]): { hit: HitterLine[]; pit: PitcherLine[]; meanWoba: number; meanFip: number } {
  const paT = hit.reduce((a, h) => a + h.pa, 0), ipT = pit.reduce((a, p) => a + p.ip, 0);
  const meanWoba = paT > 0 ? hit.reduce((a, h) => a + h.woba * h.pa, 0) / paT : 0.32;
  const meanFip = ipT > 0 ? pit.reduce((a, p) => a + p.fip * p.ip, 0) / ipT : 4.2;
  return {
    hit: hit.map((h) => ({ ...h, wobaReg: (h.woba * h.pa + meanWoba * REG.pa) / (h.pa + REG.pa) })),
    pit: pit.map((p) => ({ ...p, fipReg: (p.fip * p.ip + meanFip * REG.ip) / (p.ip + REG.ip) })),
    meanWoba, meanFip,
  };
}

/* ------------------------------------------------------------------ */
/* Ranks                                                               */
/* ------------------------------------------------------------------ */

/** 0-100 percentile of `value` within `pool` (higher = better unless `lowerIsBetter`). */
export function percentile(value: number, pool: number[], lowerIsBetter = false): number {
  if (!pool.length) return 50;
  let below = 0; for (const v of pool) if (lowerIsBetter ? v > value : v < value) below++;
  return Math.round((100 * below) / pool.length);
}

/** Qualifying thresholds for ONE league week (a full season). Scale by weeks when pooling. */
export const QUAL = { hitterPA: 300, splitPA: { vL: 100, vR: 200 }, spIP: 100, rpIP: 30 } as const;

export function hitterQual(split: string, weeks: number): number {
  const base = split === "vL" ? QUAL.splitPA.vL : split === "vR" ? QUAL.splitPA.vR : QUAL.hitterPA;
  return base * Math.max(1, weeks);
}
export function pitcherQual(role: "SP" | "RP", split: string, weeks: number): number {
  const base = role === "SP" ? QUAL.spIP : QUAL.rpIP;
  return (split === "all" ? base : Math.round(base / 2)) * Math.max(1, weeks);
}

/* ------------------------------------------------------------------ */
/* Meta summary — the one-pager                                        */
/* ------------------------------------------------------------------ */

export const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;

export interface MyHitter extends HitterLine {
  /** Percentile of wOBA among qualified hitters at the position. */
  posPct: number;
  posRank: number;
  posN: number;
  /** wOBA gap to the best qualified card at the position. */
  gapToBest: number;
  best: HitterLine | null;
}
export interface MyPitcher extends PitcherLine {
  posPct: number; posRank: number; posN: number; gapToBest: number; best: PitcherLine | null;
}

export interface MetaSummary {
  hitters: HitterLine[];       // qualified, sorted by wOBA desc
  bestByPos: Record<string, HitterLine[]>;  // top 3 per position
  sp: PitcherLine[];           // qualified SP by FIP asc
  rp: PitcherLine[];           // qualified RP/CL by FIP asc
  mine: { hitters: MyHitter[]; sp: MyPitcher[]; rp: MyPitcher[] };
  qual: { pa: number; spIp: number; rpIp: number };
}

/**
 * Best-of lists plus how `org`'s cards sit against them. `hit`/`pit` are the
 * pooled lines for the scope being summarised; `mineHit`/`minePit` are the
 * same card lines restricted to org's own stints (so a card's Torrent line is
 * compared, not its pooled line across 25 rosters).
 */
export function metaSummary(
  hit: HitterLine[], pit: PitcherLine[], mineHit: HitterLine[], minePit: PitcherLine[],
  split: string, weeks: number, minePaFloor = 100, mineIpFloor = { SP: 40, RP: 15 },
): MetaSummary {
  const paQ = hitterQual(split, weeks), spQ = pitcherQual("SP", split, weeks), rpQ = pitcherQual("RP", split, weeks);
  const hitters = hit.filter((h) => h.pa >= paQ).sort((a, b) => b.wobaReg - a.wobaReg);
  const bestByPos: Record<string, HitterLine[]> = {};
  for (const p of HIT_POS) bestByPos[p] = hitters.filter((h) => h.pos === p).slice(0, 3);
  const sp = pit.filter((p) => p.role === "SP" && p.ip >= spQ).sort((a, b) => a.fipReg - b.fipReg);
  const rp = pit.filter((p) => p.role === "RP" && p.ip >= rpQ).sort((a, b) => a.fipReg - b.fipReg);

  const myH: MyHitter[] = mineHit.filter((h) => h.pa >= minePaFloor).map((h) => {
    const pool = hitters.filter((x) => x.pos === h.pos);
    const vals = pool.map((x) => x.woba);
    const rank = 1 + vals.filter((v) => v > h.woba).length;
    const best = pool[0] ?? null;
    return { ...h, posPct: percentile(h.woba, vals), posRank: rank, posN: pool.length, gapToBest: best ? h.woba - best.woba : 0, best };
  }).sort((a, b) => b.pa - a.pa);
  const myP = (role: "SP" | "RP"): MyPitcher[] => minePit.filter((p) => p.role === role && p.ip >= mineIpFloor[role]).map((p) => {
    const pool = role === "SP" ? sp : rp;
    const vals = pool.map((x) => x.fip);
    const rank = 1 + vals.filter((v) => v < p.fip).length;
    const best = pool[0] ?? null;
    return { ...p, posPct: percentile(p.fip, vals, true), posRank: rank, posN: pool.length, gapToBest: best ? p.fip - best.fip : 0, best };
  }).sort((a, b) => b.ip - a.ip);
  return { hitters, bestByPos, sp, rp, mine: { hitters: myH, sp: myP("SP"), rp: myP("RP") }, qual: { pa: paQ, spIp: spQ, rpIp: rpQ } };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers shared by the page and the report                */
/* ------------------------------------------------------------------ */

export const f3 = (n: number) => (Number.isFinite(n) ? n.toFixed(3).replace(/^0/, "") : "—");
export const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
export const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");
export const pct1 = (n: number) => (Number.isFinite(n) ? (100 * n).toFixed(1) : "—");
