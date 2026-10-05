/**
 * The Card Model's editable state (/league-card, UI plan §5 E): the team's
 * hitters and pitchers, the lineup and staff locks, the settings and the
 * modelled card in one value. Every edit goes through `modelReducer` as a
 * labelled action, so one history (useUndoable) undoes any of it, and one
 * localStorage entry keeps it.
 *
 * Pure, so the edits, the new-export merge (C4) and the v2 migration are
 * tested without React.
 */
import type { UndoAction } from "@/lib/use-undoable";

export type Family = "PEL" | "HD" | "LD";
export type Board = "vR" | "vL";
/** Per board, slot → the roster entry locked there. */
export type Locks = Record<Board, Record<string, string>>;
/** Staff slot (SP1–SP5, CL, RP1…) → the arm locked there. */
export type ArmLocks = Record<string, string>;
/** A hitter joins the lineups; a pitcher ("arm") joins the staff. */
export type CardKind = "bat" | "arm";

export const FAMILIES: Family[] = ["PEL", "HD", "LD"];
export const SLOTS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
export const POSITIONS = SLOTS.slice(0, 8);
export const BOARD_NAME: Record<Board, string> = { vR: "vs RHP", vL: "vs LHP" };
/** A pitcher's sides are the batter's hand. */
export const BATTER_NAME: Record<Board, string> = { vR: "vs RHB", vL: "vs LHB" };
/** The batting ratings in card-face words and the card face's order; a form key is "EYE vR", "POW vL", … */
export const BAT_STATS: Array<[key: string, name: string]> = [["K", "Avoid K"], ["BA", "BABIP"], ["GAP", "Gap"], ["POW", "Power"], ["EYE", "Eye"]];
/** The pitching ratings in card-face words; a form key is "STU vR", "HRA vL", …, and Stamina is "STM". */
export const ARM_STATS: Array<[key: string, name: string]> = [["STU", "Stuff"], ["CON", "Control"], ["HRA", "pHR"], ["PBABIP", "pBABIP"]];
export const STAMINA = "STM";
export const ROTATION_SLOTS = ["SP1", "SP2", "SP3", "SP4", "SP5"];
/** A staff slot: a starter (SPn), the closer, or a reliever (RPn). The API takes the same. */
export const ARM_SLOT = /^(SP[1-9]|CL|RP[1-9]\d?)$/;
/** Stamina an arm needs to start (lib/league-arms STARTER_STAMINA; that module reads the database). */
export const STARTER_STAMINA = 25;
export const GLOVES: Array<[value: string, name: string]> = [["1", "Full"], ["0.5", "Half"], ["0", "Bat only"]];
/** The run environment PT plays by default, listed as 2010 (lib/analytics/tournament-env). */
export const DEFAULT_YEAR = "2010";
export const STORE = "league-card:v3";
export const STORE_V2 = "league-card:v2";

export const sideKeys = (b: Board) => BAT_STATS.map(([k]) => `${k} ${b}`);
export const armSideKeys = (b: Board) => ARM_STATS.map(([k]) => `${k} ${b}`);
export const POSITION_KEYS = POSITIONS.map((p) => `POS ${p}`);

export interface Settings { family: Family; year: string; park: string; glove: string }

/** A pitcher's league record in one role (GET /api/league-card): edge per 9, innings, team-weeks. */
export interface ArmObserved { edge9: number; ip: number; teams: number; weeks: number }

/** A shop card as the form starts it: its name, title and own face values. */
export interface CardBase {
  id: number; name: string; title: string | null; base: Record<string, number>;
  /** "arm" for a pitcher (the arm face); a hitter when left out. */
  kind?: CardKind;
  /** A pitcher's Movement per side: shown, not modelled (its parts are pHR and pBABIP). */
  movement?: { vL: number | null; vR: number | null } | null;
  /** A pitcher's league record as a starter and as a reliever; null with none. */
  observed?: { asSP: ArmObserved | null; asRP: ArmObserved | null } | null;
}

export interface Candidate extends CardBase {
  kind: CardKind;
  /** The form as typed. "" is blank: at a position, one the card cannot play. */
  face: Record<string, string>;
  /** Scored in the lineups (a pitcher: the staff) only when on. */
  include: boolean;
  /** A pitcher put in the rotation (SP) or the pen (RP); none: wherever he scores best. */
  role?: ArmSlotRole | null;
}

