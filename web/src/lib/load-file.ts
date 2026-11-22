/**
 * env-roster's board printout, and the load file made from it.
 *
 * env-roster prints each board slot as one row (`boardRow`); current-rosters
 * reads those rows back (`parseBoardRows`) and writes a roster:save load file,
 * every card pinned by id, and the confirm-a-buy check reads the same rows
 * (upgrade-confirm-server). The rows are the only path from the board to a
 * load file, so a slot that is not printed is a card that is not saved.
 *
 * Saturday Negro Leagues Slots, 2026-11-14: the board held William Tenny at
 * BN7 (a saved dual pick's extra bench key, roster-fill boardShape), the
 * printout walked the shape's six bench keys, and the load file came out with
 * 25 cards while the roster check, which reads the board, reported 15 bats and
 * Tenny as the backup catcher. `loadFileShortfalls` holds a load file to the
 * board's own count ("26 players") and the roster check's staff line, so a
 * card left out stops the save instead of passing silently.
 */
import { cardIdOf } from "./two-way";

/** The slot keys a board row starts with. */
const ROW_KEY = /^(R:\w+|L:\w+|SP\d+|CL|RP\d+|BN\d+)\s/;
/** A full row: key, name (with " (VAR)"), value, bats, year, runs on that board, …, "#id". */
// One space before the value is enough: a 26-letter name leaves no padding before a three-digit value.
const ROW = /^(R:\w+|L:\w+|SP\d+|CL|RP\d+|BN\d+)\s+(.+?)\s+(\d+)\s+([LRS-])\s+(\d{4})\s+([+-]?\d+\.\d)\b.*?\s#(\d+)\s*$/;

/** One printed board slot. `cardId` is the card behind the slot (a two-way form's own card). */
export interface BoardRow {
  key: string;
  /** As printed, " (VAR)" and all. */
  rawName: string;
  name: string;
  variant: boolean;
  value: number;
  bats: string;
  year: number;
  runs: number;
  twoWay: boolean;
  cardId: number;
}

/** The card a board row prints. */
export interface RowCard { cardId: number; name: string; variant?: boolean; val: number | null; bats: string | null; year: number | null }

/**
 * One board slot as env-roster prints it: key, name, value, bats, year, the
 * card's runs on that board, then `tail` (field gap, park side, defence, the
 * arm's role and stamina, "two-way (…)"), and the card id last.
 */
export function boardRow(key: string, c: RowCard | undefined, runs: number | null | undefined, tail = ""): string {
  if (!c) return `${key.padEnd(7)} —`;
  const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  return `${key.padEnd(7)} ${(c.name + (c.variant ? " (VAR)" : "")).padEnd(26)} ${String(c.val).padStart(3)}  ${(c.bats ?? "-").padEnd(2)} ${String(c.year ?? "").padEnd(5)} ${runs == null ? "" : f1(runs).padStart(6)}${tail}  #${cardIdOf(c.cardId)}`;
}

/**
 * The board rows in a printout. `unread` is every line that starts like a row
 * but does not read as one (an empty slot's "—", a card with no year or no
 * runs): each is a slot the load file would miss, so the caller stops on it.
 */
export function parseBoardRows(text: string): { rows: BoardRow[]; unread: string[] } {
  const rows: BoardRow[] = [], unread: string[] = [];
  for (const l of text.split(/\r?\n/)) {
    if (!ROW_KEY.test(l)) continue;
    const m = ROW.exec(l);
    if (!m) { unread.push(l.trim()); continue; }
    const [, key, rawName, value, bats, year, runs, id] = m;
    rows.push({
      key: key!, rawName: rawName!, name: rawName!.replace(/\s*\(VAR\)$/, ""), variant: /\(VAR\)$/.test(rawName!),
      value: Number(value), bats: bats!, year: Number(year), runs: Number(runs), twoWay: / two-way \((pitching|hitting)\)/.test(l), cardId: Number(id),
    });
  }
  return { rows, unread };
}

/** The counts the printout states about its board: "N players · value …" and the roster check's "staff S SP / R RP / B bats". */
export interface BoardReport { players: number | null; staff: { sp: number; rp: number; bats: number } | null }

export function boardReport(text: string): BoardReport {
  const p = /^(\d+) players · /m.exec(text);
  const s = /staff (\d+) SP \/ (\d+) RP \/ (\d+) bats/.exec(text);
  return { players: p ? Number(p[1]) : null, staff: s ? { sp: Number(s[1]), rp: Number(s[2]), bats: Number(s[3]) } : null };
}

/** A load-file line: its slot key and the card it pins ("(VAR)" marks the variant). */
export interface LoadLine { key: string; cardId: number; variant: boolean }

/** The distinct cards a load file pins (a card and its variant are two). */
export function loadFileCards(lines: readonly LoadLine[]): Set<string> {
  return new Set(lines.map((l) => `${l.cardId}${l.variant ? "v" : ""}`));
}

/**
 * Where a load file falls short of the board it was made from: fewer (or more)
 * cards than the board's players, or a rotation, pen or bat count unlike the
 * roster check's. A two-way card in both roles is one card on two lines, as on
 * the board. Empty when they agree.
 */
export function loadFileShortfalls(lines: readonly LoadLine[], report: BoardReport): string[] {
  const out: string[] = [];
  const cards = loadFileCards(lines).size;
  if (report.players == null) out.push("the printout states no player count");
  else if (cards !== report.players) out.push(`the load file holds ${cards} cards, the board ${report.players} players`);
  if (report.staff == null) out.push("the printout has no roster check staff line");
  else {
    const sp = lines.filter((l) => /^SP\d+$/.test(l.key)).length;
    const rp = lines.filter((l) => l.key === "CL" || /^RP\d+$/.test(l.key)).length;
    const bats = loadFileCards(lines.filter((l) => /^[RL]:|^BN\d+$/.test(l.key))).size;
    if (sp !== report.staff.sp) out.push(`${sp} SP lines, the roster check ${report.staff.sp} SP`);
    if (rp !== report.staff.rp) out.push(`${rp} RP lines, the roster check ${report.staff.rp} RP`);
    if (bats !== report.staff.bats) out.push(`${bats} bats in the load file, the roster check ${report.staff.bats} bats`);
  }
  return out;
}

/** A load file's lines read back (every slot line pins "#id"; "(VAR)" before it marks the variant). */
export function readLoadFile(text: string): LoadLine[] {
  const out: LoadLine[] = [];
  for (const l of text.split(/\r?\n/)) {
    if (l.startsWith("#")) continue;
    const m = /^(\S+)\s+(.*?)\s#(\d+)\s*$/.exec(l.trim());
    if (m) out.push({ key: m[1]!, cardId: Number(m[3]), variant: /\(VAR\)$/.test(m[2]!) });
  }
  return out;
}
