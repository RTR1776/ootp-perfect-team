"use client";

/**
 * The shop, priced against THIS roster. Every legal card you don't own is tried
 * in every slot of the board on the page — both lineups with the glove at the
 * spot, the rotation, the pen — and ranked on the runs it would add, with the
 * price and the runs per 10k PP. It re-scores on every board change and every
 * new shop upload, so a card drop shows up the next time the page loads.
 *
 * Gains are one-card swaps against the current board (the optimiser's scale:
 * lineups weighted by the field's pitcher hand, relief at 0.31). They are a
 * shopping list, not a promise: two buys at the same spot don't add.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldingRuns } from "@/lib/analytics/fielding";
import type { BuilderCard, UpgradeCard } from "@/components/roster-builder";

const RP_WEIGHT = 0.31;
/** Sanity floor only — every glove above it is priced in runs. */
const floorAt = (pos: string) => (pos === "DH" ? 0 : pos === "C" ? 50 : 40);

interface Props {
  upgrades: UpgradeCard[];
  slots: Record<string, number | null>;
  lineupPos: string[];
  spKeys: string[];
  rpKeys: string[];
  byId: Map<number, BuilderCard>;
  runsR: Map<number, number> | null;
  runsL: Map<number, number> | null;
  lhpShare: number;
  teamCap: number | null;
  onPeek: (e: React.MouseEvent<HTMLElement>, u: UpgradeCard) => void;
  onLeave: () => void;
}


const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
const pts = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export interface ShopRow { u: UpgradeCard; gain: number; where: string; price: number | null; perK: number | null; overCap: number }

export type ShopInput = Pick<Props, "upgrades" | "slots" | "lineupPos" | "spKeys" | "rpKeys" | "byId" | "runsR" | "runsL" | "lhpShare" | "teamCap">;

/**
 * Every shop card tried in every slot of the board; best one-card swap each.
 * A VARIANT offer is the upgrade of a card you already own: while its base
 * copy is on the board it can only replace that copy (a player is rostered
 * once), so its gain is the variant's edge over the base at the same spot.
 */
