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
 *
 * The community dump (`my_results`) is a third, per-event source: every entry
 * the dump saw, whether or not it was ever pasted here. Its events count
 * beside the ledger's, deduplicated by event id (the ledger's row wins), and
 * never on a day the imported tracker already covers.
 */

import { PLACEMENTS } from "@/lib/ingest/constants";
import { chicagoDay } from "@/lib/format";

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
  /** Logged on /ptcs (the default), or read from the community dump and never logged. */
  source?: "results" | "dump";
  /** The exact finish, where the dump gives one; a logged row has only the band. */
  finish?: number | null;
}

/** A my_results row, as import:myresults stores it. */
export interface DumpRow {
  eventId: string;
  name: string;
  startAt: Date;
  finish: number;
  fieldSize: number;
  points: number;
  /** Comma-joined categories; "" means the event feeds none. */
  categories: string;
}

/** The last finish in each band of PLACEMENTS. */
const BAND_TOP = [1, 2, 4, 8, 16, 32, 64, 128, 256];

/** 3 → "3rd-4th": the band a finish falls in, as the Your Tournaments screen shows it. */
export function placementBand(finish: number): string {
  const i = BAND_TOP.findIndex((top) => finish <= top);
  return PLACEMENTS[i < 0 ? PLACEMENTS.length - 1 : i];
}

/**
 * A dump row as a ledger event. Its date is the night the event started, in
 * Chicago time — the rule the dump standings use, and the date the ledger
 * gives the same event.
 */
export function dumpEvent(r: DumpRow): LedgerEvent {
  return {
    eventId: /^\d+$/.test(r.eventId) ? Number(r.eventId) : null,
    name: r.name,
    occurredOn: chicagoDay(r.startAt) ?? "",
    categories: r.categories.split(",").map((c) => c.trim()).filter(Boolean),
    points: r.points,
    fieldSize: r.fieldSize,
    placement: placementBand(r.finish),
    eliminated: false,
    source: "dump",
    finish: r.finish,
  };
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
  /** "results" when anything was logged that day; "dump" when only the dump has events. */
  source: "results" | "dump" | "import" | "none";
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
  return `${name}${id} ${place}${field}${pts}${e.source === "dump" ? " · dump" : ""}`;
}

/**
 * Days × categories from every source. `events` holds the ledger's events and
 * the dump's (source "dump") together: a dump event counts only when the
 * ledger has no event with its id and the day has no imported total.
 */
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
  const logged = new Set(events.filter((e) => e.source !== "dump" && e.eventId != null).map((e) => e.eventId));
  const eventsBy = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    if (e.source === "dump" && ((e.eventId != null && logged.has(e.eventId)) || importBy.has(e.occurredOn))) continue;
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
      // (Dump events never reach a day with an imported row, so only logged ones can conflict.)
      const conflict = !!imp?.any;
      return {
        date, points, source: evs.some((e) => e.source !== "dump") ? "results" : "dump", conflict,
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
