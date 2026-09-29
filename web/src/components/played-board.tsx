"use client";

/**
 * The Played board: every card with tournament play, ranked by what it did,
 * with the filters a draft needs - value window (round rules), position,
 * hand, year, sets, owned - and a search box. All client-side over the lines
 * the page computed; with an event picked, the page sends only the cards
 * legal there (UI plan D4).
 *
 * The filters live in the URL, written as they change (history.replaceState:
 * they change nothing on the server, and router.replace would refetch the
 * whole board on every keystroke). The board starts from the URL it opens on,
 * so a reload, or Back from a card, keeps them. Picking an event is a real
 * navigation: the server works out who is legal, and the board comes back
 * with the same filters and that event's sets.
 */

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { CardName } from "@/components/card-name";
import { EventPicker, NO_EVENT_ID, type PickerGroup } from "@/components/event-picker";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { RulesStrip } from "@/components/rules-strip";
import { Section } from "@/components/section";
import { SetFilter } from "@/components/set-filter";
import { DataTable, type Column, type Sort } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import { date, rate3, signed } from "@/lib/format";
import {
  activeFilters, clearChip, clearFilters, countLine, countOfKind, describeFilters, filterLines, filtersFromParams, filtersToParams,
  HIT_POS, KINDS, kindOf, posFloor, ratedAt, withKind, WINDOWS, type Kind, type PlayedFilters,
} from "@/lib/played-filters";
import { describePosFloor, LJ_FLOOR } from "@/lib/pos-floor";
import type { RuleItem } from "@/lib/roster-rules";
import { cn } from "@/lib/utils";

export interface PlayedLine {
  cardId: number; name: string; val: number | null; tier: string | null; pos: string; role: string | null;
  isPitcher: boolean; bats: string | null; throws: string | null; year: number | null; owned: boolean;
  /** Card set (cards.card_type): the Sets filter and the tag after the year. */
  cardType: number | null;
  /** A Limited Edition card, for a "No LE" event's rules. */
  le?: boolean;
  /** Model runs per 700 PA (PT default engine, neutral park). */
  model: number;
  /** Observed runs per 700 on the model's scale; null with no play. */
  obs: number | null;
  /** PA (bats) or batters faced (arms) behind `obs`. */
  n: number;
  pa: number; ip: number; series: number; instances: number;
  /** The ranking figure: model and observed blended by precision. */
  blend: number;
  woba: number | null; fip: number | null;
  stamina: number | null;
  defPos: Record<string, number> | null;
}

/** The event the board is scoped to: its rules line and its set rule. */
export interface PlayedEvent {
  id: number;
  name: string;
  rules: RuleItem[];
  /** The event's card-set rule as codes; null when it has none (or it can't be read). */
  sets: number[] | null;
}

const PAGE = 150;
/** Columns whose first click sorts low to high. */
const ASC_FIRST = new Set(["card", "fip"]);
const OWNED_TINT = "[--row-tint:color-mix(in_oklch,var(--primary)_7%,transparent)]";
const chip = (on: boolean) => cn(
  "rounded-md border px-2 py-0.5 font-mono text-xs",
  on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
);

/** A small number box: digits only, labelled for screen readers. */
function NumField({ value, onChange, label, placeholder, className }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string;
}) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={cn("w-14 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs", className)}
    />
  );
}

