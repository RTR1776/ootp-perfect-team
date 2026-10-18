"use client";

/**
 * The new cards as tiles (/cards/highlights; lib/card-highlights): a
 * spotlight on the biggest gain, then what L.J. just got, then the game's
 * new cards by the day they dropped. Each tile is the card's art, value and
 * tier, where it starts for him (the best three events with the runs it adds
 * and the spot) or plainly why it doesn't, and a meter of its best gain
 * against the spotlight's. Every tile opens the card's full Card Fit on
 * /cards.
 *
 * The server hands over the highlights already computed (one small object
 * per card); the tier filter only re-arranges them.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleDot, Gift, Sparkles } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { TierBadge } from "@/components/tier-badge";
import { cardHref } from "@/components/card-name";
import { cardArtUrl } from "@/lib/card-art";
import { CARD_TYPE_NAME, CARD_TYPE_SHORT } from "@/lib/card-sets";
import {
  alsoOn, arrange, meter, priceOf, standing, TILE_EVENTS, worthOf,
  type DayDrop, type Highlight, type TierFilter, type TopSpot,
} from "@/lib/card-highlights";
import { ago, date, pp, signed } from "@/lib/format";
import { TIER_COLORS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const num = "font-mono tabular-nums";
/** `color` at `pct`% strength over transparent: the tier accents (tier-badge does the same). */
const mix = (color: string, pct: number) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;
const tierColor = (h: Highlight) => (h.tier ? TIER_COLORS[h.tier] : "var(--muted-foreground)");

