"use client";

/**
 * Every event of a championship on one screen, solved. The point is the
 * comparison: the five berths are NOT one environment with five card caps —
 * 1935 at Wrigley and 2006 at U.S. Cellular want different rosters, and the
 * "buy" column is where that becomes obvious.
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { leversOf, solve, type EnvSpec } from "@/lib/analytics/runenv-view";

export interface BerthRow {
  key: string;
  label: string;
  /** e.g. "Diamond" — the tier chip colour comes off this. */
  category: string | null;
  year: number | null;
  park: string | null;
  parkYear: number | null;
  dh: boolean | null;
  band: string | null;
  cardYears: string | null;
  /** Numeric eligibility, so the shortlist can filter on it. */
  yearMin: number | null;
  yearMax: number | null;
  valMin: number | null;
  valMax: number | null;
  note: string | null;
}

const TIER_TONE: Record<string, string> = {
  Diamond: "text-tier-diamond border-tier-diamond/40",
  Gold: "text-tier-gold border-tier-gold/40",
  Silver: "text-tier-silver border-tier-silver/40",
  Bronze: "text-tier-bronze border-tier-bronze/40",
  Iron: "text-tier-iron border-tier-iron/40",
};

export function BerthGrid({ rows, lhbShare, activeKey, onPick, title, blurb }: {
  rows: BerthRow[]; lhbShare: number; activeKey: string | null;
  onPick: (spec: EnvSpec, key: string) => void; title: string; blurb: string;
}) {
  const solved = React.useMemo(
    () => rows.map((r) => {
      const spec: EnvSpec = { year: r.year, park: r.park, parkYear: r.parkYear, lhbShare };
      const s = solve(spec);
      const lv = leversOf(s);
      return { r, spec, s, buy: lv ? lv.hit.slice(0, 2).map((x) => x.rating) : [], arm: lv ? lv.pit[0]?.rating ?? null : null };
    }),
    [rows, lhbShare],
  );

  if (!rows.length) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">click a row to load it above</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{blurb}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Era</th>
                <th className="px-2 py-2 font-medium">Ballpark</th>
                <th className="px-2 py-2 text-center font-medium">DH</th>
                <th className="px-2 py-2 text-right font-medium">R/G</th>
                <th className="px-2 py-2 text-right font-medium">K%</th>
                <th className="px-2 py-2 text-right font-medium">HR/PA</th>
                <th className="px-2 py-2 font-medium">Preset</th>
                <th className="px-2 py-2 font-medium">Buy first</th>
                <th className="px-2 py-2 font-medium">Cards</th>
              </tr>
            </thead>
            <tbody>
              {solved.map(({ r, spec, s, buy, arm }) => (
                <tr
                  key={r.key}
                  onClick={() => onPick(spec, r.key)}
                  className={cn("cursor-pointer border-b border-border/40 hover:bg-accent/40", activeKey === r.key && "bg-primary/10")}
                >
                  <td className="whitespace-nowrap py-2 pr-3">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", TIER_TONE[r.category ?? ""] ?? "border-border text-muted-foreground")}>
                      {r.category ?? "—"}
                    </span>
                    <span className="ml-2 font-medium">{r.label}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{r.year ?? "default"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{s.parkRow ? s.parkLabel : (r.park ?? "neutral")}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.dh == null ? "—" : r.dh ? "on" : "off"}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{s.env ? s.env.RG.toFixed(2) : "—"}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{s.line ? `${(s.line.kPct * 100).toFixed(1)}` : "—"}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{s.line ? `${(s.line.hrPa * 100).toFixed(2)}` : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{s.env?.preset ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {buy.length ? <span className="text-foreground">{buy.join(" · ")}</span> : "—"}
                    {arm && <span className="ml-2 text-muted-foreground">arms: {arm}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                    {r.cardYears ?? "—"}{r.band ? ` · ${r.band}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
