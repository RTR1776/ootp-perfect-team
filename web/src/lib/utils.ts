import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a baseball slash-line stat (e.g. .312) without leading zero. */
export function fmtRate(n: number | undefined | null, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—";
  const s = n.toFixed(digits);
  return s.startsWith("0.") ? s.slice(1) : s;
}

/** Format a generic decimal (FIP, K9, WAR). */
export function fmtNum(n: number | undefined | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

/** Format a Perfect Team market value (in PP) from a parsed number. */
export function fmtMoney(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n) || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M PP`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K PP`;
  return `${n} PP`;
}
