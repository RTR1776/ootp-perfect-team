"use client";

/**
 * Era Strength: how the collection stands in each of five eras, per tier,
 * and the cards to buy before an event's rules are out (lib/era-strength).
 *
 * The page sends every tier, ranked both ways, so switching the tier or the
 * ranking redraws at once. Both ride in the URL (history.replaceState, as on
 * Played), so a reload or Back keeps them.
 */
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CardName } from "@/components/card-name";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import { ERAS, ERA_TIERS, mean, type BuyRow, type CardRef, type Rank, type SpotRow, type TierGrid, type TierKey } from "@/lib/era-strength";
import type { EraStrengthData } from "@/lib/era-strength-load";
import { date, pp, signed, tone } from "@/lib/format";
import { describePosFloor, LJ_FLOOR } from "@/lib/pos-floor";
import { cn } from "@/lib/utils";

const TONE = { positive: "text-positive", negative: "text-negative" } as const;
const OWNED_TINT = "[--row-tint:color-mix(in_oklch,var(--primary)_7%,transparent)]";
const num = "font-mono tabular-nums";

/** The average, or the worst era with its name. Nulls (no one owned there) are skipped. */
function stat(xs: readonly (number | null)[], rank: Rank, worst: "min" | "max" = "min"): { v: number | null; era: string | null } {
  const ok = xs.flatMap((x, e) => (x == null ? [] : [{ x, e }]));
  if (!ok.length) return { v: null, era: null };
  if (rank === "avg") return { v: mean(ok.map((o) => o.x)), era: null };
  const pick = ok.reduce((b, o) => ((worst === "min" ? o.x < b.x : o.x > b.x) ? o : b));
  return { v: pick.x, era: ERAS[pick.e].short };
}

function Signed({ v, era, colour = false }: { v: number | null; era?: string | null; colour?: boolean }) {
  const t = colour ? tone(v) : null;
  return (
    <span className={cn(num, t && TONE[t])}>
      {signed(v)}
      {era && <span className="ml-1 text-[11px] text-muted-foreground">{era}</span>}
    </span>
  );
}

const cardCell = (c: CardRef) => (
  <CardName id={c.id} name={c.name} val={c.val} year={c.year} set={c.set} owned={c.owned} variant={c.variant} />
);

/** The ask, flagged when it sits far over recent sales (a placeholder ask). */
function Price({ c }: { c: CardRef }) {
  const title = `Ask ${c.ask?.toLocaleString("en-US") ?? "none"} · last 10 ${c.last10?.toLocaleString("en-US") ?? "none"}`;
  if (c.ask == null) return <span className="text-xs text-muted-foreground" title={title}>{c.last10 != null ? `L10 ${pp(c.last10)}` : "not listed"}</span>;
  const high = c.last10 != null && c.ask > 1.5 * c.last10;
  return (
    <span className={num} title={title}>
      {pp(c.ask)}
      {high && <span className="ml-1 text-[11px] text-warning">≫ L10</span>}
    </span>
  );
}

const eraColumns = <T,>(runs: (r: T) => readonly (number | null)[], priority: 2 | 3 = 3): Column<T>[] =>
  ERAS.map((era, e) => ({
    key: `era-${era.key}`,
    header: era.short,
    tip: `${era.label} (${era.span}): runs per 700 PA, averaged over ${era.years.join(", ")}${(era.years as readonly number[]).includes(2010) ? " (2010 = PT default)" : ""}.`,
    align: "right" as const,
    priority,
    render: (r: T) => <Signed v={runs(r)[e]} />,
    sortValue: (r: T) => runs(r)[e] ?? null,
  }));

