/**
 * League lineups on the league model: each bat's runs per board, the best
 * nine per board, and what one more card adds. Shared by the league:compare
 * CLI and the /league-card page, so both read the same numbers.
 *
 * Per board, the best nine are solved exactly (Hungarian): bat on the league
 * model plus glove at the slot (fielding.ts runs × defScale; behind the plate,
 * leagueCatcherRuns), under L.J.'s position floor, DH unconditional unless dh
 * is false. A card's worth is the
 * best lineup with him minus the best lineup without him: the bench move and
 * any reshuffle are inside it. Boards are weighted by the league's measured
 * share of PA against LHP. Runs are per 700 PA per lineup slot, about a
 * season; wins use runs per win = 1.5 × R/G + 3.
 *
 * `park` is the home park: its factors at half weight (81 home games, the
 * road averaging neutral) move each bat's app runs. The league terms are
 * rating-based and park-free. `locks` pin a player to a slot on one board;
 * a locked player plays there even below L.J.'s position floor (the game
 * allows it), but not at a position he has no rating for.
 */
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, eraTable, type ParkRow } from "@/lib/analytics/tournament-env";
import { solveEnv } from "@/lib/analytics/run-env";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { maxAssignment } from "@/lib/assign";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import {
  boardRatings, envPrices, leagueHitRuns, leagueLhpShare, outsideFit, type Board, type BoardRatings, type LeagueFamily,
} from "@/lib/analytics/league-model";

export interface LineupHitter { id: number; label: string; bats: string | null; ratings: Record<string, number> }
export interface LineupSlot { slot: string; id: number; label: string; runs: number }
export interface Lineup { lineup: LineupSlot[]; total: number }
export interface CardAdd {
  vR: Lineup | null; vL: Lineup | null;
  dR: number; dL: number;
  /** Boards weighted by the league's LHP share. */
  season: number; wins: number;
  /** The card straight into the DH slot, nothing else moving. */
  dhOnly: number;
}

const FIELD = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

/**
 * A catcher's defence in league play: runs saved per `innings` (default a
 * full slot season, 1,400) against the average league catcher.
 *
 * Measured 2026-09-27 on the raw league exports' catcher fielding columns:
 * 1,850 catcher-seasons, 1.29M innings, seven weeks. The runs are framing (FRM),
 * the running game (a steal +0.20 runs, a runner thrown out −0.42) and zone
 * runs (ZR × 0.887). On base copies, per 1,000 innings:
 *     −49.75 + 0.3493·CatcherFrame + 0.0828·Catcher Arm + 0.0772·CatcherAbil
 * Pooled per card it matches what 21 catchers did at r 0.98 (variants with
 * their ratings boosted, card-forms.ts). Framing is most of it: Piazza (Frame
 * 78) gives up 5 runs a 1,000 innings to it and Salas (109) saves 4. Piazza
 * also draws 114 steal attempts a 1,000 innings against the league's 73.
 * ZR alone (fielding.ts) sees about a tenth of this, so it is not used here.
 * Null when the card has no catcher ratings.
 */
export function leagueCatcherRuns(r: Record<string, number>, innings = 1400): number | null {
  const frm = r.CatcherFrame, arm = r["Catcher Arm"], abi = r.CatcherAbil;
  if (!(frm > 0 && arm > 0 && abi > 0)) return null;
  return ((-49.75 + 0.3493 * frm + 0.0828 * arm + 0.0772 * abi) * innings) / 1000;
}

/** Slot → the hitter id locked there. */
export type Locks = Partial<Record<string, number>>;

const homeHalf = (p: ParkRow): ParkRow => ({
  team: p.team, avgL: 1 + (p.avgL - 1) / 2, avgR: 1 + (p.avgR - 1) / 2, hrL: 1 + (p.hrL - 1) / 2,
  hrR: 1 + (p.hrR - 1) / 2, d2: 1 + (p.d2 - 1) / 2, d3: 1 + (p.d3 - 1) / 2,
});

