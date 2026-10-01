"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** What the list needs of a board card. */
export interface CardListCard {
  cardId: number;
  name: string;
  val: number | null;
  variant: boolean;
}

/**
 * Every card on the board once, highest card value first, with the spots it
 * fills - a shopping list for setting the roster up in the game (L.J.,
 * 2026-10-01: "a place to list the recommended cards in number value order
 * so it makes it easy for me to grab them").
 */
export function CardList({ slotOrder, slots, byId }: {
  slotOrder: readonly string[];
  slots: Record<string, number | null>;
  byId: Map<number, CardListCard>;
}) {
  const rows = useMemo(() => {
    const at = new Map<number, string[]>();
    for (const k of slotOrder) {
      const id = slots[k];
      if (id == null || !byId.has(id)) continue;
      const l = at.get(id) ?? [];
      l.push(k);
      at.set(id, l);
    }
    return [...at].map(([id, keys]) => ({ card: byId.get(id)!, spots: spotsLabel(keys) }))
      .sort((a, b) => (b.card.val ?? -1) - (a.card.val ?? -1) || a.card.name.localeCompare(b.card.name));
  }, [slotOrder, slots, byId]);

  const total = rows.reduce((s, r) => s + (r.card.val ?? 0), 0);
  const label = (c: CardListCard) => `${c.name}${c.variant ? " (VAR)" : ""}`;
  const copy = async () => {
    const text = rows.map((r) => `${r.card.val ?? "?"}  ${label(r.card)}  — ${r.spots}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `Copied ${rows.length} cards, value order.` });
    } catch {
      toast({ tone: "error", message: "The browser blocked the clipboard." });
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" title="Every card on the board once, highest card value first: the order to pick them up in the game">Card list · value order</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{rows.length} cards · {total}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void copy()} disabled={rows.length === 0}>Copy</Button>
        </span>
      </div>
      {rows.length === 0
        ? <div className="px-2 py-1 text-xs text-muted-foreground/60">The board is empty.</div>
        : (
          <ol className="flex flex-col">
            {rows.map((r, i) => (
              <li key={r.card.cardId} className="flex items-baseline gap-2 rounded px-2 py-0.5 text-sm hover:bg-muted/40">
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70">{i + 1}</span>
                <span className="w-7 shrink-0 text-right font-mono text-xs font-semibold tabular-nums">{r.card.val ?? "?"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.card.name}
                  {r.card.variant && <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">VAR</span>}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{r.spots}</span>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}

/** "R:C" + "L:C" -> "C"; "R:1B" alone -> "1B vR"; SP1 -> "SP"; BN2 -> "bench". */
function spotsLabel(keys: string[]): string {
  const out: string[] = [];
  const byPos = new Map<string, Set<string>>();
  for (const k of keys) {
    const m = /^([RL]):(.+)$/.exec(k);
    if (m) {
      const s = byPos.get(m[2]) ?? new Set<string>();
      s.add(m[1]);
      byPos.set(m[2], s);
    }
  }
  for (const [pos, hands] of byPos) out.push(hands.size === 2 ? pos : `${pos} v${[...hands][0]}`);
  for (const k of keys) {
    if (/^[RL]:/.test(k)) continue;
    const role = /^SP/.test(k) ? "SP" : /^BN/.test(k) ? "bench" : /^CL/.test(k) ? "CL" : /^RP/.test(k) ? "RP" : k;
    if (!out.includes(role)) out.push(role);
  }
  return out.join(" · ");
}
