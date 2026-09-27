/**
 * The Card Model's editable state (/league-card, UI plan §5 E): the team, the
 * locks, the settings and the modelled card in one value. Every edit goes
 * through `modelReducer` as a labelled action, so one history (useUndoable)
 * undoes any of it, and one localStorage entry keeps it.
 *
 * Pure, so the edits, the new-export merge (C4) and the v2 migration are
 * tested without React. Arms and their locks join in PR 5; until then they
 * stay empty.
 */
import type { UndoAction } from "@/lib/use-undoable";

export type Family = "PEL" | "HD" | "LD";
export type Board = "vR" | "vL";
/** Per board, slot → the roster entry locked there. */
export type Locks = Record<Board, Record<string, string>>;

export const FAMILIES: Family[] = ["PEL", "HD", "LD"];
export const SLOTS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
export const POSITIONS = SLOTS.slice(0, 8);
export const BOARD_NAME: Record<Board, string> = { vR: "vs RHP", vL: "vs LHP" };
/** The batting ratings in card-face words; a form key is "EYE vR", "POW vL", … */
export const BAT_STATS: Array<[key: string, name: string]> = [["EYE", "Eye"], ["POW", "Power"], ["GAP", "Gap"], ["BA", "BABIP"], ["K", "Avoid K"]];
export const GLOVES: Array<[value: string, name: string]> = [["1", "Full"], ["0.5", "Half"], ["0", "Bat only"]];
export const DEFAULT_YEAR = "2010";
export const STORE = "league-card:v3";
export const STORE_V2 = "league-card:v2";

export const sideKeys = (b: Board) => BAT_STATS.map(([k]) => `${k} ${b}`);
export const POSITION_KEYS = POSITIONS.map((p) => `POS ${p}`);

export interface Settings { family: Family; year: string; park: string; glove: string }

/** A shop card as the form starts it: its name, title and own face values. */
export interface CardBase { id: number; name: string; title: string | null; base: Record<string, number> }

export interface Candidate extends CardBase {
  kind: "bat";
  /** The form as typed. "" is blank: at a position, one the card cannot play. */
  face: Record<string, string>;
  /** Scored in the lineups only when on. */
  include: boolean;
}

export interface ModelState {
  bats: string[];
  arms: string[];
  locks: Locks;
  armLocks: Record<string, string>;
  settings: Settings;
  candidate: Candidate | null;
  /** The league export the list follows (C4), e.g. "PEL, week of 2026-09-27", and its hitters. */
  source: string | null;
  exportRoster: string[];
  /** He chose the league himself; otherwise it follows the export's. */
  familyPinned: boolean;
}

/** The newest league export, as the page reads it. */
export interface LeagueExport { source: string | null; roster: string[]; family: Family }

type Edit =
  | { type: "add"; entry: string }
  | { type: "remove"; entry: string }
  | { type: "lock"; board: Board; slot: string; entry: string | null }
  | { type: "clearLocks" }
  | { type: "resetTeam"; ex: LeagueExport }
  | { type: "updateTeam"; ex: LeagueExport }
  | { type: "keepList"; ex: LeagueExport }
  | { type: "family"; family: Family; exportFamily: Family }
  | { type: "setting"; key: "year" | "park" | "glove"; value: string }
  | { type: "pickCard"; card: CardBase }
  | { type: "face"; key: string; value: string }
  | { type: "step"; keys: string[]; pct: number }
  | { type: "baseFace" }
  | { type: "include"; include: boolean }
  | { type: "clearCard" };
export type ModelAction = Edit & UndoAction;

const NO_LOCKS: Locks = { vR: {}, vL: {} };

export const nameOf = (entry: string) => entry.replace(/\s*#\d+\s*$/, "");
/** "PEL, week of 2026-09-27" → "PEL, week of 09-27". */
export const exportLabel = (source: string) => source.replace(/\d{4}-(\d{2}-\d{2})\s*$/, "$1");
export const lockCount = (l: Locks) => Object.keys(l.vR).length + Object.keys(l.vL).length;
/** A face value as the form shows it: blank for 0 (a position the card cannot play). */
export const faceText = (v: number | undefined) => (v != null && v > 0 ? String(Math.round(v)) : "");
export const baseFace = (base: Record<string, number>) => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, faceText(v)]));
export const fieldChanged = (c: Candidate, key: string) => (c.face[key] ?? "") !== faceText(c.base[key]);
export const cardEdited = (c: Candidate) => Object.keys({ ...c.base, ...c.face }).some((k) => fieldChanged(c, k));
/** The keys of a step that are still at the card's base value, so a step would move them. */
export const untouched = (c: Candidate, keys: string[]) => keys.filter((k) => !fieldChanged(c, k) && (c.base[k] ?? 0) > 0);

