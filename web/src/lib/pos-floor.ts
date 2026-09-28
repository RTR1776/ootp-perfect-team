/**
 * L.J.'s glove floor, per position.
 *
 * "I am not playing a 50 or below anywhere but 1B" (2026-09) became "I don't
 * mind bad defense (50–70) at 1B and maybe LF" (2026-09-16): no floor at first,
 * 50 in left, 70 everywhere else. Then "let all positions have a floor of 60"
 * (2026-09-28, when the C 70 kept his Piazza variant's C 69 off the Card
 * Model's boards): 60 at every position, first base and left included. A plain
 * number keeps the older shape — that floor everywhere except first base and DH.
 *
 * Flag form: --min-pos 70            (70 everywhere, 1B/DH exempt)
 *            --min-pos 70,1B:0,LF:50 (per position; the bare number is the default)
 */
export type PosFloor = number | ({ default?: number } & Partial<Record<string, number>>);

export const LJ_FLOOR: PosFloor = { default: 60 };

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

/**
 * The floor in words, for the Draft Board's footer and the scripts' headers:
 * LJ_FLOOR reads "60". DH never has one (no glove).
 */
export function describePosFloor(f: PosFloor | null | undefined): string {
  if (f == null) return "none";
  if (typeof f === "number") return `${f}; none at 1B`;
  const others = Object.entries(f).filter((e): e is [string, number] => e[0] !== "default" && e[1] != null);
  const floors = others.filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`);
  const none = others.filter(([, v]) => v <= 0).map(([k]) => k);
  return [f.default ? String(f.default) : "none", ...floors, ...(none.length ? [`none at ${none.join(", ")}`] : [])].join("; ");
}
