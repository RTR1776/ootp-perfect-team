"use client";

// Live draft assistant core (PLAN.md Day 4). Encodes the PD strategy guides:
//   - tiers over ranks (gap clustering per position bucket)
//   - replacement level (value over what's realistically available later)
//   - quota depletion / urgency (unfilled roster needs vs picks remaining)
//   - defense as the within-tier tiebreaker
// The board is computed client-side from projections.json + the selected
// context (era-as-park composition), so it's always in sync with the data.

import { create } from "zustand";
import type { Card, Position } from "./types";
import { isPitcher } from "./types";
import { hitterRunValue, pitcherRunValue } from "./optimizer";
import type { Park } from "./parks";

// Position buckets for quotas/scarcity. DH-capable bats fold into their best
// defensive bucket; pure bats bucket as DH.
export type Bucket =
  | "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "DH" | "SP" | "RP";

export const BUCKETS: Bucket[] = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "SP", "RP"];

/** Default 26-man PD roster quotas (editable in the UI; LJ can tune per type). */
export const DEFAULT_QUOTAS: Record<Bucket, number> = {
  C: 2, "1B": 2, "2B": 2, "3B": 2, SS: 2, LF: 2, CF: 2, RF: 2, DH: 1,
  SP: 4, RP: 5, // sums to 26 with the position players
};

export interface BoardEntry {
  card: Card;
  bucket: Bucket;
  /** Context-adjusted runs above average per game (evidence-blended). */
  value: number;
  /** 1 = top tier within the bucket. */
  tier: number;
  defRuns: number;
}

export function bucketOf(card: Card): Bucket {
  if (card.pos === "SP") return "SP";
  if (card.pos === "RP" || card.pos === "CL") return "RP";
  const best = card.defense?.positions[0]?.pos;
  if (best && best !== "DH") return best as Bucket;
  return (card.pos as Bucket) ?? "DH";
}

/** Card value in context: platoon-averaged runs/game at its best bucket. */
function cardValue(card: Card, park: Park): { value: number; defRuns: number; bucket: Bucket } {
  const bucket = bucketOf(card);
  if (isPitcher(card)) {
    const v = (pitcherRunValue(card, "L", park) + pitcherRunValue(card, "R", park)) / 2;
    return { value: v, defRuns: 0, bucket };
  }
  const pos: Position = bucket === "DH" ? "DH" : bucket;
  const vL = hitterRunValue(card, pos, "L", park)?.runValue ?? -9;
  const vR = hitterRunValue(card, pos, "R", park)?.runValue ?? -9;
  const defRuns = card.defense?.positions.find((p) => p.pos === pos)?.def_runs_per_162 ?? 0;
  return { value: 0.28 * vL + 0.72 * vR, defRuns: defRuns / 162, bucket };
}

/** Assign tiers within a sorted (desc) value list via gap clustering. */
function assignTiers(values: number[]): number[] {
  if (values.length < 3) return values.map(() => 1);
  const gaps = values.slice(0, -1).map((v, i) => v - values[i + 1]);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)] || 0.001;
  const threshold = Math.max(1.5 * median, 0.02);
  const tiers: number[] = [1];
  for (let i = 1; i < values.length; i++) {
    tiers.push(tiers[i - 1] + (gaps[i - 1] > threshold ? 1 : 0));
  }
  return tiers;
}

export interface Board {
  entries: Map<number, BoardEntry>; // by cid
  byBucket: Map<Bucket, BoardEntry[]>; // sorted desc by value
}

export function buildBoard(cards: Card[], park: Park): Board {
  const entries = new Map<number, BoardEntry>();
  const byBucket = new Map<Bucket, BoardEntry[]>();
  for (const card of cards) {
    if (!card.cid || (!card.hitter_overall && !card.pitcher_overall)) continue;
    const { value, defRuns, bucket } = cardValue(card, park);
    const e: BoardEntry = { card, bucket, value, tier: 99, defRuns };
    entries.set(card.cid, e);
    (byBucket.get(bucket) ?? byBucket.set(bucket, []).get(bucket)!).push(e);
  }
  for (const [, list] of byBucket) {
    list.sort((a, b) => b.value - a.value);
    const tiers = assignTiers(list.map((e) => e.value));
    list.forEach((e, i) => (e.tier = tiers[i]));
  }
  return { entries, byBucket };
}

// ---------------------------------------------------------------------------
// Scoring a pack against the current draft state
// ---------------------------------------------------------------------------

export interface DraftWeights {
  urgencyBonus: number;      // runs/game bonus when the bucket is at quota risk
  defenseTiebreak: number;   // weight on defense within a tier
  replacementDepth: number;  // "later supply" percentile depth per remaining need
}

/** All tunables in one place, per PLAN.md. */
export const DRAFT_WEIGHTS: DraftWeights = {
  urgencyBonus: 0.06,
  defenseTiebreak: 0.5,
  replacementDepth: 8,
};

export interface PackVerdict {
  entry: BoardEntry;
  score: number;
  varRuns: number;      // value above replacement at its bucket
  urgency: "high" | "med" | "low";
  tierLabel: string;    // e.g. "Tier 1 of 4 at SS"
  note: string;
}

export interface DraftState {
  quotas: Record<Bucket, number>;
  picks: number[]; // cids in pick order
}

