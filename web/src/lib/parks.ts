"use client";

import { create } from "zustand";
import type { Bats, HitterSplit } from "./types";

// ---------------------------------------------------------------------------
// Park data layer. Mirrors data.ts: fetch the static JSON once and cache it.
// ballparks.json is an array of 236 parks; factors are multipliers around 1.0.
// ---------------------------------------------------------------------------

export interface Park {
  park: string;
  team: string;
  year: number;
  avg_lhb: number; // overall offense factor for LH batters
  avg_rhb: number; // overall offense factor for RH batters
  hr_lhb: number; // home-run factor for LH batters
  hr_rhb: number; // home-run factor for RH batters
  doubles: number;
  triples: number;
  label: string;
}

/** Exact label of the user's home park (verified against ballparks.json). */
export const HOME_PARK_LABEL = "Citi Field (New York Mets, 2013)";

let cache: Park[] | null = null;
let inflight: Promise<Park[]> | null = null;

export async function loadParks(): Promise<Park[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/ballparks.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load ballparks: ${r.status}`);
      return r.json() as Promise<Park[]>;
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

export function findPark(label: string, parks?: Park[]): Park | undefined {
  return (parks ?? cache ?? []).find((p) => p.label === label);
}

/** A neutral 1.0-everywhere park, used as a safe fallback. */
export const NEUTRAL_PARK: Park = {
  park: "Neutral",
  team: "None",
  year: 0,
  avg_lhb: 1,
  avg_rhb: 1,
  hr_lhb: 1,
  hr_rhb: 1,
  doubles: 1,
  triples: 1,
  label: "Neutral (League Average)",
};

// ---------------------------------------------------------------------------
// Park adjustment of a hitter line.
//
// Model (deliberately simple, no blowups — factors are gentle multipliers):
//   contact = avg_lhb / avg_rhb (switch hitters: mean of the two). This is the
//             park's overall offense factor and scales BABIP-driven hits, so we
//             apply it to BA/OBP and to the singles portion of SLG.
//   hr      = hr_lhb / hr_rhb scales the home-run contribution (ISO carries HR).
//   doubles/triples scale the extra-base (non-HR) contribution of ISO.
//
// We rebuild a park-adjusted wOBA from its components rather than trust a flat
// scale, so the optimizer's currency reacts correctly to HR-friendly vs
// pitcher-friendly parks. wOBA weights are folded into simple proxies:
//   wOBA ≈ baseWOBA scaled by a blend of contact (on the OBP base) and power
//   (on the ISO base). We keep the adjustment small: the park multiplier is
//   applied to the *delta* of each component, never amplifying beyond the raw
//   factor, so a 1.07 HR park lifts wOBA by a few points, not wholesale.
// ---------------------------------------------------------------------------

export function applyParkToHitter(
  split: HitterSplit,
  bats: Bats,
  park: Park,
): HitterSplit {
  const contact =
    bats === "S"
      ? (park.avg_lhb + park.avg_rhb) / 2
      : bats === "L"
        ? park.avg_lhb
        : park.avg_rhb;
  const hrFactor =
    bats === "S"
      ? (park.hr_lhb + park.hr_rhb) / 2
      : bats === "L"
        ? park.hr_lhb
        : park.hr_rhb;
  const xbhFactor = (park.doubles + park.triples) / 2;

  // Decompose ISO (extra bases per AB) into a HR-driven part and a 2B/3B part.
  // HR_rate is HR per PA; ISO carries ~ +3 per HR plus the 2B/3B portion.
  const hrIso = Math.min(split.ISO, split.HR_rate * 3);
  const xbhIso = Math.max(0, split.ISO - hrIso);
  const adjIso = hrIso * hrFactor + xbhIso * xbhFactor;

  // Contact factor moves BA/OBP gently around the league mean (.250/.320).
  const adjBA = applyContact(split.BA, contact, 0.25);
  const adjOBP = applyContact(split.OBP, contact, 0.32);
  const adjSLG = adjBA + adjIso;
  const adjHR = split.HR_rate * hrFactor;

  // Rebuild wOBA from its OBP (on-base) and ISO (power) drivers, anchored to the
  // original so the change tracks only what the park actually moved.
  const obpDelta = adjOBP - split.OBP;
  const isoDelta = adjIso - split.ISO;
  const adjWOBA = split.wOBA + obpDelta * 0.9 + isoDelta * 0.55;

  return {
    ...split,
    BA: adjBA,
    OBP: adjOBP,
    SLG: adjSLG,
    OPS: adjOBP + adjSLG,
    ISO: adjIso,
    wOBA: adjWOBA,
    HR_rate: adjHR,
  };
}

/** Apply a park factor to a rate stat by scaling its distance above a floor. */
function applyContact(rate: number, factor: number, floor: number): number {
  const above = rate - floor;
  return floor + above * factor + floor * (factor - 1) * 0.5;
}

// ---------------------------------------------------------------------------
// UI store: which park the optimizer should use (home vs an away opponent).
// ---------------------------------------------------------------------------

interface ParkState {
  homeParkLabel: string;
  awayParkLabel: string | null;
  side: "home" | "away";
  setHomeParkLabel: (label: string) => void;
  setAwayParkLabel: (label: string | null) => void;
  setSide: (side: "home" | "away") => void;
}

export const useParkStore = create<ParkState>((set) => ({
  homeParkLabel: HOME_PARK_LABEL,
  awayParkLabel: null,
  side: "home",
  setHomeParkLabel: (homeParkLabel) => set({ homeParkLabel }),
  setAwayParkLabel: (awayParkLabel) => set({ awayParkLabel }),
  setSide: (side) => set({ side }),
}));

/** Resolve the active park label from current store state. */
export function activeParkLabel(s: Pick<ParkState, "homeParkLabel" | "awayParkLabel" | "side">): string {
  return s.side === "away" && s.awayParkLabel ? s.awayParkLabel : s.homeParkLabel;
}
