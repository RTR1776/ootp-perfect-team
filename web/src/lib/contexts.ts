"use client";

import { create } from "zustand";
import { NEUTRAL_PARK, type Park } from "./parks";

// ---------------------------------------------------------------------------
// Tournament/draft contexts (engine/config_build.py -> /data/contexts.json).
// Each context carries era-correct MLB run-environment baselines. We express
// an era as a pseudo-Park (component multipliers vs the modern window) so the
// existing park-adjustment machinery applies it for free; era and physical
// park compose by multiplication.
// ---------------------------------------------------------------------------

export interface ContextRE {
  window: [number, number];
  BB_rate: number;
  K_rate: number;
  HBP_rate: number;
  HR_per_BIP: number;
  "2B_per_BIP": number;
  "3B_per_BIP": number;
  BABIP: number;
  BA: number;
  OBP: number;
  SLG: number;
  R_per_G: number;
  w: Record<string, number>;
}

export interface TournamentContext {
  key: string;
  label: string;
  kind: "season" | "tournament" | "draft";
  reYear: number | null;
  re: ContextRE;
  park: string | null;
  draftType?: string;
  cadence?: string;
  rules?: Record<string, unknown>;
  cardEligibility?: Record<string, boolean | null>;
}

export interface ContextsFile {
  generatedAt: string;
  draftTypes: Record<string, unknown>;
  contexts: TournamentContext[];
}

let cache: ContextsFile | null = null;
let inflight: Promise<ContextsFile> | null = null;

export async function loadContexts(): Promise<ContextsFile> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/contexts.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load contexts: ${r.status}`);
      return r.json() as Promise<ContextsFile>;
    })
    .then((data) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export const DEFAULT_CONTEXT_KEY = "season:pt_season";

/**
 * Express a context's era as park-like multipliers relative to the modern
 * window (the frame the v2 projections live in). Neutral when it IS modern.
 */
export function eraAsPark(ctx: TournamentContext, modern: ContextRE): Park {
  const re = ctx.re;
  if (!re || re.window[0] === modern.window[0]) return NEUTRAL_PARK;
  const avg = re.BA / modern.BA;
  const hr = re.HR_per_BIP / modern.HR_per_BIP;
  return {
    park: `Era ${re.window[0]}-${re.window[1]}`,
    team: "RE",
    year: ctx.reYear ?? re.window[0],
    avg_lhb: avg,
    avg_rhb: avg,
    hr_lhb: hr,
    hr_rhb: hr,
    doubles: re["2B_per_BIP"] / modern["2B_per_BIP"],
    triples: re["3B_per_BIP"] / modern["3B_per_BIP"],
    label: `Era ${re.window[0]}–${re.window[1]}`,
  };
}

/** Compose two park-like factor sets multiplicatively. */
export function composeParks(a: Park, b: Park): Park {
  if (a === NEUTRAL_PARK) return b;
  if (b === NEUTRAL_PARK) return a;
  return {
    park: `${a.park} × ${b.park}`,
    team: a.team,
    year: a.year,
    avg_lhb: a.avg_lhb * b.avg_lhb,
    avg_rhb: a.avg_rhb * b.avg_rhb,
    hr_lhb: a.hr_lhb * b.hr_lhb,
    hr_rhb: a.hr_rhb * b.hr_rhb,
    doubles: a.doubles * b.doubles,
    triples: a.triples * b.triples,
    label: `${a.label} in ${b.label}`,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const LS_KEY = "pt.contextKey";

interface ContextState {
  contexts: TournamentContext[];
  selectedKey: string;
  loaded: boolean;
  load: () => Promise<void>;
  select: (key: string) => void;
  selected: () => TournamentContext | undefined;
  /** The era of the selected context expressed as a pseudo-Park. */
  eraPark: () => Park;
}

export const useContextStore = create<ContextState>((set, get) => ({
  contexts: [],
  selectedKey: DEFAULT_CONTEXT_KEY,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const file = await loadContexts();
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    const key =
      saved && file.contexts.some((c) => c.key === saved)
        ? saved
        : DEFAULT_CONTEXT_KEY;
    set({ contexts: file.contexts, selectedKey: key, loaded: true });
  },
  select: (key) => {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, key);
    set({ selectedKey: key });
  },
  selected: () => get().contexts.find((c) => c.key === get().selectedKey),
  eraPark: () => {
    const { contexts, selectedKey } = get();
    const ctx = contexts.find((c) => c.key === selectedKey);
    const modern = contexts.find((c) => c.key === DEFAULT_CONTEXT_KEY)?.re;
    if (!ctx || !modern) return NEUTRAL_PARK;
    return eraAsPark(ctx, modern);
  },
}));