export type ArmSlotRole = "SP" | "RP";

export interface ModelState {
  bats: string[];
  arms: string[];
  locks: Locks;
  armLocks: ArmLocks;
  settings: Settings;
  candidate: Candidate | null;
  /** The league export the lists follow (C4), e.g. "PEL, week of 2026-09-27", its hitters and its pitchers. */
  source: string | null;
  exportRoster: string[];
  /** Kept like exportRoster, so an empty staff is only ever his own choice. */
  exportArms: string[];
  /** He chose the league himself; otherwise it follows the export's. */
  familyPinned: boolean;
}

/**
 * The newest league export, as the page reads it; or L.J.'s team sheet
 * (lib/league-team) when that is newer. A sheet also carries his lineups and
 * staff roles as locks, which the list takes with it.
 */
export interface LeagueExport {
  source: string | null; roster: string[]; arms: string[]; family: Family;
  locks?: Locks; armLocks?: ArmLocks;
}

/** A team sheet's source: "your roster of 2026-09-28". */
export const rosterSource = (asOf: string) => `your roster of ${asOf}`;
export const fromRoster = (source: string | null) => !!source && source.startsWith("your roster of ");
/** What a list follows, in words: "your roster" or "the export". */
export const listName = (source: string | null) => (fromRoster(source) ? "your roster" : "the export");

type Edit =
  | { type: "add"; entry: string }
  | { type: "remove"; entry: string }
  | { type: "addArm"; entry: string }
  | { type: "removeArm"; entry: string }
  | { type: "lock"; board: Board; slot: string; entry: string | null }
  | { type: "armLock"; slot: string; entry: string | null }
  | { type: "clearLocks" }
  | { type: "clearArmLocks" }
  | { type: "resetTeam"; ex: LeagueExport }
  | { type: "resetStaff"; ex: LeagueExport }
  | { type: "updateTeam"; ex: LeagueExport }
  | { type: "keepList"; ex: LeagueExport }
  | { type: "family"; family: Family; exportFamily: Family }
  | { type: "setting"; key: "year" | "park" | "glove"; value: string }
  | { type: "pickCard"; card: CardBase }
  | { type: "face"; key: string; value: string }
  | { type: "step"; keys: string[]; pct: number }
  | { type: "boost"; deltas: Record<string, number> }
  | { type: "baseFace" }
  | { type: "include"; include: boolean }
  | { type: "armRole"; role: ArmSlotRole | null }
  | { type: "clearCard" };
export type ModelAction = Edit & UndoAction;

const NO_LOCKS: Locks = { vR: {}, vL: {} };

export const nameOf = (entry: string) => entry.replace(/\s*#\d+\s*$/, "");
/** "PEL, week of 2026-09-27" → "PEL, week of 09-27". */
export const exportLabel = (source: string) => source.replace(/\d{4}-(\d{2}-\d{2})\s*$/, "$1");
export const lockCount = (l: Locks) => Object.keys(l.vR).length + Object.keys(l.vL).length;
export const armLockCount = (l: ArmLocks) => Object.keys(l).length;
/** A face value as the form shows it: blank for 0 (a position the card cannot play). */
export const faceText = (v: number | undefined) => (v != null && v > 0 ? String(Math.round(v)) : "");
export const baseFace = (base: Record<string, number>) => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, faceText(v)]));
export const fieldChanged = (c: Candidate, key: string) => (c.face[key] ?? "") !== faceText(c.base[key]);
export const cardEdited = (c: Candidate) => Object.keys({ ...c.base, ...c.face }).some((k) => fieldChanged(c, k));
/** The keys of a step that are still at the card's base value, so a step would move them. */
export const untouched = (c: Candidate, keys: string[]) => keys.filter((k) => !fieldChanged(c, k) && (c.base[k] ?? 0) > 0);
/**
 * A rating left blank (or 0) that the form flags "needs a number": it is left
 * out of the request, so the card keeps its shop value there. A blank
 * position is no such gap: the card can't play there.
 */
