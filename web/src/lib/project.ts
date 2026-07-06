"use client";

// TypeScript port of engine/projections2.py (the v2 empirical-curve engine)
// plus defense/baserun from engine/projections.py. Powers the Card Lab: paste
// rows from any OOTP export and get the same projection the Python engine
// would produce (parity is self-checked against projections.json when the
// pasted card's CID already exists there).

import type { Card, HitterSplit, PitcherSplit, Position } from "./types";

// ---------------------------------------------------------------------------
// Curves (fitted by engine/curves.py, served at /data/curves.json)
// ---------------------------------------------------------------------------

interface CurveFit {
  alpha: number;
  beta: number;
  env_rate: number;
  rating: string;
}
interface CurvesFile {
  hit: Record<string, CurveFit | number> & { xbh_3b_share: number; hbp_rate_env: number };
  pit: Record<string, CurveFit | number> & { hbp_rate_env: number };
}

let curvesCache: CurvesFile | null = null;

export async function loadCurves(): Promise<CurvesFile> {
  if (curvesCache) return curvesCache;
  const r = await fetch("/data/curves.json");
  if (!r.ok) throw new Error(`Failed to load curves: ${r.status}`);
  curvesCache = (await r.json()) as CurvesFile;
  return curvesCache;
}

const WOBA_W = { BB: 0.69, HBP: 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, HR: 2.1 };
const FIP_C = 3.1;
const PA_VS_L = 0.28;
const PA_VS_R = 0.72;
const PIT_VS_L = 0.45;
const PIT_VS_R = 0.55;

function rate(c: CurvesFile, kind: "hit" | "pit", comp: string, rating: number | null): number | null {
  const f = c[kind][comp] as CurveFit | undefined;
  if (!f || typeof f === "number" || rating === null || rating <= 0) return null;
  return f.env_rate * Math.pow(rating / 50, f.beta) * Math.exp(f.alpha);
}

const env = (c: CurvesFile, kind: "hit" | "pit", comp: string): number =>
  (c[kind][comp] as CurveFit).env_rate;

// ---------------------------------------------------------------------------
// Split projections (faithful ports of projections2.py)
// ---------------------------------------------------------------------------

export interface HitterRatings {
  ba: number | null;
  gap: number | null;
  pow: number | null;
  eye: number | null;
  k: number | null;
  spe: number | null;
}

export function projectHitterSplit(c: CurvesFile, r: HitterRatings): HitterSplit | null {
  if ([r.ba, r.gap, r.pow, r.eye, r.k].every((v) => v === null)) return null;
  const h = c.hit;
  const kRate = Math.min(0.55, rate(c, "hit", "k", r.k) ?? env(c, "hit", "k"));
  const bbRate = Math.min(0.3, rate(c, "hit", "bb", r.eye) ?? env(c, "hit", "bb"));
  const hbpRate = h.hbp_rate_env;
  const bipShare = Math.max(0.3, 1 - kRate - bbRate - hbpRate);

  const hrBip = Math.min(0.18, rate(c, "hit", "hr", r.pow) ?? env(c, "hit", "hr"));
  const xbhBip = Math.min(0.22, rate(c, "hit", "xbh", r.gap) ?? env(c, "hit", "xbh"));
  const babip = Math.min(0.42, Math.max(0.2, rate(c, "hit", "babip", r.ba) ?? env(c, "hit", "babip")));

  const hrRate = bipShare * hrBip;
  const hitsInPlay = bipShare * (1 - hrBip) * babip;
  const xbhRate = Math.min(hitsInPlay * 0.9, bipShare * xbhBip);
  const spe = r.spe ?? 50;
  const s3 = h.xbh_3b_share * (spe >= 90 ? 1.4 : spe < 40 ? 0.6 : 1.0);
  const trRate = xbhRate * s3;
  const dbRate = xbhRate - trRate;
  const b1Rate = Math.max(0, hitsInPlay - xbhRate);

  const abRate = 1 - bbRate - hbpRate - 0.005;
  const hitsRate = b1Rate + dbRate + trRate + hrRate;
  const ba = abRate > 0 ? hitsRate / abRate : 0;
  const obp = hitsRate + bbRate + hbpRate;
  const slg = abRate > 0 ? (b1Rate + 2 * dbRate + 3 * trRate + 4 * hrRate) / abRate : 0;
  const woba =
    WOBA_W.BB * bbRate + WOBA_W.HBP * hbpRate + WOBA_W["1B"] * b1Rate +
    WOBA_W["2B"] * dbRate + WOBA_W["3B"] * trRate + WOBA_W.HR * hrRate;

  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    BA: r3(ba), OBP: r3(obp), SLG: r3(slg), OPS: r3(obp + slg), ISO: r3(slg - ba),
    wOBA: r3(woba), "K%": r3(kRate), "BB%": r3(bbRate), HR_rate: r3(hrRate), BABIP: r3(babip),
  };
}

