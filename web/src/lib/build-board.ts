/**
 * The /build working board as one value, so every change to it goes through
 * one undo history (UI plan B3, lib/use-undoable) and the board is kept per
 * event in this browser.
 *
 *   BoardState   {tid, slots, forms, adj, sets}: what the history holds.
 *   SavedBoard   `build:board:<tid>`: the board as last changed, with each
 *                card's name, so a card that later leaves the pool (sold, or
 *                no longer legal) can still be named when it is dropped.
 *   boardDiff    the cards a bulk change put on and took off, for its toast.
 *                Moving a card between slots is not a change of cards.
 *
 * Pure: no React, no storage, so it is tested in node.
 */
import { signed } from "./format";

export type Slots = Record<string, number | null>;
export interface Counts { bench: number; sp: number; rp: number }

export interface BoardState {
  /** The event this board belongs to; null before the first one loads. */
  tid: number | null;
  slots: Slots;
  /** The copy he chose per card: true = variant, false = base. */
  forms: Record<number, boolean>;
  /** Bench / SP / RP counts, as offsets from the event's baseline. */
  adj: Counts;
  /** Card sets the pool is narrowed to; empty = every set. */
  sets: number[];
}

export const NO_ADJ: Counts = { bench: 0, sp: 0, rp: 0 };
export const EMPTY_BOARD: BoardState = { tid: null, slots: {}, forms: {}, adj: NO_ADJ, sets: [] };

/** The range each counter keeps to (a board always has a closer). */
const LIMITS: Record<keyof Counts, [number, number]> = { bench: [0, 12], sp: [0, 9], rp: [1, 12] };
export const clampCount = (k: keyof Counts, v: number) => Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], Math.round(v)));

/* ------------------------------------------------------------ slots */

export const spKeysOf = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => `SP${i + 1}`);
/** The closer, then RP1..: `rp` counts the closer. */
export const rpKeysOf = (n: number) => ["CL", ...Array.from({ length: Math.max(0, n - 1) }, (_, i) => `RP${i + 1}`)];
export const benchKeysOf = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => `BN${i + 1}`);

/** Every slot a board with these counts has, in board order: vs RHP, vs LHP, staff, bench. */
export function slotKeys(lineupPos: readonly string[], c: Counts): string[] {
  return [
    ...lineupPos.map((p) => `R:${p}`), ...lineupPos.map((p) => `L:${p}`),
    ...spKeysOf(c.sp), ...rpKeysOf(c.rp), ...benchKeysOf(c.bench),
  ];
}

/** Slot groups a card may hold one slot of each: vs RHP (lineup and bench), vs LHP, staff. */
export const groupOfSlot = (s: string): "R" | "L" | "P" =>
  s.startsWith("L:") ? "L" : s.startsWith("R:") || s.startsWith("BN") ? "R" : "P";

/** Put a card in a slot, clearing any other slot he holds in the same group. Changes `slots`. */
export function placeCard(slots: Slots, slot: string, id: number | null): void {
  if (id != null) {
    const g = groupOfSlot(slot);
    for (const k of Object.keys(slots)) if (k !== slot && slots[k] === id && groupOfSlot(k) === g) slots[k] = null;
  }
  slots[slot] = id;
}

/** The filled slots only, in key order, so an emptied slot and a missing one compare equal. */
const filled = (s: Slots) => Object.entries(s).filter(([, v]) => v != null).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
export const sameSlots = (a: Slots, b: Slots) => JSON.stringify(filled(a)) === JSON.stringify(filled(b));
const sameForms = (a: Record<number, boolean>, b: Record<number, boolean>) => JSON.stringify(a) === JSON.stringify(b);

export function sameBoard(a: BoardState, b: BoardState): boolean {
  return a.tid === b.tid && sameSlots(a.slots, b.slots) && sameForms(a.forms, b.forms)
    && a.adj.bench === b.adj.bench && a.adj.sp === b.adj.sp && a.adj.rp === b.adj.rp
    && a.sets.join(",") === b.sets.join(",");
}

/* ---------------------------------------------------------- history */

