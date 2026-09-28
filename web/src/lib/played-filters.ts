/**
 * The Played board's filters (UI plan D5): what each one keeps, how they ride
 * in the URL so a reload or Back keeps them, and how the ones in effect read
 * as chips and in the "No cards match" line. Pure: the page reads the URL with
 * it on the server, the board filters with it, and the test pins both.
 *
 * Fixes over the first board: switching kind starts the hand and position
 * over (S on Starters read "0 of 1,836"); the count is out of the current kind
 * only; Min PA is a value in the field (300), not a placeholder; a position
 * means L.J.'s glove floor there (LJ_FLOOR, 60 since 2026-09-28), not a flat
 * 50.
 */
import { CARD_TYPES, CARD_TYPE_SHORT } from "@/lib/card-sets";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";

export type Kind = "hit" | "sp" | "rp";
export const KINDS: ReadonlyArray<readonly [Kind, string]> = [["hit", "Hitters"], ["sp", "Starters"], ["rp", "Relievers"]];
const NOUN: Record<Kind, string> = { hit: "hitters", sp: "starters", rp: "relievers" };

export const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
const POS_CHOICES: readonly string[] = [...HIT_POS, "DH"];

/** A draft round's value window: [label, lowest, highest]. */
export const WINDOWS: ReadonlyArray<readonly [label: string, lo: number, hi: number]> = [
  ["Any", 0, 999], ["101+", 101, 999], ["100", 100, 100], ["Perfect", 100, 999], ["Diamond", 90, 99],
  ["Gold", 80, 89], ["Silver", 70, 79], ["Bronze", 60, 69], ["Iron", 40, 59],
];

/** Min PA (bats) or BF (arms) until changed: enough play for the line to mean something. */
export const DEFAULT_MIN = "300";

export interface PlayedFilters {
  kind: Kind;
  /** Index into WINDOWS. A typed value (lo / hi) replaces it. */
  win: number;
  lo: string;
  hi: string;
  /** "all", a fielding position (at or above the glove floor) or "DH" (every bat). */
  pos: string;
  /** "all", "L", "R", or "S" (switch hitters). A hitter's L or R includes switch hitters. */
  hand: string;
  y1: string;
  y2: string;
  /** Min PA or BF as typed; "" is no minimum. */
  min: string;
  own: boolean;
  q: string;
  /** Card sets; empty is every set. */
  sets: number[];
}

/** What the filters read off a line (PlayedLine carries all of it). */
export interface FilterLine {
  name: string;
  val: number | null;
  role: string | null;
  isPitcher: boolean;
  bats: string | null;
  throws: string | null;
  year: number | null;
  owned: boolean;
  /** PA (bats) or BF (arms) on record. */
  n: number;
  cardType: number | null;
  defPos: Record<string, number> | null;
}

/** The board as it opens; with an event, its set rule is the Sets default. */
export function defaultFilters(eventSets: readonly number[] | null = null): PlayedFilters {
  return { kind: "hit", win: 0, lo: "", hi: "", pos: "all", hand: "all", y1: "", y2: "", min: DEFAULT_MIN, own: false, q: "", sets: [...(eventSets ?? [])] };
}

export const kindOf = (l: Pick<FilterLine, "isPitcher" | "role">): Kind => (!l.isPitcher ? "hit" : l.role === "SP" ? "sp" : "rp");

/** The lowest rating that plays at a position: L.J.'s floor, and rated there at all (1B has no floor). */
export const posFloor = (pos: string): number => Math.max(1, posFloorAt(LJ_FLOOR, pos));

/** Positions a hitter plays at or above the floor, best first: "LF 115 · CF 97". */
export function ratedAt(defPos: Record<string, number> | null, max = 4): string {
  if (!defPos) return "";
  return Object.entries(defPos)
    .filter(([p, v]) => v >= posFloor(p))
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([p, v]) => `${p} ${v}`)
    .join(" · ");
}

/** Switching kind starts its hand and position over: "S" means nothing to an arm, "C" nothing to a pen. */
export function withKind(f: PlayedFilters, kind: Kind): PlayedFilters {
  return f.kind === kind ? f : { ...f, kind, hand: "all", pos: "all" };
}

const typed = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

/** The value range in effect: typed bounds (either may be open) or else the window. */
export function valueRange(f: Pick<PlayedFilters, "win" | "lo" | "hi">): [lo: number, hi: number] {
  const lo = typed(f.lo), hi = typed(f.hi);
  if (lo != null || hi != null) return [lo ?? 0, hi ?? 999];
  const w = WINDOWS[f.win] ?? WINDOWS[0];
  return [w[1], w[2]];
}

