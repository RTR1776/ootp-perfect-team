/**
 * One catalogue event's rules, changed by hand: run environment, park, DH,
 * value and card-year windows, and the free-form restrictions. Weekly
 * "variety" events rotate their format, and the game changes other events'
 * rules without a new id; scripts/catalogue-set.ts applies this to a row.
 *
 * The row's previous rules are kept under restrictions.previousFormat (the
 * latest one only), so a change can be read back and undone by hand.
 */
export interface CatalogueRules {
  envYear: number | null;
  stadium: string | null;
  parkName: string | null;
  dh: boolean | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  restrictions: Record<string, unknown> | null;
}

export interface CatalogueEdit {
  envYear?: number;
  /** As the game shows it, "1958 Tiger Stadium"; the park name drops the year. */
  stadium?: string;
  dh?: boolean;
  value?: [number, number];
  /** null clears the window. */
  cardYears?: [number, number] | null;
  /** Restriction keys to remove, e.g. cardTypes when a card-kind rule ends. */
  drop?: string[];
  text?: string;
  /** Where the change came from; stored as restrictions.textFrom. */
  note?: string;
  /** Date of the change, stamped on previousFormat. */
  at: string;
}

export function editCatalogueRules(row: CatalogueRules, e: CatalogueEdit): CatalogueRules {
  const old = { ...(row.restrictions ?? {}) };
  delete old.previousFormat;
  const next: Record<string, unknown> = { ...old };
  for (const k of e.drop ?? []) delete next[k];
  if (e.text != null) next.text = e.text;
  if (e.note != null) next.textFrom = e.note;
  next.previousFormat = {
    changedOn: e.at, envYear: row.envYear, stadium: row.stadium, dh: row.dh,
    ratingsMin: row.ratingsMin, ratingsMax: row.ratingsMax,
    cardYearMin: row.cardYearMin, cardYearMax: row.cardYearMax, restrictions: old,
  };
  return {
    envYear: e.envYear ?? row.envYear,
    stadium: e.stadium ?? row.stadium,
    parkName: e.stadium != null ? e.stadium.replace(/^\d{4}\s+/, "") : row.parkName,
    dh: e.dh ?? row.dh,
    ratingsMin: e.value ? e.value[0] : row.ratingsMin,
    ratingsMax: e.value ? e.value[1] : row.ratingsMax,
    cardYearMin: e.cardYears === undefined ? row.cardYearMin : e.cardYears?.[0] ?? null,
    cardYearMax: e.cardYears === undefined ? row.cardYearMax : e.cardYears?.[1] ?? null,
    restrictions: next,
  };
}