/** Every action carries the label Undo shows ("Undo: put Hank Aaron at vs RHP 1B"). */
export type BoardAction =
  | { type: "place"; slot: string; id: number | null; label: string }
  | { type: "swap"; from: string; to: string; label: string }
  | { type: "set"; next: Partial<Omit<BoardState, "tid">>; label: string };

/** The next board; the same object when nothing changed, so a no-op is not an undo step. */
export function boardReducer(s: BoardState, a: BoardAction): BoardState {
  let next: BoardState;
  if (a.type === "place") {
    const slots = { ...s.slots };
    placeCard(slots, a.slot, a.id);
    next = { ...s, slots };
  } else if (a.type === "swap") {
    const x = s.slots[a.from] ?? null, y = s.slots[a.to] ?? null;
    const slots: Slots = { ...s.slots, [a.from]: null, [a.to]: null };
    placeCard(slots, a.to, x);
    placeCard(slots, a.from, y);
    next = { ...s, slots };
  } else {
    next = { ...s, ...a.next };
  }
  return sameBoard(next, s) ? s : next;
}

/* ------------------------------------------------------- kept board */

export const boardKey = (tid: number) => `build:board:${tid}`;

export interface SavedBoard {
  v: 1;
  slots: Record<string, number>;
  forms: Record<number, boolean>;
  /** Absolute bench / SP / RP counts, so a baseline that moves later (new exports) keeps the same board. */
  counts: Counts;
  names: Record<number, string>;
  /** Epoch ms of the change that wrote it. */
  savedAt: number;
}

/** What the page writes, less the time: compare two of these to see whether anything changed. */
export function boardContent(s: BoardState, keys: readonly string[], counts: Counts): Pick<SavedBoard, "slots" | "forms" | "counts"> {
  const slots: Record<string, number> = {};
  for (const k of keys) { const id = s.slots[k]; if (id != null) slots[k] = id; }
  return { slots, forms: { ...s.forms }, counts: { ...counts } };
}

export function toSaved(
  s: BoardState, keys: readonly string[], counts: Counts, nameOf: (id: number) => string | undefined, savedAt: number,
): SavedBoard {
  const content = boardContent(s, keys, counts);
  const names: Record<number, string> = {};
  for (const id of Object.values(content.slots)) { const n = nameOf(id); if (n) names[id] = n; }
  return { v: 1, ...content, names, savedAt };
}

const isCount = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const isId = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x > 0;

/** The stored text read back, or null when it is missing, unreadable or not a board. */
export function parseSaved(text: string | null): SavedBoard | null {
  if (!text) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = r.counts as Record<string, unknown> | undefined;
  if (r.v !== 1 || !r.slots || typeof r.slots !== "object" || !c || !isCount(c.bench) || !isCount(c.sp) || !isCount(c.rp) || !isCount(r.savedAt)) return null;
  const slots: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.slots as Record<string, unknown>)) if (isId(v)) slots[k] = v;
  const forms: Record<number, boolean> = {};
  for (const [k, v] of Object.entries((r.forms ?? {}) as Record<string, unknown>)) if (typeof v === "boolean" && isId(Number(k))) forms[Number(k)] = v;
  const names: Record<number, string> = {};
  for (const [k, v] of Object.entries((r.names ?? {}) as Record<string, unknown>)) if (typeof v === "string" && isId(Number(k))) names[Number(k)] = v;
  return { v: 1, slots, forms, counts: { bench: c.bench as number, sp: c.sp as number, rp: c.rp as number }, names, savedAt: r.savedAt as number };
}

export interface Dropped { id: number; name: string; why: "pool" | "slot" }
export interface Restored { slots: Slots; forms: Record<number, boolean>; adj: Counts; counts: Counts; dropped: Dropped[] }

/**
 * A kept board on today's page. The counts go back to offsets from the
 * event's baseline. A card no longer in the pool (sold, or not legal here
 * now) comes off and is named; so is one whose only slot the board no longer
 * has (the event dropped its DH). Choices of copy are kept for cards still
 * in the pool.
 */
