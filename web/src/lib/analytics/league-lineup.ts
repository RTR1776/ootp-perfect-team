/**
 * League lineups on the league model: each bat's runs per board, the best
 * nine per board, and what one more card adds. Shared by the league:compare
 * CLI and the /league-card page, so both read the same numbers.
 *
 * Per board, the best nine are solved exactly (Hungarian): bat on the league
 * model plus glove at the slot (fielding.ts runs × defScale), under L.J.'s
 * position floor, DH unconditional unless dh is false. A card's worth is the
 * best lineup with him minus the best lineup without him: the bench move and
 * any reshuffle are inside it. Boards are weighted by the league's measured
 * share of PA against LHP. Runs are per 700 PA per lineup slot, about a
 * season; wins use runs per win = 1.5 × R/G + 3.
 */
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, eraTable } from "@/lib/analytics/tournament-env";
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

export function leagueLineups(hitters: LineupHitter[], opts: { family: LeagueFamily; year: number; defScale?: number; dh?: boolean }) {
  const era = eraFor(opts.year)?.row ?? eraTable["0"];
  const prices: BoardRatings = envPrices(era.rates);
  const rg = solveEnv(era.rates, era.rg, null).RG;
  const rpw = 1.5 * rg + 3;
  const lhp = leagueLhpShare(opts.family);
  const defScale = opts.defScale ?? 1;
  const slots = opts.dh === false ? FIELD : [...FIELD, "DH"];
  const byId = new Map(hitters.map((h) => [h.id, h]));

  const fits = envFitMaps(hitters.map((h) => ({ cardId: h.id, isPitcher: false, bats: h.bats, ratings: h.ratings })),
    { era: era.rates, park: null, roleTrust: 0.25, eraYear: opts.year });
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

  const cell = (id: number, slot: string, b: Board): number => {
    const bat = runs.get(id)?.[b];
    if (bat == null) return -Infinity;
    if (slot === "DH") return bat;
    const pr = byId.get(id)!.ratings[`Pos Rating ${slot}`] ?? 0;
    if (!(pr > 0) || pr < posFloorAt(LJ_FLOOR, slot)) return -Infinity;
    return bat + defScale * fieldingRuns(slot, pr);
  };
  const solve = (ids: number[], b: Board): Lineup | null => {
    const pick = maxAssignment(slots.map((s) => ids.map((i) => cell(i, s, b))));
    if (!pick) return null;
    const lineup = slots.map((s, k) => ({ slot: s, id: ids[pick[k]], label: byId.get(ids[pick[k]])!.label, runs: cell(ids[pick[k]], s, b) }));
    return { lineup, total: lineup.reduce((a, x) => a + x.runs, 0) };
  };
  const add = (rosterIds: number[], id: number, base = { vR: solve(rosterIds, "vR"), vL: solve(rosterIds, "vL") }): CardAdd => {
    const vR = solve([...rosterIds, id], "vR"), vL = solve([...rosterIds, id], "vL");
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
