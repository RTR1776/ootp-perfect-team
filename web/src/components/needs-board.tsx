"use client";

/**
 * The Needs board (lib/needs-load): per tier, a diamond coloured by how far his
 * best card at each spot sits from the best legal card, the spots that matter
 * most across the tiers he plays, and for the chosen spot the cards that close
 * the gap with a price call.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { CARD_TYPE_SHORT } from "@/lib/card-sets";
import type { Rank, Spot } from "@/lib/era-strength";
import type { NeedBuy, NeedSpot, NeedsData, NeedTier } from "@/lib/needs-load";

const SPOT: Partial<Record<Spot, [number, number]>> = {
  CF: [50, 12], LF: [20, 30], RF: [80, 30], SS: [35, 50], "2B": [65, 50],
  "3B": [21, 70], "1B": [79, 70], C: [50, 91], DH: [14, 91],
};
const pts = (v: number | null) => (v == null ? "—" : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`);

/** Gap colours: within a run is fine, a few runs is a soft spot, more is a hole. */
const gapTone = (g: number | null) =>
  g == null ? "border-negative/60 bg-negative/10" : g <= 1 ? "border-positive/50 bg-positive/10" : g <= 4 ? "border-warning/60 bg-warning/10" : "border-negative/60 bg-negative/15";
const gapText = (g: number | null) => (g == null ? "text-negative" : g <= 1 ? "text-positive" : g <= 4 ? "text-warning" : "text-negative");

/** Worth a buy: closes at least half a run. */
const worth = (b: NeedBuy) => (b.gainAvg ?? 0) >= 0.5;