export function restoreBoard(
  saved: SavedBoard,
  ctx: { inPool: (id: number) => boolean; baseline: Counts; lineupPos: readonly string[] },
): Restored {
  const counts: Counts = { bench: clampCount("bench", saved.counts.bench), sp: clampCount("sp", saved.counts.sp), rp: clampCount("rp", saved.counts.rp) };
  const keys = new Set(slotKeys(ctx.lineupPos, counts));
  const slots: Slots = {};
  const gone = new Map<number, Dropped["why"]>();
  for (const [k, id] of Object.entries(saved.slots)) {
    if (!ctx.inPool(id)) { gone.set(id, "pool"); continue; }
    if (!keys.has(k)) { if (!gone.has(id)) gone.set(id, "slot"); continue; }
    slots[k] = id;
  }
  const onBoard = new Set(Object.values(slots));
  const dropped: Dropped[] = [...gone].filter(([id]) => !onBoard.has(id))
    .map(([id, why]) => ({ id, name: saved.names[id] ?? `#${id}`, why }));
  const forms: Record<number, boolean> = {};
  for (const [id, v] of Object.entries(saved.forms)) if (ctx.inPool(Number(id))) forms[Number(id)] = v;
  const adj: Counts = { bench: counts.bench - ctx.baseline.bench, sp: counts.sp - ctx.baseline.sp, rp: counts.rp - ctx.baseline.rp };
  return { slots, forms, adj, counts, dropped };
}

/** "Removed from your board: De Vries (not legal here or no longer owned)." */
export function droppedNote(dropped: readonly Dropped[]): string {
  if (!dropped.length) return "";
  const list = (why: Dropped["why"]) => dropped.filter((d) => d.why === why).map((d) => d.name);
  const pool = list("pool"), slot = list("slot");
  return [
    pool.length ? `Removed from your board: ${pool.join(", ")} (not legal here or no longer owned).` : "",
    slot.length ? `Removed: ${slot.join(", ")} (that slot is no longer on the board).` : "",
  ].filter(Boolean).join(" ");
}

/* ------------------------------------------------------------- diff */

/** Distinct cards on a board, in board order (then any other keys). */
function cardsOn(s: Slots, order: readonly string[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const rest = Object.keys(s).filter((k) => !order.includes(k)).sort();
  for (const k of [...order, ...rest]) {
    const id = s[k];
    if (id != null && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

export interface BoardDiff { added: number[]; removed: number[] }

/** Cards put on and taken off. Reshuffles (in the rotation, the pen, between lineups) are not changes. */
export function boardDiff(before: Slots, after: Slots, order: readonly string[]): BoardDiff {
  const was = cardsOn(before, order), now = cardsOn(after, order);
  const wasSet = new Set(was), nowSet = new Set(now);
  return { added: now.filter((id) => !wasSet.has(id)), removed: was.filter((id) => !nowSet.has(id)) };
}

/** "1B" for R:1B or L:1B, "SP", "RP", "CL", "bench". */
export function slotTag(key: string): string {
  if (key.includes(":")) return key.split(":")[1];
  if (key.startsWith("SP")) return "SP";
  if (key.startsWith("RP")) return "RP";
  if (key.startsWith("BN")) return "bench";
  return key;
}

/** Where a card sits on a board, by its first slot in board order. */
export function whereIs(s: Slots, id: number, order: readonly string[]): string | null {
  const k = order.find((key) => s[key] === id) ?? Object.keys(s).find((key) => s[key] === id);
  return k == null ? null : slotTag(k);
}

const list = (xs: string[], max: number) => xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and ${xs.length - max} more`;

/** "In: Hank Aaron 1B, Scott Rolen 3B. Out: Brandon Wood, Rogers Hornsby." */
export function diffText(
  d: BoardDiff, after: Slots, order: readonly string[], nameOf: (id: number) => string, max = 4,
): string {
  if (!d.added.length && !d.removed.length) return "Same players.";
  const inList = d.added.map((id) => { const at = whereIs(after, id, order); return at ? `${nameOf(id)} ${at}` : nameOf(id); });
  return [
    d.added.length ? `In: ${list(inList, max)}.` : "",
    d.removed.length ? `Out: ${list(d.removed.map(nameOf), max)}.` : "",
  ].filter(Boolean).join(" ");
}

/** "+311.4 → +359.5 runs (+48.1)"; empty when either side has no score. */
export function runsText(before: number | null, after: number | null): string {
  if (before == null || after == null) return "";
  return `${signed(before)} → ${signed(after)} runs (${signed(after - before)})`;
}
