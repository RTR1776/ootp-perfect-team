/**
 * Position defence in runs. See scripts/fielding-fit.ts for the measurement:
 * runs = (rating − field mean at the position) × ZR-per-point × runs-per-ZR,
 * per full season (1,400 innings ≈ 700 PA), scaled to the PA asked for.
 *
 * Only differences between candidates at the same position matter to a roster
 * search (every position is filled exactly once per board, so the per-position
 * constant cancels); the field mean is there so the number reads sensibly on
 * its own.
 */
import fielding from "@/data/fielding.json";
import type { EraRates } from "@/lib/analytics/run-env";

type PosFit = { slope: number; mean: number };
const FIT = fielding as { runsPerZR: number; positions: Record<string, PosFit> };

export const FIELDING_FIT = FIT;

/**
 * How much more a rating point is worth in play than the fit says, by position.
 *
 * Checked 2026-10-11 on 66 archived series (9,491 card-series lines with 50+
 * PA, the production glove: these runs × gloveScale for the series' era):
 * observed ZR per 700 PA rose 1.41 ZR per modelled run overall, flat across
 * era bands once gloveScale is applied (1.28–1.64), and by position C 1.81,
 * 1B 1.07, 2B 1.45, 3B 1.35, SS 1.85, LF 1.40, CF 1.91, RF 1.41. The fit's
 * per-point slopes are attenuated (r 0.13–0.32 per line). Two-fold by series
 * the per-position factors agreed (C 1.73/1.87, SS 1.80/1.91, CF 1.85/1.94)
 * and took the held-out slope from 1.37/1.44 to 0.89/1.01. The six PTCS 7
 * Championship brackets, never used to fit them, went 1.60 → 1.21.
 *
 * The factors are those slopes × runsPerZR (a ZR is 0.887 of a run; the
 * Championship's teams turned ZR into run differential at 1.02 ± 0.18), with
 * 1B held at 1. Catcher framing is not in ZR (the archive has no FRM), so C
 * is still short: the Championship's C framing alone ran 2.8× the model.
 * Kept here rather than in fielding.json so a refit of the slopes does not
 * silently drop it — re-measure it after any refit.
 */
export const FIELDING_CALIBRATION: Record<string, number> = {
  C: 1.61, "1B": 1.0, "2B": 1.29, "3B": 1.2, SS: 1.64, LF: 1.24, CF: 1.69, RF: 1.25,
};

/*
 * Tournament gloves are priced by FIELDING_CALIBRATION. A per-position repricing
 * from the 10-25 defence study (CF 3.38, LF 2.22, 2B 1.83, SS 2.10 up; 1B 0.77,
 * 3B 0.86 down) was wired on 10-25 and reverted the same night (Docs/Model
 * Review 2026-10-25.md §2): its 40/40 on wins had compared the harness's
 * PA-weighted glove runs, into which a team's plate appearances leak, with the
 * new prices on centred rating gaps. On centred gaps for both, the new prices
 * lose overall (better in 8/40; before 1946 3/40, 1977–93 3/40) and gain only
 * inside noise in 1946–76 and from 2010 (33/40 each). The study's measurements
 * stand in Docs/Defense Study 2026-10-25.md.
 */
function gloveRuns(cal: Record<string, number>, pos: string, rating: number | null | undefined, pa: number): number {
  const f = FIT.positions[pos];
  if (!f || rating == null || !Number.isFinite(rating) || rating <= 0) return 0;
  return (rating - f.mean) * f.slope * FIT.runsPerZR * (cal[pos] ?? 1) * (pa / 700);
}

/** Glove runs in a tournament (FIELDING_CALIBRATION). */
export function fieldingRuns(pos: string, rating: number | null | undefined, pa = 700): number {
  return gloveRuns(FIELDING_CALIBRATION, pos, rating, pa);
}

/**
 * LEAGUE glove prices (2026-10-25, Docs/League Plan 2026-10-25 §11): FIELDING_CALIBRATION
 * with center field doubled. League team-weeks (scripts/defense-study/league-def.mts,
 * league-test.py), runs allowed with FIP parts held, within each league-week:
 * CF fits at ~6x today's price (0.59 runs per point, ± 0.19), every other spot at or
 * under it. Held out over 40 half-samples, a FIXED CF x2 beats today's prices on runs
 * allowed in 38/40 and on wins in 31/40 (the best multiplier on wins; x3–x6 gain more
 * on runs allowed but fade on wins), while a freely fitted CF or 8 free prices don't
 * hold. CF x2 = 3.38.
 *
 * Every other position ×0.7 since 2026-10-25 (Docs/Model Review 2026-10-25.md §4):
 * on top of CF ×2 it held out on runs allowed in 38/40 and was level-to-positive
 * on wins (26/40), and it matches league compression — a ZR run is 0.64 runs
 * allowed in league play against 1.30 in tournaments.
 */