const pctText = (pct: number) => `+${Number(pct.toFixed(2))}%`;
const fieldName = (key: string) => {
  if (key.startsWith("POS ")) return `glove at ${key.slice(4)}`;
  const [stat, side] = key.split(" ");
  return `${BAT_STATS.find(([k]) => k === stat)?.[1] ?? stat} ${BOARD_NAME[side as Board] ?? side}`;
};

/** Every edit, labelled for the Undo button: "Undo: remove Mel Ott". Typing coalesces per field. */
export const edit = {
  add: (entry: string): ModelAction => ({ type: "add", entry, label: `Add ${nameOf(entry)}` }),
  remove: (entry: string): ModelAction => ({ type: "remove", entry, label: `Remove ${nameOf(entry)}` }),
  lock: (board: Board, slot: string, entry: string | null): ModelAction => ({
    type: "lock", board, slot, entry,
    label: entry ? `Lock ${nameOf(entry)} at ${slot} ${BOARD_NAME[board]}` : `Unlock ${slot} ${BOARD_NAME[board]}`,
  }),
  clearLocks: (n: number): ModelAction => ({ type: "clearLocks", label: `Clear ${n} lock${n === 1 ? "" : "s"}` }),
  resetTeam: (ex: LeagueExport): ModelAction => ({ type: "resetTeam", ex, label: "Reset team" }),
  updateTeam: (ex: LeagueExport): ModelAction => ({ type: "updateTeam", ex, label: "Update team" }),
  keepList: (ex: LeagueExport): ModelAction => ({ type: "keepList", ex, label: "Keep my list" }),
  family: (family: Family, exportFamily: Family): ModelAction => ({ type: "family", family, exportFamily, label: `Set league to ${family}` }),
  year: (value: string): ModelAction => ({ type: "setting", key: "year", value, label: "Edit run environment", coalesceKey: "year" }),
  park: (value: string): ModelAction => ({ type: "setting", key: "park", value, label: "Edit home park", coalesceKey: "park" }),
  glove: (value: string): ModelAction => ({
    type: "setting", key: "glove", value, label: `Set gloves to ${(GLOVES.find(([v]) => v === value)?.[1] ?? value).toLowerCase()}`,
  }),
  pickCard: (card: CardBase): ModelAction => ({ type: "pickCard", card, label: `Model ${card.name}` }),
  face: (key: string, value: string): ModelAction => ({ type: "face", key, value, label: `Edit ${fieldName(key)}`, coalesceKey: `face:${key}` }),
  /** The variant step on one side's batting ratings, or on the positions. */
  step: (what: Board | "positions", pct: number): ModelAction => ({
    type: "step", keys: what === "positions" ? POSITION_KEYS : sideKeys(what), pct,
    label: `${pctText(pct)} ${what === "positions" ? "positions" : BOARD_NAME[what]}`,
  }),
  baseFace: (name: string): ModelAction => ({ type: "baseFace", label: `Reset ${name} to base` }),
  include: (name: string, include: boolean): ModelAction => ({ type: "include", include, label: include ? `Include ${name}` : `Leave out ${name}` }),
  clearCard: (name: string): ModelAction => ({ type: "clearCard", label: `Clear ${name}` }),
};

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const keepLocks = (l: Locks, keep: (entry: string) => boolean): Locks => ({
  vR: Object.fromEntries(Object.entries(l.vR).filter(([, e]) => keep(e))),
  vL: Object.fromEntries(Object.entries(l.vL).filter(([, e]) => keep(e))),
});

/**
 * The list after taking a new export: its hitters, plus anyone he added by
 * hand (on his list but not on the export it came from). Hitters the old
 * export had and the new one doesn't are gone.
 */
export function updatedBats(s: ModelState, ex: LeagueExport): string[] {
  const byHand = s.bats.filter((e) => !s.exportRoster.includes(e) && !ex.roster.includes(e));
  return [...ex.roster, ...byHand];
}

/**
 * What the new-export banner says: who "Update team" adds and who it drops.
 * Null when the list follows the newest export: the same one, with the same
 * hitters (a week re-imported with a hitter more counts as new).
 */
export function exportChange(s: ModelState, ex: LeagueExport): { added: string[]; gone: string[] } | null {
  const same = s.source === ex.source && s.exportRoster.length === ex.roster.length && ex.roster.every((e) => s.exportRoster.includes(e));
  if (!ex.source || same) return null;
  const next = updatedBats(s, ex);
  return { added: next.filter((e) => !s.bats.includes(e)), gone: s.bats.filter((e) => !next.includes(e)) };
}

