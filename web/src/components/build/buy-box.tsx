"use client";

/**
 * The shop in one glance, above the board: the few buys that add the most to
 * the roster on the page, the best runs for the PP among cheaper cards, and
 * the variant upgrades of cards you already play. Same ranking as the Shop
 * tab (rankShop), so the two never disagree; the tab has the full list.
 */

import * as React from "react";
import { rankShop, shopKey, type ShopInput, type ShopRow } from "@/components/build/shop-board";

const pts = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export function BuyBox(p: ShopInput & { onOpenShop: () => void }) {
  const rows = React.useMemo(() => rankShop(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.upgrades, p.slots, p.lineupPos, p.spKeys, p.rpKeys, p.byId, p.runsR, p.runsL, p.lhpShare, p.teamCap]);
  if (!rows.length) return null;

  const priced = rows.filter((r) => r.price != null && r.overCap === 0);
  const best = priced.filter((r) => !r.u.variant).slice(0, 3);
  const taken = new Set(best.map((r) => shopKey(r.u)));
  // Value: a real gain for the money — at least half a run, ranked on runs per 10k.
  const value = priced
    .filter((r) => !r.u.variant && !taken.has(shopKey(r.u)) && r.gain >= 0.5 && r.perK != null)
    .sort((a, b) => b.perK! - a.perK!)
    .slice(0, 3);
  const variants = priced.filter((r) => r.u.variant).slice(0, 3);

  const line = (r: ShopRow) => (
    <li key={shopKey(r.u)} className="flex items-baseline gap-1.5" title={r.where}>
      <span className="min-w-0 truncate">{r.u.name}</span>
      <span className="shrink-0 text-muted-foreground">{r.u.pos}</span>
      <span className="ml-auto shrink-0 font-mono font-semibold text-positive">+{r.gain.toFixed(1)}</span>
      <span className="w-10 shrink-0 text-right font-mono text-muted-foreground">{pts(r.price)}</span>
    </li>
  );
  const col = (title: string, hint: string, list: ShopRow[]) => list.length > 0 && (
    <div className="min-w-0">
      <p className="mb-0.5 font-semibold" title={hint}>{title}</p>
      <ul className="flex flex-col gap-0.5">{list.map(line)}</ul>
    </div>
  );

  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">Recommended buys</span>
        <button className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={p.onOpenShop}>full shop →</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {col("Biggest adds", "Most runs added to the roster on the page, any price", best)}
        {col("Best value", "Most runs per PP among buys worth half a run or more", value)}
        {col("Variant upgrades", "Variants of cards you play; ratings estimated at the typical bump, priced at the variant's last-10", variants)}
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground">Runs per 700 added to this board (one-card swap) · price is the lowest ask, else last-10 · hover a name for where it plays.</p>
    </div>
  );
}
