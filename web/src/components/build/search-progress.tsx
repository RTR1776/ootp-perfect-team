"use client";

/**
 * The thin bar in /build's roster header while Optimise or Search longer runs
 * ("Optimise: start 3 of 6 (λ 2) · best so far +359.5 runs").
 *
 * Progress lives in a small store of its own, so an update from the search
 * redraws this bar and nothing else: redrawing the whole builder (a 400-row
 * pool table) on every climb is the kind of main-thread work the worker is
 * there to avoid.
 */
import { useSyncExternalStore } from "react";
import { signed } from "@/lib/format";

export interface SearchProgress {
  mode: "quick" | "deep";
  /** Climbs finished, and how many there are (0 while the starts are being built). */
  done: number;
  total: number;
  /** The climb running now, e.g. "λ 2". */
  current: string | null;
  /** The best board so far, in runs. */
  best: number | null;
}

let progress: SearchProgress | null = null;
const listeners = new Set<() => void>();

export function setSearchProgress(p: SearchProgress | null) {
  progress = p;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function SearchProgressBar() {
  const p = useSyncExternalStore(subscribe, () => progress, () => null);
  if (!p) return null;
  const name = p.mode === "quick" ? "Optimise" : "Search longer";
  const step = p.mode === "quick" ? "start" : "climb";
  const text = p.total === 0
    ? `${name}: building the starting boards…`
    : `${name}: ${step} ${Math.min(p.done + 1, p.total)} of ${p.total}${p.current ? ` (${p.current})` : ""}${p.best != null ? ` · best so far ${signed(p.best)} runs` : ""}`;
  return (
    <div className="mb-2">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${name} progress`}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, p.total)}
        aria-valuenow={p.done}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${p.total ? Math.max(3, (100 * p.done) / p.total) : 3}%` }}
        />
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground" title={text}>{text}</p>
    </div>
  );
}
