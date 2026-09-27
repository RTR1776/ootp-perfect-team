"use client";

/**
 * The lineups follow every edit, with no Score button (UI plan C1). A click
 * (lock, remove, a select) asks at once; typing waits 350 ms; each request
 * aborts the one before. Outcomes are kept per request, so an undo shows its
 * lineups at once without asking again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Family } from "@/lib/league-card-state";

export interface LineupSlot { slot: string; id: number; label: string; runs: number; /** Null for the modelled card. */ entry: string | null }
export interface Lineup { lineup: LineupSlot[]; total: number }
export interface ScoreResult {
  family: Family; year: number; lhp: number; rpw: number; defScale: number; park: string | null;
  /** With a park: the same locks' best nine in a neutral park. */
  neutral: Record<Board, number | null> | null;
  pool: Array<{ entry: string; label: string; vR: number | null; vL: number | null }>;
  now: Record<Board, Lineup | null>;
  candidate: { cardId: number; label: string; title: string; vR: number | null; vL: number | null } | null;
  with: Record<Board, Lineup | null> | null;
  add: { dR: number; dL: number; season: number; wins: number; dhOnly: number } | null;
  warnings: string[];
}

type Outcome = { result: ScoreResult; error?: undefined } | { error: string; result?: undefined };
const TYPING_MS = 350;
const KEEP = 40;

/** `key` is the request body (scoreRequest's key); null asks for nothing. */
export function useRescore(key: string | null) {
  const [seen, setSeen] = useState<{ byKey: Map<string, Outcome>; last: ScoreResult | null }>(() => ({ byKey: new Map(), last: null }));
  const urgent = useRef(true);
  const current = key != null ? seen.byKey.get(key) : undefined;
  const have = current != null;

  useEffect(() => {
    if (key == null || have) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      let out: Outcome;
      try {
        const r = await fetch("/api/league-card", { method: "POST", headers: { "content-type": "application/json" }, body: key, signal: ctrl.signal });
        const j = (await r.json().catch(() => ({}))) as ScoreResult & { error?: string };
        out = r.ok ? { result: j } : { error: j.error ?? `Scoring failed (HTTP ${r.status}).` };
      } catch (e) {
        if (ctrl.signal.aborted) return;
        out = { error: `Could not reach the server: ${(e as Error).message}` };
      }
      if (ctrl.signal.aborted) return;
      setSeen((s) => {
        const byKey = new Map(s.byKey).set(key, out);
        while (byKey.size > KEEP) byKey.delete(byKey.keys().next().value!);
        return { byKey, last: out.result ?? s.last };
      });
    }, urgent.current ? 0 : TYPING_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [key, have]);

  /** Whether the next change asks at once (a click, an undo) or waits for typing to stop. */
  const hurry = useCallback((now = true) => { urgent.current = now; }, []);
  const retry = useCallback(() => {
    if (key == null) return;
    urgent.current = true;
    setSeen((s) => { const byKey = new Map(s.byKey); byKey.delete(key); return { ...s, byKey }; });
  }, [key]);

  return {
    /** The lineups for these inputs, else the last ones while the new ones come. */
    result: current?.result ?? seen.last,
    pending: key != null && !have,
    error: current?.error ?? null,
    hurry, retry,
  };
}