export function needsOf(state: DraftState, board: Board): Record<Bucket, number> {
  const filled: Record<string, number> = {};
  for (const cid of state.picks) {
    const b = board.entries.get(cid)?.bucket;
    if (b) filled[b] = (filled[b] ?? 0) + 1;
  }
  const needs = {} as Record<Bucket, number>;
  for (const b of BUCKETS) needs[b] = Math.max(0, (state.quotas[b] ?? 0) - (filled[b] ?? 0));
  return needs;
}

/**
 * Replacement level for a bucket: the value of the entry you'd realistically
 * still get later — the (depth × remaining-need)-th best AVAILABLE card there.
 */
function replacementValue(
  bucket: Bucket, board: Board, taken: Set<number>, need: number,
): number {
  const avail = (board.byBucket.get(bucket) ?? []).filter((e) => !taken.has(e.card.cid));
  if (!avail.length) return 0;
  const idx = Math.min(avail.length - 1, Math.max(1, DRAFT_WEIGHTS.replacementDepth * Math.max(1, need)));
  return avail[idx].value;
}

export function scorePack(
  packCids: number[], state: DraftState, board: Board, picksRemaining: number,
): PackVerdict[] {
  const taken = new Set(state.picks);
  const needs = needsOf(state, board);
  const totalNeed = Object.values(needs).reduce((s, n) => s + n, 0);

  const verdicts: PackVerdict[] = packCids
    .map((cid) => board.entries.get(cid))
    .filter((e): e is BoardEntry => !!e)
    .map((e) => {
      const need = needs[e.bucket];
      const repl = replacementValue(e.bucket, board, taken, need);
      const varRuns = e.value - repl;

      // Urgency: how tight is this bucket vs remaining picks? If unfilled needs
      // roughly equal remaining picks, every off-need pick risks a hole.
      const slack = picksRemaining - totalNeed;
      let urgency: PackVerdict["urgency"] = "low";
      if (need > 0 && slack <= 1) urgency = "high";
      else if (need > 0 && slack <= 4) urgency = "med";
      const urgencyScore =
        need > 0 ? (urgency === "high" ? 2 : urgency === "med" ? 1 : 0.5) * DRAFT_WEIGHTS.urgencyBonus : -DRAFT_WEIGHTS.urgencyBonus;

      const bucketList = board.byBucket.get(e.bucket) ?? [];
      const maxTier = bucketList[bucketList.length - 1]?.tier ?? 1;
      const score = varRuns + urgencyScore + e.defRuns * DRAFT_WEIGHTS.defenseTiebreak;
      const note =
        need === 0
          ? `quota filled at ${e.bucket}`
          : `${e.bucket} ${state.quotas[e.bucket] - need}/${state.quotas[e.bucket]}`;
      return {
        entry: e,
        score,
        varRuns,
        urgency,
        tierLabel: `Tier ${e.tier} of ${maxTier} at ${e.bucket}`,
        note,
      };
    });
  return verdicts.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Draft session store (survives refresh via localStorage)
// ---------------------------------------------------------------------------

const LS = "pt.draft.v1";

interface DraftSession extends DraftState {
  totalPicks: number;
  clockSeconds: number;
  startedAt: number | null; // epoch ms
  pack: number[]; // cids currently offered
  setQuota: (b: Bucket, n: number) => void;
  addToPack: (cid: number) => void;
  removeFromPack: (cid: number) => void;
  clearPack: () => void;
  draftCard: (cid: number) => void;
  undoPick: () => void;
  startClock: () => void;
  reset: () => void;
}

function persist(s: Pick<DraftSession, "quotas" | "picks" | "totalPicks" | "clockSeconds" | "startedAt" | "pack">) {
  if (typeof window !== "undefined") window.localStorage.setItem(LS, JSON.stringify(s));
}

function restore(): Partial<DraftSession> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LS) ?? "{}");
  } catch {
    return {};
  }
}

export const useDraftStore = create<DraftSession>((set, get) => {
  const saved = restore();
  const snap = () => {
    const { quotas, picks, totalPicks, clockSeconds, startedAt, pack } = get();
    persist({ quotas, picks, totalPicks, clockSeconds, startedAt, pack });
  };
  return {
    quotas: saved.quotas ?? { ...DEFAULT_QUOTAS },
    picks: saved.picks ?? [],
    totalPicks: saved.totalPicks ?? 26,
    clockSeconds: saved.clockSeconds ?? 900,
    startedAt: saved.startedAt ?? null,
    pack: saved.pack ?? [],
    setQuota: (b, n) => {
      set((s) => ({ quotas: { ...s.quotas, [b]: Math.max(0, n) } }));
      snap();
    },
    addToPack: (cid) => {
      set((s) => (s.pack.includes(cid) || s.pack.length >= 8 ? s : { pack: [...s.pack, cid] }));
      snap();
    },
    removeFromPack: (cid) => {
      set((s) => ({ pack: s.pack.filter((c) => c !== cid) }));
      snap();
    },
    clearPack: () => {
      set({ pack: [] });
      snap();
    },
    draftCard: (cid) => {
      set((s) => ({ picks: [...s.picks, cid], pack: [] }));
      snap();
    },
    undoPick: () => {
      set((s) => ({ picks: s.picks.slice(0, -1) }));
      snap();
    },
    startClock: () => {
      set({ startedAt: Date.now() });
      snap();
    },
    reset: () => {
      set({ picks: [], pack: [], startedAt: null, quotas: { ...DEFAULT_QUOTAS } });
      snap();
    },
  };
});
