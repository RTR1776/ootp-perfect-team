"use client";

// Live draft assistant (PLAN.md Day 4). Type a few letters per offered card,
// Enter to add it to the pack, get an instant Best Pick verdict; keyboard-only
// operable inside a 15:00 clock.

import * as React from "react";
import { useDataStore } from "@/lib/data";
import { useContextStore } from "@/lib/contexts";
import {
  BUCKETS, buildBoard, needsOf, scorePack, useDraftStore,
  type Board, type Bucket, type PackVerdict,
} from "@/lib/draft";
import { NEUTRAL_PARK } from "@/lib/parks";
import { evidenceN, type Card as CardType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";

export default function DraftPage() {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);
  const loadContexts = useContextStore((s) => s.load);
  const contextKey = useContextStore((s) => s.selectedKey);
  const contextsLoaded = useContextStore((s) => s.loaded);

  React.useEffect(() => {
    load();
    loadContexts();
  }, [load, loadContexts]);

  const board: Board | null = React.useMemo(() => {
    if (status !== "ready" || !cards.length) return null;
    const era = contextsLoaded ? useContextStore.getState().eraPark() : NEUTRAL_PARK;
    return buildBoard(cards, era);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, cards, contextKey, contextsLoaded]);

  if (!board) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading draft board…
      </div>
    );
  }

  return <DraftRoom board={board} cards={cards} />;
}

// ---------------------------------------------------------------------------