export function rankShop(p: ShopInput): ShopRow[] {
  const onBoard = Object.values(p.slots).filter((x): x is number => x != null);
  if (!p.runsR || !p.runsL || onBoard.length === 0) return [];
  const capUsed = [...new Set(onBoard)].reduce((s, id) => s + (p.byId.get(id)?.val ?? 0), 0);
  const boardSet = new Set(onBoard);
  const runsR = p.runsR, runsL = p.runsL;
  const def = (r: Record<string, number>, pos: string) => {
    if (pos === "DH") return 0;
    const v = r[`Pos Rating ${pos}`] ?? 0;
    return v > 0 && v >= floorAt(pos) ? fieldingRuns(pos, v) : null;
  };
  const out: ShopRow[] = [];
  for (const u of p.upgrades) {
    // A variant of a card on the board may only take that card's own spots.
    const pinned = u.variant && boardSet.has(u.cardId);
    let gain = 0, where = "", replaced: BuilderCard | null = null;
    if (!u.isPitcher) {
      for (const hand of ["R", "L"] as const) {
        const w = hand === "R" ? 1 - p.lhpShare : p.lhpShare;
        const bat = hand === "R" ? u.runsR : u.runsL;
        if (bat == null) continue;
        let best = 0, at = "", rep: BuilderCard | null = null;
        for (const pos of p.lineupPos) {
          const id = p.slots[`${hand}:${pos}`];
          const cur = id != null ? p.byId.get(id) : null;
          if (!cur || (pinned && cur.cardId !== u.cardId)) continue;
          const g = def(u.ratings, pos);
          if (g == null) continue;
          const curDef = pos === "DH" ? 0 : fieldingRuns(pos, cur.ratings[`Pos Rating ${pos}`] ?? 0);
          const curBat = (hand === "R" ? runsR : runsL).get(cur.cardId) ?? 0;
          const d = (bat + g - curBat - curDef) * w;
          if (d > best) { best = d; at = `${pos} vs ${hand}HP over ${cur.cardId === u.cardId ? "your base copy" : cur.name}`; rep = cur; }
        }
        if (best > 0) { gain += best; where = where ? `${where}; ${at}` : at; replaced ??= rep; }
      }
    } else {
      const r = u.runsR;
      if (r == null) continue;
      const worst = (keys: string[]) => keys
        .map((k) => p.slots[k]).filter((x): x is number => x != null)
        .filter((id) => !pinned || id === u.cardId)
        .map((id) => ({ c: p.byId.get(id)!, v: runsR.get(id) ?? 0 }))
        .filter((x) => x.c)
        .sort((a, b) => a.v - b.v)[0] ?? null;
      const sp = u.pos === "SP" ? worst(p.spKeys) : null;
      const rp = worst(p.rpKeys);
      const gSp = sp ? r - sp.v : 0, gRp = rp ? RP_WEIGHT * (r - rp.v) : 0;
      const label = (c: BuilderCard) => (c.cardId === u.cardId ? "your base copy" : c.name);
      if (gSp >= gRp && gSp > 0 && sp) { gain = gSp; where = `rotation over ${label(sp.c)}`; replaced = sp.c; }
      else if (gRp > 0 && rp) { gain = gRp; where = `bullpen over ${label(rp.c)}`; replaced = rp.c; }
    }
    if (gain <= 0.05) continue;
    const price = u.ask && u.ask > 0 ? u.ask : u.last10;
    const overCap = p.teamCap != null && !u.variant ? Math.max(0, capUsed - (replaced?.val ?? 0) + (u.val ?? 0) - p.teamCap) : 0;
    out.push({ u, gain, where, price: price ?? null, perK: price ? gain / (price / 10000) : null, overCap });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

export const shopKey = (u: UpgradeCard) => `${u.cardId}${u.variant ? "v" : ""}`;

export function ShopBoard(p: Props) {
  const [kind, setKind] = React.useState<"ALL" | "BAT" | "ARM">("ALL");
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [maxPrice, setMaxPrice] = React.useState<string>("");

  const onBoard = React.useMemo(() => Object.values(p.slots).filter((x): x is number => x != null), [p.slots]);
  const capUsed = React.useMemo(() => [...new Set(onBoard)].reduce((s, id) => s + (p.byId.get(id)?.val ?? 0), 0), [onBoard, p.byId]);
  const rows = React.useMemo<ShopRow[]>(() => rankShop(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.upgrades, p.slots, p.lineupPos, p.spKeys, p.rpKeys, p.byId, p.runsR, p.runsL, p.lhpShare, p.teamCap]);

  const max = Number(maxPrice) > 0 ? Number(maxPrice) : null;
  const shown = rows.filter((r) =>
    (kind === "ALL" || (kind === "ARM") === r.u.isPitcher) &&
    (!onlyNew || r.u.isNew) &&
    (max == null || (r.price != null && r.price <= max)));
  const newCount = p.upgrades.filter((u) => u.isNew).length;

  if (!p.runsR) return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No run environment on file for this event, so there is nothing to price the shop against.</p>;
  if (onBoard.length === 0) return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Fill or load a roster first (Re-recommend, or a saved roster) — the shop is ranked on what each card adds to the board on the page.</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {(["ALL", "BAT", "ARM"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn("rounded-full border border-border px-2 py-0.5", kind === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {k === "ALL" ? "All" : k === "BAT" ? "Bats" : "Arms"}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-muted-foreground">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="accent-[var(--primary)]" />
          new this week ({newCount})
        </label>
        <label className="ml-2 flex items-center gap-1 text-muted-foreground">
          max price
          <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="PP" className="h-6 w-20 rounded border border-input bg-background px-1.5" />
        </label>
        {p.teamCap != null && <span className="ml-auto text-muted-foreground">cap {capUsed}/{p.teamCap}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-1.5 py-1.5">Card</th>
              <th className="px-1.5">Pos</th>
              <th className="px-1.5 text-right">VAL</th>
              <th className="px-1.5 text-right" title="Runs per 700 this card adds to the board on the page, one-card swap">Adds</th>
              <th className="px-1.5">Where</th>
              <th className="px-1.5 text-right" title="Lowest ask, else last-10">Price</th>
              <th className="px-1.5 text-right" title="Runs added per 10k PP">/10k</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[12.5px] leading-tight [font-variant-numeric:tabular-nums]">
            {shown.slice(0, 60).map((r) => (
              <tr key={shopKey(r.u)} className="border-b border-border/50">
                <td className="max-w-[200px] truncate px-1.5 py-1 font-sans" onMouseEnter={(e) => p.onPeek(e, r.u)} onMouseLeave={p.onLeave}>
                  {r.u.name}
                  {r.u.variant && <span className="ml-1 rounded bg-accent px-1 text-[9px] font-semibold" title="Variant of a card you own; its ratings are estimated (+5 hitting / +3 pitching, the typical variant bump)">VAR est.</span>}
                  {r.u.isNew && <span className="ml-1 rounded bg-primary/15 px-1 text-[9px] font-semibold text-primary">NEW</span>}
                  {r.u.clubhouse && <span className="ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">CLUB</span>}
                </td>
                <td className="px-1.5">{r.u.pos}</td>
                <td className="px-1.5 text-right">{r.u.val ?? "—"}</td>
                <td className="px-1.5 text-right font-semibold text-positive">{signed(r.gain)}</td>
                <td className="max-w-[260px] truncate px-1.5 font-sans text-[11px] text-muted-foreground" title={r.where}>
                  {r.where}
                  {r.overCap > 0 && <span className="ml-1 text-warning">· {r.overCap} over cap</span>}
                </td>
                <td className="px-1.5 text-right">{pts(r.price)}</td>
                <td className="px-1.5 text-right text-muted-foreground">{r.perK == null ? "—" : r.perK.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nothing in the shop beats the board on the page{onlyNew || max ? " with these filters" : ""}.</p>}
      </div>
    </div>
  );
}
