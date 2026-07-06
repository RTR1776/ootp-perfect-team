"use client";

import { create } from "zustand";
import {
  type Card,
  type ProjectionsFile,
  type Tier,
  type Position,
  isPitcher,
  cardWAR,
} from "./types";
import { setRunEnv } from "./optimizer";

// ---------------------------------------------------------------------------
// Module-boundary data access: fetch the static JSON exactly once and cache it.
// ---------------------------------------------------------------------------

let cache: ProjectionsFile | null = null;
let inflight: Promise<ProjectionsFile> | null = null;

export async function loadProjections(): Promise<ProjectionsFile> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/projections.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load projections: ${r.status}`);
      return r.json() as Promise<ProjectionsFile>;
    })
    .then((data) => {
      cache = data;
      inflight = null;
      setRunEnv(data.pt_env); // keep the optimizer's league frame in sync
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function getCachedCard(cid: number): Card | undefined {
  return cache?.cards.find((c) => c.cid === cid);
}

// ---------------------------------------------------------------------------
// Store: loaded cards + filter state + derived results.
// ---------------------------------------------------------------------------

export type Mode = "hitters" | "pitchers";

export interface Filters {
  search: string;
  tiers: Set<Tier>;
  positions: Set<Position>;
  bats: "any" | "L" | "R" | "S";
  throws: "any" | "L" | "R";
  minWOBA: number;
  minWAR: number;
}

interface DataState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  cards: Card[];
  mode: Mode;
  filters: Filters;

  load: () => Promise<void>;
  setMode: (m: Mode) => void;
  setSearch: (s: string) => void;
  toggleTier: (t: Tier) => void;
  togglePosition: (p: Position) => void;
  setBats: (b: Filters["bats"]) => void;
  setThrows: (t: Filters["throws"]) => void;
  setMinWOBA: (n: number) => void;
  setMinWAR: (n: number) => void;
  resetFilters: () => void;
}

const initialFilters = (): Filters => ({
  search: "",
  tiers: new Set<Tier>(),
  positions: new Set<Position>(),
  bats: "any",
  throws: "any",
  minWOBA: 0,
  minWAR: 0,
});

export const useDataStore = create<DataState>((set, get) => ({
  status: "idle",
  error: null,
  cards: [],
  mode: "hitters",
  filters: initialFilters(),

  load: async () => {
    const s = get();
    if (s.status === "loading" || s.status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const data = await loadProjections();
      set({ status: "ready", cards: data.cards });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "Unknown error" });
    }
  },

  setMode: (mode) => set({ mode }),
  setSearch: (search) => set((s) => ({ filters: { ...s.filters, search } })),
  toggleTier: (t) =>
    set((s) => {
      const tiers = new Set(s.filters.tiers);
      if (tiers.has(t)) tiers.delete(t);
      else tiers.add(t);
      return { filters: { ...s.filters, tiers } };
    }),
  togglePosition: (p) =>
    set((s) => {
      const positions = new Set(s.filters.positions);
      if (positions.has(p)) positions.delete(p);
      else positions.add(p);
      return { filters: { ...s.filters, positions } };
    }),
  setBats: (bats) => set((s) => ({ filters: { ...s.filters, bats } })),
  setThrows: (throws) => set((s) => ({ filters: { ...s.filters, throws } })),
  setMinWOBA: (minWOBA) => set((s) => ({ filters: { ...s.filters, minWOBA } })),
  setMinWAR: (minWAR) => set((s) => ({ filters: { ...s.filters, minWAR } })),
  resetFilters: () => set({ filters: initialFilters() }),
}));

// ---------------------------------------------------------------------------
// Derived selectors (pure functions over store state).
// ---------------------------------------------------------------------------

export function filterCards(cards: Card[], mode: Mode, f: Filters): Card[] {
  const q = f.search.trim().toLowerCase();
  return cards.filter((c) => {
    const pitcher = isPitcher(c);
    if (mode === "pitchers" ? !pitcher : pitcher) return false;

    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (f.tiers.size && !f.tiers.has(c.tier)) return false;
    if (f.positions.size && !f.positions.has(c.pos)) return false;
    if (f.bats !== "any" && c.bats !== f.bats) return false;
    if (f.throws !== "any" && c.throws !== f.throws) return false;

    if (f.minWAR > 0 && cardWAR(c) < f.minWAR) return false;

    // minWOBA gates hitters by overall wOBA (pitchers ignore it).
    if (f.minWOBA > 0 && mode === "hitters") {
      if ((c.hitter_overall?.wOBA ?? -Infinity) < f.minWOBA) return false;
    }
    return true;
  });
}