function DraftRoom({ board, cards }: { board: Board; cards: CardType[] }) {
  const quotas = useDraftStore((s) => s.quotas);
  const picks = useDraftStore((s) => s.picks);
  const pack = useDraftStore((s) => s.pack);
  const totalPicks = useDraftStore((s) => s.totalPicks);

  const picksRemaining = totalPicks - picks.length;
  const state = React.useMemo(() => ({ quotas, picks }), [quotas, picks]);
  const verdicts: PackVerdict[] = React.useMemo(
    () => scorePack(pack, state, board, picksRemaining),
    [pack, state, board, picksRemaining],
  );
  const needs = React.useMemo(() => needsOf(state, board), [state, board]);
  const totalNeed = Object.values(needs).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Draft Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Pick {picks.length + 1} of {totalPicks} · board sized to the selected
            context (header) · values are evidence-blended runs/game.
          </p>
        </div>
        <Clock />
      </div>

      {picksRemaining < totalNeed && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          Roster math alert: {totalNeed} unfilled quota slots but only {picksRemaining} picks left.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <div className="space-y-4">
          <PackEntry board={board} cards={cards} />
          <div className="space-y-2">
            {verdicts.map((v, i) => (
              <VerdictRow key={v.entry.card.cid} v={v} best={i === 0} />
            ))}
            {!pack.length && (
              <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Type a card name and press Enter for each card in the offered pack.
              </p>
            )}
          </div>
        </div>
        <RosterTracker board={board} needs={needs} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Clock() {
  const startedAt = useDraftStore((s) => s.startedAt);
  const clockSeconds = useDraftStore((s) => s.clockSeconds);
  const startClock = useDraftStore((s) => s.startClock);
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) {
    return (
      <Button variant="outline" onClick={startClock}>
        Start 15:00 clock
      </Button>
    );
  }
  const left = Math.max(0, clockSeconds - Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  const color = left < 120 ? "text-red-400" : left < 300 ? "text-amber-400" : "text-foreground";
  return (
    <div className={`font-mono text-2xl font-bold tabular-nums ${color}`}>
      {m}:{String(s).padStart(2, "0")}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PackEntry({ board, cards }: { board: Board; cards: CardType[] }) {
  const picks = useDraftStore((s) => s.picks);
  const pack = useDraftStore((s) => s.pack);
  const addToPack = useDraftStore((s) => s.addToPack);
  const removeFromPack = useDraftStore((s) => s.removeFromPack);
  const clearPack = useDraftStore((s) => s.clearPack);

  const [q, setQ] = React.useState("");
  const [hi, setHi] = React.useState(0);

  const suggestions = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const taken = new Set([...picks, ...pack]);
    return cards
      .filter((c) => !taken.has(c.cid) && c.name.toLowerCase().includes(needle))
      .map((c) => ({ c, e: board.entries.get(c.cid) }))
      .filter((x) => x.e)
      .sort((a, b) => {
        const ap = a.c.name.toLowerCase().startsWith(needle) ? 1 : 0;
        const bp = b.c.name.toLowerCase().startsWith(needle) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return (b.e!.value ?? 0) - (a.e!.value ?? 0);
      })
      .slice(0, 7);
  }, [q, cards, board, picks, pack]);

  const add = (cid: number) => {
    addToPack(cid);
    setQ("");
    setHi(0);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[hi]) add(suggestions[hi].c.cid);
            else if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, suggestions.length - 1));
            else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
            else if (e.key === "Escape") {
              setQ("");
              clearPack();
            }
          }}
          placeholder="Add offered card… (Enter adds · Esc clears pack)"
          autoFocus
          className="h-10 w-full rounded-md border border-border bg-card/50 px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-background shadow-lg">
            {suggestions.map((s, i) => (
              <button
                key={s.c.cid}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s.c.cid);
                }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${i === hi ? "bg-accent" : ""}`}
              >
                <span>
                  {s.c.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    {s.c.pos} · {s.c.tier}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {s.e!.value >= 0 ? "+" : ""}
                  {s.e!.value.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {pack.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Pack ({pack.length}):</span>
          {pack.map((cid) => {
            const e = board.entries.get(cid);
            return (
              <button
                key={cid}
                onClick={() => removeFromPack(cid)}
                className="rounded-full border border-border px-2 py-0.5 hover:border-red-400 hover:text-red-400"
                title="remove"
              >
                {e?.card.name ?? cid} ✕
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function VerdictRow({ v, best }: { v: PackVerdict; best: boolean }) {
  const draftCard = useDraftStore((s) => s.draftCard);
  const c = v.entry.card;
  const n = evidenceN(c);
  const isPit = c.pos === "SP" || c.pos === "RP" || c.pos === "CL";
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        best ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      {best && (
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
          Best
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {c.name}
          <span className="text-xs font-normal text-muted-foreground">
            {c.pos} · {c.bats}
          </span>
          <TierBadge tier={c.tier} className="scale-90" />
        </div>
        <div className="text-xs text-muted-foreground">
          VAR {v.varRuns >= 0 ? "+" : ""}
          {v.varRuns.toFixed(2)} r/g · {v.tierLabel} · {v.note} · urgency{" "}
          <span className={v.urgency === "high" ? "text-red-400" : v.urgency === "med" ? "text-amber-400" : ""}>
            {v.urgency}
          </span>
          {n > 0 && (
            <>
              {" "}
              · {n} {isPit ? "IP" : "PA"} observed
            </>
          )}
        </div>
      </div>
      <span className="font-mono text-sm tabular-nums">
        {v.score >= 0 ? "+" : ""}
        {v.score.toFixed(2)}
      </span>
      <Button size="sm" variant={best ? "default" : "outline"} onClick={() => draftCard(c.cid)}>
        Draft
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RosterTracker({ board, needs }: { board: Board; needs: Record<Bucket, number> }) {
  const quotas = useDraftStore((s) => s.quotas);
  const picks = useDraftStore((s) => s.picks);
  const totalPicks = useDraftStore((s) => s.totalPicks);
  const setQuota = useDraftStore((s) => s.setQuota);
  const undoPick = useDraftStore((s) => s.undoPick);
  const reset = useDraftStore((s) => s.reset);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          Quotas
          <span className="text-muted-foreground">
            {picks.length}/{totalPicks} picked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {BUCKETS.map((b) => {
            const need = needs[b];
            const quota = quotas[b];
            const filled = quota - need;
            return (
              <div
                key={b}
                className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-xs"
              >
                <span className={need > 0 ? "" : "text-muted-foreground"}>{b}</span>
                <span className="flex items-center gap-1 font-mono">
                  <span className={need === 0 ? "text-emerald-400" : ""}>{filled}</span>/
                  <input
                    type="number"
                    value={quota}
                    min={0}
                    max={9}
                    onChange={(e) => setQuota(b, Number(e.target.value))}
                    className="w-8 rounded border border-border bg-background px-1 text-center text-xs"
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          Drafted
          <span className="flex gap-2">
            <button onClick={undoPick} className="text-muted-foreground hover:text-foreground">
              undo
            </button>
            <button
              onClick={() => {
                if (confirm("Reset the whole draft session?")) reset();
              }}
              className="text-muted-foreground hover:text-red-400"
            >
              reset
            </button>
          </span>
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto text-xs">
          {picks.map((cid, i) => {
            const e = board.entries.get(cid);
            return (
              <div key={`${cid}-${i}`} className="flex justify-between">
                <span>
                  {i + 1}. {e?.card.name ?? cid}{" "}
                  <span className="text-muted-foreground">{e?.bucket}</span>
                </span>
                <span className="font-mono text-muted-foreground">{e ? e.value.toFixed(2) : ""}</span>
              </div>
            );
          })}
          {!picks.length && <p className="text-muted-foreground">No picks yet.</p>}
        </div>
      </div>
    </div>
  );
}