export interface PitcherRatings {
  stu: number | null;
  con: number | null;
  pbabip: number | null;
  hra: number | null;
}

export function projectPitcherSplit(c: CurvesFile, r: PitcherRatings): PitcherSplit | null {
  if (r.stu === null && r.con === null) return null;
  const p = c.pit;
  const kRate = Math.min(0.5, rate(c, "pit", "k", r.stu) ?? env(c, "pit", "k"));
  const bbRate = Math.min(0.2, Math.max(0.02, rate(c, "pit", "bb", r.con) ?? env(c, "pit", "bb")));
  const hbpRate = p.hbp_rate_env;
  const bipShare = Math.max(0.3, 1 - kRate - bbRate - hbpRate);
  const hrBip = Math.min(0.15, rate(c, "pit", "hr", r.hra) ?? env(c, "pit", "hr"));
  const babip = Math.min(0.4, Math.max(0.2, rate(c, "pit", "babip", r.pbabip) ?? env(c, "pit", "babip")));

  const hrRate = bipShare * hrBip;
  const hitsInPlay = bipShare * (1 - hrBip) * babip;
  const hitsRate = hitsInPlay + hrRate;
  const ipPerPa = Math.max(0.05, (1 - hitsRate - bbRate - hbpRate) / 3);
  const per9 = 9 / ipPerPa;
  const k9 = kRate * per9, bb9 = bbRate * per9, hr9 = hrRate * per9, hbp9 = hbpRate * per9;
  const fip = (13 * hr9 + 3 * (bb9 + hbp9) - 2 * k9) / 9 + FIP_C;
  const wobaAgainst =
    WOBA_W.BB * bbRate + WOBA_W.HBP * hbpRate + WOBA_W["1B"] * hitsInPlay * 0.8 +
    WOBA_W["2B"] * hitsInPlay * 0.17 + WOBA_W["3B"] * hitsInPlay * 0.03 + WOBA_W.HR * hrRate;

  const r2 = (x: number) => Math.round(x * 100) / 100;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    FIP: r2(Math.max(0.5, Math.min(12, fip))),
    "K/9": r2(k9), "BB/9": r2(bb9), "HR/9": r2(hr9),
    BABIP_against: r3(babip), wOBA_against: r3(wobaAgainst),
  };
}

// ---------------------------------------------------------------------------
// Defense + baserun (ports of engine/projections.py)
// ---------------------------------------------------------------------------

const POS_FIELDING: Record<string, [string, string, string]> = {
  C: ["C ABI", "C FRM", "C ARM"],
  "1B": ["IF RNG", "IF ERR", "IF ARM"],
  "2B": ["IF RNG", "IF ERR", "IF ARM"],
  "3B": ["IF RNG", "IF ERR", "IF ARM"],
  SS: ["IF RNG", "IF ERR", "IF ARM"],
  LF: ["OF RNG", "OF ERR", "OF ARM"],
  CF: ["OF RNG", "OF ERR", "OF ARM"],
  RF: ["OF RNG", "OF ERR", "OF ARM"],
};
const POSITIONAL_ADJ: Record<string, number> = {
  C: 12.5, SS: 7.5, "2B": 2.5, CF: 2.5, "3B": 2.5,
  RF: -7.5, LF: -7.5, "1B": -12.5, DH: -17.5,
};

