/**
 * A hand-exported "eligible cards" list as the roster pool.
 *
 * The Cwhit challenges have no databotai row, and the collection snapshot in
 * the database is only as fresh as the last upload — it missed a variant L.J.
 * had acquired since. Exporting the eligible list straight out of the roster
 * screen sidesteps both: the game has already applied the event's own filters,
 * so whatever is in the file is legal by construction.
 *
 * The file speaks the collection export's vocabulary (BA/POW/EYE/K vL·vR,
 * STU/CON/HRA/PBABIP) and carries no `Pos Rating` columns, so each row is
 * matched back to the card table for positions, year and role, and the two
 * rating sets are merged by `formRatings` — which keeps the exported variant
 * boosts and rebuilds Contact from them.
 */

import { formRatings } from "@/lib/card-forms";

export interface EligibleRow {
  pos: string; name: string; bats: string | null; throws: string | null;
  value: number; variant: boolean;
  /** Export-vocabulary ratings, as written in the file. */
  exported: Record<string, number>;
}

/** Minimal RFC-4180 reader — the export has no embedded commas or quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];
  const head = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    const row: Record<string, string> = {};
    head.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

const RATING_COLS = [
  "BA vL", "GAP vL", "POW vL", "EYE vL", "K vL", "BA vR", "GAP vR", "POW vR", "EYE vR", "K vR",
  "STU vL", "CON vL", "PBABIP vL", "HRA vL", "STU vR", "CON vR", "PBABIP vR", "HRA vR",
  "STM", "SPE", "STE", "RUN", "IF RNG", "IF ERR", "IF ARM", "TDP", "OF RNG", "OF ERR", "OF ARM",
];

export function readEligible(text: string): EligibleRow[] {
  return parseCsv(text).map((r) => {
    const exported: Record<string, number> = {};
    for (const c of RATING_COLS) {
      const n = Number(r[c]);
      if (Number.isFinite(n) && r[c] !== "-" && r[c] !== "") exported[c] = n;
    }
    const bats = r["B"] === "Left" ? "L" : r["B"] === "Right" ? "R" : r["B"] === "Switch" ? "S" : null;
    return {
      pos: r["POS"], name: r["Name"], bats,
      throws: r["T"] === "Left" ? "L" : r["T"] === "Right" ? "R" : null,
      value: Number(r["CVAL"]), variant: r["VAR"] === "Y", exported,
    };
  }).filter((r) => r.name && Number.isFinite(r.value));
}

export interface BaseCard {
  cardId: number; name: string; cardValue: number; year: number | null;
  position: string; pitcherRole: string | null; isPitcher: boolean; bats: string | null;
  cardType: number | null; ratings: Record<string, number>;
}

export interface MatchedCard {
  cardId: number; name: string; val: number; year: number | null;
  isPitcher: boolean; role: string | null; cardType: number | null;
  bats: string | null; variant: boolean; ratings: Record<string, number>;
}

/** How far an export row sits from a candidate base card, on park-immune ratings. */
const fingerprint = (row: EligibleRow, c: BaseCard): number => {
  const pairs: [string, string][] = c.isPitcher
    ? [["STU vR", "Stuff vR"], ["CON vR", "Control vR"], ["HRA vR", "pHR vR"]]
    : [["POW vR", "Power vR"], ["EYE vR", "Eye vR"], ["GAP vR", "Gap vR"], ["K vR", "Avoid K vR"]];
  let d = 0, n = 0;
  for (const [from, to] of pairs) {
    const a = row.exported[from], b = c.ratings[to];
    if (a == null || b == null) continue;
    d += Math.abs(a - b); n++;
  }
  return n ? d / n : 1e6;
};

export interface MatchReport { matched: MatchedCard[]; unmatched: EligibleRow[] }

/**
 * Match each exported row to a base card. Name plus value is nearly unique;
 * where it is not (a base and its variant share both) the rating fingerprint
 * decides, and a variant sits further from its base than the base does, so the
 * VAR flag in the file is trusted over the distance.
 */
export function matchEligible(rows: EligibleRow[], universe: BaseCard[]): MatchReport {
  const byName = new Map<string, BaseCard[]>();
  for (const c of universe) {
    const k = `${c.name}|${c.cardValue}`;
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(c);
  }
  const matched: MatchedCard[] = [], unmatched: EligibleRow[] = [];
  for (const row of rows) {
    const cands = byName.get(`${row.name}|${row.value}`) ?? [];
    if (!cands.length) { unmatched.push(row); continue; }
    const base = cands.length === 1
      ? cands[0]
      : cands.slice().sort((a, b) => fingerprint(row, a) - fingerprint(row, b))[0];
    matched.push({
      cardId: base.cardId, name: base.name, val: row.value, year: base.year,
      isPitcher: base.isPitcher, role: base.pitcherRole ?? (["SP", "RP", "CL"].includes(row.pos) ? row.pos : null),
      cardType: base.cardType, bats: row.bats ?? base.bats, variant: row.variant,
      ratings: formRatings(base.ratings, row.exported),
    });
  }
  return { matched, unmatched };
}
