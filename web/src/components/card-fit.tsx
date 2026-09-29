"use client";

/**
 * Card Fit on /cards (lib/card-fit): the new cards with where each one starts
 * for L.J., and one card across every current event.
 *
 * Both read the same rows: per event, the spot the card takes, its runs
 * against each hand, its rank there among every legal card, and what it does
 * to his team (whom it replaces and the runs it adds, or the card of his it
 * falls short of). Filters are local: tier chips and "only where it starts".
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardName } from "@/components/card-name";
import { Section } from "@/components/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import type { CardFitData, FitCard, FitEvent, FitRow } from "@/lib/card-fit-load";
import { date, pp, signed, tone } from "@/lib/format";
import { tierCode, TIER_NAME } from "@/lib/roster-rules";
import { cn } from "@/lib/utils";

const num = "font-mono tabular-nums";
const TONE = { positive: "text-positive", negative: "text-negative" } as const;
const EVENT_TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Slots", "Live"] as const;
const CARD_TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Perfect"] as const;
const STARTS_TINT = "[--row-tint:color-mix(in_oklch,var(--positive)_8%,transparent)]";

function Signed({ v, colour = false, className }: { v: number | null | undefined; colour?: boolean; className?: string }) {
  const t = colour ? tone(v ?? null) : null;
  return <span className={cn(num, t && TONE[t], className)}>{signed(v ?? null)}</span>;
}

const cardTier = (c: FitCard) => TIER_NAME[tierCode(c.val)];

/** "SP over Bob Gibson +10.7" / "1B vR over Rob Deer +6.3" / "DH vL (empty) +4.0". */
function swapText(s: FitRow["swaps"][number]) {
  const where = s.board === "staff" ? s.spot : `${s.spot} v${s.board}`;
  return `${where} ${s.out ? `over ${s.out.name}${s.out.variant ? " (V)" : ""}` : "(empty)"} ${signed(s.delta)}`;
}

/** What the card does to his team there: the gain and whom it replaces, or why it doesn't start. */
function TeamCell({ r, e }: { r: FitRow; e: FitEvent }) {
  const against = e.team.kind === "saved" ? `Measured against your saved roster “${e.team.name}”.` : "No roster saved for this event: measured against the best team your legal cards make.";
  let cap: React.ReactNode = null;
  if (e.cap && r.status === "start" && r.capCost != null) {
    if (e.cap.spare == null) cap = <span className="text-warning">cap {e.cap.cap.toLocaleString("en-US")}: check in Build</span>;
    else if (r.capCost > e.cap.spare) cap = <span className="text-warning">needs {r.capCost - e.cap.spare} more cap</span>;
    else cap = <span className="text-muted-foreground">fits the cap ({r.capCost > 0 ? `uses ${r.capCost} of ${e.cap.spare} spare` : r.capCost < 0 ? `frees ${-r.capCost}` : "same value"})</span>;
  }
  if (r.status === "start") {
    return (
      <span className="flex flex-col gap-0.5" title={against}>
        <span><Signed v={r.gain} colour className="font-semibold" /> <span className="text-xs text-muted-foreground">runs</span></span>
        <span className="text-xs">{r.swaps.map(swapText).join(" · ")}</span>
        {cap && <span className="text-[11px]">{cap}</span>}
      </span>
    );
  }
  if (r.status === "on") return <span className="text-xs text-primary" title={against}>on your roster · {r.on.join(", ")}</span>;
  return (
    <span className="text-xs text-muted-foreground" title={against}>
      {r.short ? <>your {r.short.name} is {signed(-r.short.delta)} better</> : "doesn't start"}
    </span>
  );
}

function Rank({ r }: { r: FitRow }) {
  const top = r.rank <= Math.max(3, Math.ceil(r.of * 0.05));
  return (
    <span className={cn(num, top ? "text-positive" : r.rank <= Math.ceil(r.of * 0.2) ? "" : "text-muted-foreground")} title={`${r.rank} of the ${r.of} legal cards at ${r.spot} here (both hands, glove included)`}>
      {r.rank}<span className="text-muted-foreground"> / {r.of}</span>
    </span>
  );
}

function Price({ c }: { c: FitCard }) {
  const owned = c.owned.variant ? "yours (variant)" : c.owned.base ? "yours" : null;
  if (owned) return <span className="text-xs text-primary">{owned}</span>;
  if (c.ask == null) return <span className="text-xs text-muted-foreground">{c.last10 != null ? `L10 ${pp(c.last10)}` : "not listed"}</span>;
  return <span className={num} title={`Ask ${c.ask.toLocaleString("en-US")} · last 10 ${c.last10?.toLocaleString("en-US") ?? "none"}`}>{pp(c.ask)}</span>;
}

/* ------------------------------------------------------------------ */
/* One card across every current event                                 */
/* ------------------------------------------------------------------ */

