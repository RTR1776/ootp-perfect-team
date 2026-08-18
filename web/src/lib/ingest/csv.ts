/**
 * Minimal quote-aware CSV/TSV reader for OOTP Perfect Team exports.
 *
 * Deliberately dependency-free: every PT export we ingest is flat text with no
 * embedded newlines, so a small hand-rolled reader is easier to reason about
 * than a parser config — and it lets us handle the pt_card_list field-count
 * quirk explicitly instead of silently.
 */

export type Row = Record<string, string>;

/** Split one delimited line, honouring "quoted, fields" and "" escapes. */
export function splitLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/** Guess the delimiter from the header line. OOTP exports are CSV; pasted cells are TSV. */
export function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

/**
 * Normalise a header cell: strip the `//` OOTP prefixes on the first column,
 * trim, and collapse internal whitespace runs.
 */
export function normaliseHeader(cell: string): string {
  return cell.replace(/^\/+/, "").trim().replace(/\s+/g, " ");
}

/**
 * De-duplicate repeated header names the way pandas does: the first occurrence
 * keeps its name, later ones get `_1`, `_2`, ...
 *
 * This matters. OOTP's 184-column stats export reuses `CON vL` for BOTH hitter
 * contact and pitcher control; the second one is `CON vL_1`. Reading the wrong
 * one silently produced FIP errors of +11.7 in an earlier engine build.
 */
export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h}_${n}`;
  });
}

export interface ParseOptions {
  /**
   * Some OOTP exports emit one MORE field per data row than the header
   * declares — `pt_card_list.csv` has a 122-field header and 123-field rows
   * from a trailing empty column. Left unhandled, every column right of `era`
   * shifts by one and `tier` / `owned` / prices all land in the wrong place.
   *
   * "pad"  — name the extras `_extra_0`, `_extra_1`, ... and keep them (default)
   * "drop" — discard them
   * "error" — throw, for files where a count mismatch means real corruption
   */
  extraFields?: "pad" | "drop" | "error";
  delimiter?: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: Row[];
  /** Number of data rows whose field count did not equal the header count. */
  raggedRows: number;
  /** Field count seen on data rows, if consistent. */
  fieldCount: number | null;
}

export function parseCsv(text: string, options: ParseOptions = {}): ParsedCsv {
  const { extraFields = "pad" } = options;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], raggedRows: 0, fieldCount: null };
  }

  const delimiter = options.delimiter ?? detectDelimiter(lines[0]);
  const headers = dedupeHeaders(splitLine(lines[0], delimiter).map(normaliseHeader));

  const rows: Row[] = [];
  let ragged = 0;
  const counts = new Set<number>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    counts.add(cells.length);

    if (cells.length !== headers.length) {
      ragged++;
      if (cells.length > headers.length && extraFields === "error") {
        throw new Error(
          `Row ${i + 1} has ${cells.length} fields, header has ${headers.length}`,
        );
      }
    }

    const row: Row = {};
    for (let c = 0; c < headers.length; c++) row[headers[c]] = (cells[c] ?? "").trim();

    if (cells.length > headers.length && extraFields === "pad") {
      for (let c = headers.length; c < cells.length; c++) {
        row[`_extra_${c - headers.length}`] = (cells[c] ?? "").trim();
      }
    }
    rows.push(row);
  }

  return {
    headers,
    rows,
    raggedRows: ragged,
    fieldCount: counts.size === 1 ? [...counts][0] : null,
  };
}

/** Numeric coercion that treats "", "-", and "n/a" as null rather than 0. */
export function num(value: string | undefined | null): number | null {
  if (value == null) return null;
  const s = value.trim();
  if (s === "" || s === "-" || s === "--" || s.toLowerCase() === "n/a") return null;
  // PT price columns use space-separated thousands: "50 275" = 50275.
  const n = Number(s.replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Same as num() but returns 0 instead of null — for counters like `owned`. */
export function numOr0(value: string | undefined | null): number {
  return num(value) ?? 0;
}