export const needsNumber = (c: Candidate, key: string) => !key.startsWith("POS ") && !(Number(c.face[key] || 0) > 0);

const pctText = (pct: number) => `+${Number(pct.toFixed(2))}%`;
const fieldName = (key: string) => {
  if (key.startsWith("POS ")) return `glove at ${key.slice(4)}`;
  if (key === STAMINA) return "Stamina";
  const [stat, side] = key.split(" ");
  const arm = ARM_STATS.find(([k]) => k === stat);
  if (arm) return `${arm[1]} ${BATTER_NAME[side as Board] ?? side}`;
  return `${BAT_STATS.find(([k]) => k === stat)?.[1] ?? stat} ${BOARD_NAME[side as Board] ?? side}`;
};

/** Every edit, labelled for the Undo button: "Undo: remove Mel Ott". Typing coalesces per field. */
export const edit = {
  add: (entry: string): ModelAction => ({ type: "add", entry, label: `Add ${nameOf(entry)}` }),
  remove: (entry: string): ModelAction => ({ type: "remove", entry, label: `Remove ${nameOf(entry)}` }),
  addArm: (entry: string): ModelAction => ({ type: "addArm", entry, label: `Add ${nameOf(entry)} to the staff` }),
  removeArm: (entry: string): ModelAction => ({ type: "removeArm", entry, label: `Remove ${nameOf(entry)}` }),
  lock: (board: Board, slot: string, entry: string | null): ModelAction => ({
    type: "lock", board, slot, entry,
    label: entry ? `Lock ${nameOf(entry)} at ${slot} ${BOARD_NAME[board]}` : `Unlock ${slot} ${BOARD_NAME[board]}`,
  }),
  armLock: (slot: string, entry: string | null): ModelAction => ({
    type: "armLock", slot, entry, label: entry ? `Lock ${nameOf(entry)} at ${slot}` : `Unlock ${slot}`,
  }),
  clearLocks: (n: number): ModelAction => ({ type: "clearLocks", label: `Clear ${n} lock${n === 1 ? "" : "s"}` }),
  clearArmLocks: (n: number): ModelAction => ({ type: "clearArmLocks", label: `Clear ${n} staff lock${n === 1 ? "" : "s"}` }),
  /** The whole team: hitters, pitchers, every lock and the league. */
  resetTeam: (ex: LeagueExport): ModelAction => ({ type: "resetTeam", ex, label: "Reset team" }),
  resetStaff: (ex: LeagueExport): ModelAction => ({ type: "resetStaff", ex, label: "Reset staff to the export" }),
  updateTeam: (ex: LeagueExport): ModelAction => ({ type: "updateTeam", ex, label: "Update team" }),
  keepList: (ex: LeagueExport): ModelAction => ({ type: "keepList", ex, label: "Keep my list" }),
  family: (family: Family, exportFamily: Family): ModelAction => ({ type: "family", family, exportFamily, label: `Set league to ${family}` }),
  year: (value: string): ModelAction => ({
    type: "setting", key: "year", value, label: `Set run environment to ${value === DEFAULT_YEAR ? "the PT default" : value}`,
  }),
  park: (value: string): ModelAction => ({ type: "setting", key: "park", value, label: "Edit home park", coalesceKey: "park" }),
  glove: (value: string): ModelAction => ({
    type: "setting", key: "glove", value, label: `Set gloves to ${(GLOVES.find(([v]) => v === value)?.[1] ?? value).toLowerCase()}`,
  }),
  pickCard: (card: CardBase): ModelAction => ({ type: "pickCard", card, label: `Model ${card.name}` }),
  face: (key: string, value: string): ModelAction => ({ type: "face", key, value, label: `Edit ${fieldName(key)}`, coalesceKey: `face:${key}` }),
  /** The variant step on one side's batting ratings, or on the positions. */
  /** A variant's boost as the shop lists it, points over the base card on both sides ("+10 Avoid K, +14 Eye"). */
  boost: (deltas: Record<string, number>): ModelAction => ({
    type: "boost", deltas,
    label: `Variant ${Object.entries(deltas).map(([k, d]) => `${d >= 0 ? "+" : ""}${d} ${BAT_STATS.find(([s]) => s === k)?.[1] ?? k}`).join(", ")}`,
  }),
  step: (what: Board | "positions", pct: number): ModelAction => ({
    type: "step", keys: what === "positions" ? POSITION_KEYS : sideKeys(what), pct,
    label: `${pctText(pct)} ${what === "positions" ? "positions" : BOARD_NAME[what]}`,
  }),
  /** The same step on one side of a pitcher's face (vs RHB / vs LHB); Stamina stays. */
  armStep: (side: Board, pct: number): ModelAction => ({ type: "step", keys: armSideKeys(side), pct, label: `${pctText(pct)} ${BATTER_NAME[side]}` }),
  baseFace: (name: string): ModelAction => ({ type: "baseFace", label: `Reset ${name} to base` }),
  include: (name: string, include: boolean): ModelAction => ({ type: "include", include, label: include ? `Include ${name}` : `Leave out ${name}` }),
  armRole: (name: string, role: ArmSlotRole | null): ModelAction => ({
    type: "armRole", role, label: role ? `Model ${name} as a ${role === "SP" ? "starter" : "reliever"}` : `Put ${name} where he scores best`,
  }),
  clearCard: (name: string): ModelAction => ({ type: "clearCard", label: `Clear ${name}` }),
};

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x));
const keepLocks = (l: Locks, keep: (entry: string) => boolean): Locks => ({
  vR: Object.fromEntries(Object.entries(l.vR).filter(([, e]) => keep(e))),
  vL: Object.fromEntries(Object.entries(l.vL).filter(([, e]) => keep(e))),
});
const keepArmLocks = (l: ArmLocks, keep: (entry: string) => boolean): ArmLocks => Object.fromEntries(Object.entries(l).filter(([, e]) => keep(e)));
const sameRecord = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
const sameLocks = (a: Locks, b: Locks) => sameRecord(a.vR, b.vR) && sameRecord(a.vL, b.vL);
/** The locks a list brings: a team sheet's lineups and staff roles (for players on `bats` / `arms`), else none. */
const exLocks = (ex: LeagueExport, bats: string[]): Locks => (ex.locks ? locksOf(ex.locks, bats) : NO_LOCKS);
const exArmLocks = (ex: LeagueExport, arms: string[]): ArmLocks => (ex.armLocks ? armLocksOf(ex.armLocks, arms) : {});


