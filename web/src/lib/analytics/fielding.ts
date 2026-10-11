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

export function fieldingRuns(pos: string, rating: number | null | undefined, pa = 700): number {
  const f = FIT.positions[pos];
  if (!f || rating == null || !Number.isFinite(rating) || rating <= 0) return 0;
  return (rating - f.mean) * f.slope * FIT.runsPerZR * (FIELDING_CALIBRATION[pos] ?? 1) * (pa / 700);
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
