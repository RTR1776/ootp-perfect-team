"use client";

/**
 * The builder laid out on a field (L.J., 2026-10-16: "I want our builder to
 * look more like this", databot's builder): candidates grouped by position on
 * the left, the lineup on a diamond in the middle, the staff and bench in the
 * roster panel beside it.
 *
 * Every number is the builder's own scorer, in runs per 700 PA in this event:
 *   Off — the bat (runsR / runsL: calibrated, park and era, observed play
 *         blended in), against the chosen hand; "Total" reads it at the
 *         field's share of left-handed pitching.
 *   Def — the glove at that spot, priced the way the optimiser prices it
 *         (fieldingRuns × the event's glove weight, plus framing at C).
 * Arms show their runs saved per 700 batters faced. Nothing here is a second
 * model; their split and their sum are what the optimiser adds up.
 */

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import { TIER_NAME, TIER_ORDER, tierCode, type TierCode } from "@/lib/roster-rules";
import type { BuilderCard, UpgradeCard } from "@/components/roster-builder";
import { FieldBackdrop, FIELD_SPOT, surname } from "@/components/diamond";
import { ParkBackdrop, ParkBanner } from "@/components/park-backdrop";
import { parkView } from "@/lib/park-shape";

type Split = "T" | "L" | "R";
type Measure = "T" | "O" | "D";

interface Props {
  lineupPos: string[];
  slots: Record<string, number | null>;
  byId: Map<number, BuilderCard>;
  /** Legal owned cards, bans and the Sets chips already applied. */
  pool: BuilderCard[];
  upgrades: UpgradeCard[];
  runsR: Map<number, number> | null;
  runsL: Map<number, number> | null;
  lhpShare: number;
  /** The optimiser's glove weight (gloveScale × the era's team weight). */
  glove: number;
  /** Catcher framing's team weight (calibration.ts teamWeights `frm`); 1 when absent. */
  framing?: number;
  eraYear: number | null;
  spKeys: string[];
  rpKeys: string[];
  selected: string | null;
  onSelect: (slot: string | null) => void;
  /** Put a hitter at a position on the given boards, as one undo step. */
  placeBat: (cardId: number, pos: string, hands: Array<"R" | "L">) => void;
  /** Put an arm in the selected staff slot, else the first open one of its role. */
  placeArm: (cardId: number, role: "SP" | "RP") => void;
  startDrag: (e: React.DragEvent, payload: string) => void;
  dropOnSlot: (slot: string, payload: string) => void;
  dupNames: Set<string>;
  onPeek: (e: React.MouseEvent<HTMLElement>, c: BuilderCard) => void;
  clearPeek: () => void;
  /** Buttons at the end of the toolbar (the builder's exports). */
  toolbar?: React.ReactNode;
  /** The event's stadium ("1927 Yankee Stadium"): its real field is drawn when its dimensions are on file. */
  stadium?: string | null;
}

/** Where each position sits on the diamond, in % of the field box (left, top). */
const SPOT = FIELD_SPOT;

const TIER_BAR: Record<TierCode, string> = {
  P: "bg-tier-perfect", D: "bg-tier-diamond", G: "bg-tier-gold", S: "bg-tier-silver", B: "bg-tier-bronze", I: "bg-tier-iron",
};
const TIER_CHIP: Record<TierCode, string> = {
  P: "border-tier-perfect text-tier-perfect", D: "border-tier-diamond text-tier-diamond", G: "border-tier-gold text-tier-gold",
  S: "border-tier-silver text-tier-silver", B: "border-tier-bronze text-tier-bronze", I: "border-tier-iron text-tier-iron",
};

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
const SHOW = 8;