export function EraStrengthBoard({ data, initialTier, initialRank }: { data: EraStrengthData; initialTier: TierKey; initialRank: Rank }) {
  const pathname = usePathname();
  const [tier, setTier] = useState<TierKey>(initialTier);
  const [rank, setRank] = useState<Rank>(initialRank);
  const go = (t: TierKey, r: Rank) => {
    setTier(t); setRank(r);
    const qs = new URLSearchParams();
    if (t !== "bronze") qs.set("tier", t);
    if (r !== "avg") qs.set("rank", r);
    const url = qs.size ? `${pathname}?${qs}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
  };

  const view = data.tiers.find((t) => t.tier === tier) ?? data.tiers[0];
  const tierLabel = ERA_TIERS.find((t) => t.key === tier)?.label ?? tier;
  const rankWord = rank === "avg" ? "Avg" : "Worst";

  /* ---------------- strength by era: every tier ---------------- */
  const eraName = (xs: readonly number[], pick: "min" | "max") => {
    const v = pick === "min" ? Math.min(...xs) : Math.max(...xs);
    return { e: xs.indexOf(v), v };
  };
  const gridCols: Column<TierGrid>[] = [
    {
      key: "tier", header: "Tier", priority: 1,
      render: (g) => <span className={cn("font-medium", g.tier === tier && "text-primary")}>{ERA_TIERS.find((t) => t.key === g.tier)?.label}</span>,
    },
    ...eraColumns<TierGrid>((g) => g.short.map((x) => -x), 2),
    {
      key: "all", header: "All eras", align: "right", priority: 1,
      tip: "Runs short of the best possible team, averaged over the five eras.",
      render: (g) => <Signed v={-mean(g.short)} />, sortValue: (g) => -mean(g.short),
    },
    {
      key: "strong", header: "Strongest", priority: 1, tip: "The era where you are closest to the best possible team.",
      render: (g) => { const s = eraName(g.short, "min"); return <span className="text-positive">{ERAS[s.e].short}</span>; },
    },
    {
      key: "weak", header: "Weakest", priority: 1, tip: "The era where you are furthest from the best possible team.",
      render: (g) => { const s = eraName(g.short, "max"); return <span className="text-negative">{ERAS[s.e].short}</span>; },
    },
  ];

  /* ---------------- by position, for the tier ---------------- */
  const spotCols: Column<SpotRow>[] = [
    { key: "spot", header: "Pos", priority: 1, render: (r) => <span className="font-medium">{r.spot}</span> },
    { key: "mine", header: "Your team", priority: 1, render: (r) => (r.mine ? cardCell(r.mine.card) : <span className="text-xs text-muted-foreground">none at the floor</span>) },
    ...eraColumns<SpotRow>((r) => r.mine?.runs ?? ERAS.map(() => null)),
    {
      key: "mineRuns", header: rankWord, align: "right", priority: 2,
      tip: rank === "avg" ? "Your card's runs, averaged over the five eras." : "Your card's runs in its worst era.",
      render: (r) => { const s = stat(r.mine?.runs ?? [], rank); return <Signed v={s.v} era={s.era} />; },
      sortValue: (r) => stat(r.mine?.runs ?? [], rank).v,
    },
    {
      key: "best", header: "Best possible", priority: 2,
      render: (r) => (r.best && r.mine && r.best.card.id === r.mine.card.id && r.best.card.variant === r.mine.card.variant
        ? <span className="text-xs text-positive">yours</span>
        : r.best ? cardCell(r.best.card) : "—"),
    },
    {
      key: "gap", header: "Gap", align: "right", priority: 1,
      tip: rank === "avg"
        ? "How far the best possible team's card at this spot is ahead of your team's, averaged over the eras. Arms: per starter or reliever."
        : "The widest gap at this spot, and the era it is in.",
      render: (r) => {
        const s = stat(r.gap, rank, "max");
        if (s.v == null) return <span className="text-xs text-muted-foreground">none owned</span>;
        return <Signed v={-s.v} era={s.era} colour />;
      },
      sortValue: (r) => stat(r.gap, rank, "max").v,
    },
  ];

  /* ---------------- the buys ---------------- */
  const buyCols: Column<BuyRow>[] = [
    { key: "spot", header: "Pos", priority: 1, render: (r) => <span className={cn("font-medium", r.place > 1 && "text-muted-foreground")}>{r.spot}</span> },
    {
      key: "card", header: "Card", priority: 1,
      render: (r) => (
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          {cardCell(r.card)}
          {r.card.le && <span className="rounded bg-accent px-1 text-[10px] font-semibold" title="Limited edition">LE</span>}
        </span>
      ),
    },
    ...eraColumns<BuyRow>((r) => r.runs),
    {
      key: "runs", header: rankWord, align: "right", priority: 2,
      tip: rank === "avg" ? "Runs averaged over the five eras: the ranking." : "Runs in the card's worst era: the ranking.",
      render: (r) => { const s = stat(r.runs, rank); return <Signed v={s.v} era={s.era} />; },
      sortValue: (r) => stat(r.runs, rank).v,
    },
    {
      key: "gain", header: "Gain", align: "right", priority: 1,
      tip: `Over the card it would replace: the one your best team plays at the spot, your fifth starter, or your seventh reliever. ${rank === "avg" ? "Averaged over the eras." : "In its worst era."}`,
      render: (r) => { const s = stat(r.gain, rank); return s.v == null ? <span className="text-xs text-muted-foreground">—</span> : <Signed v={s.v} era={s.era} colour />; },
      sortValue: (r) => stat(r.gain, rank).v,
    },
    { key: "ask", header: "Ask", align: "right", priority: 1, tip: "The lowest ask on the newest shop list.", render: (r) => <Price c={r.card} />, sortValue: (r) => r.card.ask ?? r.card.last10 ?? null },
    {
      key: "released", header: "Released", align: "right", priority: 2,
      tip: "When the card came out. Newer releases tend to be stronger.",
      render: (r) => <span className="text-xs text-muted-foreground">{r.card.released ? date(r.card.released) : "—"}</span>,
      sortValue: (r) => r.card.released,
    },
  ];

  /* ---------------- his era-proof cards ---------------- */
  type CoreRow = (typeof view.core)[number];
  const coreCols: Column<CoreRow>[] = [
    { key: "spot", header: "Pos", priority: 1, render: (r) => <span className="font-medium">{r.spot}</span> },
    { key: "card", header: "Card", priority: 1, render: (r) => cardCell(r.card) },
    ...eraColumns<CoreRow>((r) => r.runs),
    { key: "avg", header: "Avg", align: "right", priority: 2, render: (r) => <Signed v={mean(r.runs)} />, sortValue: (r) => mean(r.runs) },
    {
      key: "worst", header: "Worst", align: "right", priority: 1, tip: "Runs in the card's worst era: the ranking.",
      render: (r) => { const s = stat(r.runs, "worst"); return <Signed v={s.v} era={s.era} />; },
      sortValue: (r) => stat(r.runs, "worst").v,
    },
  ];

  const about = (
    <>
      <p>For buying before an event&rsquo;s rules are announced. Every card is scored in five eras. Each era is the average of three run environments PT runs events in, in a neutral park:</p>
      <ul className="list-disc pl-5">
        {ERAS.map((e) => <li key={e.key}>{`${e.label} (${e.span}): ${e.years.join(", ")}${(e.years as readonly number[]).includes(2010) ? " (2010 is the PT default)" : ""}`}</li>)}
      </ul>
      <p>Runs are per 700 PA, on the same scorer as Build: calibrated, era-corrected, with tournament play blended in. A card that has out-played its ratings keeps that edge in every era. A bat is 70% vs RHP and 30% vs LHP, plus its glove at the spot. The glove counts for more in eras with more balls in play (deadball ×{data.glove[0]}, modern ×{data.glove[4]}).</p>
      <p>{`A tier is every card at or under its ceiling: Bronze 69, Silver 79, Gold 89, Diamond 99. Live and Perfect cards are left out. A spot needs a rating at or above your glove floor (${describePosFloor(LJ_FLOOR)}). Your variants are scored from their own ratings.`}</p>
      <p>{`Owned is the ${data.collectionDate ? date(data.collectionDate) : "latest"} collection, plus cards the ${data.shopDate ? date(data.shopDate) : "latest"} shop list shows you own. Prices are from that shop list.`}</p>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Era Strength" description="Your cards against the best in five eras, and the buys that close the gaps." about={about} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented aria-label="Tier" size="md" options={ERA_TIERS.map((t) => ({ value: t.key, label: t.label }))} value={tier} onChange={(t) => go(t, rank)} />
        <Segmented
          aria-label="Rank by"
          options={[{ value: "avg" as Rank, label: "Average", title: "Rank by the five-era average" }, { value: "worst" as Rank, label: "Worst era", title: "Rank by the weakest era: cards that hold up anywhere" }]}
          value={rank}
          onChange={(r) => go(tier, r)}
        />
      </div>

      <Section
        id="grid"
        title="Strength by era"
        summary="Runs short of the best possible team."
        help={<p>The team is the best nine bats (each card once, the scarce gloves filled first), five starters, and seven relievers, each reliever counted at 0.31 of a lineup spot. It is scored separately in each era. 0.0 means you own the best possible team in that era. Tap a tier to open it below.</p>}
      >
        <DataTable columns={gridCols} rows={data.tiers.map((t) => t.grid)} rowKey={(g) => g.tier} onRowClick={(g) => go(g.tier, rank)} rowClassName={(g) => (g.tier === tier ? OWNED_TINT : undefined)} />
      </Section>

      <Section
        id="spots"
        title={`${tierLabel} by position`}
        summary="Your best at each spot, and the game's."
        help={<p>{`Both teams are filled as in the grid above: each card once, the scarce gloves first, by ${rank === "avg" ? "the five-era average" : "the worst era"}. So a card that is your best at several spots shows at one, and the bats' gaps add up to the lineup part of the grid's total. Starters and relievers show the best one; their gap is per slot over five starters or seven relievers. The gap is worked out era by era, so in a given era it can involve other cards than the two shown.`}</p>}
      >
        <DataTable columns={spotCols} rows={view.spots[rank]} rowKey={(r) => r.spot} />
      </Section>

      <Section
        id="buys"
        title="Buys: the top 3 you don't own at each spot"
        summary={rank === "avg" ? "By average; Gain is over what it replaces." : "By worst era: cards that hold up anywhere."}
        help={<p>A green Gain is an upgrade on what you own. A card can appear at more than one spot. &ldquo;≫ L10&rdquo; marks an ask over 1.5 times the last ten sales, usually a placeholder, so check the price in game.</p>}
      >
        <DataTable columns={buyCols} rows={view.buys[rank]} rowKey={(r) => `${r.spot}-${r.card.id}`} />
      </Section>

      <Section id="core" title="Your era-proof cards" summary="10 bats, 10 arms, by their worst era." collapsible defaultOpen={false}>
        <DataTable columns={coreCols} rows={view.core} rowKey={(r) => `${r.spot}-${r.card.id}-${r.card.variant}`} rowClassName={() => OWNED_TINT} />
      </Section>
    </div>
  );
}
