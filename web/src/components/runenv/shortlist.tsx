"use client";

/**
 * The collection, ranked for THIS environment.
 *
 * The number is runs above a league-average card per 700 PA, from the card's
 * own ratings pushed through the fitted rate curves into this era, through this
 * ballpark, valued with this environment's linear weights. No observed stats,
 * no projected-wOBA fit — which is the point, because for a berth like PTCS
 * Silver there is nothing observed to rank on.
 *
 * It is a BAT and ARM ranking only. Defence is not in the model, so a shortstop
 * and a DH are compared on offence alone; read it beside the card face in
 * /build before you slot anyone.
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HIT_KEYS, PIT_KEYS, type PoolCard } from "@/lib/analytics/pool-shape";
import { cardRuns, hitterRates, pitcherRates, ratingValues, type Split } from "@/lib/analytics/card-value";
import type { Solved } from "@/lib/analytics/runenv-view";

export interface Filters {
  yearMin: number | null; yearMax: number | null;
  valMin: number | null; valMax: number | null;
  label: string | null;
}

const SPLIT_OFFSET: Record<Split, number> = { all: 0, vL: 1, vR: 2 };

/** Rebuild the shop-vocabulary record the curve model wants from the flat row. */
function ratingsOf(c: PoolCard, split: Split): Record<string, number> {
  const keys = c.isP ? PIT_KEYS : HIT_KEYS;
  const out: Record<string, number> = {};
  keys.forEach((k, i) => { out[k] = c.r[i * 3 + SPLIT_OFFSET[split]]; });
  return out;
}

export function Shortlist({ pool, asOf, s, filters }: {
  pool: PoolCard[]; asOf: string | null; s: Solved; filters: Filters;
}) {
  const [side, setSide] = React.useState<"hit" | "pit">("hit");
  const [split, setSplit] = React.useState<Split>("all");
  const [activeOnly, setActiveOnly] = React.useState(false);
  const [useFilters, setUseFilters] = React.useState(true);
  const [limit, setLimit] = React.useState(25);

  const rows = React.useMemo(() => {
    if (!s.valueEnv) return [];
    const env = s.valueEnv;
    const out: { c: PoolCard; runs: number; lever: string | null }[] = [];
    for (const c of pool) {
      if ((c.isP ? "pit" : "hit") !== side) continue;
      if (activeOnly && !c.active) continue;
      if (useFilters) {
        if (filters.yearMin != null && (c.year == null || c.year < filters.yearMin)) continue;
        if (filters.yearMax != null && (c.year == null || c.year > filters.yearMax)) continue;
        if (filters.valMin != null && c.value < filters.valMin) continue;
        if (filters.valMax != null && c.value > filters.valMax) continue;
      }
      const r = ratingsOf(c, split);
      const rates = side === "hit" ? hitterRates(r, env.rates, "all") : pitcherRates(r, env.rates, "all");
      if (!rates) continue;
      const runs = cardRuns(rates, env) * (side === "pit" ? -1 : 1);
      out.push({ c, runs, lever: null });
    }
    out.sort((a, b) => b.runs - a.runs);
    // Only the visible rows pay for the per-card lever solve.
    return out.slice(0, limit).map((row) => {
      const lv = ratingValues(ratingsOf(row.c, split), s.valueEnv!, side, "all");
      return { ...row, lever: lv[0]?.rating ?? null };
    });
  }, [pool, s.valueEnv, side, split, activeOnly, useFilters, filters, limit]);

  const total = React.useMemo(
    () => pool.filter((c) => (c.isP ? "pit" : "hit") === side && (!activeOnly || c.active)).length,
    [pool, side, activeOnly],
  );

  if (!pool.length) {
    return (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">
        No collection uploaded yet — drop a collection export on /upload and this ranks it for whatever environment is selected above.
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Your cards, ranked for this environment</div>
            <p className="text-xs text-muted-foreground">
              Runs above a league-average card per 700 PA{side === "pit" ? " (runs prevented, per 700 batters faced)" : ""} —
              modelled from ratings, not from observed play. Bat and arm only: no defence, no stamina, no position scarcity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Toggle options={[["hit", "Hitters"], ["pit", "Pitchers"]]} value={side} onChange={(v) => setSide(v as "hit" | "pit")} />
            <Toggle options={[["all", "Overall"], ["vL", "vs LHP"], ["vR", "vs RHP"]]} value={split} onChange={(v) => setSplit(v as Split)} />
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="accent-[var(--primary)]" />
              on my roster
            </label>
          </div>
        </div>

        {(filters.yearMin != null || filters.valMin != null || filters.valMax != null) && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={useFilters} onChange={(e) => setUseFilters(e.target.checked)} className="accent-[var(--primary)]" />
            apply this event&apos;s eligibility
            <span className="text-foreground">
              {filters.yearMin != null && `cards ${filters.yearMin}–${filters.yearMax ?? ""}`}
              {filters.valMin != null || filters.valMax != null ? `${filters.yearMin != null ? " · " : ""}value ${filters.valMin ?? ""}–${filters.valMax ?? ""}` : ""}
            </span>
          </label>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Card</th>
                <th className="px-2 py-2 font-medium">Pos</th>
                <th className="px-2 py-2 text-right font-medium">Year</th>
                <th className="px-2 py-2 text-right font-medium">Value</th>
                <th className="px-2 py-2 text-right font-medium" title="Runs above a league-average card per 700 plate appearances, in this environment">Runs / 700</th>
                <th className="px-2 py-2 font-medium" title="The rating that would add the most if you upgraded it">Its best lever</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.c.id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{r.c.name}</span>
                    {r.c.variant && <span className="ml-1.5 rounded border border-border px-1 text-[9px] text-muted-foreground">VAR</span>}
                    {r.c.active && <span className="ml-1.5 rounded border border-primary/40 px-1 text-[9px] text-primary">on roster</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.c.role ?? r.c.pos}{r.c.bats ? ` · ${r.c.bats}` : ""}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{r.c.year ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.c.value}</td>
                  <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", r.runs >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {r.runs >= 0 ? "+" : ""}{r.runs.toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.lever ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{rows.length} of {total} owned {side === "hit" ? "hitters" : "pitchers"}{asOf ? ` · collection as of ${asOf}` : ""}</span>
          {rows.length >= limit && (
            <button onClick={() => setLimit((n) => n + 25)} className="rounded border border-border px-2 py-1 hover:text-foreground">
              show 25 more
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-md border border-border p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn("rounded px-2 py-0.5 transition-colors", value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
