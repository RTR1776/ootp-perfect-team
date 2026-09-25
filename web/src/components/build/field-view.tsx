"use client";

/**
 * The lineup on a diamond: one board (vs RHP or vs LHP) with every spot read
 * as bat runs plus glove runs at that position, and next to it the two
 * questions a builder actually asks of a spot — is there a better card I
 * already own, and is there one worth buying.
 *
 * Bat runs are the builder's own scorer (runsR / runsL: calibrated runs per
 * 700 PA in this event's era and park, observed play blended in); gloves are
 * fieldingRuns at the slot, the same pricing the optimiser uses, under the
 * same position floor. Nothing here is a second model.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import type { BuilderCard, UpgradeCard } from "@/components/roster-builder";

type Hand = "R" | "L";

interface Props {
  lineupPos: string[];
  slots: Record<string, number | null>;
  byId: Map<number, BuilderCard>;
  pool: BuilderCard[];
  upgrades: UpgradeCard[];
  runsR: Map<number, number> | null;
  runsL: Map<number, number> | null;
  lhpShare: number;
  /** Open the pool on this spot: select the slot and filter to the position. */
  onPick: (slot: string, pos: string) => void;
}

/** Grid cell per position — a diamond read top (CF) to bottom (C). */
const CELL: Record<string, string> = {
  CF: "col-start-3 row-start-1",
  LF: "col-start-1 row-start-2",
  RF: "col-start-5 row-start-2",
  SS: "col-start-2 row-start-3",
  "2B": "col-start-4 row-start-3",
  "3B": "col-start-1 row-start-4",
  "1B": "col-start-5 row-start-4",
  C: "col-start-3 row-start-5",
  DH: "col-start-5 row-start-5",
};

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

interface Read {
  pos: string;
  slot: string;
  cur: { c: BuilderCard; bat: number; glove: number; rating: number | null; belowFloor: boolean } | null;
  better: { name: string; gain: number } | null;
  buy: { name: string; gain: number; ask: number | null } | null;
}