export function projectDefense(get: (col: string) => number | null, listedPos: Position) {
  const positions: Card["defense"] extends { positions: infer P } | undefined ? P : never = [] as never;
  const out: NonNullable<Card["defense"]>["positions"] = [];
  for (const pos of Object.keys(POS_FIELDING) as Position[]) {
    let ratingAtPos = get(pos);
    // 43-col collection exports lack per-position ratings — grant the card's
    // listed position at a neutral 50 so eligibility survives.
    if ((ratingAtPos === null || ratingAtPos <= 0) && pos === listedPos) ratingAtPos = 50;
    if (ratingAtPos === null || ratingAtPos <= 0) continue;
    const [rngC, errC, armC] = POS_FIELDING[pos];
    const rng = get(rngC) ?? 50, err = get(errC) ?? 50, arm = get(armC) ?? 50;
    let runs: number;
    if (pos === "C") {
      const frm = get("C FRM") ?? 50, armCth = get("C ARM") ?? 50, abi = get("C ABI") ?? 50;
      runs = 0.4 * (frm - 100) + 0.1 * (armCth - 100) + 0.05 * (abi - 100);
    } else if (pos === "LF" || pos === "CF" || pos === "RF") {
      runs = 0.2 * (rng - 100) + 0.05 * -(err - 100) + 0.08 * (arm - 100);
      if (pos === "CF") runs *= 1.15;
    } else {
      const tdp = get("TDP") ?? 50;
      runs = 0.18 * (rng - 100) + 0.05 * -(err - 100) + 0.06 * (arm - 100) + 0.04 * (tdp - 100);
    }
    out.push({
      pos,
      position_rating: ratingAtPos,
      def_runs_per_162: Math.round(runs * 10) / 10,
      with_position_adj: Math.round((runs + (POSITIONAL_ADJ[pos] ?? 0)) * 10) / 10,
    });
  }
  out.sort((a, b) => b.with_position_adj - a.with_position_adj);
  void positions;
  return { positions: out };
}

// ---------------------------------------------------------------------------
// Env-level values (match projections2.overall_card_value)
// ---------------------------------------------------------------------------

function envWoba(c: CurvesFile): number {
  const h = c.hit;
  const k = env(c, "hit", "k"), bb = env(c, "hit", "bb"), hbp = h.hbp_rate_env;
  const bip = 1 - k - bb - hbp;
  const hrB = env(c, "hit", "hr");
  const hr = bip * hrB;
  const hip = bip * (1 - hrB) * env(c, "hit", "babip");
  const xbh = Math.min(bip * env(c, "hit", "xbh"), hip * 0.9);
  const b3 = xbh * h.xbh_3b_share, b2 = xbh - b3, b1 = hip - xbh;
  return WOBA_W.BB * bb + WOBA_W.HBP * hbp + WOBA_W["1B"] * b1 + WOBA_W["2B"] * b2 + WOBA_W["3B"] * b3 + WOBA_W.HR * hr;
}

function envFip(c: CurvesFile): number {
  const p = c.pit;
  const k = env(c, "pit", "k"), bb = env(c, "pit", "bb"), hbp = p.hbp_rate_env;
  const bip = 1 - k - bb - hbp;
  const hrB = env(c, "pit", "hr");
  const hr = bip * hrB;
  const hip = bip * (1 - hrB) * env(c, "pit", "babip");
  const ipPerPa = Math.max(0.05, (1 - hip - hr - bb - hbp) / 3);
  const per9 = 9 / ipPerPa;
  return (13 * hr * per9 + 3 * (bb + hbp) * per9 - 2 * k * per9) / 9 + FIP_C;
}

// ---------------------------------------------------------------------------
// Paste parsing: header + rows, comma or tab separated, quote-aware.
// Accepts the 184-col stats export, the 64-col ratings CSV, or the 43-col
// collection export (auto-detected via which columns exist).
// ---------------------------------------------------------------------------

function parseLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedRow {
  fields: Record<string, string>;
  format: "stats-export" | "ratings-csv" | "collection";
}

export function parsePaste(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("Paste the header line plus at least one card row.");
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const header = parseLine(lines[0], sep);
  if (!header.includes("Name") || !header.includes("POS")) {
    throw new Error("First line must be the export's header row (needs Name and POS columns).");
  }
  const format: ParsedRow["format"] = header.includes("Tier")
    ? "stats-export"
    : header.includes("CTier")
      ? "ratings-csv"
      : "collection";
  return lines.slice(1).map((l) => {
    const vals = parseLine(l, sep);
    const fields: Record<string, string> = {};
    // Replicate pandas' dedup: later duplicate headers get _1, _2 suffixes.
    const seen: Record<string, number> = {};
    header.forEach((hRaw, i) => {
      const n = seen[hRaw] ?? 0;
      seen[hRaw] = n + 1;
      fields[n === 0 ? hRaw : `${hRaw}_${n}`] = vals[i] ?? "";
    });
    return { fields, format };
  });
}

// ---------------------------------------------------------------------------
// Project a parsed row -> Card (cid <= 0 marks a hypothetical)
// ---------------------------------------------------------------------------

const PITCHER_POS = new Set(["SP", "RP", "CL"]);

