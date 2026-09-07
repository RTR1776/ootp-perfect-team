/**
 * One day of PTCS points can be recorded two ways: as a per-event ledger row
 * (`results`, keyed by event id — anything logged through the app) or as a
 * day × category total (`daily_totals`, the spreadsheet history imported for
 * PTCS 6). A day must be counted from ONE of them, never both, or it double
 * counts. This module is that rule, so the page and any script agree.
 *
 * Per-event rows win when a day has both: they carry event ids and can be
 * corrected one event at a time, while an imported total is a number with a
 * free-text note. The day is flagged so the disagreement is visible rather
 * than silently resolved.
 */

export interface LedgerEvent {
  eventId: number | null;
  name: string;
  occurredOn: string;
  categories: string[];
  /** Points awarded to EACH category. */
  points: number;
  fieldSize: number | null;
  placement: string | null;
  eliminated: boolean;
}

export interface ImportedTotal {
  occurredOn: string;
  category: string;
  points: number;
  note: string | null;
}

export interface MergedDay {
  date: string;
  /** Per category, from whichever source counts for this day. */
  points: Record<string, number>;
  source: "results" | "import" | "none";
  /** True when the day has BOTH sources; `points` comes from results. */
  conflict: boolean;
  /** The imported total's numbers, kept for the conflict message. */
  importPoints: Record<string, number> | null;
  /** Imported free-text note, or a log line built from the events. */
  note: string | null;
  events: LedgerEvent[];
}

const ABBR: Record<string, string> = {
  Iron: "I", Bronze: "B", Silver: "S", Gold: "G", Diamond: "D",
  Open: "Op", Live: "L", Cap: "C", "PD Daily": "PDD", "PD Weekly": "PDW",
};

/** "Perfectly Gold 2220177 5-8 (64) +6 PDD" — the shape L.J.'s tracker notes use. */
export function eventLogLine(e: LedgerEvent): string {
  const name = e.name.replace(/^Daily\s+/i, "").replace(/\s*\(\d{4,9}\)\s*$/, "").trim();
  const id = e.eventId != null ? ` ${e.eventId}` : "";
  const place = e.eliminated ? "eliminated" : (e.placement ?? "?").replace(/(\d+)(?:st|nd|rd|th)-(\d+)(?:st|nd|rd|th)/, "$1-$2").replace(/^1st$/, "WINNER");
  const field = e.fieldSize != null ? ` (${e.fieldSize})` : "";
  const pts = e.points > 0
    ? " " + e.categories.map((c) => `+${e.points} ${ABBR[c] ?? c}`).join("/")
    : e.eliminated ? " unscored" : " 0";
  return `${name}${id} ${place}${field}${pts}`;
}

export function mergeDays(
  dates: readonly string[],
  categories: readonly string[],
  imported: readonly ImportedTotal[],
  events: readonly LedgerEvent[],
): MergedDay[] {
  const importBy = new Map<string, { points: Record<string, number>; note: string | null; any: boolean }>();
  for (const r of imported) {
    const d = importBy.get(r.occurredOn) ?? { points: {}, note: null, any: false };
    d.points[r.category] = (d.points[r.category] ?? 0) + r.points;
    if (r.points !== 0) d.any = true;
    // The note is per category in the table but was one line per day in the sheet.
    if (r.note && !d.note) d.note = r.note;
    importBy.set(r.occurredOn, d);
  }
  const eventsBy = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    const list = eventsBy.get(e.occurredOn) ?? [];
    list.push(e);
    eventsBy.set(e.occurredOn, list);
  }

  return dates.map((date) => {
    const zero = (): Record<string, number> => Object.fromEntries(categories.map((c) => [c, 0]));
    const imp = importBy.get(date);
    const evs = eventsBy.get(date) ?? [];
    if (evs.length) {
      const points = zero();
      for (const e of evs) for (const c of e.categories) if (c in points) points[c] += e.points;
      const ordered = [...evs].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      const note = ordered.map(eventLogLine).join("; ");
      // An imported row of all zeros is a placeholder, not a second opinion.
      const conflict = !!imp?.any;
      return {
        date, points, source: "results", conflict,
        importPoints: imp ? { ...zero(), ...imp.points } : null,
        note: conflict ? `${note} — imported total for this day also on file: ${describe(imp!.points)}` : note,
        events: ordered,
      };
    }
    if (imp) {
      return { date, points: { ...zero(), ...imp.points }, source: "import", conflict: false, importPoints: null, note: imp.note, events: [] };
    }
    return { date, points: zero(), source: "none", conflict: false, importPoints: null, note: null, events: [] };
  });
}

function describe(points: Record<string, number>): string {
  const parts = Object.entries(points).filter(([, v]) => v !== 0).map(([c, v]) => `${ABBR[c] ?? c} ${v}`);
  return parts.length ? parts.join(", ") : "all zero";
}