/** A new export's list, plus anyone he added by hand (on his list but not on the export it came from). */
const takeExport = (mine: string[], fromExport: string[], next: string[]) => [...next, ...mine.filter((e) => !fromExport.includes(e) && !next.includes(e))];

/**
 * The list after taking a new export: its hitters, plus anyone he added by
 * hand (on his list but not on the export it came from). Hitters the old
 * export had and the new one doesn't are gone.
 */
export function updatedBats(s: ModelState, ex: LeagueExport): string[] {
  return takeExport(s.bats, s.exportRoster, ex.roster);
}
/** The same for the staff: the export's pitchers, plus arms he added by hand. */
export function updatedArms(s: ModelState, ex: LeagueExport): string[] {
  return takeExport(s.arms, s.exportArms, ex.arms);
}

/**
 * What the new-export banner says: who "Update team" adds and who it drops,
 * hitters then pitchers. Null when the lists follow the newest export: the
 * same one, with the same players (a week re-imported with a player more
 * counts as new).
 */
export function exportChange(s: ModelState, ex: LeagueExport): { added: string[]; gone: string[] } | null {
  const same = s.source === ex.source && sameSet(s.exportRoster, ex.roster) && sameSet(s.exportArms, ex.arms);
  if (!ex.source || same) return null;
  const bats = updatedBats(s, ex), arms = updatedArms(s, ex);
  return {
    added: [...bats.filter((e) => !s.bats.includes(e)), ...arms.filter((e) => !s.arms.includes(e))],
    gone: [...s.bats.filter((e) => !bats.includes(e)), ...s.arms.filter((e) => !arms.includes(e))],
  };
}

/** The slot a lock would move the player from, on that board; null when it moves no one. */
export function lockMovesFrom(s: ModelState, board: Board, slot: string, entry: string | null): string | null {
  if (!entry) return null;
  return Object.entries(s.locks[board]).find(([at, e]) => e === entry && at !== slot)?.[0] ?? null;
}

