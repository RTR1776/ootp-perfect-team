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

export interface ConfidencePoint { label: string; level: ConfidenceLevel; text: string }
export interface Confidence { level: ConfidenceLevel; headline: string; points: ConfidencePoint[]; improve: string[] }

const worse = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => (a === "slim" || b === "slim" ? "slim" : a === "fair" || b === "fair" ? "fair" : "good");
const down = (l: ConfidenceLevel): ConfidenceLevel => (l === "good" ? "fair" : "slim");
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);

export function dataConfidence(i: ConfidenceInput): Confidence {
  const points: ConfidencePoint[] = [];
  const improve: string[] = [];

  // 1. This event's own exports.
  const files = i.seriesTeams != null && i.seriesTeams < 8 ? 0 : i.seriesFiles;
  const exportsLevel: ConfidenceLevel = files >= 3 ? "good" : files >= 1 ? "fair" : "slim";
  points.push({
    label: "this event", level: exportsLevel,
    text: files === 0
      ? "no exports of this event on record — field handedness and roster shape are defaults, and no card has a line here"
      : `${files} export${files === 1 ? "" : "s"} of this event${i.seriesTeams ? ` (${Math.round(i.seriesTeams)} teams each)` : ""} — field handedness measured; cards that played here carry their line here`,
  });
  if (files < 3) improve.push(files === 0 ? "Export this event when it ends (File OOTP Exports); the first export sets the field's handedness and roster shape." : "More exports of this event sharpen the field read; one per run.");

  // 2. Play behind the pool.
  const share = i.poolSize ? i.poolWithPlay / i.poolSize : 0;
  const coverageLevel: ConfidenceLevel = share >= 0.85 && i.poolMedianN >= 500 ? "good" : share >= 0.6 || i.poolMedianN >= 150 ? "fair" : "slim";
  points.push({
    label: "the pool", level: coverageLevel,
    text: `${pct(i.poolWithPlay, i.poolSize)}% of the ${i.poolSize.toLocaleString()} legal cards have tournament play on record (median ${Math.round(i.poolMedianN).toLocaleString()} PA/BF) — ${coverageLevel === "good" ? "the blend is mostly play" : coverageLevel === "fair" ? "ratings still carry much of the ranking" : "ratings carry the ranking"}`,
  });
  if (coverageLevel !== "good") improve.push("Exports from any series with these cards raise the pool's coverage; the value window decides which series help.");

  // 3. The era band the correction rests on.
  const eraLevel: ConfidenceLevel = !i.eraBand ? "slim" : i.eraBand.series >= 6 ? "good" : i.eraBand.series >= 3 ? "fair" : "slim";
  points.push({
    label: "the era", level: eraLevel,
    text: !i.eraBand
      ? "no era band for this environment — the correction is off"
      : `${i.eraBand.band} band rests on ${i.eraBand.series} series — ${eraLevel === "good" ? "the rating prices are well measured" : eraLevel === "fair" ? "the rating prices carry real uncertainty" : "the rating prices are a direction, not a measurement"}${i.envYearKnown ? "" : " (environment year not on file: PT default assumed)"}`,
  });
  if (eraLevel !== "good") improve.push("Exports from events in this era band sharpen the rating prices (pnpm era:slopes).");
  if (!i.envYearKnown) improve.push("Record the event's run-environment year in the catalogue.");

  // 4. The park.
  points.push({ label: "the park", level: i.parkOnFile ? "good" : "fair", text: i.parkOnFile ? "park factors on file" : "no park factors on file — a neutral park is assumed" });
  if (!i.parkOnFile) improve.push("Add the stadium's factors to park-factors.json (the game's ballpark screen prints them).");

  // Overall: the pool decides, then this event's exports and the era band can each take it down a step; the park caps at fair.
  let level = coverageLevel;
  if (exportsLevel === "slim") level = down(level);
  if (eraLevel === "slim") level = down(level);
  if (!i.parkOnFile || !i.envYearKnown) level = worse(level, "fair");
  const headline = level === "good" ? "Good data behind this build" : level === "fair" ? "Fair data — read the ranking with some care" : "Slim data — the ranking is mostly ratings and defaults";
  return { level, headline, points, improve };
}