/** The minimum PA / BF in effect; an empty field is no minimum. */
export const minOf = (f: Pick<PlayedFilters, "min">): number => typed(f.min) ?? 0;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matches(l: FilterLine, f: PlayedFilters): boolean {
  if (kindOf(l) !== f.kind) return false;
  const [lo, hi] = valueRange(f);
  if (l.val != null && (l.val < lo || l.val > hi)) return false;
  if (f.kind === "hit" && f.pos !== "all" && f.pos !== "DH" && !((l.defPos?.[f.pos] ?? 0) >= posFloor(f.pos))) return false;
  if (f.hand !== "all") {
    const h = f.kind === "hit" ? l.bats : l.throws;
    if (f.hand === "S" ? h !== "S" : !(h === f.hand || (f.kind === "hit" && h === "S"))) return false;
  }
  const y1 = typed(f.y1), y2 = typed(f.y2);
  if (y1 != null && (l.year ?? 0) < y1) return false;
  if (y2 != null && (l.year ?? 9999) > y2) return false;
  if (l.n < minOf(f)) return false;
  if (f.own && !l.owned) return false;
  if (f.sets.length && (l.cardType == null || !f.sets.includes(l.cardType))) return false;
  const q = fold(f.q.trim());
  return !q || fold(l.name).includes(q);
}

export const filterLines = <T extends FilterLine>(lines: readonly T[], f: PlayedFilters): T[] => lines.filter((l) => matches(l, f));

/** How many lines of this kind there are: the count's denominator. */
export const countOfKind = (lines: readonly Pick<FilterLine, "isPitcher" | "role">[], kind: Kind): number =>
  lines.reduce((n, l) => n + (kindOf(l) === kind ? 1 : 0), 0);

const n0 = (x: number) => x.toLocaleString("en-US");

/** "1,544 of 2,288 hitters", or "52 of 187 hitters legal in Daily All-Star Hardware Slots". */
export function countLine(shown: number, total: number, kind: Kind, eventName?: string | null): string {
  return `${n0(shown)} of ${n0(total)} ${NOUN[kind]}${eventName ? ` legal in ${eventName}` : ""}`;
}

/* ------------------------------------------------------------------ the URL */

const sameSets = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((t, i) => t === b[i]);

function parseSets(s: string, eventSets: readonly number[] | null): number[] {
  const codes = s.split(",").map((x) => Number(x.trim()))
    .filter((t) => (CARD_TYPES as readonly number[]).includes(t) && (!eventSets || eventSets.includes(t)));
  return [...new Set(codes)].sort((a, b) => a - b);
}

/**
 * The filters a URL carries: kind, win, lo, hi, pos, hand, y1, y2, min, own,
 * q and sets. Anything missing or unreadable is the default, so an old or
 * hand-typed link still opens the board.
 */
export function filtersFromParams(get: (key: string) => string | null | undefined, eventSets: readonly number[] | null = null): PlayedFilters {
  const d = defaultFilters(eventSets);
  const kind = KINDS.find(([k]) => k === get("kind"))?.[0] ?? d.kind;
  const w = (get("win") ?? "").toLowerCase();
  const win = Math.max(0, WINDOWS.findIndex(([label]) => label.toLowerCase() === w));
  const digits = (key: string, max = 4) => {
    const v = (get(key) ?? "").trim();
    return new RegExp(`^\\d{1,${max}}$`).test(v) ? v : "";
  };
  const pos = get("pos") ?? "";
  const hand = get("hand") ?? "";
  const min = get("min");
  const setsParam = get("sets");
  const picked = setsParam && setsParam !== "all" ? parseSets(setsParam, eventSets) : [];
  return {
    kind,
    win,
    lo: digits("lo", 3),
    hi: digits("hi", 3),
    pos: kind === "hit" && POS_CHOICES.includes(pos) ? pos : "all",
    hand: ["L", "R", ...(kind === "hit" ? ["S"] : [])].includes(hand) ? hand : "all",
    y1: digits("y1"),
    y2: digits("y2"),
    min: min == null ? DEFAULT_MIN : min === "" || /^\d{1,6}$/.test(min) ? min : DEFAULT_MIN,
    own: get("own") === "1",
    q: (get("q") ?? "").slice(0, 60),
    // "all" is every set on purpose; a list that reads as nothing is the default.
    sets: setsParam === "all" ? [] : picked.length ? picked : d.sets,
  };
}

