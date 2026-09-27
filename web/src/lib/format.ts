/**
 * One way to print each kind of number and date across the app.
 *
 * Pages each grew their own helpers (cards, played, market, build, runenv…),
 * and they disagreed: "0.326" here and ".326" there, "-0.0" in red, innings as
 * "19.33", and an upload date that read "(-1d)" before noon UTC. Each page
 * swaps its local copy for these as it is touched (UI plan G3).
 *
 * Minus signs are U+2212 so signed columns line up with plus signs. Dates are
 * calendar days in America/Chicago, where L.J. plays, not UTC.
 */

const MINUS = "−";
export const TIME_ZONE = "America/Chicago";

/** A rate like wOBA or AVG: ".341", "−.012", "1.034". */
export function rate3(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const s = Math.abs(x).toFixed(3).replace(/^0(?=\.)/, "");
  return x < 0 && s !== ".000" ? `${MINUS}${s}` : s;
}

/**
 * A signed number: "+4.2", "−1.0". Rounds first, so a value that rounds to
 * zero prints "0.0" with no sign (and so takes no colour; see tone()).
 */
export function signed(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const s = Math.abs(x).toFixed(digits);
  if (Number(s) === 0) return s;
  return `${x < 0 ? MINUS : "+"}${s}`;
}

/** A share as a percent: pct(0.342) → "34%", pct(0.342, 1) → "34.2%". */
export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

/** Perfect Points (PP), compact: "1,800", "22k", "2.50M". Show the exact value in a title. */
export function pp(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const a = Math.abs(x), sign = x < 0 ? MINUS : "";
  if (a >= 999_500) return `${sign}${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}${Math.round(a / 1000)}k`;
  return `${sign}${Math.round(a).toLocaleString("en-US")}`;
}

/** Innings from a decimal: 19.333 → "19.1" (outs, not tenths). */
export function ip(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const outs = Math.round(x * 3);
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

/**
 * 'positive' | 'negative' | null for colouring a signed delta. The dead band is
 * half the last digit shown, so a number that prints as zero is never coloured.
 */
export function tone(x: number | null | undefined, digits = 1): "positive" | "negative" | null {
  if (x == null || !Number.isFinite(x)) return null;
  const eps = 0.5 * 10 ** -digits;
  return x >= eps ? "positive" : x <= -eps ? "negative" : null;
}

/* ------------------------------------------------------------------ dates */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const chicagoParts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * The Chicago calendar day of a moment, as "YYYY-MM-DD". A bare "YYYY-MM-DD"
 * is already a calendar day (a league week, a period date) and is kept as is.
 */
export function chicagoDay(d: Date | string | null | undefined): string | null {
  if (d == null || d === "") return null;
  if (typeof d === "string" && ISO_DAY.test(d)) return d;
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return chicagoParts.format(t);
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

/** Whole Chicago calendar days from d to now; never negative. Null when d is missing. */
export function daysAgo(d: Date | string | null | undefined, now: Date = new Date()): number | null {
  const then = chicagoDay(d), today = chicagoDay(now);
  if (!then || !today) return null;
  return Math.max(0, Math.round(dayNumber(today) - dayNumber(then)));
}

/** "today", "1d", "6d". */
export function ago(d: Date | string | null | undefined, now: Date = new Date()): string {
  const n = daysAgo(d, now);
  return n == null ? "—" : n === 0 ? "today" : `${n}d`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 27", with the year only when it isn't the current one: "Sep 27, 2025". */
export function date(d: Date | string | null | undefined, now: Date = new Date()): string {
  const iso = chicagoDay(d);
  if (!iso) return "—";
  const label = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  return iso.slice(0, 4) === chicagoDay(now)!.slice(0, 4) ? label : `${label}, ${iso.slice(0, 4)}`;
}

/** "Sep 7 – Oct 4". */
export function range(a: Date | string | null | undefined, b: Date | string | null | undefined, now: Date = new Date()): string {
  return `${date(a, now)} – ${date(b, now)}`;
}