export function leagueLineups(hitters: LineupHitter[], opts: { family: LeagueFamily; year: number; defScale?: number; dh?: boolean; park?: ParkRow | null }) {
  const era = eraFor(opts.year)?.row ?? eraTable["0"];
  const prices: BoardRatings = envPrices(era.rates);
  const rg = solveEnv(era.rates, era.rg, null).RG;
  const rpw = 1.5 * rg + 3;
  const lhp = leagueLhpShare(opts.family);
  const defScale = opts.defScale ?? 1;
  const slots = opts.dh === false ? FIELD : [...FIELD, "DH"];
  const byId = new Map(hitters.map((h) => [h.id, h]));

  const fits = envFitMaps(hitters.map((h) => ({ cardId: h.id, isPitcher: false, bats: h.bats, ratings: h.ratings })),
    { era: era.rates, park: opts.park ? homeHalf(opts.park) : null, roleTrust: 0.25, eraYear: opts.year });
  const runs = new Map<number, Record<Board, number | null>>();
  const warnings: string[] = [];
  for (const h of hitters) {
    const out: Record<Board, number | null> = { vL: null, vR: null };
    for (const b of ["vL", "vR"] as Board[]) {
      const br = boardRatings(h.ratings, b);
      const app = (b === "vL" ? fits.runsL : fits.runsR).get(h.id);
      if (!br || app == null) continue;
      out[b] = leagueHitRuns(app, br, opts.family, b, prices);
      const off = outsideFit(br);
      if (off.length) warnings.push(`${h.label} ${b}: ${off.join(", ")} is outside the league fit (extrapolated)`);
    }
    runs.set(h.id, out);
  }

  const cell = (id: number, slot: string, b: Board, locked = false): number => {
    const bat = runs.get(id)?.[b];
    if (bat == null) return -Infinity;
    if (slot === "DH") return bat;
    const r = byId.get(id)!.ratings;
    const pr = r[`Pos Rating ${slot}`] ?? 0;
    if (!(pr > 0) || (!locked && pr < posFloorAt(LJ_FLOOR, slot))) return -Infinity;
    const glove = (slot === "C" ? leagueCatcherRuns(r) : null) ?? fieldingRuns(slot, pr);
    return bat + defScale * glove;
  };
  const solve = (ids: number[], b: Board, locks: Locks = {}): Lineup | null => {
    const lockedAt = new Map(Object.entries(locks).filter(([, id]) => id != null && ids.includes(id)) as Array<[string, number]>);
    const lockedIds = new Set(lockedAt.values());
    const value = (i: number, s: string) => {
      const pin = lockedAt.get(s);
      if (pin != null) return i === pin ? cell(i, s, b, true) : -Infinity;
      return lockedIds.has(i) ? -Infinity : cell(i, s, b);
    };
    const pick = maxAssignment(slots.map((s) => ids.map((i) => value(i, s))));
    if (!pick) return null;
    const lineup = slots.map((s, k) => ({ slot: s, id: ids[pick[k]], label: byId.get(ids[pick[k]])!.label, runs: value(ids[pick[k]], s) }));
    if (lineup.some((x) => !Number.isFinite(x.runs))) return null;
    return { lineup, total: lineup.reduce((a, x) => a + x.runs, 0) };
  };
  const add = (rosterIds: number[], id: number, base = { vR: solve(rosterIds, "vR"), vL: solve(rosterIds, "vL") },
    locks: Partial<Record<Board, Locks>> = {}): CardAdd => {
    const vR = solve([...rosterIds, id], "vR", locks.vR), vL = solve([...rosterIds, id], "vL", locks.vL);
    const dR = (vR?.total ?? 0) - (base.vR?.total ?? 0), dL = (vL?.total ?? 0) - (base.vL?.total ?? 0);
    const season = (1 - lhp) * dR + lhp * dL;
    const dhAt = (b: Board) => {
      const cur = base[b]?.lineup.find((x) => x.slot === "DH");
      const v = runs.get(id)?.[b];
      return cur && v != null ? Math.max(0, v - cur.runs) : 0;
    };
    return { vR, vL, dR, dL, season, wins: season / rpw, dhOnly: (1 - lhp) * dhAt("vR") + lhp * dhAt("vL") };
  };
  return { prices, rg, rpw, lhp, runs, warnings, solve, add };
}