export function FieldView(p: Props) {
  const [hand, setHand] = React.useState<Hand>("R");
  const runs = hand === "R" ? p.runsR : p.runsL;

  const reads = React.useMemo<Read[]>(() => {
    const onBoard = new Set(p.lineupPos.map((pos) => p.slots[`${hand}:${pos}`]).filter((x): x is number => x != null));
    const rating = (r: Record<string, number>, pos: string) => (pos === "DH" ? null : r[`Pos Rating ${pos}`] ?? 0);
    const fits = (r: Record<string, number>, pos: string) => {
      if (pos === "DH") return true;
      const v = r[`Pos Rating ${pos}`] ?? 0;
      return v > 0 && v >= posFloorAt(LJ_FLOOR, pos);
    };
    const glove = (r: Record<string, number>, pos: string) => (pos === "DH" ? 0 : fieldingRuns(pos, r[`Pos Rating ${pos}`] ?? 0));

    return p.lineupPos.map((pos) => {
      const slot = `${hand}:${pos}`;
      const id = p.slots[slot] ?? null;
      const c = id != null ? p.byId.get(id) ?? null : null;
      const curTotal = c && runs ? (runs.get(c.cardId) ?? 0) + glove(c.ratings, pos) : null;
      const cur = c && runs
        ? {
            c, bat: runs.get(c.cardId) ?? 0, glove: glove(c.ratings, pos), rating: rating(c.ratings, pos),
            belowFloor: pos !== "DH" && !fits(c.ratings, pos),
          }
        : null;

      let better: Read["better"] = null;
      if (runs) {
        for (const o of p.pool) {
          if (o.isPitcher || o.cardId === id || onBoard.has(o.cardId) || !fits(o.ratings, pos)) continue;
          const t = (runs.get(o.cardId) ?? -1e6) + glove(o.ratings, pos);
          const gain = t - (curTotal ?? 0);
          if (gain > 0.5 && (!better || gain > better.gain)) better = { name: o.name, gain };
        }
      }

      let buy: Read["buy"] = null;
      for (const u of p.upgrades) {
        if (u.isPitcher || !fits(u.ratings, pos)) continue;
        // Upgrades carry one blended runs figure (both hands); good enough to flag a spot.
        const gain = u.runs + glove(u.ratings, pos) - (curTotal ?? 0);
        if (gain > 1 && (!buy || gain > buy.gain)) buy = { name: u.name, gain, ask: u.ask ?? u.last10 };
      }
      return { pos, slot, cur, better, buy };
    });
  }, [p.lineupPos, p.slots, p.byId, p.pool, p.upgrades, runs, hand]);

  const total = reads.reduce((s, r) => s + (r.cur ? r.cur.bat + r.cur.glove : 0), 0);
  const filled = reads.filter((r) => r.cur).length;
  const weakest = reads
    .filter((r) => r.better || r.buy)
    .sort((a, b) => Math.max(b.better?.gain ?? 0, b.buy?.gain ?? 0) - Math.max(a.better?.gain ?? 0, a.buy?.gain ?? 0))[0];

  if (!runs) {
    return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No run environment on file for this event, so there are no runs to put on the field.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["R", "L"] as Hand[]).map((h) => (
          <button
            key={h}
            onClick={() => setHand(h)}
            className={cn(
              "rounded-md border border-border px-3 py-1 text-xs font-semibold",
              hand === h ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            vs {h}HP <span className="font-normal opacity-70">{Math.round((h === "R" ? 1 - p.lhpShare : p.lhpShare) * 100)}%</span>
          </button>
        ))}
        <span className="text-xs text-muted-foreground">
          {filled}/{p.lineupPos.length} filled · board <span className="font-mono text-foreground">{signed(total)}</span> runs/700 (bat + glove)
        </span>
        {weakest && (
          <span className="text-xs text-muted-foreground">
            · weakest spot <span className="font-medium text-foreground">{weakest.pos}</span>
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30 p-2 sm:p-3">
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-40">
          <polygon points="50,18 82,55 50,92 18,55" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.6" />
        </svg>
        <div className="relative grid grid-cols-5 grid-rows-5 gap-1.5 sm:gap-2">
          {reads.map((r) => (
            <button
              key={r.pos}
              onClick={() => p.onPick(r.slot, r.pos)}
              title={`Open the pool on ${r.pos} vs ${hand}HP`}
              className={cn(
                CELL[r.pos] ?? "",
                "flex min-w-0 flex-col gap-0.5 rounded-md border bg-card p-1.5 text-left transition-colors hover:border-primary sm:p-2",
                r.cur?.belowFloor ? "border-warning" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">{r.pos}</span>
                {r.cur && <span className="rounded bg-muted px-1 font-mono text-[10px]">{r.cur.c.val ?? "?"}</span>}
              </div>
              {r.cur ? (
                <>
                  <span className="truncate text-xs font-medium">{r.cur.c.name}</span>
                  <span className="font-mono text-sm tabular-nums">{signed(r.cur.bat + r.cur.glove)}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    bat {signed(r.cur.bat)}
                    {r.pos !== "DH" && <> · glove {signed(r.cur.glove)} ({r.cur.rating})</>}
                  </span>
                  {r.cur.belowFloor && <span className="text-[10px] text-warning">below the glove floor</span>}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">empty</span>
              )}
              {r.better && <span className="truncate text-[10px] text-positive">own: {r.better.name} {signed(r.better.gain)}</span>}
              {r.buy && (
                <span className="truncate text-[10px] text-muted-foreground">
                  buy: {r.buy.name} {signed(r.buy.gain)}{r.buy.ask ? ` · ${Math.round(r.buy.ask / 1000)}k` : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Runs per 700 PA in this event: the bat against {hand}HP plus the glove at that spot, priced the way the optimiser
        prices it. &ldquo;own&rdquo; is the best card you already have that isn&apos;t on this board; &ldquo;buy&rdquo; is
        the best legal card you don&apos;t own (its bat figure is both hands blended). Click a spot to open the pool on it.
      </p>
    </div>
  );
}