export function projectParsed(c: CurvesFile, row: ParsedRow, hypoId: number): Card {
  const f = row.fields;
  const num = (col: string): number | null => {
    const v = f[col];
    if (v === undefined || v === "" || v === "-") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pos = (f["POS"] || "DH") as Position;
  const isPit = PITCHER_POS.has(pos);
  const hand = (v: string | undefined) => (v ? v.trim().charAt(0).toUpperCase() : "R");

  const card: Card = {
    cid: num("CID") ?? hypoId,
    name: f["Name"] || "Pasted card",
    pos,
    bats: hand(f["B"]) as Card["bats"],
    throws: hand(f["T"]) as Card["throws"],
    tier: (f["Tier"] || f["CTier"] || "Diamond") as Card["tier"],
    buy: f["BUY"] || "0",
    sell: f["SELL"] || "0",
    lock: false,
    var: (f["VAR"] === "Y" ? "Y" : "N") as Card["var"],
    vlvl: num("VLvl") ?? 0,
    engine: "v2-empirical (TS)",
    value: { wRAA_per_600: 0, BsR_per_162: 0, best_def_runs_162: 0, WAR_per_600: 0 },
  };

  if (!isPit) {
    const hr = (suf: string): HitterRatings => ({
      ba: num(`BA ${suf}`), gap: num(`GAP ${suf}`), pow: num(`POW ${suf}`),
      eye: num(`EYE ${suf}`), k: num(`K ${suf}`), spe: num("SPE"),
    });
    const vL = projectHitterSplit(c, hr("vL"));
    const vR = projectHitterSplit(c, hr("vR"));
    card.hitter_vL = vL ?? undefined;
    card.hitter_vR = vR ?? undefined;
    if (vL && vR) {
      const overall = {} as HitterSplit;
      (Object.keys(vL) as (keyof HitterSplit)[]).forEach((k) => {
        overall[k] = Math.round((vL[k] * PA_VS_L + vR[k] * PA_VS_R) * 1000) / 1000;
      });
      card.hitter_overall = overall;
    }
    card.defense = projectDefense(num, pos);
    const spe = num("SPE") ?? 50, ste = num("STE") ?? 50, sr = num("SR") ?? 50, run = num("RUN") ?? 50;
    const avg = spe * 0.3 + ste * 0.2 + sr * 0.2 + run * 0.3;
    card.baserun = { SPE: spe, STE: ste, SR: sr, RUN: run, bsr_runs_per_162: Math.round((avg - 100) * 0.2 * 10) / 10 };
    if (card.hitter_overall) {
      const wraa600 = ((card.hitter_overall.wOBA - envWoba(c)) / 1.25) * 600;
      const bsr = card.baserun.bsr_runs_per_162 * (600 / 700);
      const bestDef = Math.max(0, ...card.defense.positions.map((p) => p.with_position_adj));
      card.value = {
        wRAA_per_600: Math.round(wraa600 * 10) / 10,
        BsR_per_162: Math.round(bsr * 10) / 10,
        best_def_runs_162: Math.round(bestDef * 10) / 10,
        WAR_per_600: Math.round(((wraa600 + bsr + bestDef) / 10) * 100) / 100,
      };
    }
  } else {
    // Pitcher control: 184-col + 43-col exports call it "CON vX"; the old
    // ratings CSV calls it "CON vX_1" (hitter CON occupies "CON vX" there).
    const conCol = (suf: string) =>
      row.format === "ratings-csv" ? `CON ${suf}_1` : `CON ${suf}`;
    const pr = (suf: string): PitcherRatings => ({
      stu: num(`STU ${suf}`), con: num(conCol(suf)),
      pbabip: num(`PBABIP ${suf}`), hra: num(`HRA ${suf}`),
    });
    const vL = projectPitcherSplit(c, pr("vL"));
    const vR = projectPitcherSplit(c, pr("vR"));
    card.pitcher_vL = vL ?? undefined;
    card.pitcher_vR = vR ?? undefined;
    if (vL && vR) {
      const overall = {} as PitcherSplit;
      (Object.keys(vL) as (keyof PitcherSplit)[]).forEach((k) => {
        overall[k] = Math.round((vL[k] * PIT_VS_L + vR[k] * PIT_VS_R) * 1000) / 1000;
      });
      card.pitcher_overall = overall;
    }
    card.stamina = num("STM") ?? 0;
    card.hold = num("HLD") ?? 0;
    if (card.pitcher_overall) {
      const runsAbove = (envFip(c) - Math.max(1, card.pitcher_overall.FIP)) * (180 / 9);
      card.value = {
        RAA_per_180IP: Math.round(runsAbove * 10) / 10,
        WAR_per_180IP: Math.round((runsAbove / 10) * 100) / 100,
      };
    }
  }
  return card;
}