/** The URL's part of the filters: only what differs from the default, so a plain board is a plain URL. */
export function filtersToParams(f: PlayedFilters, eventSets: readonly number[] | null = null): URLSearchParams {
  const d = defaultFilters(eventSets);
  const p = new URLSearchParams();
  if (f.kind !== d.kind) p.set("kind", f.kind);
  if (f.win !== 0 && WINDOWS[f.win]) p.set("win", WINDOWS[f.win][0]);
  if (f.lo) p.set("lo", f.lo);
  if (f.hi) p.set("hi", f.hi);
  if (f.pos !== "all") p.set("pos", f.pos);
  if (f.hand !== "all") p.set("hand", f.hand);
  if (f.y1) p.set("y1", f.y1);
  if (f.y2) p.set("y2", f.y2);
  if (f.min !== DEFAULT_MIN) p.set("min", f.min);
  if (f.own) p.set("own", "1");
  if (f.q.trim()) p.set("q", f.q);
  if (!sameSets(f.sets, d.sets)) p.set("sets", f.sets.length ? f.sets.join(",") : "all");
  return p;
}

/* ---------------------------------------------------------------- the chips */

export type ChipKey = "win" | "value" | "pos" | "hand" | "years" | "min" | "own" | "sets";
export interface FilterChip { key: ChipKey; label: string }

/** "80–89", "100", "1990+", "up to 1969". */
const span = (lo: string | number, hi: string | number) =>
  lo !== "" && hi !== "" ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : lo !== "" ? `${lo}+` : `up to ${hi}`;

/**
 * The secondary filters in effect, as removable chips ("Gold 80–89", "At C",
 * "Min PA 1000"). The kind and the search sit on the bar itself.
 */
export function activeFilters(f: PlayedFilters, eventSets: readonly number[] | null = null): FilterChip[] {
  const d = defaultFilters(eventSets);
  const out: FilterChip[] = [];
  if (f.lo || f.hi) out.push({ key: "value", label: `Value ${span(f.lo, f.hi)}` });
  else if (f.win !== 0 && WINDOWS[f.win]) {
    const [label, lo, hi] = WINDOWS[f.win];
    out.push({ key: "win", label: /\d/.test(label) ? `Value ${label}` : `${label} ${hi >= 999 ? `${lo}+` : span(lo, hi)}` });
  }
  if (f.pos !== "all") out.push({ key: "pos", label: `At ${f.pos}` });
  if (f.hand !== "all") out.push({ key: "hand", label: f.hand === "S" ? "Switch hitters" : `${f.kind === "hit" ? "Bats" : "Throws"} ${f.hand}` });
  if (f.y1 || f.y2) out.push({ key: "years", label: `Years ${span(f.y1, f.y2)}` });
  const unit = f.kind === "hit" ? "PA" : "BF";
  if (f.min !== DEFAULT_MIN) out.push({ key: "min", label: f.min === "" || typed(f.min) === 0 ? `No min ${unit}` : `Min ${unit} ${f.min}` });
  if (f.own) out.push({ key: "own", label: "Owned only" });
  if (!sameSets(f.sets, d.sets)) out.push({ key: "sets", label: f.sets.length ? `Sets ${f.sets.map((t) => CARD_TYPE_SHORT[t] ?? t).join(" + ")}` : "Every set" });
  return out;
}

/** One chip's filter back to its default. */
export function clearChip(f: PlayedFilters, key: ChipKey, eventSets: readonly number[] | null = null): PlayedFilters {
  const d = defaultFilters(eventSets);
  switch (key) {
    case "win": return { ...f, win: 0 };
    case "value": return { ...f, lo: "", hi: "" };
    case "pos": return { ...f, pos: "all" };
    case "hand": return { ...f, hand: "all" };
    case "years": return { ...f, y1: "", y2: "" };
    case "min": return { ...f, min: DEFAULT_MIN };
    case "own": return { ...f, own: false };
    case "sets": return { ...f, sets: d.sets };
  }
}

/** Every filter and the search back to the default; the kind stays. */
export const clearFilters = (f: PlayedFilters, eventSets: readonly number[] | null = null): PlayedFilters => ({ ...defaultFilters(eventSets), kind: f.kind });

/** "Gold 80–89 · At C · “piazza”": what an empty board was filtered by. */
export function describeFilters(f: PlayedFilters, eventSets: readonly number[] | null = null): string {
  const parts = activeFilters(f, eventSets).map((c) => c.label);
  if (f.q.trim()) parts.push(`“${f.q.trim()}”`);
  return parts.join(" · ");
}