export function NeedsBoard({ data }: { data: NeedsData }) {
  const byPlay = React.useMemo(() => [...data.tiers].sort((a, b) => b.share - a.share || b.short - a.short), [data.tiers]);
  const [tierKey, setTierKey] = React.useState(byPlay[0]?.key ?? "bronze");
  const [rank, setRank] = React.useState<Rank>("avg");
  const tier = data.tiers.find((t) => t.key === tierKey) ?? data.tiers[0];
  const spots = tier.spots[rank];
  const worst = [...spots].sort((a, b) => (b.gapAvg ?? 99) - (a.gapAvg ?? 99))[0];
  const [spotKey, setSpotKey] = React.useState<Spot | null>(null);
  const spot = spots.find((s) => s.spot === spotKey) ?? worst;

  /** The holes that matter most: gap × how much he plays the tier, with a buy that closes some of it. */
  const top = React.useMemo(() => data.tiers.flatMap((t) => t.spots[rank]
    .filter((s) => (s.gapAvg ?? 0) >= 1.5 && s.buys.some(worth))
    .map((s) => ({ t, s, score: (s.gapAvg ?? 0) * (0.4 + t.share) })))
    .sort((a, b) => b.score - a.score).slice(0, 8), [data.tiers, rank]);

  const pick = (t: NeedTier, s: NeedSpot) => { setTierKey(t.key); setSpotKey(s.spot); };

  return (
    <div className="flex flex-col gap-4">
      {/* biggest needs across tiers */}
      {top.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Biggest needs</h2>
            <span className="text-[11px] text-muted-foreground">gap × how much you play the tier{data.period ? ` (${data.period})` : ""}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {top.map(({ t, s }) => {
              const b = [...s.buys].filter(worth).sort((x, y) => (y.gainAvg ?? 0) - (x.gainAvg ?? 0))[0];
              return (
                <button key={`${t.key}${s.spot}`} type="button" onClick={() => pick(t, s)}
                  className={cn("rounded-md border px-2.5 py-1.5 text-left text-xs hover:border-primary", gapTone(s.gapAvg))}>
                  <span className="font-semibold">{t.label} {s.spot}</span> <span className={cn("font-mono", gapText(s.gapAvg))}>−{(s.gapAvg ?? 0).toFixed(1)}</span>
                  {b && <span className="block text-[11px] text-muted-foreground">{b.card.name} {b.call === "buy" ? `buy ${pts(b.target)}` : b.call === "bid" ? `bid ${pts(b.target)}` : ""}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* tier tabs + rank */}
      <div className="flex flex-wrap items-center gap-2">
        {data.tiers.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTierKey(t.key); setSpotKey(null); }}
            className={cn("rounded-md border border-border px-3 py-1.5 text-left text-xs", t.key === tier.key ? "bg-foreground text-background" : "hover:bg-muted")}>
            <span className="font-semibold">{t.label}</span>
            <span className={cn("ml-1.5 font-mono", t.key === tier.key ? "opacity-80" : "text-muted-foreground")}>−{t.short.toFixed(1)}</span>
            <span className={cn("block text-[10px]", t.key === tier.key ? "opacity-80" : "text-muted-foreground")}>{t.entries} entries · {Math.round(t.share * 100)}% of your play</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs">
          {(["avg", "worst"] as Rank[]).map((r) => (
            <button key={r} type="button" onClick={() => setRank(r)}
              className={cn("rounded-md px-2.5 py-1 font-semibold", rank === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              title={r === "avg" ? "Ranked on the five-era average" : "Ranked on each card's weakest era"}>
              {r === "avg" ? "Average era" : "Worst era"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* the diamond */}
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[5/4] min-h-[340px] overflow-hidden rounded-lg border border-border bg-[#0f1a12]">
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <path d="M50 95 L3 46 Q50 -40 97 46 Z" fill="#1d3a22" stroke="#5b4a2e" strokeWidth="1.2" />
              <ellipse cx="50" cy="76" rx="21" ry="19" fill="#3b2a17" />
              <polygon points="50,61 63,75 50,89 37,75" fill="none" stroke="#e8e2d0" strokeOpacity="0.5" strokeWidth="0.5" />
            </svg>
            {spots.filter((s) => SPOT[s.spot]).map((s) => {
              const [x, y] = SPOT[s.spot]!;
              return (
                <button key={s.spot} type="button" onClick={() => setSpotKey(s.spot)} style={{ left: `${x}%`, top: `${y}%` }}
                  className={cn("absolute flex w-[27%] min-w-[92px] max-w-[160px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border text-left text-xs shadow-sm backdrop-blur",
                    gapTone(s.gapAvg), spot?.spot === s.spot && "ring-2 ring-primary")}>
                  <span className="flex w-8 shrink-0 items-center justify-center bg-background/70 font-mono font-bold">{s.spot}</span>
                  <span className="flex min-w-0 flex-1 flex-col bg-card/85 px-1.5 py-1">
                    <span className="truncate font-medium">{s.mine?.card.name ?? "nobody"}</span>
                    <span className={cn("font-mono text-[11px]", gapText(s.gapAvg))}>{s.gapAvg == null ? "no card" : s.gapAvg <= 0.05 ? "best" : `−${s.gapAvg.toFixed(1)}`}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {spots.filter((s) => s.spot === "SP" || s.spot === "RP").map((s) => (
              <button key={s.spot} type="button" onClick={() => setSpotKey(s.spot)}
                className={cn("rounded-md border px-2.5 py-1.5 text-left text-xs", gapTone(s.gapAvg), spot?.spot === s.spot && "ring-2 ring-primary")}>
                <span className="font-semibold">{s.spot === "SP" ? "Rotation" : "Bullpen"}</span>
                <span className={cn("ml-1.5 font-mono", gapText(s.gapAvg))}>{s.gapAvg == null ? "short of arms" : `−${s.gapAvg.toFixed(1)} per arm`}</span>
                <span className="block truncate text-[11px] text-muted-foreground">best: {s.mine?.card.name ?? "—"}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Runs per 700 your best card at each spot is short of the best {tier.label.toLowerCase()} card (each card once, glove in, {rank === "avg" ? "five-era average" : "its weakest era"}).
            Green is within a run, amber a soft spot, red a hole. Arms are per slot over five starters or seven relievers.
          </p>
        </div>

        {/* the chosen spot */}
        {spot && <SpotDetail tier={tier} s={spot} eras={data.eras} />}
      </div>
    </div>
  );
}

function SpotDetail({ tier, s, eras }: { tier: NeedTier; s: NeedSpot; eras: string[] }) {
  const buys = [...s.buys].sort((a, b) => (b.gainAvg ?? -99) - (a.gainAvg ?? -99));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{tier.label} {s.spot === "SP" ? "rotation" : s.spot === "RP" ? "bullpen" : s.spot}</h2>
        <span className={cn("font-mono text-sm", gapText(s.gapAvg))}>{s.gapAvg == null ? "no card" : `gap −${s.gapAvg.toFixed(1)}`}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-border p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Yours</div>
          <div className="font-medium">{s.mine ? `${s.mine.card.name} ${s.mine.card.val}` : "—"}</div>
          {s.mine && <div className="font-mono text-muted-foreground">{signed(s.mine.runs)} runs/700</div>}
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Best legal</div>
          <div className="font-medium">{s.best ? `${s.best.card.name} ${s.best.card.val}` : "—"}{s.best?.card.owned && <span className="ml-1 text-positive">yours</span>}</div>
          {s.best && <div className="font-mono text-muted-foreground">{signed(s.best.runs)} runs/700</div>}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">Gap by era: {s.gap.map((g, i) => <span key={i} className="mr-2 font-mono">{eras[i]} {g == null ? "—" : g <= 0.05 ? "0" : `−${g.toFixed(1)}`}</span>)}</div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-1 font-medium">Card</th>
              <th className="pb-1 text-right font-medium" title="Runs per 700 over the card it would replace, five-era average">Adds</th>
              <th className="pb-1 text-right font-medium" title="Lowest ask now / highest bid now">Ask · bid</th>
              <th className="pb-1 text-right font-medium" title="Last-10 average: two-week low – median – high">Last-10 (14 d)</th>
              <th className="pb-1 text-right font-medium" title="Buy at the ask when it's at or under the two-week median; else bid the low and wait">Call</th>
              <th className="pb-1 text-right font-medium" title="Runs per 1,000 PP at that price">Runs/1k</th>
            </tr>
          </thead>
          <tbody>
            {buys.map((b) => (
              <tr key={b.card.id} className={cn("border-t border-border/60", !worth(b) && "text-muted-foreground")}>
                <td className="py-1 pr-2">
                  {b.card.name} <span className="text-muted-foreground">{b.card.val}{b.card.year ? ` · ’${String(b.card.year).slice(2)}` : ""}{b.card.set != null && CARD_TYPE_SHORT[b.card.set] ? ` · ${CARD_TYPE_SHORT[b.card.set]}` : ""}{b.card.le ? " · LE" : ""}</span>
                </td>
                <td className={cn("py-1 text-right font-mono", (b.gainAvg ?? 0) > 0 ? "text-positive" : "")}>{signed(b.gainAvg)}</td>
                <td className="py-1 text-right font-mono">{pts(b.price.ask)} · {pts(b.price.bid)}</td>
                <td className="py-1 text-right font-mono">{b.price.low == null ? "—" : `${pts(b.price.low)}–${pts(b.price.median)}–${pts(b.price.high)}`}</td>
                <td className="py-1 text-right font-mono">
                  {b.call === "buy" ? <span className="text-positive">buy {pts(b.target)}</span> : b.call === "bid" ? <span className="text-warning">bid {pts(b.target)}</span> : "—"}
                </td>
                <td className="py-1 text-right font-mono">{b.perK == null ? "—" : b.perK.toFixed(2)}</td>
              </tr>
            ))}
            {buys.length === 0 && <tr><td colSpan={6} className="py-2 text-muted-foreground">No unowned card beats yours here.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The top three unowned cards at the spot. A grey row closes less than half a run. Prices swing a lot: when the ask sits over its two-week median the call is a bid at the two-week low
        (or one over the top bid), and the low tends to come round again.
      </p>
    </div>
  );
}
