/** Wire shapes shared by /api/results and the ResultEntry component. */

export type EntryStatus = "new" | "duplicate" | "problem";

export interface EntryRow {
  line: string;
  eventId: number | null;
  name: string;
  occurredOn: string | null;
  periodName: string | null;
  categories: string[];
  points: number;
  totalPoints: number;
  fieldSize: number | null;
  placement: string | null;
  eliminated: boolean;
  status: EntryStatus;
  problems: string[];
  /** A new row the totals already count from the community dump: logging it adds only the difference. */
  inDump?: { points: number; categories: string[] };
}

export interface EntryResponse {
  asOf: string;
  rows: EntryRow[];
  /** byCategory: what the totals will change by (dump rows count only their difference); fromDump: new rows the dump already had. */
  summary: { new: number; duplicates: number; problems: number; byCategory: Record<string, number>; fromDump: number };
  saved: number | null;
}
