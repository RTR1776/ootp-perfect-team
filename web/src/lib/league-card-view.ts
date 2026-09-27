/**
 * What the Card Model shows, worked out from a score (/api/league-card): the
 * headline totals, the lock menus, and the order and groups of the team
 * tables (UI plan C5, C6). Pure, so the rules the plan checks are tested
 * without a browser.
 */
import { signed } from "@/lib/format";
import { BOARD_NAME, nameOf, type Board } from "@/lib/league-card-state";

/** A hitter on the list, as scored: his bat per board and his glove rating at each field slot he can play. */
export interface PoolRow { entry: string; label: string; vR: number | null; vL: number | null; positions?: Record<string, number> }
export interface SlotRow { slot: string; label: string; runs: number; entry: string | null }
export interface LineupLike { lineup: SlotRow[]; total: number }
type Boards = Record<Board, LineupLike | null>;

/** "vs RHP · 53%": the board and its share of the season's plate appearances. */
export const boardTitle = (b: Board, lhp: number | null | undefined) =>
  lhp == null ? BOARD_NAME[b] : `${BOARD_NAME[b]} · ${Math.round((b === "vL" ? lhp : 1 - lhp) * 100)}%`;

/** A bat weighted as the season is: (1 − lhp)·vR + lhp·vL. Null when either side is. */
export const seasonBat = (vR: number | null | undefined, vL: number | null | undefined, lhp: number) =>
  vR == null || vL == null ? null : (1 - lhp) * vR + lhp * vL;

/**
 * The summary strip's numbers: the lineups' runs a season (the headline, each
 * board weighted by the league's share of PA against LHP), each board, the
 * staff's runs a season, and the two together. Null where there is nothing
 * to add up.
 */
export function teamTotals(r: { now: Boards; lhp: number; staff: { total: number } | null } | null | undefined) {
  const vR = r?.now.vR?.total ?? null, vL = r?.now.vL?.total ?? null;
  const bats = r ? seasonBat(vR, vL, r.lhp) : null;
  const arms = r?.staff?.total ?? null;
  return { bats, vR, vL, arms, team: bats != null && arms != null ? bats + arms : null };
}

/**
 * One slot's lock menu (C5): only the players who can play there, best
 * glove first ("Scott Rolen · 3B 137"); at DH everyone with a bat on this
 * board, best bat first ("Mel Ott · bat +4.6"). A player not scored yet (just
 * added) is offered by name, and the slot's own lock always shows, so the
 * menu never hides what is set.
 */
export function lockOptions(slot: string, board: Board, bats: string[], pool: PoolRow[], locked?: string | null): Array<[entry: string, label: string]> {
  const byEntry = new Map(pool.map((p) => [p.entry, p]));
  const dh = slot === "DH";
  const glove = (p: PoolRow) => p.positions?.[slot] ?? 0;
  const can = bats.map((e) => byEntry.get(e)).filter((p): p is PoolRow => p != null && p[board] != null && (dh || glove(p) > 0));
  can.sort((a, b) => (dh ? b[board]! - a[board]! : glove(b) - glove(a)));
  const out: Array<[string, string]> = can.map((p) => [p.entry, dh ? `${nameOf(p.entry)} · bat ${signed(p[board])}` : `${nameOf(p.entry)} · ${slot} ${glove(p)}`]);
  for (const e of bats) if (!byEntry.has(e)) out.push([e, nameOf(e)]);
  if (locked && !out.some(([e]) => e === locked)) out.push([locked, `${nameOf(locked)} · can't play ${slot}`]);
  return out;
}

export interface RosterRow {
  entry: string;
  label: string;
  vR: number | null;
  vL: number | null;
  /** "C vs R · DH vs L", "SS vs both", "1B vs R", "Bench"; "—" before he is scored. */
  plays: string;
  /** Boards he starts on: 2, 1 or 0. */
  starts: number;
}

/**
 * The hitters' table (C6): starters first (both boards, then one), then the
 * bench, each by his bat weighted as the season is. Anyone who starts on
 * neither board is on the bench. `waiting` holds entries not scored yet (all
 * of them before the first score), in list order.
 */
export function rosterRows(bats: string[], pool: PoolRow[], now: Boards | null | undefined, lhp: number): { starters: RosterRow[]; bench: RosterRow[]; waiting: RosterRow[] } {
  const byEntry = new Map(pool.map((p) => [p.entry, p]));
  const slotOn = (b: Board, e: string) => now?.[b]?.lineup.find((x) => x.entry === e)?.slot ?? null;
  const rows: RosterRow[] = [];
  const waiting: RosterRow[] = [];
  for (const e of bats) {
    const p = byEntry.get(e);
    if (!p || !now) { waiting.push({ entry: e, label: p?.label ?? nameOf(e), vR: p?.vR ?? null, vL: p?.vL ?? null, plays: "—", starts: 0 }); continue; }
    const r = slotOn("vR", e), l = slotOn("vL", e);
    const plays = r && l ? (r === l ? `${r} vs both` : `${r} vs R · ${l} vs L`) : r ? `${r} vs R` : l ? `${l} vs L` : "Bench";
    rows.push({ entry: e, label: p.label, vR: p.vR, vL: p.vL, plays, starts: (r ? 1 : 0) + (l ? 1 : 0) });
  }
  const bat = (x: RosterRow) => seasonBat(x.vR, x.vL, lhp) ?? -Infinity;
  rows.sort((a, b) => b.starts - a.starts || bat(b) - bat(a));
  return { starters: rows.filter((x) => x.starts > 0), bench: rows.filter((x) => x.starts === 0), waiting };
}

/** One staff slot as the arms' table needs it. */
export interface StaffSlotLike { slot: string; entry: string }

/**
 * The pitchers' table, in the same shape as the hitters': the rotation and
 * then the pen in slot order, then the arms who sit (past the staff's
 * size), then any not scored yet.
 */
export function armRows<T extends { entry: string }>(
  arms: string[], pool: T[], staff: { rotation: StaffSlotLike[]; bullpen: StaffSlotLike[]; out: Array<{ entry: string }> } | null | undefined,
): { pitching: Array<{ entry: string; slot: string; arm: T }>; sits: Array<{ entry: string; arm: T }>; waiting: string[] } {
  const byEntry = new Map(pool.map((a) => [a.entry, a]));
  const at = new Map([...(staff?.rotation ?? []), ...(staff?.bullpen ?? [])].map((s, i) => [s.entry, { slot: s.slot, order: i }]));
  const pitching: Array<{ entry: string; slot: string; arm: T }> = [];
  const sits: Array<{ entry: string; arm: T }> = [];
  const waiting: string[] = [];
  for (const e of arms) {
    const arm = byEntry.get(e), slot = at.get(e)?.slot;
    if (!arm || !staff) waiting.push(e);
    else if (slot) pitching.push({ entry: e, slot, arm });
    else sits.push({ entry: e, arm });
  }
  pitching.sort((a, b) => at.get(a.entry)!.order - at.get(b.entry)!.order);
  return { pitching, sits, waiting };
}