/** The staff slot a lock would move the arm from; null when it moves no one. */
export function armLockMovesFrom(s: ModelState, slot: string, entry: string | null): string | null {
  if (!entry) return null;
  return Object.entries(s.armLocks).find(([at, e]) => e === entry && at !== slot)?.[0] ?? null;
}

/** His edits to the export's lists, hitters and pitchers, for the caption "your edits: +1, −2". */
export function teamEdits(s: ModelState): { added: number; removed: number } {
  const notIn = (list: string[], other: string[]) => list.filter((e) => !other.includes(e)).length;
  return { added: notIn(s.bats, s.exportRoster) + notIn(s.arms, s.exportArms), removed: notIn(s.exportRoster, s.bats) + notIn(s.exportArms, s.arms) };
}

export function modelReducer(s: ModelState, a: ModelAction): ModelState {
  const c = s.candidate;
  switch (a.type) {
    case "add":
      return !a.entry || s.bats.includes(a.entry) ? s : { ...s, bats: [...s.bats, a.entry] };
    case "remove":
      // His locks go with him, so undo brings both back.
      return s.bats.includes(a.entry) ? { ...s, bats: s.bats.filter((e) => e !== a.entry), locks: keepLocks(s.locks, (e) => e !== a.entry) } : s;
    case "addArm":
      return !a.entry || s.arms.includes(a.entry) ? s : { ...s, arms: [...s.arms, a.entry] };
    case "removeArm":
      return s.arms.includes(a.entry) ? { ...s, arms: s.arms.filter((e) => e !== a.entry), armLocks: keepArmLocks(s.armLocks, (e) => e !== a.entry) } : s;
    case "lock": {
      const cur = s.locks[a.board];
      const noChange = a.entry ? cur[a.slot] === a.entry || !s.bats.includes(a.entry) : cur[a.slot] == null;
      if (noChange) return s;
      // A player locks into one slot per board: locking him elsewhere moves him.
      const next = Object.fromEntries(Object.entries(cur).filter(([slot, e]) => slot !== a.slot && e !== a.entry));
      if (a.entry) next[a.slot] = a.entry;
      return { ...s, locks: { ...s.locks, [a.board]: next } };
    }
    case "armLock": {
      const cur = s.armLocks;
      const noChange = !ARM_SLOT.test(a.slot) || (a.entry ? cur[a.slot] === a.entry || !s.arms.includes(a.entry) : cur[a.slot] == null);
      if (noChange) return s;
      // An arm locks into one staff slot: locking him elsewhere moves him.
      const next = Object.fromEntries(Object.entries(cur).filter(([slot, e]) => slot !== a.slot && e !== a.entry));
      if (a.entry) next[a.slot] = a.entry;
      return { ...s, armLocks: next };
    }
    case "clearLocks":
      return lockCount(s.locks) ? { ...s, locks: NO_LOCKS } : s;
    case "clearArmLocks":
      return armLockCount(s.armLocks) ? { ...s, armLocks: {} } : s;
    case "resetTeam": {
      const { ex } = a;
      const locks = exLocks(ex, ex.roster), armLocks = exArmLocks(ex, ex.arms);
      const same = sameList(s.bats, ex.roster) && sameList(s.exportRoster, ex.roster) && sameLocks(s.locks, locks)
        && sameList(s.arms, ex.arms) && sameList(s.exportArms, ex.arms) && sameRecord(s.armLocks, armLocks)
        && s.source === ex.source && !s.familyPinned && s.settings.family === ex.family;
      return same ? s : {
        ...s, bats: [...ex.roster], locks, arms: [...ex.arms], armLocks,
        settings: { ...s.settings, family: ex.family }, familyPinned: false,
        source: ex.source, exportRoster: [...ex.roster], exportArms: [...ex.arms],
      };
    }
    case "resetStaff": {
      const { ex } = a;
      const armLocks = exArmLocks(ex, ex.arms);
      const same = sameList(s.arms, ex.arms) && sameList(s.exportArms, ex.arms) && sameRecord(s.armLocks, armLocks);
      return same ? s : { ...s, arms: [...ex.arms], armLocks, exportArms: [...ex.arms] };
    }
    case "updateTeam": {
      const bats = updatedBats(s, a.ex), arms = updatedArms(s, a.ex);
      // A team sheet sets the lineups and staff roles as he set them in game; an export keeps his own locks.
      const locks = a.ex.locks ? exLocks(a.ex, bats) : keepLocks(s.locks, (e) => bats.includes(e));
      const armLocks = a.ex.armLocks ? exArmLocks(a.ex, arms) : keepArmLocks(s.armLocks, (e) => arms.includes(e));
      return {
        ...s, bats, locks, arms, armLocks,
        settings: s.familyPinned ? s.settings : { ...s.settings, family: a.ex.family },
        source: a.ex.source, exportRoster: [...a.ex.roster], exportArms: [...a.ex.arms],
      };
    }
    case "keepList":
      return {
        ...s, settings: s.familyPinned ? s.settings : { ...s.settings, family: a.ex.family },
        source: a.ex.source, exportRoster: [...a.ex.roster], exportArms: [...a.ex.arms],
      };
    case "family":
      // Choosing the export's own league is the same as not choosing: it keeps following the export.
      return s.settings.family === a.family ? s : { ...s, settings: { ...s.settings, family: a.family }, familyPinned: a.family !== a.exportFamily };
    case "setting":
      return s.settings[a.key] === a.value ? s : { ...s, settings: { ...s.settings, [a.key]: a.value } };
    case "pickCard":
      return c?.id === a.card.id ? s : { ...s, candidate: { ...a.card, kind: a.card.kind ?? "bat", face: baseFace(a.card.base), include: true } };
    case "face":
      return !c || (c.face[a.key] ?? "") === a.value ? s : { ...s, candidate: { ...c, face: { ...c.face, [a.key]: a.value } } };
    case "step": {
      if (!c || !(a.pct > 0)) return s;
      // Only fields still at the card's base: a number typed off the face stays.
      const face = { ...c.face };
      for (const k of untouched(c, a.keys)) face[k] = faceText(c.base[k] * (1 + a.pct / 100));
      return Object.keys(face).some((k) => face[k] !== c.face[k]) ? { ...s, candidate: { ...c, face } } : s;
    }
    case "boost": {
      if (!c || c.kind !== "bat") return s;
      // From the base card, so applying it twice doesn't add twice; both sides.
      const face = { ...c.face };
      for (const [k, d] of Object.entries(a.deltas)) for (const side of ["vL", "vR"]) {
        const key = `${k} ${side}`;
        if (c.base[key] != null && Number.isFinite(d)) face[key] = faceText(c.base[key] + d);
      }
      return Object.keys(face).some((k) => face[k] !== c.face[k]) ? { ...s, candidate: { ...c, face } } : s;
    }
    case "baseFace":
      return c && cardEdited(c) ? { ...s, candidate: { ...c, face: baseFace(c.base) } } : s;
    case "include":
      return !c || c.include === a.include ? s : { ...s, candidate: { ...c, include: a.include } };
    case "armRole":
      return !c || c.kind !== "arm" || (c.role ?? null) === a.role ? s : { ...s, candidate: { ...c, role: a.role } };
    case "clearCard":
      return c ? { ...s, candidate: null } : s;
  }
}

