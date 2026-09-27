"use client";

/**
 * The lineups and the staff follow every edit, with no Score button (UI plan
 * C1). A click (lock, remove, a select) asks at once; typing waits 350 ms;
 * each request aborts the one before. Outcomes are kept per request, so an
 * undo shows its result at once without asking again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Family } from "@/lib/league-card-state";

export interface LineupSlot { slot: string; id: number; label: string; runs: number; /** Null for the modelled card. */ entry: string | null }
export interface Lineup { lineup: LineupSlot[]; total: number }

/** One staff slot (lib/league-arms StaffSlot): edge per 9 in that role, and runs a season. */
export interface StaffSlot { slot: string; entry: string; label: string; role: "SP" | "RP"; edge9: number; runs: number }
export interface Staff {
  rotation: StaffSlot[];
  bullpen: StaffSlot[];
  /** Arms past the staff's size: they don't pitch. */
  out: Array<{ entry: string; label: string }>;
  total: number;
}
/** An arm's scores per role and per side, and where each role's score comes from. */
export interface ArmRow {
  entry: string; label: string; cardId: number;
  /** Edge per 9 as a starter / reliever. */
  sp: number | null; rp: number | null;
  /** "league": 150+ league innings in that role; "estimate": mostly the ratings. */
  spSource: "league" | "estimate"; rpSource: "league" | "estimate";
  /** League innings behind each role's score (the base card's and its variant's), and those in the team's league family. */
  spIp: number; rpIp: number;
  spIpFamily: number; rpIpFamily: number;
  stamina: number | null;
  /** League edge per 9 against left- and right-handed batters; null with no league line. */
  vL: number | null; vR: number | null;
}

export interface ScoreResult {
  family: Family; year: number; lhp: number; rpw: number; defScale: number; park: string | null;
  /** With a park: the same locks' best nine in a neutral park. */
  neutral: Record<Board, number | null> | null;
  pool: Array<{ entry: string; label: string; vR: number | null; vL: number | null }>;
  now: Record<Board, Lineup | null>;
  candidate: { cardId: number; label: string; title: string; vR: number | null; vL: number | null } | null;
  with: Record<Board, Lineup | null> | null;
  add: { dR: number; dL: number; season: number; wins: number; dhOnly: number } | null;
  /** The pitching staff; null with no arms on the list. */
  staff: (Staff & { ipPerSlot: { sp: number; rp: number }; week: string | null; source: string; entries: string[] }) | null;
  armPool: ArmRow[];
  /** The modelled card when it's a pitcher. */
  candidateArm: ArmRow | null;
  /** What he adds on the same number of pitching spots: his slot, who leaves the rotation, who sits, and the staff with him. */
  armAdd: { season: number; wins: number; slot: StaffSlot | null; replaces: string[]; sits: string[]; staff: Staff; role: "SP" | "RP" | null } | null;
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
    /** What's on screen isn't for these inputs: still coming, not asked for (skipped), or failed. */
    stale: current?.result == null && seen.last != null,
    error: current?.error ?? null,
    hurry, retry,
  };
}
