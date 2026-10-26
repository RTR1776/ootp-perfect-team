"use client";

/**
 * The live draft helper: rounds left on the left, this pick in the middle,
 * the team on the right. Built to be used with the game's clock running:
 * - type a few letters of each card in the pack and Enter (the list only
 *   offers this round's pool), or find them on the board below;
 * - the top row is the pick; Enter on an empty box takes it, Undo takes it back;
 * - the first card typed sets the round when none is chosen.
 * Picks, the open pack and the settings are kept per event in this browser,
 * so a reload mid-draft loses nothing. The engine runs in a worker
 * (lib/draft/draft.worker.ts): the page never waits on it to take a key.
 */
import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cardIndex, matchCards } from "@/lib/card-search";
import { draftView, makeEngine, type DraftCard, type DraftView, type ViewInput } from "@/lib/draft/engine";
import { replay, roundFor, type DraftGroup, type PackKind, type RoundKind } from "@/lib/draft/formats";
import type { DraftPageData } from "@/lib/draft/load";
import { fieldPercentile } from "@/lib/draft/study";
import type { DraftWorkerRequest, DraftWorkerResponse } from "@/lib/draft/draft.worker";
import { TIER_COLORS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

interface Saved {
  /** Card ids, in pick order. */
  picks: number[];
  /** Card ids in the pack on screen. */
  pack: number[];
  /** The round kind chosen by hand (null: the default or the first card typed decides). */
  round: string | null;
  /** In a pick-a-position round, the position whose pack is open. */
  group: DraftGroup | null;
  packSize: number;
  /** Pack kind per round key, over the format's (the 5L's pick-a-position or mixed). */
  kinds: Record<string, PackKind>;
}

const storeKey = (series: string) => `draft-live:v1:${series}`;
const BOARD_ROWS = 25;
const signed = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;
const ordinal = (n: number) => {
  const r = Math.round(n), t = r % 100;
  return `${r}${t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th"}`;
};

function fresh(packSize: number): Saved {
  return { picks: [], pack: [], round: null, group: null, packSize, kinds: {} };
}

/** A draft kept in this browser for one event; it survives a reload mid-draft. */
function useSaved(series: string, packSize: number) {
  const [saved, setSaved] = React.useState<Saved>(() => fresh(packSize));
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let s: Saved = fresh(packSize);
    try {
      const raw = localStorage.getItem(storeKey(series));
      if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<Saved>) };
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from browser storage after mount
    setSaved(s);
    setLoaded(true);
  }, [series, packSize]);
  const update = React.useCallback((f: (s: Saved) => Saved) => {
    setSaved((prev) => {
      const next = f(prev);
      try { localStorage.setItem(storeKey(series), JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [series]);
  return [saved, update, loaded] as const;
}

/**
 * The engine in a worker, one per event; falls back to running on the page
 * if this browser can't start one. Only the newest answer is kept.
 */
function useDraftView(data: DraftPageData, input: ViewInput | null): { view: DraftView | null; busy: boolean; error: string | null } {
  const [state, setState] = React.useState<{ view: DraftView | null; busy: boolean; error: string | null }>({ view: null, busy: false, error: null });
  const worker = React.useRef<Worker | null>(null);
  const latest = React.useRef(0);
  const fallback = React.useMemo(() => ({ engine: null as ReturnType<typeof makeEngine> | null }), []);

  React.useEffect(() => {
    let w: Worker | null = null;
    try {
      w = new Worker(new URL("../../lib/draft/draft.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<DraftWorkerResponse>) => {
        const m = e.data;
        if (m.id !== latest.current) return;
        if (m.type === "view") setState({ view: m.view, busy: false, error: null });
        else setState((s) => ({ ...s, busy: false, error: m.message }));
      };
      w.onerror = (err) => { err.preventDefault(); worker.current = null; };
      w.postMessage({ type: "init", cards: data.cards, ctx: data.ctx } satisfies DraftWorkerRequest);
    } catch { w = null; }
    worker.current = w;
    return () => { w?.terminate(); worker.current = null; };
  }, [data]);

  const key = input ? JSON.stringify(input) : null;
  React.useEffect(() => {
    if (!input) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, busy: true }));
    if (worker.current) {
      worker.current.postMessage({ type: "view", id, input } satisfies DraftWorkerRequest);
      return;
    }
    const t = setTimeout(() => {
      try {
        fallback.engine ??= makeEngine(data.cards, data.ctx);
        const view = draftView(fallback.engine, input, () => performance.now());
        if (id === latest.current) setState({ view, busy: false, error: null });
      } catch (err) {
        if (id === latest.current) setState((s) => ({ ...s, busy: false, error: err instanceof Error ? err.message : String(err) }));
      }
    }, 0);
    return () => clearTimeout(t);
    // The key stands for the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, data, fallback]);
  return state;
}

export function LiveDraft({ events, data }: { events: { series: string; short: string }[]; data: DraftPageData }) {
  const f = data.format;
  const E = React.useMemo(() => makeEngine(data.cards, data.ctx), [data]);
  const [saved, update, loaded] = useSaved(f.series, f.packSize);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);

  const idxOf = React.useCallback((id: number) => E.byId.get(id), [E]);
  const team = React.useMemo(() => saved.picks.map(idxOf).filter((i): i is number => i != null), [saved.picks, idxOf]);
  const pack = React.useMemo(() => saved.pack.map(idxOf).filter((i): i is number => i != null), [saved.pack, idxOf]);
  const { rem, used, unplaced } = React.useMemo(() => replay(f, team.map((i) => E.cards[i])), [f, team, E]);
  const kindOf = React.useCallback((r: RoundKind) => saved.kinds[r.key] ?? r.pack, [saved.kinds]);
  const taken = React.useMemo(() => new Set(team.map((i) => E.cards[i].player ?? E.cards[i].id)), [team, E]);

  // The round on screen: chosen by hand; else the first card in the pack's; else, with three kinds or fewer, the one with most left.
  const round: RoundKind | null = React.useMemo(() => {
    const open = f.rounds.filter((r) => (rem[r.key] ?? 0) > 0);
    const chosen = saved.round ? open.find((r) => r.key === saved.round) : undefined;
    if (chosen) return chosen;
    if (pack.length) return roundFor(f, rem, E.cards[pack[0]]);
    if (open.length === 1 || f.rounds.length <= 3) return [...open].sort((a, b) => (rem[b.key] ?? 0) - (rem[a.key] ?? 0))[0] ?? null;
    return null;
  }, [f, rem, saved.round, pack, E]);
  const choose = round != null && kindOf(round) === "choose";
  const group: DraftGroup | null = choose ? (saved.group ?? (pack.length ? E.cards[pack[0]].group : null)) : null;

  const viewInput: ViewInput | null = loaded ? {
    format: f, team, rem, round: round?.key ?? null, group, pack,
    play: { packSize: saved.packSize, packKinds: saved.kinds }, keep: 60,
  } : null;
  const { view, busy, error } = useDraftView(data, viewInput);
  const current = view && view.round === (round?.key ?? null) ? view : null;

  // The search offers this round's pool (and the open position's), else every legal card; drafted players never.
  const options = React.useMemo(() => {
    const ok = (c: DraftCard) => !taken.has(c.player ?? c.id)
      && (!round || (c.tier === round.tier && round.groups.includes(c.group) && (!group || c.group === group)));
    return E.cards.map((c, i) => ({ ...c, idx: i, label: `${c.name} ${c.val} · ${c.year ?? ""} ${c.group} ${c.tier}` })).filter(ok);
  }, [E, taken, round, group]);
  const index = React.useMemo(() => cardIndex(options), [options]);
  const matches = React.useMemo(() => (query.trim() ? matchCards(index, query, 8) : []), [index, query]);

  // The first card in a pack fixes the round (and, in a pick-a-position round, the position) unless chosen already.
  const addToPack = (idx: number) => {
    const c = E.cards[idx];
    update((s) => {
      const r = (s.round ? f.rounds.find((x) => x.key === s.round) : null) ?? round ?? roundFor(f, rem, c);
      return {
        ...s, pack: s.pack.includes(c.id) ? s.pack : [...s.pack, c.id],
        round: s.round ?? r?.key ?? null,
        group: s.group ?? (r && kindOf(r) === "choose" ? c.group : null),
      };
    });
    setQuery("");
    setActive(0);
  };
  const take = (idx: number) => {
    const c = E.cards[idx];
    update((s) => ({ ...s, picks: [...s.picks, c.id], pack: [], round: null, group: null }));
    setQuery("");
    setActive(0);
    input.current?.focus();
  };
  const top = current?.rows[0];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!matches.length) return;
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) { const m = matches[Math.min(active, matches.length - 1)]; if (m) addToPack(m.idx); }
      else if (pack.length && top && !busy) take(top.idx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery(""); else update((s) => ({ ...s, pack: [], round: null, group: null }));
    } else if (e.key === "Backspace" && !query && pack.length) {
      e.preventDefault();
      update((s) => ({ ...s, pack: s.pack.slice(0, -1) }));
    }
  };

  const pickNo = team.length + 1;
  const done = team.length >= f.cards;
  const pct = current || view ? fieldPercentile(data.study?.fieldValues, (current ?? view)!.finish.value) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Event, the environment, the settings */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {events.map((ev) => (
              <Link key={ev.series} href={`/draft/live?e=${ev.series}`}
                className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", ev.series === f.series ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {ev.short}
              </Link>
            ))}
            <span className="ml-1 text-xs text-muted-foreground">
              {f.envYear} run environment · {data.env.park} · {f.dh ? "DH" : "no DH"} · {f.cards} cards · {f.teams} teams, {f.mode}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-muted-foreground" title="Cards a pack shows. Sets what the rounds left are expected to bring.">
                Pack
                <input type="number" min={2} max={15} value={saved.packSize}
                  onChange={(e) => update((s) => ({ ...s, packSize: Math.max(2, Math.min(15, Number(e.target.value) || f.packSize)) }))}
                  className="h-7 w-14 rounded-md border border-input bg-background px-2 text-sm" />
              </label>
              {f.rounds.filter((r) => r.pack !== "fixed").length > 0 && (
                <PackKindSwitch rounds={f.rounds.filter((r) => r.pack !== "fixed")} kindOf={kindOf}
                  set={(kinds) => update((s) => ({ ...s, kinds: { ...s.kinds, ...kinds }, group: null }))} />
              )}
              <button className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40" disabled={!team.length}
                onClick={() => update((s) => ({ ...s, picks: s.picks.slice(0, -1), pack: [], round: null, group: null }))}>Undo pick</button>
              <ConfirmButton size="sm" prompt="Start a new draft?" confirmLabel="New draft" disabled={!team.length && !pack.length}
                onConfirm={() => update((s) => ({ ...fresh(s.packSize), kinds: s.kinds }))}>New draft</ConfirmButton>
            </div>
          </div>
          <Weights data={data} />
          {data.differences.length > 0 && (
            <p className="text-xs text-warning">
              Using L.J.&apos;s 10-25 format where the catalogue differs ({data.differences.join("; ")}). Docs/Draft Helper 2026-10-26.md has the catalogue:set line that fixes the row.
            </p>
          )}
          {unplaced > 0 && <p className="text-xs text-negative">{unplaced} pick{unplaced > 1 ? "s" : ""} fit no round left in this format. Check them in the team list.</p>}
          {error && <p className="text-xs text-negative">The engine failed: {error}</p>}
        </CardContent>
      </Card>

      {/* Three columns on a wide screen; below that the pick comes first, rounds and team under it. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,20rem)]">
        {/* Rounds left */}
        <Card className="order-2 min-w-0 xl:order-1">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between">
              <span className="label-eyebrow">{done ? "Draft done" : `Pick ${pickNo} of ${f.cards}`}</span>
              <span className="text-[11px] text-muted-foreground">rounds left</span>
            </div>
            <div className="flex flex-col gap-1">
              {f.rounds.map((r) => {
                const left = rem[r.key] ?? 0;
                const on = round?.key === r.key;
                return (
                  <button key={r.key} disabled={!left}
                    onClick={() => update((s) => ({ ...s, round: on && s.round ? null : r.key, group: null, pack: on ? s.pack : [] }))}
                    className={cn("flex items-center justify-between rounded-md border px-2 py-1 text-left text-sm",
                      on ? "border-primary bg-primary/10" : "border-border hover:bg-muted", !left && "opacity-40")}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: TIER_COLORS[r.tier] }} />
                      {r.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{left}/{r.count}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {f.rounds.length > 3
                ? "Click the round the game is showing, or just type the first card of the pack: it sets the round."
                : "The round with most left is assumed; click another when the game shows it."}
            </p>
            {choose && current && current.groups.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="label-eyebrow">Open which position?</span>
                {current.groups.slice(0, 11).map((g, k) => (
                  <button key={g.group} onClick={() => update((s) => ({ ...s, group: s.group === g.group ? null : g.group, pack: [] }))}
                    className={cn("flex items-center justify-between rounded px-2 py-0.5 text-left text-sm",
                      group === g.group ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted")}
                    title={`A pack of ${saved.packSize} ${round!.tier} ${g.group} cards is expected to add ${g.ev.toFixed(1)} runs to your finished team, e.g. ${E.cards[g.idx].name}`}>
                    <span className={cn(k === 0 && "font-semibold")}>{g.group}</span>
                    <span className={cn("font-mono text-xs", k === 0 ? "text-positive" : "text-muted-foreground")}>
                      {k === 0 ? `+${g.ev.toFixed(1)}` : signed(g.delta)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* This pick */}
        <Card className="order-1 min-w-0 md:col-span-2 xl:order-2 xl:col-span-1">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow">
                {round ? `${round.label}${group ? ` · ${group}` : ""}` : "Which round?"}
              </span>
              {busy && <span className="text-[11px] text-muted-foreground">thinking…</span>}
              {current && <span className="ml-auto text-[11px] text-muted-foreground">{current.ms.toFixed(0)} ms</span>}
            </div>
            <div className="relative">
              <input ref={input} autoFocus value={query} disabled={done}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
                placeholder={done ? "Draft done" : pack.length ? "Next card in the pack… (Enter on empty takes the top pick)" : "Type a card in the pack…"}
                role="combobox" aria-expanded={matches.length > 0} aria-controls="pack-matches" autoComplete="off" spellCheck={false}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              {matches.length > 0 && (
                <ul id="pack-matches" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                  {matches.map((m, i) => (
                    <li key={m.id} role="option" aria-selected={i === active}>
                      <button onMouseDown={(e) => { e.preventDefault(); addToPack(m.idx); input.current?.focus(); }}
                        className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === active ? "bg-muted" : "hover:bg-muted")}>
                        <CardName c={m} />
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{m.group}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {pack.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Pack:</span>
                {pack.map((i) => (
                  <span key={E.cards[i].id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs">
                    {E.cards[i].name}
                    <button aria-label={`Remove ${E.cards[i].name}`} className="text-muted-foreground hover:text-foreground"
                      onClick={() => update((s) => ({ ...s, pack: s.pack.filter((x) => x !== E.cards[i].id) }))}>×</button>
                  </span>
                ))}
              </div>
            )}

            {!round ? (
              <p className="text-sm text-muted-foreground">Pick the round on the left, or type the first card you see.</p>
            ) : !current ? (
              <p className="text-sm text-muted-foreground">{busy ? "Working out the rounds left…" : " "}</p>
            ) : current.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No card left in this round&apos;s pool.</p>
            ) : (
              <Picks E={E} view={current} pack={pack.length > 0} onTake={take} />
            )}
          </CardContent>
        </Card>

        {/* The team */}
        <Card className="order-3 min-w-0">
          <CardContent className="flex flex-col gap-3 p-4">
            <TeamPanel E={E} data={data} view={current ?? view} team={team} used={used} pct={pct}
              onRemove={(k) => update((s) => ({ ...s, picks: s.picks.filter((_, j) => j !== k), pack: [], round: null, group: null }))} />
          </CardContent>
        </Card>
      </div>
      <StudyNote data={data} />
    </div>
  );
}

function CardName({ c, dim }: { c: DraftCard; dim?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", dim && "text-muted-foreground")}>
      <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: TIER_COLORS[c.tier] }} title={c.tier} />
      <span className="truncate">{c.name}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {c.val}{c.year ? ` ’${String(c.year).slice(2)}` : ""}{c.hand ? ` ${c.hand}` : ""}
      </span>
    </span>
  );
}

/** What a run is worth at each kind of slot here, so a big starter number reads right. */
function Weights({ data }: { data: DraftPageData }) {
  const c = data.ctx, w = data.weights;
  const text = `A run of bat at a lineup spot counts 1 (boards ${Math.round((1 - c.lhp) * 100)}/${Math.round(c.lhp * 100)} vs RHP/LHP, from ${data.env.fieldFrom}); `
    + `a glove run ×${c.glove.toFixed(2)}, framing ×${c.frm}; each of ${c.sp} starters ×${c.spW.toFixed(2)} and each of ${c.rp} relievers ×${c.rpW.toFixed(2)} `
    + `(a starter faces ${w.spWeight.toFixed(2)}× a lineup slot's PA here, a reliever ${w.rpWeight.toFixed(2)}×, from ${w.source}); ${c.bench} bench bats ×${c.benchW.toFixed(3)}.`;
  return <p className="text-[11px] leading-snug text-muted-foreground">{text}</p>;
}

function PackKindSwitch({ rounds, kindOf, set }: { rounds: RoundKind[]; kindOf: (r: RoundKind) => PackKind; set: (k: Record<string, PackKind>) => void }) {
  const choose = rounds.every((r) => kindOf(r) === "choose");
  return (
    <label className="flex items-center gap-1 text-muted-foreground" title="How the open rounds' packs come: you pick the position and see a pack of it, or a pack mixes positions.">
      Open rounds
      <select value={choose ? "choose" : "mixed"} onChange={(e) => set(Object.fromEntries(rounds.map((r) => [r.key, e.target.value as PackKind])))}
        className="h-7 rounded-md border border-input bg-background px-1 text-xs">
        <option value="choose">pick the position</option>
        <option value="mixed">mixed packs</option>
      </select>
    </label>
  );
}

function Picks({ E, view, pack, onTake }: {
  E: ReturnType<typeof makeEngine>; view: DraftView; pack: boolean; onTake: (i: number) => void;
}) {
  const rows = pack ? view.rows : view.rows.slice(0, BOARD_ROWS);
  const top = rows[0];
  const typical = view.typical;
  return (
    <div className="flex flex-col gap-2">
      {top && (
        <div className="rounded-md border border-positive/40 bg-positive/5 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs text-muted-foreground">{pack ? "Take" : "Best in this pool"}</span>
            <span className="text-base font-semibold">{E.cards[top.idx].name}</span>
            <span className="text-xs text-muted-foreground">{top.use}</span>
            <span className="ml-auto font-mono text-sm text-positive">{signed(top.delta)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rows[1] ? `${signed(top.delta)} runs over ${E.cards[rows[1].idx].name}` : "the only card"}
            {typical && ` · ${signed(top.overTypical)} over a typical pick here (${E.cards[typical.idx].name})`}
            {pack && " · Enter on the empty box takes it"}
          </p>
        </div>
      )}
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground">
            <th className="w-6 font-normal">#</th>
            <th className="font-normal">Card</th>
            <th className="w-24 font-normal">Plays</th>
            <th className="w-12 text-right font-normal" title="The finished team's value against the top pick (the top pick: its lead)">vs top</th>
            <th className="w-14 text-right font-normal" title="Model runs per 700: a bat vs RHP / vs LHP; an arm saved">runs</th>
            <th className="w-10 text-right font-normal" title="Share of the field's full teams that drafted it (current-format exports)">field</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => {
            const c = E.cards[r.idx];
            return (
              <tr key={c.id} className={cn("border-t border-border/60", k === 0 && "font-medium", !r.exact && "text-muted-foreground")}>
                <td className="py-1 font-mono">{k + 1}</td>
                <td className="py-1">
                  <span className="flex min-w-0 items-center gap-1">
                    <CardName c={c} />
                    {c.out ? (
                      <span className="shrink-0 rounded bg-warning/15 px-1 text-[10px] text-warning" title="Drafted in the earlier runs, by nobody in the current ones: taken to have left the pool. Still yours to take if it is in your pack.">left pool?</span>
                    ) : c.seen === false ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground" title="Nobody drafted it in the current-format exports">not drafted lately</span>
                    ) : null}
                  </span>
                </td>
                <td className="truncate py-1" title={r.use}>{r.use || (r.exact ? "" : "quick read")}</td>
                <td className={cn("py-1 text-right font-mono", k === 0 ? "text-positive" : r.delta < -3 ? "text-negative" : "")}
                  title={typical ? `${signed(r.overTypical)} over a typical pick here` : undefined}>{signed(r.delta)}</td>
                <td className="py-1 text-right font-mono">{c.isPitcher ? c.runsR.toFixed(0) : `${c.runsR.toFixed(0)}/${c.runsL.toFixed(0)}`}</td>
                <td className="py-1 text-right font-mono">{c.share != null ? `${Math.round(c.share * 100)}%` : ""}</td>
                <td className="py-1 text-right">
                  <button className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted" onClick={() => onTake(r.idx)}>Take</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Scores are the expected value of your finished team with that pick: the rounds left played out each time. Grey rows are a
        quick read (what the card adds to the team you are expected to finish with), outside the {view.rows.filter((r) => r.exact).length} played out.
      </p>
    </div>
  );
}

function TeamPanel({ E, data, view, team, used, pct, onRemove }: {
  E: ReturnType<typeof makeEngine>; data: DraftPageData; view: DraftView | null; team: number[]; used: (string | null)[]; pct: number | null; onRemove: (k: number) => void;
}) {
  const f = data.format;
  const complete = team.length >= f.cards;
  const fv = data.study?.fieldValues;
  const field = fv?.length ? { median: Math.round(fv[50]), top: Math.round(fv[90]) } : null;
  const label = (key: string | null) => f.rounds.find((r) => r.key === key)?.label ?? "no round";
  const mine = new Set(team);
  const plan = view?.finish.plan;
  const expectedFrom = new Map(view?.finish.expected.map((e) => [e.idx, e.round]) ?? []);
  const slotRow = (board: "R" | "L") => (plan ? plan[board] : []);
  const name = (i: number) => (i < 0 ? "—" : E.cards[i].name);
  const cell = (i: number) => (
    <span className={cn("truncate", i >= 0 && !mine.has(i) && "italic text-muted-foreground")}
      title={i >= 0 && !mine.has(i) ? `expected from a ${label(expectedFrom.get(i) ?? null)} round` : undefined}>{name(i)}</span>
  );
  const copy = () => {
    if (!plan) return;
    const line = (i: number) => (i < 0 ? "—" : `${E.cards[i].name} (${E.cards[i].val})${mine.has(i) ? "" : " [expected]"}`);
    const lineup = (b: "R" | "L") => E.lineup.map((pos, k) => `  ${pos.padEnd(3)} ${line(plan[b][k])}`).join("\n");
    const text = [
      `${f.name}: ${team.length} of ${f.cards} picked; finished team ${plan.value.toFixed(1)}`,
      `vs RHP\n${lineup("R")}`, `vs LHP\n${lineup("L")}`,
      `Rotation: ${plan.rotation.map(line).join(", ")}`, `Pen: ${plan.pen.map(line).join(", ")}`, `Bench: ${plan.bench.map(line).join(", ")}`,
    ].join("\n");
    void navigator.clipboard?.writeText(text);
  };

  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="label-eyebrow">Your team</span>
        {view && (
          <span className="text-xs text-muted-foreground" title="The finished team's value on this model: picks so far, plus the rounds left at a typical pack. Against the teams the field drafted in the current-format exports, scored the same way; a percentile once every pick is in.">
            {complete ? "finished" : "projected"} {view.finish.value.toFixed(0)}
            {complete && pct != null ? ` · ${ordinal(pct)} pct of field teams` : field ? ` · field median ${field.median}, top tenth ${field.top}` : ""}
          </span>
        )}
      </div>
      {team.length === 0 ? (
        <p className="text-xs text-muted-foreground">No picks yet.</p>
      ) : (
        <ol className="flex flex-col">
          {team.map((i, k) => (
            <li key={E.cards[i].id} className="flex items-center gap-2 border-t border-border/60 py-0.5 text-xs">
              <span className="w-5 font-mono text-muted-foreground">{k + 1}</span>
              <CardName c={E.cards[i]} />
              <span className={cn("ml-auto shrink-0 text-[11px]", used[k] ? "text-muted-foreground" : "text-negative")}>{used[k] ? label(used[k]) : "fits no round"}</span>
              <button aria-label={`Remove ${E.cards[i].name}`} className="text-muted-foreground hover:text-foreground" onClick={() => onRemove(k)}>×</button>
            </li>
          ))}
        </ol>
      )}
      {plan && (
        <div className="flex flex-col gap-2 text-xs">
          <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <span />
            <span className="label-eyebrow">vs RHP</span>
            <span className="label-eyebrow">vs LHP</span>
            {E.lineup.map((pos, k) => (
              <React.Fragment key={pos}>
                <span className="font-mono text-muted-foreground">{pos}</span>
                {cell(slotRow("R")[k])}
                {cell(slotRow("L")[k])}
              </React.Fragment>
            ))}
          </div>
          <div><span className="label-eyebrow">Rotation </span>{plan.rotation.map((i, k) => <React.Fragment key={i}>{k > 0 && ", "}{cell(i)}</React.Fragment>)}</div>
          <div><span className="label-eyebrow">Pen </span>{plan.pen.map((i, k) => <React.Fragment key={i}>{k > 0 && ", "}{cell(i)}</React.Fragment>)}</div>
          <div><span className="label-eyebrow">Bench </span>{plan.bench.map((i, k) => <React.Fragment key={i}>{k > 0 && ", "}{cell(i)}</React.Fragment>)}</div>
          <p className="text-[11px] text-muted-foreground">Italic names are what the rounds left are expected to bring, not picks.</p>
          <button className="self-start rounded border border-border px-2 py-1 text-[11px] hover:bg-muted" onClick={copy}>Copy team as text</button>
        </div>
      )}
    </>
  );
}

/** What the uploaded results say, in two lines, with the doc for the rest. */
function StudyNote({ data }: { data: DraftPageData }) {
  const s = data.study;
  if (!s?.validation) return null;
  const v = s.validation;
  const lj = s.lj.filter((t) => t.full);
  const text = `From the ${s.files.length} exports since the format change (${s.fullTeams} teams with every card on file): `
    + `the model's team value against win% r ${v.rWin.toFixed(2)} (the sum of card values ${v.rCardValue.toFixed(2)}); `
    + `win% by quarter of value, low to high, ${v.quarters.map((q) => q.toFixed(3)).join(" · ")}. `
    + `Card by card it tracks play here at r ${v.cards.bats.r.toFixed(2)} for bats and ${v.cards.arms.r.toFixed(2)} for arms.`
    + (lj.length ? ` Your full teams there graded at the ${lj.map((t) => ordinal(t.pct)).join(", ")} percentile.` : "");
  return <p className="text-[11px] leading-snug text-muted-foreground">{text}</p>;
}
