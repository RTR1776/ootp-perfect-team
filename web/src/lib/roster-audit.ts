/**
 * The checks every tournament roster must show before it goes to L.J.
 * (2026-10-04: "you can't keep making these lineup mistakes ... you have to
 * know the era, how many RP, how many SP, what are others using, what is pitch
 * count, backups"). Not a legality check (validateRoster is that): these are
 * the baseball calls the optimiser's objective does not price.
 *
 *   - staff: at most MAX_ARMS arms and MAX_RP relievers, beside what the
 *     series' best quarter actually carried (field-construction.json)
 *   - stamina: every starter can go a starter's distance for the era, and the
 *     pen has a long man
 *   - backups: every fielding position has a second card who can play it at
 *     L.J.'s floor, so no regular has to play every inning (Banks, 10-04)
 */
import { MAX_ARMS, MAX_RP, MAX_SP } from "./roster-fill";
import { posFloorAt, type PosFloor } from "./pos-floor";

export interface AuditCard { cardId: number; name: string; isPitcher: boolean; ratings: Record<string, number> }
export interface FieldShape { sp: number; rp: number; bats: number; label: string }
export interface AuditLine { ok: boolean; text: string }

/** A starter's minimum stamina by run environment: older eras ask starters to go deeper. */
export function starterStaminaFloor(envYear: number | null | undefined): number {
  if (envYear == null || envYear >= 1980) return 50;
  if (envYear >= 1950) return 60;
  if (envYear >= 1920) return 70;
  return 80;
}
export const LONG_MAN_STAMINA = 45;

export function auditRoster(o: {
  slots: Record<string, number>;
  cards: Map<number, AuditCard>;
  lineupPos: readonly string[];
  envYear: number | null | undefined;
  posFloor: PosFloor | null | undefined;
  field?: FieldShape | null;
}): AuditLine[] {
  const out: AuditLine[] = [];
  const get = (id: number | undefined) => (id == null ? undefined : o.cards.get(id));
  const ids = [...new Set(Object.values(o.slots))];
  const members = ids.map((id) => get(id)).filter((c): c is AuditCard => c != null);
  const sp = Object.entries(o.slots).filter(([k]) => /^SP\d/.test(k)).map(([, id]) => get(id)!).filter(Boolean);
  const rp = Object.entries(o.slots).filter(([k]) => k === "CL" || /^RP\d/.test(k)).map(([, id]) => get(id)!).filter(Boolean);
  const bats = members.filter((c) => !c.isPitcher);
  const arms = sp.length + rp.length;
  const f = o.field ? ` · ${o.field.label}: ${o.field.sp.toFixed(1)} SP / ${o.field.rp.toFixed(1)} RP / ${o.field.bats.toFixed(1)} bats` : "";
  out.push({ ok: arms <= MAX_ARMS && rp.length <= MAX_RP && sp.length <= MAX_SP, text: `staff ${sp.length} SP / ${rp.length} RP / ${bats.length} bats (caps: ${MAX_SP} SP, ${MAX_RP} RP, ${MAX_ARMS} arms)${f}` });

  const floor = starterStaminaFloor(o.envYear);
  const short = sp.filter((c) => (c.ratings.Stamina ?? 0) < floor);
  out.push({ ok: short.length === 0, text: `starters' stamina ${sp.map((c) => `${c.name} ${c.ratings.Stamina ?? "?"}`).join(", ")} (era floor ${floor})${short.length ? ` — SHORT: ${short.map((c) => c.name).join(", ")}` : ""}` });
  const long = rp.filter((c) => (c.ratings.Stamina ?? 0) >= LONG_MAN_STAMINA);
  out.push({ ok: long.length >= 2, text: long.length ? `stamina guys in the pen (${LONG_MAN_STAMINA}+): ${long.map((c) => `${c.name} ${c.ratings.Stamina}`).join(", ")}${long.length < 2 ? " — need 2" : ""}` : `no long man: every reliever under stamina ${LONG_MAN_STAMINA}` });

  for (const pos of o.lineupPos) {
    if (pos === "DH") continue;
    const fl = Math.max(1, posFloorAt(o.posFloor, pos));
    const can = bats.filter((c) => (c.ratings[`Pos Rating ${pos}`] ?? 0) >= fl);
    const starters = new Set([o.slots[`R:${pos}`], o.slots[`L:${pos}`]].filter((x) => x != null));
    const backups = can.filter((c) => !starters.has(c.cardId) || starters.size > 1);
    const ok = can.length >= 2;
    out.push({ ok, text: `${pos.padEnd(2)} backup: ${ok ? can.filter((c) => !(starters.size === 1 && starters.has(c.cardId))).map((c) => `${c.name} ${c.ratings[`Pos Rating ${pos}`]}`).join(", ") || backups.map((c) => c.name).join(", ") : `NONE — only ${can.map((c) => c.name).join(", ") || "nobody"} can play it (floor ${fl})`}` });
  }
  return out;
}

/**
 * The game uses the slot ORDER: SP1 starts the most games and the closer
 * closes. The optimiser treats the rotation and pen slots as interchangeable,
 * so it can hand the CL slot to its worst reliever (Axford, 10-04). Reorder
 * both best-first by `value` (runs saved); every card keeps its role.
 */
export function orderStaff(slots: Record<string, number>, value: (id: number) => number): Record<string, number> {
  const out = { ...slots };
  const sp = Object.keys(slots).filter((k) => /^SP\d+$/.test(k)).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  const pen = ["CL", ...Object.keys(slots).filter((k) => /^RP\d+$/.test(k)).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)))].filter((k) => k in slots);
  for (const keys of [sp, pen]) {
    const ids = keys.map((k) => slots[k]).sort((a, b) => value(b) - value(a));
    keys.forEach((k, i) => { out[k] = ids[i]; });
  }
  return out;
}
