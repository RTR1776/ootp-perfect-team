"use client";

/**
 * The Buy Plan page (lib/buy-plan-load): where he plays and where he's short,
 * the cards that add most across those events for the PP, a basket he ticks
 * up against his budget, the best Clubhouse buys for CS, and what to sell.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { CardName } from "@/components/card-name";
import { Section } from "@/components/section";
import { Input } from "@/components/ui/input";
import { DataTable, type Column, type Sort } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import type { BuyPlanData, BuyRow, ClubRow, SellRow, VariantRow } from "@/lib/buy-plan-load";
import { date, pp } from "@/lib/format";
import { cn } from "@/lib/utils";

const num = "font-mono tabular-nums";
const PICKED_TINT = "[--row-tint:color-mix(in_oklch,var(--primary)_10%,transparent)]";

function Pill({ tone, children, title }: { tone: "go" | "wait" | "cs"; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "go" ? "bg-positive/15 text-positive" : tone === "wait" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>
      {children}
    </span>
  );
}

function Starts({ row, max = 3 }: { row: BuyRow; max?: number }) {
  return (
    <span className="flex flex-wrap gap-1">
      {row.starts.slice(0, max).map((s) => (
        <span key={s.eventId} className="inline-flex items-center gap-1 rounded bg-positive/10 px-1.5 py-0.5 text-[11px]" title={`${s.event}: +${s.gain} at ${s.spot}, ${s.perWeek} entries a week`}>
          <span className="font-medium">{s.event}</span>
          <span className={num}>{s.spot} +{s.gain}</span>
        </span>
      ))}
      {row.starts.length > max && <span className="text-[11px] text-muted-foreground">+{row.starts.length - max} more</span>}
    </span>
  );
}

const ALL = "All";

export function BuyPlanBoard({ data }: { data: BuyPlanData }) {
  const byId = useMemo(() => new Map(data.buys.map((b) => [b.id, b])), [data.buys]);
  const [budgetText, setBudgetText] = useState("100000");
  const budget = Number(budgetText.replace(/[^\d]/g, "")) || 0;
  const [tier, setTier] = useState<string>(ALL);
  const [fits, setFits] = useState(false);
  const [sort, setSort] = useState<Sort | null>({ key: "weighted", desc: true });
  const [limit, setLimit] = useState(30);
  const [basket, setBasket] = useState<Set<number>>(new Set());
  const [allClub, setAllClub] = useState(false);
  const [sellLimit, setSellLimit] = useState(25);
  const [showLocked, setShowLocked] = useState(false);

  const tierEvents = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const e of data.events) if (e.tier) m.set(e.tier, new Set([...(m.get(e.tier) ?? []), e.id]));
    return m;
  }, [data.events]);

  const rows = useMemo(() => {
    const ids = tier === ALL ? null : tierEvents.get(tier) ?? new Set<number>();
    return data.buys
      .map((b) => {
        if (!ids) return b;
        const starts = b.starts.filter((s) => ids.has(s.eventId));
        const weighted = Math.round(starts.reduce((s, r) => s + r.gain * r.perWeek, 0) * 10) / 10;
        return { ...b, starts, weighted, per10k: b.price ? Math.round((weighted / b.price) * 100_000) / 10 : null };
      })
      .filter((b) => b.weighted >= 1 && (!fits || (b.target ?? b.price ?? Infinity) <= budget));
  }, [data.buys, tier, tierEvents, fits, budget]);

  const picked = [...basket].map((id) => byId.get(id)).filter((b): b is BuyRow => !!b);
  const spend = picked.reduce((s, b) => s + (b.target ?? b.price ?? 0), 0);
  const unpricedPicked = picked.filter((b) => b.price == null).length;
  const unpriced = data.buys.filter((b) => b.price == null).length;
  const gain = picked.reduce((s, b) => s + b.weighted, 0);
  const toggle = (id: number) => setBasket((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const confirmHref = `/upgrades?group=events:${data.events.map((e) => e.id).join(",")}`;

  const buyCols: Column<BuyRow>[] = [
    { key: "pick", header: "", priority: 1, render: (r) => (
      <input type="checkbox" checked={basket.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Add ${r.name} to the basket`} className="size-4 accent-[var(--primary)]" />
    ) },
    { key: "card", header: "Card", priority: 1, sortValue: (r) => r.name, render: (r) => (
      <span className="flex min-w-0 flex-col">
        <CardName id={r.id} name={r.name} val={r.val} tier={r.tier} compact />
        <span className="truncate text-[11px] text-muted-foreground">{r.pos} · {r.title.replace(/\s+\S+\s+\S+\s+\d{4}$/, "").slice(0, 48)}</span>
      </span>
    ) },
    { key: "weighted", header: "Runs / wk", tip: "Each event's gain times your entries a week there, summed", align: "right", priority: 1, sortValue: (r) => r.weighted, render: (r) => <span className={num}>{r.weighted.toFixed(1)}</span> },
    { key: "per10k", header: "Per 10k PP", align: "right", priority: 2, sortValue: (r) => r.per10k, render: (r) => <span className={num}>{r.per10k?.toFixed(1) ?? "—"}</span> },
    { key: "price", header: "Last sold · ask", align: "right", priority: 2, sortValue: (r) => r.price, render: (r) => <span className={num}>{pp(r.last10)} · {pp(r.ask)}</span> },
    { key: "how", header: "How", priority: 1, sortValue: (r) => r.target, render: (r) => (
      <span className="flex flex-wrap items-center gap-1">
        {r.call === "none"
          ? <Pill tone="wait" title={r.fresh ? "New on the card list: no ask and no sales yet. Bid once it lists." : r.clubhouse ? "No PP sales on file: buy it with CS in the Clubhouse." : "No ask and no sales on file."}>
              {r.fresh ? "No price yet" : r.clubhouse ? "No PP sales" : "No price"}
            </Pill>
          : <Pill tone={r.call === "buy" ? "go" : "wait"}>{r.call === "buy" ? "Buy" : "Bid"} {pp(r.target)}</Pill>}
        {r.cs != null
          ? <Pill tone="cs" title="Clubhouse price">{r.cs} CS</Pill>
          : r.clubhouse && <Pill tone="cs" title="A Clubhouse card whose CS price isn't in the screenshots yet">CS ?</Pill>}
      </span>
    ) },
    { key: "where", header: "Where it starts", priority: 3, render: (r) => (
      <span className="flex flex-col gap-1">
        <Starts row={r} />
        {r.clash.length > 0 && <span className="text-[11px] text-warning">Another copy of this player is on: {r.clash.join(", ")}</span>}
      </span>
    ), text: (r) => r.starts.slice(0, 4).map((s) => `${s.event} ${s.spot} +${s.gain}`).join("; ") },
  ];

  const varCols: Column<VariantRow>[] = [
    { key: "card", header: "Variant of", priority: 1, render: (r) => <CardName id={r.id} name={r.name} val={r.val} compact /> },
    { key: "weighted", header: "Runs / wk", align: "right", priority: 1, sortValue: (r) => r.weighted, render: (r) => <span className={num}>{r.weighted.toFixed(1)}</span> },
    { key: "price", header: "Variant price", align: "right", priority: 1, sortValue: (r) => r.price, render: (r) => <span className={num}>{r.price ? pp(r.price) : "none listed"}</span> },
    { key: "per10k", header: "Per 10k PP", align: "right", priority: 2, sortValue: (r) => r.per10k, render: (r) => <span className={num}>{r.per10k?.toFixed(1) ?? "—"}</span> },
    { key: "events", header: "Events", align: "right", priority: 2, sortValue: (r) => r.events, render: (r) => <span className={num}>{r.events}</span> },
  ];

  const rate = data.clubhouse.ppPerCs;
  const clubRows = data.clubhouse.rows.filter((r) => !r.owned && (allClub || r.weighted > 0));
  // Clubhouse cards the screenshots don't have yet: what they add is known, their CS price isn't.
  const unlisted = data.clubhouse.rows.filter((r) => r.cs == null && !r.owned && r.weighted > 0).sort((a, b) => b.weighted - a.weighted);
  const clubCols: Column<ClubRow>[] = [
    { key: "card", header: "Clubhouse card", priority: 1, sortValue: (r) => r.name, render: (r) => r.id != null ? <CardName id={r.id} name={r.name} val={r.val} compact /> : <span>{r.name} <span className="text-[11px] text-muted-foreground">{r.val}</span></span> },
    { key: "cs", header: "CS", align: "right", priority: 1, sortValue: (r) => r.cs, render: (r) => r.cs != null
      ? <span className={num}>{r.cs}{r.discount ? <span className="ml-1 text-[11px] text-muted-foreground">−{r.discount}%</span> : null}</span>
      : <span className="text-[11px] text-muted-foreground" title="Not in the Clubhouse screenshots yet: send one for its CS price">not in screenshots</span> },
    { key: "perCs", header: "Runs / wk per 10 CS", align: "right", priority: 1, sortValue: (r) => r.perCs, render: (r) => <span className={num}>{r.perCs?.toFixed(1) ?? "—"}</span> },
    { key: "weighted", header: "Runs / wk", align: "right", priority: 2, sortValue: (r) => r.weighted, render: (r) => <span className={num}>{r.weighted ? r.weighted.toFixed(1) : "—"}</span> },
    { key: "pp", header: "Or in PP", align: "right", priority: 2, sortValue: (r) => r.pp, render: (r) => {
      const csCost = rate && r.cs != null ? r.cs * rate : null;
      const cheaper = r.pp != null && csCost != null && r.pp < csCost * 0.8;
      return <span className={num}>{pp(r.pp)}{cheaper && <span className="ml-1"><Pill tone="go" title="Cheaper in PP than in CS at today's rate">PP</Pill></span>}</span>;
    } },
  ];

  const sellable = data.sells.filter((r) => showLocked || !r.locked);
  const lockedCount = data.sells.filter((r) => r.locked).length;
  const sells = sellable.slice(0, sellLimit);
  const sellCols: Column<SellRow>[] = [
    { key: "card", header: "Card", priority: 1, sortValue: (r) => r.name, render: (r) => (
      <span className="flex min-w-0 flex-col">
        <CardName id={r.id} name={r.name} val={r.val} variant={r.variant} owned compact />
        <span className="truncate text-[11px] text-muted-foreground">
          {r.locked && <span className="mr-1 font-medium text-warning">Locked or new</span>}
          {r.title.slice(0, 48)}
        </span>
      </span>
    ) },
    { key: "last10", header: "Last sold", align: "right", priority: 1, sortValue: (r) => r.last10, render: (r) => <span className={num}>{pp(r.last10)}</span> },
    { key: "bid", header: "Bid · ask", align: "right", priority: 2, sortValue: (r) => r.bid, render: (r) => <span className={num}>{r.variant ? "variant market" : `${pp(r.bid)} · ${pp(r.ask)}`}</span> },
    { key: "do", header: "Do", priority: 1, sortValue: (r) => r.target, render: (r) => <Pill tone={r.call === "take" ? "go" : "wait"}>{r.call === "take" ? "Take the bid" : "List"} {pp(r.target)}</Pill> },
  ];

  const worst = [...data.tiers].filter((t) => t.ptsPerEntry != null).sort((a, b) => a.ptsPerEntry! - b.ptsPerEntry!).slice(0, 2).map((t) => t.tier);

  return (
    <div className="flex flex-col gap-4">
      <Section id="tiers" title="Where you play" summary={`Logged results since ${date(data.since)}, drafts left out`}
        help={<p>Entries a week and points per entry by tier, off the results you log. Slots and cap events count under their tier (Diamond Jumble Slots is Diamond). The best buys are the three cards that add most in that tier&rsquo;s events, weighted by how often you enter each.</p>}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Tier</th><th className="px-3 py-2 text-right font-medium">Entries / wk</th><th className="px-3 py-2 text-right font-medium">Pts / entry</th><th className="px-3 py-2 font-medium">Best buys there</th>
            </tr></thead>
            <tbody>
              {data.tiers.map((t) => (
                <tr key={t.tier} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{t.tier}</td>
                  <td className={cn("px-3 py-2 text-right", num)}>{t.perWeek.toFixed(1)}</td>
                  <td className={cn("px-3 py-2 text-right", num, worst.includes(t.tier) && "font-semibold text-warning")}>{t.ptsPerEntry?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2">{t.top.map((id) => byId.get(id)).filter(Boolean).map((b) => `${b!.name} ${b!.val}`).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="buys" title="What to buy" summary={`${data.buys.length} cards you don't own that start in events you play${unpriced ? `, ${unpriced} with no price yet` : ""}`}
        actions={<Link href={confirmHref} className="text-sm text-primary hover:underline">Confirm a basket on Upgrades</Link>}
        help={<>
          <p>Every card you don&rsquo;t own that has a price, plus new releases the market hasn&rsquo;t priced yet and Clubhouse cards, swapped into your newest saved roster in each event you play (Card Fit&rsquo;s one swap, in the event&rsquo;s era and park, with tournament play blended in). In a slots or cap event a card that only fits once room is made counts what it adds less what the room costs. Each event&rsquo;s gain is multiplied by your entries a week there.</p>
          <p><b>How</b>: buy at the ask when it is within 10% of recent sales; otherwise bid about the last-10 average and wait. Two cards for the same spot don&rsquo;t add up, so confirm a basket with the real rebuild on Upgrades before buying several.</p>
          <p><b>No price yet</b>: a card first listed within a week of the newest card on the card list, with no ask and no sales; bid once it lists. <b>No PP sales</b>: a Clubhouse card that hasn&rsquo;t traded for PP; buy it with CS (its price is under Spend CS when the screenshots have it, else <b>CS ?</b>).</p>
        </>}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="budget">
            PP budget
            <Input id="budget" inputMode="numeric" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} className={cn("h-8 w-32", num)} />
          </label>
          <label className="flex items-center gap-2 text-sm" htmlFor="fits">
            <input id="fits" type="checkbox" checked={fits} onChange={(e) => setFits(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Only cards under budget
          </label>
          <Segmented aria-label="Tier" value={tier} onChange={(v) => { setTier(v); setLimit(30); }}
            options={[ALL, ...data.tiers.map((t) => t.tier)].map((t) => ({ value: t, label: t }))} />
        </div>
        {picked.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">Basket: {picked.length} card{picked.length === 1 ? "" : "s"}</span>
            <span className={num}>{pp(spend)} PP</span>
            {unpricedPicked > 0 && <span className="text-muted-foreground">plus {unpricedPicked} with no PP price yet</span>}
            <span className={cn(num, spend > budget ? "text-warning" : "text-muted-foreground")}>{spend > budget ? `${pp(spend - budget)} over budget` : `${pp(budget - spend)} left`}</span>
            <span className={num}>about +{gain.toFixed(1)} runs a week, before overlaps</span>
            <button type="button" onClick={() => setBasket(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
        <DataTable columns={buyCols} rows={rows} rowKey={(r) => r.id} sort={sort} onSort={setSort} limit={limit}
          rowClassName={(r) => (basket.has(r.id) ? PICKED_TINT : undefined)}
          empty={<p className="py-6 text-center text-sm text-muted-foreground">No card you don&rsquo;t own starts in these events{fits ? " under this budget" : ""}.</p>} />
        {rows.length > limit && <button type="button" onClick={() => setLimit((l) => l + 30)} className="mt-2 text-sm text-primary hover:underline">Show more ({rows.length - limit})</button>}
      </Section>

      {data.variants.length > 0 && (
        <Section id="variants" title="Variants of cards you start" summary="The boosted copy of a card already on your rosters" collapsible defaultOpen={false}
          help={<p>Each base card that starts on a saved roster, scored again as its variant (its split ratings ×1.08). Most variants aren&rsquo;t listed for sale; the price is recent variant sales where there are any.</p>}>
          <DataTable columns={varCols} rows={data.variants} rowKey={(r) => r.id} limit={25} />
        </Section>
      )}

      <Section id="clubhouse" title="Spend CS in the Clubhouse"
        summary={rate ? `One CS is worth about ${Math.round(rate)} PP; prices as of ${date(data.clubhouse.asOf)}` : `Prices as of ${date(data.clubhouse.asOf)}`}
        actions={<label className="flex items-center gap-2 text-sm" htmlFor="allclub"><input id="allclub" type="checkbox" checked={allClub} onChange={(e) => setAllClub(e.target.checked)} className="size-4 accent-[var(--primary)]" />Show every card</label>}
        help={<>
          <p>The Clubhouse prices come from your screenshots ({data.clubhouse.note}) and live in <code>src/data/clubhouse-cs.json</code>: send new screenshots after a Wednesday price drop and they get updated. Clubhouse cards also trade for PP, so the median of PP price over CS price says what one CS is worth.</p>
          <p>Runs a week are the same as under What to buy. A card marked PP is cheaper bought for PP than with CS at that rate.</p>
          <p>Clubhouse cards the screenshots don&rsquo;t have yet (a set added since they were taken) are listed too when they start somewhere, with their runs a week and no CS price; they sort after the priced ones, best first.</p>
        </>}>
        {unlisted.length > 0 && (
          <p className="mb-3 text-sm">
            <span className="font-medium">Not in the screenshots yet, so no CS price:</span>{" "}
            {unlisted.slice(0, 6).map((r) => `${r.name} ${r.val} (${r.weighted.toFixed(0)} runs / wk)`).join(" · ")}
            {unlisted.length > 6 ? ` · ${unlisted.length - 6} more` : ""}.{" "}
            <span className="text-muted-foreground">Send a Clubhouse screenshot for their prices.</span>
          </p>
        )}
        <DataTable columns={clubCols} rows={clubRows} rowKey={(r) => `${r.id ?? ""}-${r.name}-${r.val}-${r.pos}`} sort={{ key: "perCs", desc: true }}
          empty={<p className="py-6 text-center text-sm text-muted-foreground">No Clubhouse card starts in the events you play.</p>} />
      </Section>

      <Section id="sells" title="What to sell" summary={`${sellable.length} unlocked cards on no current roster and not on your league team`}
        actions={lockedCount > 0 && <label className="flex items-center gap-2 text-sm" htmlFor="locked"><input id="locked" type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} className="size-4 accent-[var(--primary)]" />Show {lockedCount} locked</label>}
        help={<>
          <p>Cards in your newest collection that no roster saved in the last 20 days for a current event uses, and that aren&rsquo;t on your league team, worth 15k or more. A card unused today may start once the weekly events rotate, so check before selling one that top teams play.</p>
          <p><b>Locked cards</b>: no export marks them, so each card is checked against your unlocked-cards export of {date(data.unlockedAsOf)} (<code>src/data/unlocked-cards.json</code>). A card missing from it is locked, or new since then. Send a fresh unlocked export after a mission and the list gets updated.</p>
          <p><b>Do</b>: take the instant bid when it is within 15% of recent sales; otherwise list just under the ask or last-10.</p>
        </>}>
        <DataTable columns={sellCols} rows={sells} rowKey={(r) => `${r.id}${r.variant ? "v" : ""}`}
          empty={<p className="py-6 text-center text-sm text-muted-foreground">Nothing unused worth listing.</p>} />
        {sellable.length > sellLimit && <button type="button" onClick={() => setSellLimit((l) => l + 25)} className="mt-2 text-sm text-primary hover:underline">Show more ({sellable.length - sellLimit})</button>}
      </Section>
    </div>
  );
}