/** The slot a lock would move the player from, on that board; null when it moves no one. */
export function lockMovesFrom(s: ModelState, board: Board, slot: string, entry: string | null): string | null {
  if (!entry) return null;
  return Object.entries(s.locks[board]).find(([at, e]) => e === entry && at !== slot)?.[0] ?? null;
}

/** His edits to the export's list, for the caption "your edits: +1, −2". */
export function teamEdits(s: ModelState): { added: number; removed: number } {
  return { added: s.bats.filter((e) => !s.exportRoster.includes(e)).length, removed: s.exportRoster.filter((e) => !s.bats.includes(e)).length };
}

export function modelReducer(s: ModelState, a: ModelAction): ModelState {
  const c = s.candidate;
  switch (a.type) {
    case "add":
      return !a.entry || s.bats.includes(a.entry) ? s : { ...s, bats: [...s.bats, a.entry] };
    case "remove":
      // His locks go with him, so undo brings both back.
      return s.bats.includes(a.entry) ? { ...s, bats: s.bats.filter((e) => e !== a.entry), locks: keepLocks(s.locks, (e) => e !== a.entry) } : s;
    case "lock": {
      const cur = s.locks[a.board];
      const noChange = a.entry ? cur[a.slot] === a.entry || !s.bats.includes(a.entry) : cur[a.slot] == null;
      if (noChange) return s;
      // A player locks into one slot per board: locking him elsewhere moves him.
      const next = Object.fromEntries(Object.entries(cur).filter(([slot, e]) => slot !== a.slot && e !== a.entry));
      if (a.entry) next[a.slot] = a.entry;
      return { ...s, locks: { ...s.locks, [a.board]: next } };
    }
    case "clearLocks":
      return lockCount(s.locks) ? { ...s, locks: NO_LOCKS } : s;
    case "resetTeam": {
      const { ex } = a;
      const same = sameList(s.bats, ex.roster) && sameList(s.exportRoster, ex.roster) && !lockCount(s.locks)
        && s.source === ex.source && !s.familyPinned && s.settings.family === ex.family;
      return same ? s : {
        ...s, bats: [...ex.roster], locks: NO_LOCKS, settings: { ...s.settings, family: ex.family }, familyPinned: false,
        source: ex.source, exportRoster: [...ex.roster],
      };
    }
    case "updateTeam": {
      const bats = updatedBats(s, a.ex);
      return {
        ...s, bats, locks: keepLocks(s.locks, (e) => bats.includes(e)),
        settings: s.familyPinned ? s.settings : { ...s.settings, family: a.ex.family },
        source: a.ex.source, exportRoster: [...a.ex.roster],
      };
    }
    case "keepList":
      return {
        ...s, settings: s.familyPinned ? s.settings : { ...s.settings, family: a.ex.family },
        source: a.ex.source, exportRoster: [...a.ex.roster],
      };
    case "family":
      // Choosing the export's own league is the same as not choosing: it keeps following the export.
      return s.settings.family === a.family ? s : { ...s, settings: { ...s.settings, family: a.family }, familyPinned: a.family !== a.exportFamily };
    case "setting":
      return s.settings[a.key] === a.value ? s : { ...s, settings: { ...s.settings, [a.key]: a.value } };
    case "pickCard":
      return c?.id === a.card.id ? s : { ...s, candidate: { ...a.card, kind: "bat", face: baseFace(a.card.base), include: true } };
    case "face":
      return !c || (c.face[a.key] ?? "") === a.value ? s : { ...s, candidate: { ...c, face: { ...c.face, [a.key]: a.value } } };
    case "step": {
      if (!c || !(a.pct > 0)) return s;
      // Only fields still at the card's base: a number typed off the face stays.
      const face = { ...c.face };
      for (const k of untouched(c, a.keys)) face[k] = faceText(c.base[k] * (1 + a.pct / 100));
      return Object.keys(face).some((k) => face[k] !== c.face[k]) ? { ...s, candidate: { ...c, face } } : s;
    }
    case "baseFace":
      return c && cardEdited(c) ? { ...s, candidate: { ...c, face: baseFace(c.base) } } : s;
    case "include":
      return !c || c.include === a.include ? s : { ...s, candidate: { ...c, include: a.include } };
    case "clearCard":
      return c ? { ...s, candidate: null } : s;
  }
}

/* --------------------------------------------------------- start and save */

/** The source of a list migrated from v2 that doesn't match the newest export. */
export const V2_SOURCE = "your saved list";

