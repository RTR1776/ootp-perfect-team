/**
 * An event's catalogue rules as env-roster flags, so a roster can be rebuilt
 * for any current event from what the catalogue holds (scripts/current-rosters),
 * read the way /build reads it:
 *
 *   - run environment: env_year, else the PT default (2010 is its label);
 *   - park: the stadium through tournament-env parkFor (its aliases and the
 *     nearest year on file), passed as the table's own name and year;
 *   - DH, value window, card years, card-set rule, slots, cap, variant cap or
 *     no variants, No LE, roster size;
 *   - the series: its own exports as the field (--series), unless they
 *     predate the event's current format, when they are left out of observed
 *     play too (--obs-exclude), as the 09-28 weekly-format work set out.
 *
 * Anything it can't express is a problem, and the caller skips the event
 * rather than build it to the wrong rules.
 */
import { parkFor } from "@/lib/analytics/tournament-env";
import { parseCardTypeRule } from "@/lib/roster-rules";

export interface CatalogueEvent {
  id: number;
  name: string;
  envYear: number | null;
  stadium: string | null;
  dh: boolean | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  series: string | null;
  isDraft: boolean;
  restrictions: Record<string, unknown> | null;
}

export interface RosterArgs {
  args: string[];
  /** Rules the flags can't carry; the event should not be built. */
  problems: string[];
  /** Things worth saying about the build (a neutral park, a guessed window). */
  notes: string[];
}

const TIERS = ["P", "D", "G", "S", "B", "I"];

export function eventRosterArgs(t: CatalogueEvent, opts: { seriesStale: boolean }): RosterArgs {
  const rx = (t.restrictions ?? {}) as {
    slots?: Record<string, number> | null; teamCap?: number | null; variantCap?: number | null; variantsAllowed?: boolean | null;
    cardTypes?: string[] | null; cards?: number | null; noLimitedEdition?: boolean | null; notes?: string[] | null; valueWindowFrom?: string;
  };
  const args: string[] = [], problems: string[] = [], notes: string[] = [];
  if (t.isDraft) problems.push("a draft");

  args.push("--year", String(t.envYear ?? 2010));
  if (t.envYear == null) notes.push("PT default RE");
  const park = parkFor(t.stadium);
  if (park.row && park.name && park.year != null) args.push("--park", park.name, "--park-year", String(park.year));
  else notes.push(`neutral park (${park.label})`);
  if (t.dh === true) args.push("--dh");
  else if (t.dh == null) problems.push("DH rule not on file");

  if (t.ratingsMin != null) args.push("--min", String(t.ratingsMin));
  if (t.ratingsMax != null) args.push("--max", String(t.ratingsMax));
  if (rx.valueWindowFrom) notes.push(`value window read off the name (${rx.valueWindowFrom})`);
  if (t.cardYearMin != null) args.push("--card-year-min", String(t.cardYearMin));
  if (t.cardYearMax != null) args.push("--card-year-max", String(t.cardYearMax));

  const types = (rx.cardTypes ?? []).filter((s) => s.trim());
  if (types.length) {
    const parsed = types.map(parseCardTypeRule);
    if (parsed.some((p) => p == null)) problems.push(`card-set rule not understood: ${types.join(" / ")}`);
    else {
      const codes = [...new Set(parsed.flat() as number[])].sort((a, b) => a - b);
      args.push("--card-types", codes.join(","));
      // Live cards are this season's: a Live-only event is a 2026-only event, which
      // answers the field guard's year question (Time Travelers' field is all 2026).
      if (codes.length === 1 && codes[0] === 1 && t.cardYearMin == null && t.cardYearMax == null) args.push("--card-year-min", "2026", "--card-year-max", "2026");
    }
  }
  if (rx.slots) {
    const parts = TIERS.filter((k) => (rx.slots![k] ?? 0) > 0).map((k) => `${k}${rx.slots![k]}`);
    if (parts.length) args.push("--slots", parts.join(","));
  }
  if (rx.teamCap != null) args.push("--cap", String(rx.teamCap));
  if (rx.variantsAllowed === false) args.push("--variant-cap", "0");
  else if (rx.variantCap != null) args.push("--variant-cap", String(rx.variantCap));
  if (rx.noLimitedEdition) args.push("--no-le");
  args.push("--size", String(rx.cards ?? 26));

  if (t.series) {
    if (opts.seriesStale) { args.push("--obs-exclude", t.series); notes.push(`${t.series}'s exports predate the current format: left out`); }
    else args.push("--series", t.series);
  }
  // A set rule on file answers the field's set guard; so does a card-year window.
  args.push("--name", t.name);
  return { args, problems, notes };
}