export function FieldView(p: Props) {
  const [split, setSplit] = React.useState<Split>("T");
  const [measure, setMeasure] = React.useState<Measure>("T");
  const [tiers, setTiers] = React.useState<Set<TierCode>>(new Set());
  const [open, setOpen] = React.useState<Set<string>>(new Set(["C"]));
  const [more, setMore] = React.useState<Record<string, number>>({});
  const [detail, setDetail] = React.useState<Set<string>>(new Set());

  const runsR = p.runsR, runsL = p.runsL;
  /** The event's park, drawn behind the lineup; null keeps the generic field. */
  const park = React.useMemo(() => parkView(p.stadium ?? null), [p.stadium]);
  /** The bat against the chosen hand ("Total": at the field's LHP share). */
  const off = React.useCallback((id: number, s: Split = split): number | null => {
    const r = runsR?.get(id), l = runsL?.get(id);
    if (r == null || l == null) return null;
    return s === "R" ? r : s === "L" ? l : (1 - p.lhpShare) * r + p.lhpShare * l;
  }, [runsR, runsL, p.lhpShare, split]);
  const def = React.useCallback((c: BuilderCard, pos: string): number => {
    if (pos === "DH") return 0;
    return p.glove * fieldingRuns(pos, c.ratings[`Pos Rating ${pos}`] ?? 0) + (pos === "C" ? (p.framing ?? 1) * framingRuns(c.ratings.CatcherFrame, p.eraYear) : 0);
  }, [p.glove, p.framing, p.eraYear]);
  const plays = (c: BuilderCard, pos: string) => {
    if (c.isPitcher) return false;
    if (pos === "DH") return true;
    const v = c.ratings[`Pos Rating ${pos}`] ?? 0;
    return v > 0 && v >= posFloorAt(LJ_FLOOR, pos);
  };
  const isStarter = (c: BuilderCard) => c.role === "SP" || (c.role == null && (c.ratings.Stamina ?? 0) >= 45);

  /** The boards a click fills, and the one the diamond shows. */
  const hands: Array<"R" | "L"> = split === "T" ? ["R", "L"] : [split];
  const showHand: "R" | "L" = split === "L" ? "L" : "R";

  const tierOk = (c: BuilderCard) => tiers.size === 0 || (c.val != null && tiers.has(tierCode(c.val)));

  type Row = { c: BuilderCard; o: number; d: number; v: number };
  const groups = React.useMemo(() => {
    const out: { key: string; label: string; arm: boolean; rows: Row[] }[] = [];
    for (const pos of p.lineupPos) {
      const rows: Row[] = [];
      for (const c of p.pool) {
        if (!plays(c, pos) || !tierOk(c)) continue;
        const o = off(c.cardId);
        if (o == null) continue;
        const d = def(c, pos);
        rows.push({ c, o, d, v: measure === "O" ? o : measure === "D" ? d : o + d });
      }
      out.push({ key: pos, label: pos, arm: false, rows: rows.sort((a, b) => b.v - a.v) });
    }
    for (const [key, label, want] of [["SP", "Starters", true], ["RP", "Relievers", false]] as const) {
      const rows: Row[] = [];
      for (const c of p.pool) {
        if (!c.isPitcher || isStarter(c) !== want || !tierOk(c)) continue;
        const r = runsR?.get(c.cardId);
        if (r == null) continue;
        rows.push({ c, o: r, d: 0, v: r });
      }
      out.push({ key, label, arm: true, rows: rows.sort((a, b) => b.v - a.v) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pool, p.lineupPos, off, def, measure, tiers, runsR]);

  /** Which slots each card holds now, for the "on the board" marks. */
  const holding = React.useMemo(() => {
    const m = new Map<number, string[]>();
    for (const [k, id] of Object.entries(p.slots)) if (id != null) m.set(id, [...(m.get(id) ?? []), k]);
    return m;
  }, [p.slots]);

  /** The diamond: each position's card(s) and their value on the chosen split. */
  const spots = React.useMemo(() => p.lineupPos.map((pos) => {
    const idR = p.slots[`R:${pos}`] ?? null, idL = p.slots[`L:${pos}`] ?? null;
    const cR = idR != null ? p.byId.get(idR) ?? null : null, cL = idL != null ? p.byId.get(idL) ?? null : null;
    const valOf = (c: BuilderCard | null, s: "R" | "L") => {
      if (!c) return null;
      const o = off(c.cardId, s);
      if (o == null) return null;
      const d = def(c, pos);
      return measure === "O" ? o : measure === "D" ? d : o + d;
    };
    const vR = valOf(cR, "R"), vL = valOf(cL, "L");
    const v = split === "R" ? vR : split === "L" ? vL : vR != null && vL != null ? (1 - p.lhpShare) * vR + p.lhpShare * vL : null;
    return { pos, cR, cL, v };
  }), [p.lineupPos, p.slots, p.byId, off, def, measure, split, p.lhpShare]);
  const boardTotal = spots.reduce((s, x) => s + (x.v ?? 0), 0);
  const filled = spots.filter((x) => (split === "L" ? x.cL : split === "R" ? x.cR : x.cR && x.cL)).length;

  /** The best legal card not owned, per position, for the field box's buy line. */
  const buyAt = React.useMemo(() => {
    const m = new Map<string, { name: string; gain: number }>();
    for (const s of spots) {
      const cur = s.v ?? 0;
      for (const u of p.upgrades) {
        if (u.isPitcher || !(s.pos === "DH" || ((u.ratings[`Pos Rating ${s.pos}`] ?? 0) > 0 && (u.ratings[`Pos Rating ${s.pos}`] ?? 0) >= posFloorAt(LJ_FLOOR, s.pos)))) continue;
        const o = split === "R" ? u.runsR ?? u.runs : split === "L" ? u.runsL ?? u.runs : u.runs;
        const d = s.pos === "DH" ? 0 : p.glove * fieldingRuns(s.pos, u.ratings[`Pos Rating ${s.pos}`] ?? 0);
        const gain = (measure === "O" ? o : measure === "D" ? d : o + d) - cur;
        if (gain > 1 && (!m.get(s.pos) || gain > m.get(s.pos)!.gain)) m.set(s.pos, { name: u.variant ? `${u.name} (VAR)` : u.name, gain });
      }
    }
    return m;
  }, [spots, p.upgrades, p.glove, split, measure]);

  if (!runsR || !runsL) {
    return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No run environment on file for this event, so there are no runs to put on the field.</p>;
  }

  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  const pick = (g: (typeof groups)[number], c: BuilderCard) => {
    if (g.arm) p.placeArm(c.cardId, g.key as "SP" | "RP");
    else p.placeBat(c.cardId, g.key, hands);
  };
  const seg = (on: boolean) => cn(
    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
    on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <div className="flex flex-col gap-3">
      {/* split · measure · tiers */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <span className="px-1.5 text-[11px] text-muted-foreground">Split</span>
          {(["T", "L", "R"] as Split[]).map((s) => (
            <button key={s} type="button" onClick={() => setSplit(s)} className={seg(split === s)}
              title={s === "T" ? `Both hands, at the field's ${Math.round(p.lhpShare * 100)}% left-handed pitching; a click fills both lineups` : `Against ${s === "L" ? "left" : "right"}-handed pitching; a click fills that lineup`}>
              {s === "T" ? "Total" : s === "L" ? "vs LHP" : "vs RHP"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <span className="px-1.5 text-[11px] text-muted-foreground">Runs</span>
          {(["T", "O", "D"] as Measure[]).map((m) => (
            <button key={m} type="button" onClick={() => setMeasure(m)} className={seg(measure === m)}>
              {m === "T" ? "Total" : m === "O" ? "Off" : "Def"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {[...TIER_ORDER].reverse().map((t) => (
            <button key={t} type="button" onClick={() => setTiers(toggle(tiers as Set<string>, t) as Set<TierCode>)}
              className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tiers.has(t) ? cn(TIER_CHIP[t], "bg-muted") : "border-border text-muted-foreground hover:text-foreground")}>
              {TIER_NAME[t]}
            </button>
          ))}
          {tiers.size > 0 && <button type="button" onClick={() => setTiers(new Set())} className="px-1 text-[11px] text-muted-foreground underline">clear</button>}
        </div>
        <span className="text-xs text-muted-foreground">
          {filled}/{p.lineupPos.length} filled · lineup <span className="font-mono text-foreground">{signed(boardTotal)}</span>
        </span>
        {p.toolbar && <div className="ml-auto flex items-center gap-1.5">{p.toolbar}</div>}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        {/* candidates by position */}
        <div className="flex max-h-[760px] flex-col gap-1.5 overflow-y-auto pr-1">
          {groups.map((g) => {
            const isOpen = open.has(g.key);
            const n = more[g.key] ?? SHOW;
            return (
              <div key={g.key} className="rounded-lg border border-border">
                <button type="button" onClick={() => setOpen(toggle(open, g.key))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold">
                  {isOpen ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                  {g.label}
                  <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">{g.rows.length}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-2 pb-2 pt-1">
                    <div className="flex justify-end px-1 pb-0.5 text-[10px] text-muted-foreground">
                      {g.arm ? "runs saved" : measure === "T" ? "Off+Def" : measure === "O" ? "Off" : "Def"}
                    </div>
                    {g.rows.length === 0 && <p className="px-1 py-1 text-xs text-muted-foreground">Nobody owned plays here{tiers.size ? " in those tiers" : ""}.</p>}
                    {g.rows.slice(0, n).map(({ c, o, d, v }) => {
                      const key = `${g.key}:${c.cardId}`;
                      const held = holding.get(c.cardId) ?? [];
                      const here = g.arm ? held.some((k) => !k.includes(":") && !k.startsWith("BN")) : held.some((k) => k.endsWith(`:${g.key}`));
                      const t = c.val != null ? tierCode(c.val) : null;
                      return (
                        <div key={key}>
                          <div
                            draggable
                            onDragStart={(e) => p.startDrag(e, `card:${c.cardId}`)}
                            onMouseEnter={(e) => p.onPeek(e, c)}
                            onMouseLeave={p.clearPeek}
                            className={cn("group flex items-center gap-1.5 rounded px-1 py-1 text-[13px] hover:bg-muted/60", here && "bg-primary/10")}
                          >
                            <span className={cn("h-4 w-1 shrink-0 rounded-full", t ? TIER_BAR[t] : "bg-border")} />
                            <button type="button" onClick={() => pick(g, c)} className="min-w-0 flex-1 truncate text-left"
                              title={g.arm ? `Put ${c.name} on the staff` : `Put ${c.name} at ${g.key}${split === "T" ? " in both lineups" : ` vs ${split}HP`}`}>
                              {c.name}{p.dupNames.has(c.name) && c.year ? <span className="text-muted-foreground"> ’{String(c.year).slice(2)}</span> : null}
                              {here && <span className="ml-1 text-[10px] text-primary">● on</span>}
                            </button>
                            {c.variant && <span className="rounded border border-border px-1 font-mono text-[9px] text-muted-foreground">VAR</span>}
                            <span className="w-6 text-right font-mono text-xs text-muted-foreground">{c.val ?? "?"}</span>
                            <span className={cn("w-12 text-right font-mono text-xs tabular-nums", v >= 0 ? "text-foreground" : "text-negative")}>{signed(v)}</span>
                            {!g.arm && (
                              <button type="button" aria-label="Off and Def" onClick={() => setDetail(toggle(detail, key))} className="text-muted-foreground hover:text-foreground">
                                {detail.has(key) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              </button>
                            )}
                          </div>
                          {!g.arm && detail.has(key) && (
                            <div className="flex gap-3 pb-1 pl-4 font-mono text-[11px] text-muted-foreground">
                              <span>Off {signed(o)}</span>
                              <span>Def {signed(d)}</span>
                              {g.key !== "DH" && <span>{g.key} {c.ratings[`Pos Rating ${g.key}`] ?? 0}</span>}
                              {split === "T" && <span>vR {signed(off(c.cardId, "R") ?? 0)} · vL {signed(off(c.cardId, "L") ?? 0)}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {g.rows.length > n && (
                      <button type="button" onClick={() => setMore({ ...more, [g.key]: n + SHOW })} className="px-1 pt-1 text-[11px] text-muted-foreground hover:text-foreground">
                        Show next {Math.min(SHOW, g.rows.length - n)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* the event's park, and the diamond on it */}
        <div className="flex min-w-0 flex-col gap-1.5 self-start">
          {park && <ParkBanner park={park} />}
          <div className="relative aspect-[5/4] min-h-[380px] overflow-hidden rounded-lg border border-border bg-[#0f1a12] dark:bg-[#0c140e]">
            {park ? <ParkBackdrop park={park} /> : <FieldBackdrop />}
            {spots.map((s) => {
              const [x, y] = SPOT[s.pos] ?? [50, 50];
              const slot = `${showHand}:${s.pos}`;
              const cur = showHand === "L" ? s.cL : s.cR;
              const platoon = split === "T" && s.cR && s.cL && s.cR.cardId !== s.cL.cardId;
              const buy = buyAt.get(s.pos);
              const sel = p.selected === slot || (split === "T" && p.selected === `L:${s.pos}`);
              return (
                <button
                  key={s.pos}
                  type="button"
                  onClick={() => {
                    p.onSelect(sel ? null : slot);
                    setOpen(new Set([...open, s.pos]));
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const d = e.dataTransfer.getData("text/plain");
                    // A card from the lists fills every board the split covers; a card moved from a slot moves on its own board.
                    if (d.startsWith("card:")) for (const h of hands) p.dropOnSlot(`${h}:${s.pos}`, d);
                    else p.dropOnSlot(slot, d);
                  }}
                  onMouseEnter={(e) => cur && p.onPeek(e, cur)}
                  onMouseLeave={p.clearPeek}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${s.pos}: click to pick from the ${s.pos} list, or drag a card here`}
                  className={cn(
                    "absolute flex w-[27%] min-w-[96px] max-w-[176px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border bg-card/95 text-left shadow-sm transition-colors hover:border-primary",
                    sel ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="flex w-9 shrink-0 items-center justify-center bg-muted font-mono text-xs font-bold">{s.pos}</span>
                  <span className="flex min-w-0 flex-1 flex-col px-1.5 py-1">
                    {cur ? (
                      <>
                        <span className="truncate text-xs font-medium">
                          {platoon ? `${surname(s.cR!.name)} / ${surname(s.cL!.name)}` : cur.name}
                        </span>
                        <span className="flex items-baseline justify-between gap-1">
                          <span className="font-mono text-[10px] text-muted-foreground">{platoon ? "vR / vL" : cur.val ?? ""}</span>
                          <span className={cn("font-mono text-xs tabular-nums", (s.v ?? 0) >= 0 ? "text-foreground" : "text-negative")}>{s.v != null ? signed(s.v) : "—"}</span>
                        </span>
                        {buy && <span className="truncate text-[9.5px] text-muted-foreground">buy {buy.name} {signed(buy.gain)}</span>}
                      </>
                    ) : (
                      <span className="py-1 text-xs text-muted-foreground">empty</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Runs per 700 PA in this event. <span className="text-foreground">Off</span> is the bat against the chosen hand (Total: at the field&apos;s {Math.round(p.lhpShare * 100)}% left-handed pitching);{" "}
        <span className="text-foreground">Def</span> is the glove at that spot (and framing at C), priced the way the optimiser prices it. Arms show runs saved per 700 batters faced.
        Click a card to place it ({split === "T" ? "Total fills both lineups" : `fills the vs ${split}HP lineup`}), or drag it onto the field or the roster panel; click a position to open its list.
        Two names on a spot are a platoon (vs RHP / vs LHP).
      </p>
    </div>
  );
}
