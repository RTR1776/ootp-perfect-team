/// <reference lib="webworker" />
/**
 * Deep search for /build, off the main thread.
 *
 * The page's quick Optimise prunes every slot to its 120 best candidates and
 * stops after ~30 s so the tab stays responsive. Deep search runs the same
 * optimiser from more starts and, from each, under two settings — the quick
 * search's own (120 per slot) and a wider one (300 per slot, more pair
 * candidates and passes) — keeping the best.
 *
 * Wider is not simply better: the climb is steepest-ascent, so a different
 * candidate list takes a different path. On Saturday Bronze Cap (2026-09-26)
 * the full pool alone stopped at −21.8 and 300-per-slot at −21.1, where the
 * quick setting reached −19.5 from the same start. Running both settings from
 * a superset of the quick search's starts means deep can never do worse than
 * Optimise. The best board is posted after every climb so the page shows
 * progress and Stop keeps the best so far.
 *
 * Everything arrives as plain data (Maps as entry arrays) and the objective
 * is rebuilt here — functions cannot cross postMessage.
 */
import { optimizeRoster } from "./roster-optimize";
import { rosterObjective } from "./roster-objective";
import { LJ_FLOOR } from "./pos-floor";
import type { FillCard, FillResult, FillShape } from "./roster-fill";
import type { RosterRules } from "./roster-rules";

export interface DeepRequest {
  starts: { label: string; slots: FillResult }[];
  pool: FillCard[];
  rules: RosterRules;
  shape: FillShape;
  runsR: [number, number][];
  runsL: [number, number][];
  lhpShare: number;
  locks: number[];
  minCatchers: number;
}
export interface DeepBest { slots: FillResult; score: number; moves: number; from: string }
export interface DeepMessage { type: "progress" | "done"; done: number; total: number; best: DeepBest | null }

const SETTINGS = [
  { candidateLimit: 120, aTop: 8, bCheapest: 10, maxPasses: 40, tag: "" },
  { candidateLimit: 300, aTop: 10, bCheapest: 12, maxPasses: 80, tag: ", wide" },
];

self.onmessage = (e: MessageEvent<DeepRequest>) => {
  const d = e.data;
  const locks = new Set(d.locks);
  const obj = rosterObjective(d.pool, {
    shape: d.shape, runsR: new Map(d.runsR), runsL: new Map(d.runsL), lhpShare: d.lhpShare,
    mustIds: locks.size ? locks : undefined,
  });
  const total = d.starts.length * SETTINGS.length;
  let best: DeepBest | null = null;
  let done = 0;
  for (const st of d.starts) {
    for (const cfg of SETTINGS) {
      const r = optimizeRoster(st.slots, d.pool, d.rules, d.shape, {
        objective: obj.objective, slotValue: obj.slotValue, minDefShare: 0.6, posFloor: LJ_FLOOR,
        pairMoves: { aTop: cfg.aTop, bCheapest: cfg.bCheapest, rank: obj.rank }, maxPasses: cfg.maxPasses,
        candidateLimit: cfg.candidateLimit, keep: locks, minCatchers: d.minCatchers,
      });
      if (r.legal && (!best || r.score > best.score + 1e-9)) best = { slots: r.slots, score: r.score, moves: r.moves, from: st.label + cfg.tag };
      done++;
      const msg: DeepMessage = { type: done === total ? "done" : "progress", done, total, best };
      postMessage(msg);
    }
  }
  if (total === 0) postMessage({ type: "done", done: 0, total: 0, best: null } satisfies DeepMessage);
};
