/**
 * The cap ledger: what each card's cap buys, in a cap event.
 *
 * L.J., 2026-10-31 (Early Years Cap, a 41 SP4 beside four 46-48 bench bats):
 * "We need a way to value cards against the cap in cap tourneys." The search
 * already prices the cap (its λ), but nothing showed where the points went.
 *
 * For each rostered card: his value above the floor (the cheapest card the pool
 * can field), and the runs he adds over the best unrostered FLOOR card that can
 * take every slot he holds (same position floor, same role). Runs per cap point
 * is the price he pays; the roster's own average is the yardstick. A card that
 * is there for a rule rather than his runs is named with the rule: the backup
 * positions he alone covers, or the second catcher.
 */
import type { FillCard, FillResult } from "./roster-fill";
import type { RosterRules } from "./roster-rules";
import { posFloorAt, type PosFloor } from "./pos-floor";
import { backupPositions, capFloorValue, missingBackups } from "./roster-optimize";
import { cardEligibility } from "./roster-rules";
import { unitOf } from "./two-way";

export interface LedgerRow {
  cardId: number;
  name: string;
  val: number;
  /** Value above the floor: the cap he costs over a floor card. */
  above: number;
  slots: string[];
  role: "lineup" | "SP" | "pen" | "bench";
  /** Objective runs he adds over the best floor card in his slots (null: no floor card can take them). */
  runs: number | null;
  sub: string | null;
  perPoint: number | null;
  /** Rules he satisfies that a floor card in his place would break. */
  why: string[];
}

export interface CapLedger {
  floorValue: number;
  rows: LedgerRow[];
  /** Runs per cap point across every card above the floor. */
  avgPerPoint: number | null;
}

const fieldPos = (key: string): string | null => {
  const m = /^[RL]:(.+)$/.exec(key);
  return m && m[1] !== "DH" ? m[1]! : null;
};

/** Whether `c` may take slot `key`: the role, and at a fielding position the floor. */
function fits(c: FillCard, key: string, posFloor: PosFloor | undefined): boolean {
  if (/^SP\d+$/.test(key)) return c.isPitcher && (c.role === "SP" || c.role == null);
  if (key === "CL" || /^RP\d+$/.test(key)) return c.isPitcher;
  if (c.isPitcher) return false;
  const pos = fieldPos(key);
  return pos == null || (c.ratings[`Pos Rating ${pos}`] ?? 0) >= Math.max(1, posFloorAt(posFloor, pos));
}

export function capLedger(o: {
  slots: FillResult;
  pool: readonly FillCard[];
  rules: RosterRules;
  objective: (s: FillResult) => number;
  posFloor?: PosFloor;
  minCatchers?: number;
}): CapLedger | null {
  const fv = capFloorValue(o.pool, o.rules);
  if (fv == null) return null;
  const byId = new Map(o.pool.map((c) => [c.cardId, c]));
  const onRoster = new Set(Object.values(o.slots));
  const floorCards = o.pool.filter((c) => c.val != null && c.val <= fv && !onRoster.has(c.cardId)
    && (c.variant ? c.variantOwned : c.baseOwned) && !cardEligibility(c, o.rules).errors.length);
  const base = o.objective(o.slots);
  const backupPos = backupPositions(o.pool, o.rules, o.posFloor);
  const missingNow = new Set(missingBackups(o.slots, byId, backupPos));
  const wantC = o.minCatchers ?? 0;
  const cFloor = Math.max(1, posFloorAt(o.posFloor, "C"));
  const catchers = (s: FillResult) => [...new Set(Object.values(s))].filter((id) => {
    const c = byId.get(id); return c && !c.isPitcher && (c.ratings["Pos Rating C"] ?? 0) >= cFloor;
  }).length;

  const rows: LedgerRow[] = [];
  const doneUnits = new Set<number>();
  for (const id of onRoster) {
    const c = byId.get(id);
    if (!c) continue;
    // A two-way card in both roles is one card: one row, every slot either form holds.
    if (doneUnits.has(unitOf(id))) continue;
    doneUnits.add(unitOf(id));
    const keys = Object.entries(o.slots).filter(([, v]) => unitOf(v) === unitOf(id)).map(([k]) => k);
    const role: LedgerRow["role"] = keys.some((k) => /^SP\d+$/.test(k)) ? "SP"
      : keys.some((k) => k === "CL" || /^RP\d+$/.test(k)) ? "pen"
      : keys.some((k) => /^[RL]:/.test(k)) ? "lineup" : "bench";
    let best = -Infinity, bestCard: FillCard | null = null, bestSlots: FillResult | null = null;
    // A starter's floor first; where no floor card clears it (SS 85 at the floor value is rare),
    // any floor card who can stand there at all: the objective prices the glove he brings.
    for (const floor of [o.posFloor, 1] as const) {
      for (const f of floorCards) {
        if (!keys.every((k) => fits(f, k, floor))) continue;
        const s = { ...o.slots };
          for (const k of keys) s[k] = f.cardId;
        const sc = o.objective(s);
        if (sc > best) { best = sc; bestCard = f; bestSlots = s; }
      }
      if (bestCard) break;
    }
    const above = (c.val ?? fv) - fv;
    const runs = bestCard ? base - best : null;
    const why: string[] = [];
    // The rules a floor card in his place would break (with no floor card for his slots, any card would).
    const swapped = bestSlots ?? Object.fromEntries(Object.entries(o.slots).filter(([, v]) => unitOf(v) !== unitOf(id)));
    const lost = missingBackups(swapped, byId, backupPos).filter((m) => !missingNow.has(m)).map((m) => m.split(" ")[0]!);
    if (lost.length) why.push(`backup ${[...new Set(lost)].join("/")}`);
    if (wantC >= 2 && catchers(swapped) < wantC && catchers(o.slots) >= wantC) why.push("2nd C");
    rows.push({ cardId: id, name: c.name, val: c.val ?? fv, above, slots: keys, role, runs,
      sub: bestCard?.name ?? null, perPoint: runs != null && above > 0 ? runs / above : null, why });
  }
  const paid = rows.filter((r) => r.above > 0 && r.runs != null);
  const pts = paid.reduce((n, r) => n + r.above, 0);
  const avgPerPoint = pts > 0 ? paid.reduce((n, r) => n + r.runs!, 0) / pts : null;
  rows.sort((a, b) => b.above - a.above || (b.runs ?? 0) - (a.runs ?? 0));
  return { floorValue: fv, rows, avgPerPoint };
}

/** A leak: cap spent above the floor that buys under half the roster's average runs per point, with no rule behind it. */
export const isLeak = (r: LedgerRow, avg: number | null): boolean =>
  r.above >= 3 && r.why.length === 0 && avg != null && r.runs != null && r.runs < 0.5 * avg * r.above;