export function freshState(ex: LeagueExport): ModelState {
  return {
    bats: [...ex.roster], arms: [], locks: NO_LOCKS, armLocks: {},
    settings: { family: ex.family, year: DEFAULT_YEAR, park: "", glove: "1" }, candidate: null,
    source: ex.source, exportRoster: [...ex.roster], familyPinned: false,
  };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x != null && !Array.isArray(x);
const strings = (x: unknown): string[] | null =>
  Array.isArray(x) ? [...new Set(x.filter((e): e is string => typeof e === "string" && e.trim() !== ""))] : null;
const familyOf = (x: unknown): Family | null => (FAMILIES.includes(x as Family) ? (x as Family) : null);
const textOr = (x: unknown, ok: RegExp, fallback: string) => (typeof x === "string" && ok.test(x) ? x : fallback);

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

function candidateOf(x: unknown): Candidate | null {
  if (!isObj(x) || !isObj(x.base) || !isObj(x.face)) return null;
  const id = Number(x.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const base = Object.fromEntries(Object.entries(x.base).filter((kv): kv is [string, number] => typeof kv[1] === "number" && Number.isFinite(kv[1])));
  const face = Object.fromEntries(Object.entries(x.face).filter((kv): kv is [string, string] => typeof kv[1] === "string" && /^\d{0,3}$/.test(kv[1])));
  return {
    id, kind: "bat", name: typeof x.name === "string" && x.name ? x.name : `Card ${id}`,
    title: typeof x.title === "string" ? x.title : null, base, face, include: x.include !== false,
  };
}

function settingsOf(x: Obj, family: Family): Settings {
  return {
    family,
    year: textOr(x.year, /^\d{0,4}$/, DEFAULT_YEAR),
    park: typeof x.park === "string" ? x.park.slice(0, 80) : "",
    glove: GLOVES.some(([v]) => v === x.glove) ? (x.glove as string) : "1",
  };
}

/**
 * The state to start from: the saved v3 state, else the v2 list migrated,
 * else the newest export. Anything malformed falls back field by field; it
 * never throws. The league follows the export unless he pinned one.
 */
export function restoreState(saved: unknown, v2: unknown, ex: LeagueExport): ModelState {
  if (isObj(saved)) {
    const bats = strings(saved.bats) ?? [...ex.roster];
    const settings = isObj(saved.settings) ? saved.settings : {};
    const pinned = saved.familyPinned === true ? familyOf(settings.family) : null;
    return {
      bats, arms: [], locks: locksOf(saved.locks, bats), armLocks: {},
      settings: settingsOf(settings, pinned ?? ex.family), candidate: candidateOf(saved.candidate),
      source: typeof saved.source === "string" ? saved.source : null,
      exportRoster: strings(saved.exportRoster) ?? [], familyPinned: pinned != null,
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
      ...freshState(ex), bats, locks: locksOf(v2.locks, bats), settings: settingsOf(v2, family), familyPinned: family !== ex.family,
      ...(isThis ? {} : { source: V2_SOURCE, exportRoster: [...bats] }),
    };
  }
  return freshState(ex);
}

/* ------------------------------------------------------------ the request */

export interface ScoreBody {
  roster: string[]; locks: Locks; park: string | null; family: Family; year: number; defScale: number;
  cardId?: number; ratings?: Record<string, number>;
}
/** A request to score, keyed by its JSON; or why there is none (null: nothing to score yet). */
export type ScoreRequest = { key: string; body: ScoreBody; skip?: undefined } | { key: null; body?: undefined; skip: string | null };

/**
 * What /api/league-card is asked for this state. Half-typed input asks for
 * nothing: a year that isn't four digits yet, or a park that isn't one on the
 * list. A blank batting rating is left out (the card keeps its shop value); a
 * blank position is sent as 0, a position the card cannot play.
 */
export function scoreRequest(s: ModelState, parks: ReadonlySet<string>): ScoreRequest {
  if (!s.bats.length) return { key: null, skip: null };
  if (!/^\d{4}$/.test(s.settings.year)) return { key: null, skip: "Run environment: type a four-digit year." };
  const park = s.settings.park.trim();
  if (park && !parks.has(park)) return { key: null, skip: "Home park: pick one from the list, or leave it blank for neutral." };
  const body: ScoreBody = {
    roster: s.bats, locks: s.locks, park: park || null, family: s.settings.family,
    year: Number(s.settings.year), defScale: Number(s.settings.glove),
  };
  const c = s.candidate;
  if (c?.include) {
    const ratings: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.face)) {
      if (v !== "") ratings[k] = Number(v);
      else if (k.startsWith("POS ")) ratings[k] = 0;
    }
    body.cardId = c.id;
    body.ratings = ratings;
  }
  return { key: JSON.stringify(body), body };
}