/* --------------------------------------------------------- start and save */

/** The source of a list migrated from v2 that doesn't match the newest export. */
export const V2_SOURCE = "your saved list";

export function freshState(ex: LeagueExport): ModelState {
  return {
    bats: [...ex.roster], arms: [...ex.arms], locks: exLocks(ex, ex.roster), armLocks: exArmLocks(ex, ex.arms),
    settings: { family: ex.family, year: DEFAULT_YEAR, park: "", glove: "1" }, candidate: null,
    source: ex.source, exportRoster: [...ex.roster], exportArms: [...ex.arms], familyPinned: false,
  };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x != null && !Array.isArray(x);
const strings = (x: unknown): string[] | null =>
  Array.isArray(x) ? [...new Set(x.filter((e): e is string => typeof e === "string" && e.trim() !== ""))] : null;
const familyOf = (x: unknown): Family | null => (FAMILIES.includes(x as Family) ? (x as Family) : null);
const textOr = (x: unknown, ok: RegExp, fallback: string) => (typeof x === "string" && ok.test(x) ? x : fallback);
const numOr = <T,>(x: unknown, fallback: T): number | T => (typeof x === "number" && Number.isFinite(x) ? x : fallback);

/** Locks on a known slot and a player on the list, one slot per player per board. */
function locksOf(x: unknown, bats: string[]): Locks {
  const out: Locks = { vR: {}, vL: {} };
  if (!isObj(x)) return out;
  for (const b of ["vR", "vL"] as Board[]) {
    const raw = x[b];
    if (!isObj(raw)) continue;
    for (const [slot, e] of Object.entries(raw)) {
      if (SLOTS.includes(slot) && typeof e === "string" && bats.includes(e) && !Object.values(out[b]).includes(e)) out[b][slot] = e;
    }
  }
  return out;
}

/** Staff locks on a staff slot and an arm on the list, one slot per arm. */
function armLocksOf(x: unknown, arms: string[]): ArmLocks {
  const out: ArmLocks = {};
  if (!isObj(x)) return out;
  for (const [slot, e] of Object.entries(x)) {
    if (ARM_SLOT.test(slot) && typeof e === "string" && arms.includes(e) && !Object.values(out).includes(e)) out[slot] = e;
  }
  return out;
}

function observedOf(x: unknown): Candidate["observed"] {
  if (!isObj(x)) return null;
  const role = (y: unknown): ArmObserved | null => {
    if (!isObj(y)) return null;
    const edge9 = numOr(y.edge9, null), ip = numOr(y.ip, null);
    return edge9 != null && ip != null ? { edge9, ip, teams: numOr(y.teams, 0), weeks: numOr(y.weeks, 0) } : null;
  };
  return { asSP: role(x.asSP), asRP: role(x.asRP) };
}

function candidateOf(x: unknown): Candidate | null {
  if (!isObj(x) || !isObj(x.base) || !isObj(x.face)) return null;
  const id = Number(x.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const base = Object.fromEntries(Object.entries(x.base).filter((kv): kv is [string, number] => typeof kv[1] === "number" && Number.isFinite(kv[1])));
  const face = Object.fromEntries(Object.entries(x.face).filter((kv): kv is [string, string] => typeof kv[1] === "string" && /^\d{0,3}$/.test(kv[1])));
  const arm = x.kind === "arm";
  const movement = arm && isObj(x.movement) ? { vL: numOr(x.movement.vL, null), vR: numOr(x.movement.vR, null) } : null;
  return {
    id, kind: arm ? "arm" : "bat", name: typeof x.name === "string" && x.name ? x.name : `Card ${id}`,
    title: typeof x.title === "string" ? x.title : null, base, face, include: x.include !== false,
    ...(arm ? { movement, observed: observedOf(x.observed), role: x.role === "SP" || x.role === "RP" ? x.role : null } : {}),
  };
}

/** A saved year that is still one to pick (four digits, and on the list when there is one); else the PT default. */
function yearOf(x: unknown, years?: ReadonlySet<string>): string {
  const y = textOr(x, /^\d{4}$/, DEFAULT_YEAR);
  return !years || years.has(y) ? y : DEFAULT_YEAR;
}

/** Park names the list no longer offers under the name a saved board may hold. */
const RENAMED_PARKS: Record<string, string> = { "2005 Minue Maid Park": "2005 Minute Maid Park" };

function settingsOf(x: Obj, family: Family, years?: ReadonlySet<string>): Settings {
  const park = typeof x.park === "string" ? x.park.slice(0, 80) : "";
  return {
    family,
    year: yearOf(x.year, years),
    park: RENAMED_PARKS[park] ?? park,
    glove: GLOVES.some(([v]) => v === x.glove) ? (x.glove as string) : "1",
  };
}

/**
 * The state to start from: the saved v3 state, else the v2 list migrated,
 * else the newest export. Anything malformed falls back field by field; it
 * never throws. The league follows the export unless he pinned one. `years`,
 * the run environments on the page's list: a saved year off it (a half-typed
 * "20" from the old free-text box) starts at the PT default.
 */
export function restoreState(saved: unknown, v2: unknown, ex: LeagueExport, years?: ReadonlySet<string>): ModelState {
  if (isObj(saved)) {
    const bats = strings(saved.bats) ?? [...ex.roster];
    const settings = isObj(saved.settings) ? saved.settings : {};
    const pinned = saved.familyPinned === true ? familyOf(settings.family) : null;
    // A state saved before the staff (PR 4a) has arms [] and no exportArms:
    // that list was never his, so the staff follows the export's pitchers.
    // Since then an empty staff is one he emptied.
    const exportArms = strings(saved.exportArms);
    const arms = exportArms ? strings(saved.arms) ?? [...ex.arms] : [...ex.arms];
    return {
      bats, arms, locks: locksOf(saved.locks, bats), armLocks: exportArms ? armLocksOf(saved.armLocks, arms) : {},
      settings: settingsOf(settings, pinned ?? ex.family, years), candidate: candidateOf(saved.candidate),
      source: typeof saved.source === "string" ? saved.source : null,
      exportRoster: strings(saved.exportRoster) ?? [], exportArms: exportArms ?? [...ex.arms], familyPinned: pinned != null,
    };
  }
  if (isObj(v2)) {
    // v2 kept a list and settings but not which export the list came from.
    // The same hitters as this export: it is this export's list, and a league
    // unlike the export's was his choice. Otherwise it may be an older
    // export's (a week imported before he first opens this page): it stays
    // his list, the new-export banner offers the update, and the league
    // follows the export.
    const pool = strings(v2.pool);
    const bats = pool?.length ? pool : [...ex.roster];
    const isThis = bats.length === ex.roster.length && ex.roster.every((e) => bats.includes(e));
    const family = (isThis ? familyOf(v2.family) : null) ?? ex.family;
    return {
      ...freshState(ex), bats, locks: locksOf(v2.locks, bats), settings: settingsOf(v2, family, years), familyPinned: family !== ex.family,
      ...(isThis ? {} : { source: V2_SOURCE, exportRoster: [...bats] }),
    };
  }
  return freshState(ex);
}

/* ------------------------------------------------------------ the request */

export interface ScoreBody {
  roster: string[]; locks: Locks; park: string | null; family: Family; year: number; defScale: number;
  arms: string[]; armLocks: ArmLocks;
  cardId?: number; ratings?: Record<string, number>;
  /** A modelled pitcher's role, when he isn't put wherever he scores best. */
  candidateRole?: ArmSlotRole;
}
/** A request to score, keyed by its JSON; or why there is none (null: nothing to score yet). */
export type ScoreRequest = { key: string; body: ScoreBody; skip?: undefined } | { key: null; body?: undefined; skip: string | null };

/**
 * What /api/league-card is asked for this state. Half-typed input asks for
 * nothing: a year that isn't four digits, or a park that isn't one on the
 * list. The staff is always sent, so an empty one stays empty. A blank (or 0)
 * rating is left out, so the card keeps its shop value there (the form flags
 * it: needsNumber); a hitter's blank position is sent as 0, a position the
 * card cannot play.
 */
export function scoreRequest(s: ModelState, parks: ReadonlySet<string>): ScoreRequest {
  if (!s.bats.length) return { key: null, skip: null };
  if (!/^\d{4}$/.test(s.settings.year)) return { key: null, skip: "Run environment: pick a year from the list." };
  const park = s.settings.park.trim();
  if (park && !parks.has(park)) return { key: null, skip: "Home park: pick one from the list, or leave it blank for neutral." };
  const body: ScoreBody = {
    roster: s.bats, locks: s.locks, park: park || null, family: s.settings.family,
    year: Number(s.settings.year), defScale: Number(s.settings.glove), arms: s.arms, armLocks: s.armLocks,
  };
  const c = s.candidate;
  if (c?.include) {
    const ratings: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.face)) {
      if (k.startsWith("POS ")) { if (c.kind === "bat") ratings[k] = v === "" ? 0 : Number(v); }
      else if (!needsNumber(c, k)) ratings[k] = Number(v);
    }
    body.cardId = c.id;
    body.ratings = ratings;
    if (c.kind === "arm" && c.role) body.candidateRole = c.role;
  }
  return { key: JSON.stringify(body), body };
}
