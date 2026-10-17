/**
 * Build presets (L.J., 2026-10-16: "help build lineups … with presets, but
 * options and data for me to look at"): the roster rules Optimise follows,
 * saved under a name and applied with one click.
 *
 *   twoCatchers / twoShortstops / twoLong / backups — the roster checks Optimise
 *     must keep (roster-optimize minCatchers, minShortstops, minLongMen, backups)
 *   defense — a multiplier on the glove weight (gloveScale × the era's team
 *     weight): 1 prices gloves as the model does; above 1 leans to gloves
 *   pen — "field" keeps the event's own pen (its best quarter's, rosterShape),
 *     a number sets the relievers carried
 *
 * Kept in this browser (per-viewer settings), with the built-ins always there.
 */

export interface BuildPreset {
  name: string;
  twoCatchers: boolean;
  twoShortstops: boolean;
  twoLong: boolean;
  backups: boolean;
  defense: number;
  pen: "field" | number;
}

export const BUILT_IN_PRESETS: readonly BuildPreset[] = [
  { name: "Standard", twoCatchers: true, twoShortstops: false, twoLong: true, backups: true, defense: 1, pen: "field" },
  { name: "Gloves first", twoCatchers: true, twoShortstops: false, twoLong: true, backups: true, defense: 1.25, pen: "field" },
  { name: "Bats first", twoCatchers: true, twoShortstops: true, twoLong: true, backups: false, defense: 0.8, pen: "field" },
  { name: "Short pen (5)", twoCatchers: true, twoShortstops: false, twoLong: true, backups: true, defense: 1, pen: 5 },
];

const KEY = "build:presets";
const ACTIVE = "build:preset";

export function loadPresets(): BuildPreset[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as BuildPreset[];
    const mine = Array.isArray(saved) ? saved.filter((p) => p && typeof p.name === "string" && !BUILT_IN_PRESETS.some((b) => b.name === p.name)) : [];
    return [...BUILT_IN_PRESETS, ...mine];
  } catch {
    return [...BUILT_IN_PRESETS];
  }
}

export function savePreset(p: BuildPreset): BuildPreset[] {
  const mine = loadPresets().filter((x) => !BUILT_IN_PRESETS.some((b) => b.name === x.name) && x.name !== p.name);
  try { localStorage.setItem(KEY, JSON.stringify([...mine, p])); } catch { /* storage unavailable */ }
  return loadPresets();
}

export function deletePreset(name: string): BuildPreset[] {
  const mine = loadPresets().filter((x) => !BUILT_IN_PRESETS.some((b) => b.name === x.name) && x.name !== name);
  try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch { /* storage unavailable */ }
  return loadPresets();
}

export function activePresetName(): string {
  try { return localStorage.getItem(ACTIVE) ?? "Standard"; } catch { return "Standard"; }
}

export function rememberActive(name: string): void {
  try { localStorage.setItem(ACTIVE, name); } catch { /* storage unavailable */ }
}