/** "SP · throws L · 2006 · HH": the spot, the hand, the year and the set. */
function metaLine(h: Highlight) {
  const c = h.card;
  const hand = c.hand ? (c.role ? `throws ${c.hand}` : `bats ${c.hand}`) : null;
  return [c.role ?? c.pos, hand, c.year, c.set != null ? CARD_TYPE_SHORT[c.set] ?? null : null].filter((x) => x != null).join(" · ");
}

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** The card's art over a baseball mark, so a card with no art on file still has a face. */
function Art({ id, color, className }: { id: number; color: string; className?: string }) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  // Art that failed before hydration never fires onError: a finished image with no pixels is a miss.
  useEffect(() => { const img = ref.current; if (img?.complete && img.naturalWidth === 0) setOk(false); }, []);
  return (
    <div aria-hidden className={cn("relative aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-muted", className)} style={{ boxShadow: `0 0 0 1px ${mix(color, 55)}, 0 4px 14px ${mix(color, 18)}` }}>
      <CircleDot className="absolute inset-0 m-auto size-6 text-muted-foreground/30" />
      {ok && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={ref} src={cardArtUrl(id)} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

function Chip({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide", className)}>{children}</span>;
}

function Chips({ h }: { h: Highlight }) {
  return (
    <>
      {h.newVariant && <Chip className="bg-primary/15 text-primary ring-1 ring-primary/30" title="A variant: new to your collection">VAR</Chip>}
      {h.card.le && <Chip className="bg-accent text-accent-foreground" title="Limited edition">LE</Chip>}
    </>
  );
}

/** The best gain as a bar against the spotlight's. */
function Meter({ h, max, color }: { h: Highlight; max: number; color: string }) {
  const fill = meter(h.best, max);
  return (
    <div className="flex items-center gap-2" title={max > 0 ? `Its biggest gain in one event, against the biggest among these new cards (${signed(max)})` : undefined}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.round(fill * 100)}%`, background: `linear-gradient(90deg, ${mix(color, 55)}, ${color})` }} />
      </div>
      <span className={cn(num, "text-xs font-semibold", h.best > 0 ? "text-positive" : "text-muted-foreground")} title={h.best > 0 || !h.starts ? undefined : "It starts only in cap or slots events, where one swap may not survive the reshuffle"}>{h.best > 0 ? signed(h.best) : h.starts ? "cap/slots" : "—"}</span>
    </div>
  );
}

/** One event where it starts: the event, the spot (V for his variant), the runs it adds. */
function Spot({ s, rank = false }: { s: TopSpot; rank?: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-2">
      <span className="truncate" title={s.event}>{s.event}</span>
      <span className="text-muted-foreground">
        {s.spot}{s.variant && <span className="ml-1 rounded bg-primary/15 px-0.5 text-[9px] font-semibold text-primary" title="Your variant plays here">V</span>}
        {rank && <span className="ml-1.5 text-[11px]" title={`${s.rank} of the ${s.of} legal cards at ${s.spot} there`}>#{s.rank}/{s.of}</span>}
        {s.rule && <span className="ml-1 rounded bg-muted px-0.5 text-[9px] font-semibold uppercase" title={`One swap into your saved roster. This event's ${s.rule === "cap" ? "value cap" : "tier slots"} can make the whole roster reshuffle, so check it in Build before counting on it.`}>{s.rule}</span>}
      </span>
      <span className={cn(num, "font-semibold", s.rule ? "text-positive/60" : "text-positive")}>{signed(s.gain)}</span>
    </li>
  );
}

function Where({ h, n }: { h: Highlight; n: number }) {
  const also = alsoOn(h);
  return (
    <div className="text-xs">
      <div className={cn("font-medium", h.starts ? "text-foreground" : "text-muted-foreground")}>
        {standing(h)}{also && <span className="font-normal text-muted-foreground"> · {also}</span>}
      </div>
      {h.top.length > 0 && <ul className="mt-1 space-y-0.5">{h.top.slice(0, n).map((s) => <Spot key={s.eventId} s={s} />)}</ul>}
      {h.starts > n && <div className="mt-0.5 text-[11px] text-muted-foreground">+{h.starts - n} more</div>}
    </div>
  );
}

/** The tile's last line: the price for a shop card; for his, what's new and what it sells for. */
function Footer({ h }: { h: Highlight }) {
  if (h.mine) {
    const worth = worthOf(h.card, h.newVariant);
    return (
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-primary">{h.newVariant ? "New variant" : "New card"}</span>
        {worth != null && <span title="The last 10 sales' average">sells ~<span className={num}>{pp(worth)}</span></span>}
      </div>
    );
  }
  const p = priceOf(h.card);
  const last10 = h.card.last10;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      {p.kind === "yours"
        ? <span className="font-medium text-primary">{p.text}</span>
        : <span>{p.kind === "ask" && last10 != null ? <>last 10 <span className={num}>{pp(last10)}</span></> : null}</span>}
      {p.kind === "yours"
        ? last10 != null && <span title="The last 10 sales' average">sells ~<span className={num}>{pp(last10)}</span></span>
        : (
          <span title={p.title} className={p.kind === "ask" ? cn(num, "text-xs font-semibold text-foreground") : ""}>
            {p.kind === "ask" ? <><span className="font-sans text-[11px] font-normal text-muted-foreground">ask </span>{p.text}</> : p.text}
          </span>
        )}
    </div>
  );
}

function Tile({ h, max }: { h: Highlight; max: number }) {
  const color = tierColor(h);
  return (
    <Link
      href={cardHref(h.card.id)}
      prefetch={false}
      className="group relative flex gap-3 overflow-hidden rounded-xl border bg-card p-3 pt-4 text-card-foreground shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: mix(color, 35), backgroundImage: `linear-gradient(160deg, ${mix(color, 11)}, transparent 55%)` }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, ${mix(color, 35)})` }} />
      <Art id={h.card.id} color={color} className="w-16 self-start sm:w-[4.5rem]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold leading-tight group-hover:underline">{h.card.name}</span>
              <Chips h={h} />
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={h.card.set != null ? CARD_TYPE_NAME[h.card.set] : undefined}>{metaLine(h)}</div>
          </div>
          <span className="stat-value shrink-0 text-2xl leading-none" style={{ color }} title={`${h.tier ?? "Value"} ${h.card.val}`}>{h.card.val}</span>
        </div>
        <Where h={h} n={TILE_EVENTS} />
        <div className="mt-auto space-y-1.5">
          <Meter h={h} max={max} color={color} />
          <Footer h={h} />
        </div>
      </div>
    </Link>
  );
}

function Spotlight({ h, tier }: { h: Highlight; tier: TierFilter }) {
  const color = tierColor(h);
  const p = priceOf(h.card);
  const worth = h.mine ? worthOf(h.card, h.newVariant) : null;
  return (
    <Link
      href={cardHref(h.card.id)}
      prefetch={false}
      className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 overflow-hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-lg sm:gap-x-6 sm:p-6"
      style={{
        borderColor: mix(color, 50),
        backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${mix(color, 20)}, transparent 60%), radial-gradient(80% 60% at 100% 100%, ${mix(color, 8)}, transparent 70%)`,
        boxShadow: `0 0 0 1px ${mix(color, 20)}, 0 10px 40px -12px ${mix(color, 45)}`,
      }}
    >
      <Art id={h.card.id} color={color} className="w-24 sm:row-span-2 sm:w-40" />
      <div className="min-w-0 self-center sm:self-start">
        <div className="label-eyebrow flex items-center gap-1.5" style={{ color }}>
          <Sparkles className="size-3.5" aria-hidden /> Spotlight · biggest gain {tier === "All" ? "of the new cards" : `of the new ${tier} cards`}
        </div>
        <h2 className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-wide group-hover:underline sm:text-4xl">{h.card.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {h.tier && <TierBadge tier={h.tier} />}
          <span className="stat-value text-xl leading-none" style={{ color }}>{h.card.val}</span>
          <span>{metaLine(h)}</span>
          <Chips h={h} />
          <span className={h.mine ? "font-medium text-primary" : ""}>{h.mine ? (h.newVariant ? "· your new variant" : "· yours, new") : `· new ${date(h.card.firstSeen)}`}</span>
        </div>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Best gain" value={<span className="text-positive">{signed(h.best)}</span>} sub={`runs, ${h.top[0]?.event ?? ""}`} />
          <Stat label="Starts" value={<>{h.starts}<span className="text-base text-muted-foreground"> / {h.legal}</span></>} sub={alsoOn(h) ?? "current events"} />
          {h.mine
            ? <Stat label="Sells for" value={worth != null ? pp(worth) : "—"} sub="last 10 average" />
            : p.kind === "yours"
              ? <Stat label="Price" value={<span className="text-primary">yours</span>} sub={h.card.last10 != null ? `sells ~${pp(h.card.last10)}` : undefined} />
              : p.kind === "ask"
                ? <Stat label="Ask" value={p.text} sub={h.card.last10 != null ? `last 10 ${pp(h.card.last10)}` : "no sales on file"} />
                : p.kind === "last10"
                  ? <Stat label="Last 10" value={pp(h.card.last10)} sub="no ask listed" />
                  : <Stat label="Price" value="—" sub="not listed" />}
        </div>
        <ul className="mt-3 space-y-1 text-sm">{h.top.map((s) => <Spot key={s.eventId} s={s} rank />)}</ul>
        {h.starts > h.top.length && <div className="mt-1 text-xs text-muted-foreground">+{h.starts - h.top.length} more events · tap for all</div>}
      </div>
    </Link>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/60 px-2.5 py-2 sm:px-3">
      <div className="label-eyebrow">{label}</div>
      <div className="stat-value text-2xl leading-tight sm:text-3xl">{value}</div>
      {sub && <div className="truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}

function Grid({ cards, max }: { cards: Highlight[]; max: number }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((h) => <Tile key={h.card.id} h={h} max={max} />)}</div>;
}

function Heading({ icon: Icon, title, summary }: { icon: typeof Gift; title: string; summary: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase leading-none tracking-wide">
        <Icon className="size-5 text-primary" aria-hidden />{title}
      </h2>
      <p className="text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}

function Day({ d, max }: { d: DayDrop; max: number }) {
  const when = ago(d.day);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold uppercase tracking-wide">{weekday(d.day)} {date(d.day)}</span>
          {when === "today" && <span className="rounded bg-primary/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">today</span>}
        </div>
        <span className="text-xs text-muted-foreground">{d.cards.length} card{d.cards.length === 1 ? "" : "s"}{d.cards.length ? ` · ${d.starting} start${d.starting === 1 ? "s" : ""} for you` : ""}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <Grid cards={d.cards} max={max} />
    </div>
  );
}

export function CardHighlights({ highlights, events, collectionDate, shopDate, hasPulled }: {
  highlights: Highlight[];
  /** Current events the cards were placed in. */
  events: number;
  collectionDate: string | null;
  shopDate: string | null;
  /** Whether his collection had anything new at all (before the filter). */
  hasPulled: boolean;
}) {
  const [tier, setTier] = useState<TierFilter>("All");
  const all = useMemo(() => arrange(highlights), [highlights]);
  const view = useMemo(() => (tier === "All" ? all : arrange(highlights, tier)), [all, highlights, tier]);
  const shopCount = view.shop.reduce((n, d) => n + d.cards.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className={cn(num, "font-semibold text-foreground")}>{view.shown}</span> new card{view.shown === 1 ? "" : "s"}
          {" · "}<span className={cn(num, "font-semibold text-positive")}>{view.starting}</span> start somewhere for you
          {" · "}placed in {events} current events
        </p>
        {all.tiers.length > 1 && (
          <Segmented
            aria-label="Card tier"
            size="md"
            className="flex-wrap"
            options={[
              { value: "All" as TierFilter, label: <>All <span className={cn(num, "text-[11px] opacity-60")}>{highlights.length}</span></> },
              ...all.tiers.map(({ tier: t, n }) => ({
                value: t as TierFilter,
                label: <span className="inline-flex items-center gap-1"><span aria-hidden className="size-2 rounded-full" style={{ background: TIER_COLORS[t] }} />{t} <span className={cn(num, "text-[11px] opacity-60")}>{n}</span></span>,
              })),
            ]}
            value={tier}
            onChange={setTier}
          />
        )}
      </div>

      {view.spotlight
        ? <Spotlight h={view.spotlight} tier={tier} />
        : view.shown > 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">None of these starts anywhere for you yet, so no spotlight.</p>}

      <section className="space-y-3" aria-labelledby="hl-yours">
        <Heading icon={Gift} title="You just got" summary={<span id="hl-yours">Cards and variants new to your collection{collectionDate ? ` (collection of ${date(collectionDate)})` : ""}, strongest first.</span>} />
        {view.yours.length
          ? <Grid cards={view.yours} max={view.max} />
          : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{hasPulled ? "None in this tier." : "Nothing new in your collection since the one before. Upload your collection after you open packs and they show up here."}</p>}
      </section>

      <section className="space-y-4" aria-labelledby="hl-shop">
        <Heading icon={CalendarDays} title="New in the game" summary={<span id="hl-shop">The newest week of shop lists, by the day each card first appeared{shopDate ? ` (prices from ${date(shopDate)})` : ""}.</span>} />
        {shopCount
          ? view.shop.map((d) => <Day key={d.day} d={d} max={view.max} />)
          : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">None in this tier.</p>}
      </section>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">How this works</summary>
        <div className="mt-1.5 max-w-3xl space-y-1.5">
          <p>Each card is placed in every current event it is legal in, exactly as the New table on Look up places it (Card Fit): that event&rsquo;s run environment and park, the field&rsquo;s hands, tournament play blended in. &ldquo;Starts&rdquo; means one swap into your newest saved roster there (or the best team your legal cards make, where none is saved) adds runs; the runs shown are that swap&rsquo;s.</p>
          <p>The bar is the card&rsquo;s biggest gain in one event, against the spotlight&rsquo;s. A cap or slot rule can make Build reshuffle more than one card, so open the event in Build and Optimise before you save. Tap any card for its full table.</p>
        </div>
      </details>
    </div>
  );
}