export function PlayedBoard({ lines, k, collectionDate, groups, event, eventParam, missingEvent }: {
  lines: PlayedLine[];
  /** The blend's K (PA/BF at which play and model weigh the same). */
  k: number;
  collectionDate: string | null;
  groups: PickerGroup[];
  event: PlayedEvent | null;
  /** The URL's event: an id, 0 for "PT default (no event)", or null when absent. */
  eventParam: number | null;
  /** An event id in the URL that isn't in the catalogue. */
  missingEvent: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const eventSets = event?.sets ?? null;
  // The URL as it stands, not as the server first rendered it: Back from a
  // card restores this page's first payload, but the URL has the filters.
  const [f, setF] = useState<PlayedFilters>(() => filtersFromParams((key) => params.get(key), eventSets));
  const [sort, setSort] = useState<Sort>({ key: "blend", desc: true });
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<number | null>(null);
  const [navigating, startNav] = useTransition();
  // A link to /played while the board is filtered (the sidebar's Played)
  // changes the URL but not the key the page was rendered under, so the board
  // would keep its filters under a bare URL and lose them on reload. Read the
  // filters again from any query the board did not write itself.
  const query = params.toString();
  const [seen, setSeen] = useState(query); // the query last reacted to
  const [own, setOwn] = useState(query); // the query the board last wrote, or opened on
  if (query !== seen) {
    setSeen(query);
    if (query !== own) {
      setOwn(query);
      setF(filtersFromParams((key) => params.get(key), eventSets));
      setLimit(PAGE);
    }
  }

  /** Every filter change: the board, the page length, and the URL (so a reload or Back keeps it). */
  const apply = (next: PlayedFilters) => {
    setF(next);
    setLimit(PAGE);
    const out = new URLSearchParams();
    if (eventParam != null) out.set("event", String(eventParam));
    for (const [key, v] of filtersToParams(next, eventSets)) out.set(key, v);
    const qs = out.toString();
    setOwn(qs);
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
  };
  const set = (patch: Partial<PlayedFilters>) => apply({ ...f, ...patch });
  const setKind = (kind: Kind) => { apply(withKind(f, kind)); setSort({ key: "blend", desc: true }); };
  const clearAll = () => apply(clearFilters(f, eventSets));

  const pickEvent = (id: number | null) => {
    const next = id ?? NO_EVENT_ID;
    if (next === (event?.id ?? NO_EVENT_ID) && missingEvent == null) return;
    setPicked(next);
    // Keep the filters; the sets start from the new event's rule.
    const out = new URLSearchParams({ event: String(next) });
    for (const [key, v] of filtersToParams({ ...f, sets: [] })) if (key !== "sets") out.set(key, v);
    startNav(() => router.push(`${pathname}?${out}`));
  };

  const hit = f.kind === "hit";
  const ofKind = useMemo(() => countOfKind(lines, f.kind), [lines, f.kind]);
  const rows = useMemo(() => filterLines(lines, f), [lines, f]);
  const setCounts = useMemo(() => {
    const n: Record<number, number> = {};
    for (const l of lines) if (l.cardType != null && kindOf(l) === f.kind) n[l.cardType] = (n[l.cardType] ?? 0) + 1;
    return n;
  }, [lines, f.kind]);
  const chips = activeFilters(f, eventSets).map((c) => ({ key: c.key, label: c.label, clear: () => apply(clearChip(f, c.key, eventSets)) }));
  const eventId = event?.id ?? null;

  const columns = useMemo((): Column<PlayedLine>[] => {
    const cols: Column<PlayedLine>[] = [
      {
        key: "card", header: "Card", priority: 1, sortValue: (r) => r.name, text: (r) => r.name,
        // Takes the width the numbers leave, never less than 9rem; the name truncates.
        className: "w-full max-w-0 min-w-36",
        render: (r, i) => (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground">{i + 1}</span>
            <CardName id={r.cardId} name={r.name} val={r.val} tier={r.tier} year={r.year} set={r.cardType} owned={r.owned} eventId={eventId} />
          </span>
        ),
      },
      {
        key: "blend", header: "Runs", align: "right", priority: 1, sortValue: (r) => r.blend,
        tip: "The ranking: observed play and the model, blended by how much play there is. Runs per 700 PA (or BF, saved) above a league-average card, PT default engine, neutral park.",
        render: (r) => <span className="font-semibold">{signed(r.blend)}</span>,
      },
      { key: "val", header: "Val", align: "right", priority: 1, sortValue: (r) => r.val, render: (r) => r.val ?? "—" },
      { key: "pos", header: "Pos", priority: 1, className: "text-muted-foreground", render: (r) => (r.isPitcher ? r.role ?? r.pos : r.pos) },
      {
        key: "obs", header: "Observed", align: "right", priority: 2, sortValue: (r) => r.obs,
        tip: "What the card did against its fields, on the model's scale. A dash: no play to read.",
        render: (r) => (r.obs == null ? <span className="text-muted-foreground">—</span> : signed(r.obs)),
      },
      {
        key: "model", header: "Model", align: "right", priority: 2, sortValue: (r) => r.model, className: "text-muted-foreground",
        tip: "The rating model alone: PT default engine, neutral park.", render: (r) => signed(r.model),
      },
      {
        key: "n", header: hit ? "PA" : "BF", align: "right", priority: 2, sortValue: (r) => r.n,
        tip: "Plate appearances (batters faced) on record: the weight behind Observed.", render: (r) => r.n.toLocaleString("en-US"),
      },
      hit
        ? { key: "woba", header: "wOBA", align: "right", priority: 2, sortValue: (r) => r.woba, tip: "Pooled across every series the card played, so it mixes eras: context, not the ranking.", render: (r) => (r.woba == null ? "" : rate3(r.woba)) }
        : { key: "fip", header: "FIP", align: "right", priority: 2, sortValue: (r) => r.fip, tip: "Pooled across every series the card played, so it mixes eras: context, not the ranking.", render: (r) => (r.fip == null ? "" : r.fip.toFixed(2)) },
      { key: "year", header: "Year", align: "right", priority: 2, sortValue: (r) => r.year, className: "text-muted-foreground", render: (r) => r.year ?? "" },
      { key: "hand", header: hit ? "B" : "T", priority: 3, className: "text-muted-foreground", tip: hit ? "Bats" : "Throws", render: (r) => (hit ? r.bats : r.throws) ?? "" },
      ...(hit ? [] : [{ key: "stm", header: "STM", align: "right" as const, priority: 3 as const, tip: "Stamina", sortValue: (r: PlayedLine) => r.stamina, className: "text-muted-foreground", render: (r: PlayedLine) => r.stamina ?? "" }]),
      { key: "series", header: "Series", align: "right", priority: 3, sortValue: (r) => r.series, className: "text-muted-foreground", tip: "How many tournament series the card has played in", render: (r) => r.series },
      ...(hit ? [{
        key: "rated", header: "Rated", priority: 3 as const, className: "whitespace-nowrap text-[11px] text-muted-foreground",
        tip: `Positions at or above the glove floor (${describePosFloor(LJ_FLOOR)}), best first`, render: (r: PlayedLine) => ratedAt(r.defPos),
      }] : []),
    ];
    return cols;
  }, [hit, eventId]);

  const described = describeFilters(f, eventSets);
  const noun = KINDS.find(([kk]) => kk === f.kind)?.[1].toLowerCase() ?? "cards";
  const empty = described ? (
    <span>
      {`No cards match: ${described}. `}
      <button type="button" onClick={clearAll} className="text-primary underline">Clear filters</button>
    </span>
  ) : `No ${noun} ${event ? `legal in ${event.name}` : "with play on record"}.`;

  const primary = (
    <>
      <Segmented aria-label="Kind" size="md" options={KINDS.map(([value, label]) => ({ value, label }))} value={f.kind} onChange={setKind} />
      <label className="relative">
        <span className="sr-only">Search a card</span>
        <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search a card…"
          className="h-8 w-40 rounded-md border border-border bg-background pl-7 pr-2 text-sm sm:w-48"
        />
      </label>
    </>
  );

  const secondary = (
    <>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Value window">
        {WINDOWS.map(([label], i) => {
          const on = f.win === i && !f.lo && !f.hi;
          return <button key={label} type="button" aria-pressed={on} onClick={() => set({ win: i, lo: "", hi: "" })} className={chip(on)}>{label}</button>;
        })}
        <NumField label="Lowest card value" placeholder="min" value={f.lo} onChange={(lo) => set({ lo })} />
        <NumField label="Highest card value" placeholder="max" value={f.hi} onChange={(hi) => set({ hi })} />
      </div>
      {hit && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Position">
          {["all", ...HIT_POS, "DH"].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={f.pos === p}
              onClick={() => set({ pos: p })}
              title={p === "all" ? undefined : p === "DH" ? "Any bat can DH" : p === "1B" ? "Rated at 1B (no glove floor there)" : `Rated ${p} ${posFloor(p)} or better`}
              className={chip(f.pos === p)}
            >
              {p === "all" ? "Any pos" : p}
            </button>
          ))}
        </div>
      )}
      <Segmented
        aria-label={hit ? "Bats" : "Throws"}
        className="w-fit"
        options={[
          { value: "all", label: hit ? "Any bat" : "Any arm" },
          { value: "L", label: "L", title: hit ? "Bats left, switch hitters included" : "Throws left" },
          { value: "R", label: "R", title: hit ? "Bats right, switch hitters included" : "Throws right" },
          ...(hit ? [{ value: "S", label: "S", title: "Switch hitters" }] : []),
        ]}
        value={f.hand}
        onChange={(hand) => set({ hand })}
      />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Years</span>
        <NumField label="From year" placeholder="from" value={f.y1} onChange={(y1) => set({ y1 })} className="w-16" />
        <span aria-hidden className="text-muted-foreground">–</span>
        <NumField label="To year" placeholder="to" value={f.y2} onChange={(y2) => set({ y2 })} className="w-16" />
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{`Min ${hit ? "PA" : "BF"}`}</span>
        <NumField label={`Minimum ${hit ? "plate appearances" : "batters faced"}`} value={f.min} onChange={(min) => set({ min })} className="w-16" />
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={f.own} onChange={(e) => set({ own: e.target.checked })} />
        Owned only
      </label>
      <SetFilter value={f.sets} onChange={(sets) => set({ sets })} allowed={eventSets} counts={setCounts} countLabel="on this board" />
    </>
  );

  const help = (
    <>
      <p>{`Runs is what the card did against its fields, put on the model's scale and blended with the model by how much play it has: at ${k.toLocaleString("en-US")} PA (or BF) the two weigh the same, and a card with ${(k * 2).toLocaleString("en-US")} on record is two-thirds observed. Jim-beater teams are left out.`}</p>
      <p>Runs, Observed and Model are read at the PT default engine and a neutral park, whatever the event: a draft&rsquo;s environment is announced late or random, and the default is the centre of what runs. wOBA and FIP are pooled across every era the card played, so they are context, not the ranking.</p>
      <p>{`A position means rated there at or above your glove floor (${describePosFloor(LJ_FLOOR)}). DH is every bat.`}</p>
      {collectionDate && <p>{`Owned cards (the dot, and the tinted rows) are from the ${date(collectionDate)} collection.`}</p>}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Played" description="Who has actually produced, by value window and position." />

      <div className="flex flex-col gap-1.5">
        <EventPicker
          groups={groups}
          value={picked ?? event?.id ?? NO_EVENT_ID}
          onPick={pickEvent}
          allowNone
          disabled={navigating}
          disabledTitle="Loading the event…"
        />
        {event && (
          <>
            <RulesStrip items={event.rules} compact />
            <p className="text-xs text-muted-foreground">Runs stay at the PT default, neutral park; the event sets who is legal.</p>
          </>
        )}
        {missingEvent != null && <p className="text-xs text-warning">{`Event ${missingEvent} is not in the catalogue, so every card is shown.`}</p>}
      </div>

      {/* While the next event loads, the old board dims and takes no input: it is about to be replaced. */}
      <div aria-busy={navigating} inert={navigating} className={cn("transition-opacity", navigating && "opacity-50")}>
        <Section
          id="board"
          title={`Ranked by ${sort.key === "card" ? "name" : columns.find((c) => c.key === sort.key)?.header ?? "Runs"}`}
          summary={countLine(rows.length, ofKind, f.kind, event?.name)}
          help={help}
        >
          <div className="flex flex-col gap-3">
            <FilterBar primary={primary} active={chips} onClearAll={clearAll}>{secondary}</FilterBar>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.cardId}
              sort={sort}
              onSort={(next) => setSort(next.key === sort.key ? next : { key: next.key, desc: !ASC_FIRST.has(next.key) })}
              rowClassName={(r) => (r.owned ? OWNED_TINT : undefined)}
              limit={limit}
              empty={empty}
            />
            {rows.length > limit && (
              <button type="button" className="self-start text-xs text-primary hover:underline" onClick={() => setLimit((l) => l + PAGE)}>
                {`Show ${Math.min(PAGE, rows.length - limit)} more`}
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