const LEAGUE_OTHER_SCALE = 0.7;
export const LEAGUE_FIELDING_CALIBRATION: Record<string, number> = {
  ...Object.fromEntries(Object.entries(FIELDING_CALIBRATION).map(([p, v]) => [p, v * LEAGUE_OTHER_SCALE])),
  CF: 3.38,
};

/** Glove runs in league play (LEAGUE_FIELDING_CALIBRATION). */
export function leagueFieldingRuns(pos: string, rating: number | null | undefined, pa = 700): number {
  return gloveRuns(LEAGUE_FIELDING_CALIBRATION, pos, rating, pa);
}

/**
 * CATCHER FRAMING in tournaments (2026-10-14, Docs/Model Audit 2026-10-14.md).
 * ZR does not count framing, so the glove above sees about a tenth of it.
 * Measured on 42 tournament exports (3,394 catcher stints, 324k innings), the
 * export's FRM plus the running game (a steal +0.20, a runner thrown out
 * −0.42), within each export: per 1,000 innings 0.2365·CatcherFrame +
 * 0.0104·Arm + 0.0351·Abil (halves 0.232 / 0.244 on Frame). Arm and ability
 * add little beyond ZR, so only Frame is priced here, on top of the C glove.
 * League play has its own, larger measure (league-lineup.ts leagueCatcherRuns).
 *
 * BY ERA (cwhit: the game files carry an era modifier for framing). Within
 * each export, per Frame point per 1,000 innings: 1946–1976 0.116 ± 0.004
 * (1,051 stints), 1977–2009 0.281 ± 0.010 (885), 2010+ 0.297 ± 0.013 (861).
 * Blocking (ZR and passed balls per CatcherAbil point) is flat across the
 * three. Before 1946 there are 22 stints on file, too few: those events take
 * the 1946–1976 rate until the full archive measures them.
 */
export const TOURNEY_FRAMING = {
  mean: 84.7,
  bands: [{ to: 1976, runsPer1000Inn: 0.116 }, { to: 2009, runsPer1000Inn: 0.281 }, { to: 9999, runsPer1000Inn: 0.297 }],
} as const;

/** Framing runs per Frame point per 1,000 innings for an event's run-environment year (PT default 2010). */
export function framingRate(year: number | null | undefined): number {
  const y = year ?? 2010;
  return (TOURNEY_FRAMING.bands.find((b) => y <= b.to) ?? TOURNEY_FRAMING.bands[TOURNEY_FRAMING.bands.length - 1]).runsPer1000Inn;
}

/** Framing runs over the average tournament catcher, per `pa` (700 PA ≈ 1,400 innings). Zero without a framing rating. */
export function framingRuns(frame: number | null | undefined, year?: number | null, pa = 700): number {
  if (frame == null || !Number.isFinite(frame) || frame <= 0) return 0;
  return framingRate(year) * (frame - TOURNEY_FRAMING.mean) * 1.4 * (pa / 700);
}

/** Runs per rating point at a position, per 700 PA. */
export function fieldingRunsPerPoint(pos: string): number {
  const f = FIT.positions[pos];
  return f ? f.slope * FIT.runsPerZR * (FIELDING_CALIBRATION[pos] ?? 1) : 0;
}

/** Balls in play (not home runs) per PA the fit's archive averaged, PA-weighted over 70 series. */
export const ARCHIVE_BIP = 0.743;

/**
 * How much a glove point is worth in this environment, against the archive
 * the slopes were fitted on. Defence is plays made on balls in play, so an
 * era that strikes out and homers more gives the fielders less to do.
 *
 * Measured 2026-09-27 on 8,041 card-series lines with 150+ PA (70 series).
 * Within each series and position, ZR per rating point per 700 PA was:
 * - 0.144 where balls in play ran 0.60–0.70 a PA
 * - 0.148 at 0.70–0.74
 * - 0.188 at 0.74–0.85
 * That is +3% for each extra 0.01 of balls in play. L.J.'s point: in a
 * high-BABIP era defence matters more.
 *
 * The scale is (BIP / 0.743)^1.5, held to 0.7–1.35. It is gentler than the
 * continuous fit (2.3) because the low end of the bins is flatter than that.
 * PT default 0.81, 2010 0.91, 1959 1.01, 1920 1.22.
 */
export function gloveScale(rates: EraRates | null | undefined): number {
  if (!rates) return 1;
  const bip = (1 - rates.K - rates.BB - rates.HBP) * (1 - rates.HR);
  if (!(bip > 0)) return 1;
  return Math.min(1.35, Math.max(0.7, (bip / ARCHIVE_BIP) ** 1.5));
}
