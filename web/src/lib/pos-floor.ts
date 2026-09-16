/**
 * L.J.'s glove floor, per position.
 *
 * "I am not playing a 50 or below anywhere but 1B" (2026-09) became "I don't
 * mind bad defense (50–70) at 1B and maybe LF" (2026-09-16): no floor at first,
 * 50 in left, 70 everywhere else. A plain number keeps the older shape — that
 * floor everywhere except first base and DH.
 *
 * Flag form: --min-pos 70            (70 everywhere, 1B/DH exempt)
 *            --min-pos 70,1B:0,LF:50 (per position; the bare number is the default)
 */
export type PosFloor = number | ({ default?: number } & Partial<Record<string, number>>);

export const LJ_FLOOR: PosFloor = { default: 70, "1B": 0, LF: 50 };

export function posFloorAt(f: PosFloor | null | undefined, pos: string): number {
  if (f == null || pos === "DH") return 0;
  if (typeof f === "number") return pos === "1B" ? 0 : f;
  return f[pos] ?? f.default ?? 0;
}

export function parsePosFloor(s: string | undefined | null): PosFloor | null {
  if (s == null || s === "") return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const out: { default?: number } & Partial<Record<string, number>> = {};
  for (const part of s.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [k, v] = part.includes(":") ? part.split(":") : ["default", part];
    const n = Number(v); if (!Number.isFinite(n)) throw new Error(`bad --min-pos part "${part}"`);
    out[k === "default" ? "default" : k.toUpperCase()] = n;
  }
  return out;
}

export function describePosFloor(f: PosFloor | null | undefined): string {
  if (f == null) return "none";
  if (typeof f === "number") return `${f} (1B/DH exempt)`;
  const parts = Object.entries(f).filter(([k]) => k !== "default").map(([k, v]) => `${k} ${v}`);
  return `${f.default ?? 0}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}
