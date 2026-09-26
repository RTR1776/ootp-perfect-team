/**
 * How much data stands behind a build, in one word and a few reasons.
 *
 * A roster is only as good as what the scorer has seen: exports of THIS
 * event (field handedness, roster shape, the cards' own lines here), play
 * on record for the cards in the legal pool (the observed blend), the era
 * band the correction was fitted on, and whether the park is on file. The
 * page shows the level as a coloured banner so a build on thin data reads
 * as one before it is trusted.
 */
export type ConfidenceLevel = "good" | "fair" | "slim";

export interface ConfidenceInput {
  /** Exports of this series on record (series_meta.files); 0 when none. */
  seriesFiles: number;
  /** Average teams per export, when known — a two-team sliver is not an export. */
  seriesTeams: number | null;
  /** Eligible owned cards in the pool. */
  poolSize: number;
  /** Pool cards with any tournament play on record. */
  poolWithPlay: number;
  /** Median PA/BF on record among pool cards with play. */
  poolMedianN: number;
  /** The era band the correction rests on, and how many series it was fitted on. */
  eraBand: { band: string; series: number } | null;
  /** The catalogue knows the event's run-environment year (else PT default is assumed). */
  envYearKnown: boolean;
  /** Park factors are on file for the stadium (else neutral). */
  parkOnFile: boolean;
}

export interface ConfidencePoint { label: string; level: ConfidenceLevel; short: string; text: string }
export interface Confidence { level: ConfidenceLevel; headline: string; points: ConfidencePoint[] }

const worse = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => (a === "slim" || b === "slim" ? "slim" : a === "fair" || b === "fair" ? "fair" : "good");
const down = (l: ConfidenceLevel): ConfidenceLevel => (l === "good" ? "fair" : "slim");
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);

/**
 * Kept to one line on the page: this event's own exports and the play behind
 * the pool. The era band and the environment year still shade the level but
 * are not listed; the park is listed only when its factors are missing (they
 * should always be on file, so that line is a to-do, not a caveat).
 */
export function dataConfidence(i: ConfidenceInput): Confidence {
  const points: ConfidencePoint[] = [];

  // 1. This event's own exports.
  const files = i.seriesTeams != null && i.seriesTeams < 8 ? 0 : i.seriesFiles;
  const exportsLevel: ConfidenceLevel = files >= 3 ? "good" : files >= 1 ? "fair" : "slim";
  points.push({
    label: "this event", level: exportsLevel,
    short: files === 0 ? "no data" : `${files} tourney${files === 1 ? "" : "s"}`,
    text: files === 0
      ? "No exports of this event on record: field handedness and roster shape are defaults, and no card has a line here."
      : `${files} export${files === 1 ? "" : "s"} of this event${i.seriesTeams ? ` (${Math.round(i.seriesTeams)} teams each)` : ""}: field handedness measured; cards that played here carry their line here.`,
  });

  // 2. Play behind the pool.
  const share = i.poolSize ? i.poolWithPlay / i.poolSize : 0;
  const coverageLevel: ConfidenceLevel = share >= 0.85 && i.poolMedianN >= 500 ? "good" : share >= 0.6 || i.poolMedianN >= 150 ? "fair" : "slim";
  points.push({
    label: "pool", level: coverageLevel,
    short: `${pct(i.poolWithPlay, i.poolSize)}% of ${i.poolSize.toLocaleString()} cards have play`,
    text: `Median ${Math.round(i.poolMedianN).toLocaleString()} PA/BF among cards with play: ${coverageLevel === "good" ? "the blend is mostly play" : coverageLevel === "fair" ? "ratings still carry much of the ranking" : "ratings carry the ranking"}.`,
  });

  // 3. The park, only when missing.
  if (!i.parkOnFile) points.push({ label: "park", level: "fair", short: "factors not on file (neutral assumed)", text: "Add the stadium's factors to park-factors.json (the game's ballpark screen prints them)." });

  // Overall: the pool decides; no exports of this event or a thin era band take it down a step; a missing park or year caps at fair.
  const eraSlim = !i.eraBand || i.eraBand.series < 3;
  let level = coverageLevel;
  if (exportsLevel === "slim") level = down(level);
  if (eraSlim) level = down(level);
  if (!i.parkOnFile || !i.envYearKnown) level = worse(level, "fair");
  const headline = level === "good" ? "Good data" : level === "fair" ? "Fair data" : "Slim data";
  return { level, headline, points };
}