export function CardFitTable({ data, cardId }: { data: CardFitData; cardId: number }) {
  const entry = data.cards.find((c) => c.card.id === cardId);
  const events = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);
  const [tier, setTier] = useState<string>("All");
  const [onlyStarts, setOnlyStarts] = useState(false);
  if (!entry) return null;
  const { card, rows } = entry;
  const tiers = EVENT_TIERS.filter((t) => rows.some((r) => events.get(r.eventId)?.tier === t));
  const shown = rows.filter((r) => (tier === "All" || events.get(r.eventId)?.tier === tier) && (!onlyStarts || r.status !== "bench"));
  const starts = rows.filter((r) => r.status === "start");
  const on = rows.filter((r) => r.status === "on");
  const form = rows.some((r) => r.variant) ? " (your variant)" : "";

  const cols: Column<FitRow>[] = [
    {
      key: "event", header: "Event", priority: 1,
      render: (r) => {
        const e = events.get(r.eventId)!;
        return (
          <span className="flex min-w-0 flex-col">
            <Link href={`/build?t=${e.id}`} prefetch={false} className="font-medium hover:underline" onClick={(ev) => ev.stopPropagation()}>{e.name}</Link>
            <span className="text-[11px] text-muted-foreground">{[e.env, e.window, ...e.rules].join(" · ")}</span>
          </span>
        );
      },
      sortValue: (r) => events.get(r.eventId)?.name ?? "",
    },
    {
      key: "spot", header: "Spot", priority: 2,
      tip: "Where it goes: the spot of its biggest gain, else where it plays now, else where it ranks best.",
      render: (r) => <span className="font-medium">{r.spot}{r.variant && <span className="ml-1 rounded bg-accent px-1 text-[10px] font-semibold">V</span>}</span>,
    },
    {
      key: "team", header: "Your team", priority: 1,
      tip: "What it does to your roster there: the runs one swap adds and whom it replaces (a lineup spot weighted by the field's share of each hand, a starter in full, a reliever at 0.31), or the card of yours it falls short of. Against your newest saved roster for the event, else the best team your legal cards make.",
      render: (r) => <TeamCell r={r} e={events.get(r.eventId)!} />,
      sortValue: (r) => (r.status === "start" ? r.gain : r.status === "on" ? 0 : -(r.short?.delta ? -r.short.delta : 99)),
    },
    {
      key: "rank", header: "Rank", align: "right", priority: 1,
      tip: "Among every legal card at the spot here, base cards only (both hands, glove included). cwhit's rank, in this event's own environment.",
      render: (r) => <Rank r={r} />, sortValue: (r) => -(r.rank - 1) / r.of,
    },
    { key: "vr", header: "vs RHP", align: "right", priority: 2, tip: "Runs per 700 PA against right-handed pitching (runs saved per 700 BF for an arm), in this event's run environment and park, play blended in.", render: (r) => <Signed v={r.runsR} />, sortValue: (r) => r.runsR },
    { key: "vl", header: "vs LHP", align: "right", priority: 3, tip: "Runs per 700 PA against left-handed pitching.", render: (r) => <Signed v={r.runsL} />, sortValue: (r) => r.runsL },
    {
      key: "played", header: "Played here", align: "right", priority: 3,
      tip: "The card's own line in this event's series: PA (BF for an arm), and runs per 700 above that field.",
      render: (r) => r.played ? <span className="text-xs"><span className={num}>{r.played.n.toLocaleString("en-US")}</span> <Signed v={r.played.vsField} colour /></span> : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (r) => r.played?.n ?? null,
    },
  ];

  return (
    <Section
      id="fit"
      title="Where it fits"
      summary={`${card.name}${form}: legal in ${rows.length} current events, starts for you in ${starts.length}${on.length ? `, already on ${on.length}` : ""}.`}
      help={<>
        <p>Every current event the card is legal in, scored as Build scores it: that event&rsquo;s run environment and park, the field&rsquo;s hands, tournament play blended in, the glove at the spot. Your team is your newest saved roster for the event, or the best team your legal cards make where none is saved.</p>
        <p>Runs are one swap into your roster: the first move Build&rsquo;s Optimise would weigh. A cap or slot rule can make the whole roster reshuffle, so open the event in Build (the event name) and press Optimise before you save.</p>
        <p>{`Ownership: the ${data.collectionDate ? date(data.collectionDate) : "newest"} collection. Prices: the ${data.shopDate ? date(data.shopDate) : "newest"} shop list.`}</p>
      </>}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented aria-label="Event tier" options={["All", ...tiers].map((t) => ({ value: t, label: t }))} value={tier} onChange={setTier} />
        <Segmented
          aria-label="Rows"
          options={[{ value: "all", label: "All events" }, { value: "starts", label: "Starts or on", title: "Only the events where it starts for you or already plays" }]}
          value={onlyStarts ? "starts" : "all"}
          onChange={(v) => setOnlyStarts(v === "starts")}
        />
      </div>
      <DataTable
        columns={cols}
        rows={shown}
        rowKey={(r) => r.eventId}
        rowClassName={(r) => (r.status === "start" ? STARTS_TINT : undefined)}
        empty={<p className="p-4 text-sm text-muted-foreground">{rows.length ? "No event matches the filter." : "Not legal in any current event."}</p>}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* The new cards                                                       */
/* ------------------------------------------------------------------ */

interface NewRow { card: FitCard; rows: FitRow[]; starts: FitRow[]; on: number; best: number; pulled: boolean }

export function NewCardsBoard({ data, pulled }: { data: CardFitData; pulled: number[] }) {
  const router = useRouter();
  const events = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);
  const [tier, setTier] = useState<string>("All");
  const mine = new Set(pulled);
  const all: NewRow[] = data.cards.map(({ card, rows }) => {
    const starts = rows.filter((r) => r.status === "start");
    return { card, rows, starts, on: rows.filter((r) => r.status === "on").length, best: starts[0]?.gain ?? 0, pulled: mine.has(card.id) };
  }).sort((a, b) => b.best - a.best || b.starts.length - a.starts.length);
  const tiers = CARD_TIERS.filter((t) => all.some((x) => cardTier(x.card) === t));
  const pick = (xs: NewRow[]) => xs.filter((x) => tier === "All" || cardTier(x.card) === tier);

  const cols: Column<NewRow>[] = [
    {
      key: "card", header: "Card", priority: 1,
      render: (x) => (
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <CardName id={x.card.id} name={x.card.name} val={x.card.val} tier={x.card.tier} year={x.card.year} set={x.card.set} owned={x.card.owned.base || x.card.owned.variant} variant={x.card.owned.variant} />
          {x.card.le && <span className="rounded bg-accent px-1 text-[10px] font-semibold" title="Limited edition">LE</span>}
        </span>
      ),
      sortValue: (x) => x.card.name,
    },
    { key: "pos", header: "Pos", priority: 2, render: (x) => <span className="font-medium">{x.card.role ?? x.card.pos}</span> },
    {
      key: "starts", header: "Starts", align: "right", priority: 1,
      tip: "Current events where it would start for you (one swap into your roster adds runs), of the events it is legal in.",
      render: (x) => <span className={num}><span className={x.starts.length ? "text-positive" : "text-muted-foreground"}>{x.starts.length}</span><span className="text-muted-foreground"> / {x.rows.length}</span></span>,
      sortValue: (x) => x.starts.length,
    },
    {
      key: "where", header: "Where it goes", priority: 1,
      tip: "The events where it adds the most, with the runs added and the spot. Tap the row for every event.",
      render: (x) => x.starts.length ? (
        <span className="flex flex-wrap gap-1">
          {x.starts.slice(0, 3).map((r) => (
            <span key={r.eventId} className="rounded bg-positive/10 px-1.5 py-0.5 text-[11px]" title={r.swaps.map(swapText).join(" · ")}>
              {events.get(r.eventId)?.name.replace(/^Daily /, "")} <span className="font-semibold text-positive">{signed(r.gain)}</span> <span className="text-muted-foreground">{r.spot}</span>
            </span>
          ))}
          {x.starts.length > 3 && <span className="text-[11px] text-muted-foreground">+{x.starts.length - 3} more</span>}
        </span>
      ) : <span className="text-xs text-muted-foreground">{x.on ? `already on ${x.on} roster${x.on === 1 ? "" : "s"}` : x.rows.length ? "doesn't start anywhere" : "not legal in any current event"}</span>,
      sortValue: (x) => x.best,
    },
    { key: "price", header: "Price", align: "right", priority: 2, tip: "The lowest ask on the newest shop list; yours if you own it.", render: (x) => <Price c={x.card} />, sortValue: (x) => x.card.ask ?? x.card.last10 ?? null },
    { key: "seen", header: "Listed", align: "right", priority: 3, tip: "When a shop list first had the card.", render: (x) => <span className="text-xs text-muted-foreground">{date(x.card.firstSeen)}</span>, sortValue: (x) => x.card.firstSeen },
  ];

  const open = (x: NewRow) => router.push(`/cards?id=${x.card.id}`);
  const yours = pick(all.filter((x) => x.pulled)), shop = pick(all.filter((x) => !x.pulled));
  return (
    <div className="flex flex-col gap-4">
      {tiers.length > 1 && <Segmented aria-label="Card tier" size="md" options={["All", ...tiers].map((t) => ({ value: t, label: t }))} value={tier} onChange={setTier} />}
      {all.some((x) => x.pulled) && (
        <Section id="new-yours" title="New to your collection" summary="Cards and variants you got since the collection before.">
          <DataTable columns={cols} rows={yours} rowKey={(x) => x.card.id} onRowClick={open} rowClassName={(x) => (x.starts.length ? STARTS_TINT : undefined)} empty={<p className="p-4 text-sm text-muted-foreground">None in this tier.</p>} />
        </Section>
      )}
      <Section
        id="new-shop"
        title="New in the shop"
        summary="The latest release: where each card would start for you."
        help={<p>Cards a shop list first listed within a week of the newest one. Each is placed in every current event it is legal in, against your roster there. Tap a card for the full table.</p>}
      >
        <DataTable columns={cols} rows={shop} rowKey={(x) => x.card.id} onRowClick={open} rowClassName={(x) => (x.starts.length ? STARTS_TINT : undefined)} empty={<p className="p-4 text-sm text-muted-foreground">None in this tier.</p>} />
      </Section>
    </div>
  );
}
