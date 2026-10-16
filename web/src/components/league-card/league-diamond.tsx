"use client";

/**
 * The league lineups on a field (L.J., 2026-10-16: "I love the field/line up
 * thing"), read-only over the Card Model's solve: each slot's player against
 * the chosen hand, both names where the boards platoon, and the slot's runs a
 * season ("Total" weights the boards by the league's share of PA against LHP).
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { signed } from "@/lib/format";
import { FieldBackdrop, FIELD_SPOT, SPOT_BOX, surname } from "@/components/diamond";
import type { Lineup, LineupSlot } from "./use-rescore";

type Split = "T" | "vR" | "vL";

/** "Ed Bailey 97 VAR" → "Ed Bailey" (the label carries value and variant). */
const nameOf = (label: string) => label.replace(/\s+\d{2,3}(\s+VAR)?$/, "");

export function LeagueDiamond({ now, lhp, stale }: { now: { vR: Lineup | null; vL: Lineup | null }; lhp: number | null; stale: boolean }) {
  const [split, setSplit] = React.useState<Split>("T");
  const w = lhp ?? 0.3;
  const at = (l: Lineup | null, slot: string): LineupSlot | undefined => l?.lineup.find((x) => x.slot === slot);
  const slots = Object.keys(FIELD_SPOT);
  const total = split === "vR" ? now.vR?.total : split === "vL" ? now.vL?.total
    : now.vR && now.vL ? (1 - w) * now.vR.total + w * now.vL.total : null;
  const seg = (on: boolean) => cn("rounded-md px-2.5 py-1 text-xs font-semibold", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div className={cn("flex flex-col gap-2 transition-opacity", stale && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["T", "vL", "vR"] as Split[]).map((s) => (
            <button key={s} type="button" onClick={() => setSplit(s)} className={seg(split === s)}>
              {s === "T" ? "Total" : s === "vL" ? `vs LHP ${Math.round(w * 100)}%` : `vs RHP ${Math.round((1 - w) * 100)}%`}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">lineup <span className="font-mono text-foreground">{signed(total)}</span> runs a season</span>
      </div>
      <div className="relative aspect-[5/4] min-h-[320px] max-w-3xl overflow-hidden rounded-lg border border-border bg-[#0f1a12]">
        <FieldBackdrop />
        {slots.map((slot) => {
          const r = at(now.vR, slot), l = at(now.vL, slot);
          const [x, y] = FIELD_SPOT[slot];
          const platoon = split === "T" && r && l && r.label !== l.label;
          const cur = split === "vL" ? l : r ?? l;
          const runs = split === "vR" ? r?.runs : split === "vL" ? l?.runs : r && l ? (1 - w) * r.runs + w * l.runs : undefined;
          return (
            <div key={slot} style={{ left: `${x}%`, top: `${y}%` }} className={cn(SPOT_BOX, "flex overflow-hidden rounded-md border border-border bg-card/95 text-xs shadow-sm")}>
              <span className="flex w-9 shrink-0 items-center justify-center bg-muted font-mono font-bold">{slot}</span>
              <span className="flex min-w-0 flex-1 flex-col px-1.5 py-1">
                <span className="truncate font-medium" title={platoon ? `${r!.label} vs RHP · ${l!.label} vs LHP` : cur?.label}>
                  {cur ? (platoon ? `${surname(nameOf(r!.label))} / ${surname(nameOf(l!.label))}` : nameOf(cur.label)) : "—"}
                </span>
                <span className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{platoon ? "vR / vL" : ""}</span>
                  <span className={(runs ?? 0) >= 0 ? "text-foreground" : "text-negative"}>{signed(runs)}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
