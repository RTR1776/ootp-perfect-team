/**
 * Undo and redo for a page's editable state (UI plan principle 4: one click
 * never loses work). Every action carries a label, so the Undo button can say
 * what it will undo ("Undo: remove Mel Ott").
 *
 * Typing into one field should be one undo step, not one per keystroke:
 * actions that share a `coalesceKey` merge into the step before them until
 * `seal()` (call it on blur) or an action with another key.
 *
 * The history logic is plain functions (`initHistory`, `pushHistory`,
 * `undoHistory`, `redoHistory`) so it is tested without React.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UndoAction { label: string; coalesceKey?: string }

export interface History<S> {
  past: { state: S; label: string }[];
  present: S;
  /** Label of the action that produced `present`, if any. */
  presentLabel: string | null;
  future: { state: S; label: string }[];
  /** The coalesce key still open for merging, or null. */
  open: string | null;
}

export const HISTORY_LIMIT = 50;

export function initHistory<S>(state: S): History<S> {
  return { past: [], present: state, presentLabel: null, future: [], open: null };
}

/** Plain-data equality: the reducer rebuilds objects, so `Object.is` can't tell "back where it began". */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a == null || b == null || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const kx = Object.keys(x), ky = Object.keys(y);
  return kx.length === ky.length && kx.every((k) => Object.prototype.hasOwnProperty.call(y, k) && same(x[k], y[k]));
}

/** Record `next` as the result of an action. A new action clears the redo list. */
export function pushHistory<S>(h: History<S>, next: S, action: UndoAction): History<S> {
  if (Object.is(next, h.present)) return h;
  if (action.coalesceKey != null && action.coalesceKey === h.open) {
    // Typed back to where the step began (Ctrl+Z inside the field does this):
    // the step would undo nothing, so it goes, and the next Undo is a real one.
    const start = h.past[h.past.length - 1];
    if (start && same(next, start.state)) {
      return { past: h.past.slice(0, -1), present: start.state, presentLabel: h.past.length > 1 ? h.past[h.past.length - 2].label : null, future: [], open: null };
    }
    return { ...h, present: next, presentLabel: action.label, future: [] };
  }
  const past = [...h.past, { state: h.present, label: action.label }].slice(-HISTORY_LIMIT);
  return { past, present: next, presentLabel: action.label, future: [], open: action.coalesceKey ?? null };
}

export function undoHistory<S>(h: History<S>): History<S> {
  const prev = h.past[h.past.length - 1];
  if (!prev) return h;
  return {
    past: h.past.slice(0, -1),
    present: prev.state,
    presentLabel: h.past.length > 1 ? h.past[h.past.length - 2].label : null,
    future: [{ state: h.present, label: prev.label }, ...h.future],
    open: null,
  };
}

export function redoHistory<S>(h: History<S>): History<S> {
  const next = h.future[0];
  if (!next) return h;
  return {
    past: [...h.past, { state: h.present, label: next.label }].slice(-HISTORY_LIMIT),
    present: next.state,
    presentLabel: next.label,
    future: h.future.slice(1),
    open: null,
  };
}

/** Close any open coalescing, so the next edit to the same field is its own step. */
export function sealHistory<S>(h: History<S>): History<S> {
  return h.open == null ? h : { ...h, open: null };
}

/** The label the Undo button shows: what undo would take back. */
export const undoLabel = (h: History<unknown>) => h.past[h.past.length - 1]?.label ?? null;
export const redoLabel = (h: History<unknown>) => h.future[0]?.label ?? null;

export interface Undoable<S, A extends UndoAction> {
  state: S;
  dispatch: (action: A) => void;
  undo: () => void;
  redo: () => void;
  seal: () => void;
  /** Start over from `state` with no history (a page load, not an edit). */
  reset: (state: S) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

export function useUndoable<S, A extends UndoAction>(reducer: (state: S, action: A) => S, init: S | (() => S)): Undoable<S, A> {
  const [h, setH] = useState<History<S>>(() => initHistory(typeof init === "function" ? (init as () => S)() : init));
  const reducerRef = useRef(reducer);
  useEffect(() => { reducerRef.current = reducer; }, [reducer]);

  const dispatch = useCallback((action: A) => setH((cur) => pushHistory(cur, reducerRef.current(cur.present, action), action)), []);
  const undo = useCallback(() => setH(undoHistory), []);
  const redo = useCallback(() => setH(redoHistory), []);
  const seal = useCallback(() => setH(sealHistory), []);
  const reset = useCallback((state: S) => setH(initHistory(state)), []);

  return useMemo(() => ({
    state: h.present, dispatch, undo, redo, seal, reset,
    canUndo: h.past.length > 0, canRedo: h.future.length > 0,
    undoLabel: undoLabel(h), redoLabel: redoLabel(h),
  }), [h, dispatch, undo, redo, seal, reset]);
}

/**
 * Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z (or Ctrl+Y) redoes, except while
 * typing in a field, where the browser's own text undo should win.
 */
export function useUndoKeys(undo: () => void, redo: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, enabled]);
}
