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
}

export interface EntryResponse {
  asOf: string;
  rows: EntryRow[];
  summary: { new: number; duplicates: number; problems: number; byCategory: Record<string, number> };
  saved: number | null;
}
