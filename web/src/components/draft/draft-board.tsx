"use client";

/**
 * The board. One column per position, best card at the top, with a tier line
 * wherever the next card is a real drop, a "wait cost" in each header (how many
 * runs you give up if the top card goes before your next pick), and a click to
 * mark a card taken — it leaves every column it was in and the columns re-rank.
 *
 * Taken marks are kept per event in this browser only; they're a mid-draft
 * convenience, not a record.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DraftEvent { id: number; label: string; isDraft: boolean }
export interface DraftCard {
  id: number; name: string; val: number | null; year: number | null; isPitcher: boolean;
  hand: string | null; pos: string; runsR: number | null; runsL: number | null; stamina: number | null;
}
export interface DraftColumn { key: string; label: string; entries: { id: number; score: number; rating: number | null }[] }

interface Props {
  events: DraftEvent[];
  eventId: number | null;
  eventName: string | null;
  context: string | null;
  columns: DraftColumn[];
  cards: DraftCard[];
}

/** A drop this big between neighbours starts a new tier (runs per 700). */
const TIER_GAP = 2;
const SHOW = 15;
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

function useTaken(eventId: number | null) {
  const key = eventId ? `draft-taken:${eventId}` : null;
  const [taken, setTaken] = React.useState<number[]>([]);
  React.useEffect(() => {
    if (!key) return;
    let saved: number[] = [];
    try { saved = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from browser storage after mount
    setTaken(Array.isArray(saved) ? saved : []);
  }, [key]);
  const save = (next: number[]) => {
    setTaken(next);
    if (key) try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return [taken, save] as const;
}

export function DraftBoard(p: Props) {
  const router = useRouter();
  const [taken, setTaken] = useTaken(p.eventId);
  const [search, setSearch] = React.useState("");
  const [pickGap, setPickGap] = React.useState(8);
  const byId = React.useMemo(() => new Map(p.cards.map((c) => [c.id, c])), [p.cards]);
  const takenSet = React.useMemo(() => new Set(taken), [taken]);
  const q = search.trim().toLowerCase();

  const toggle = (id: number) => setTaken(takenSet.has(id) ? taken.filter((x) => x !== id) : [...taken, id]);

  const draftEvents = p.events.filter((e) => e.isDraft);
  const otherEvents = p.events.filter((e) => !e.isDraft);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1">
            <span className="label-eyebrow">Event</span>
            <select
              className="h-8 w-72 max-w-full rounded-md border border-input bg-background px-2 text-sm"
              value={p.eventId ?? ""}
              onChange={(e) => router.push(e.target.value ? `/draft?t=${e.target.value}` : "/draft")}
            >
              <option value="">Pick an event…</option>
              {draftEvents.length > 0 && (
                <optgroup label="Perfect Drafts">
                  {draftEvents.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </optgroup>
              )}
              <optgroup label="Everything else">
                {otherEvents.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-eyebrow">Find</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Card name…"
              className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1" title="Picks between your turns. Sets the wait cost in each column header.">
            <span className="label-eyebrow">Picks until your next turn</span>
            <input
              type="number" min={1} max={40} value={pickGap}
              onChange={(e) => setPickGap(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          {p.eventId && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>{taken.length} taken</span>
              <button className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40" disabled={!taken.length} onClick={() => setTaken(taken.slice(0, -1))}>Undo last</button>
              <button className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40" disabled={!taken.length} onClick={() => setTaken([])}>Reset</button>
            </div>
          )}
          {p.context && <p className="w-full text-xs text-muted-foreground">{p.eventName} · {p.context}</p>}
        </CardContent>
      </Card>

      {!p.eventId ? (
        <p className="text-sm text-muted-foreground">Pick an event to lay out its board.</p>
      ) : p.columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No legal cards or no run environment on file for this event.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {p.columns.map((col) => {
            const live = col.entries.filter((e) => !takenSet.has(e.id));
            const shown = (q ? live.filter((e) => byId.get(e.id)?.name.toLowerCase().includes(q)) : live).slice(0, SHOW);
            // Wait cost: the best card now vs the best card still likely there after pickGap more picks
            // (assumes the others take from the top of this column at worst — an upper bound).
            const wait = live.length > pickGap ? live[0].score - live[Math.min(pickGap, live.length - 1)].score : null;
            return (
              <Card key={col.key} className="min-w-0">
                <CardContent className="flex flex-col gap-1 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{col.label}</span>
                    {wait != null && (
                      <span
                        className={cn("text-[11px]", wait >= 6 ? "text-negative" : wait >= 3 ? "text-warning" : "text-muted-foreground")}
                        title={`Top card now vs the ${pickGap + 1}th-best left: what waiting ${pickGap} picks can cost at ${col.label}`}
                      >
                        wait costs {wait.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <ol className="flex flex-col">
                    {shown.map((e, i) => {
                      const c = byId.get(e.id);
                      if (!c) return null;
                      const prev = i > 0 ? shown[i - 1] : null;
                      const newTier = !q && prev != null && prev.score - e.score >= TIER_GAP;
                      return (
                        <li key={e.id}>
                          {newTier && <div className="my-1 border-t border-dashed border-border" aria-label="tier break" />}
                          <button
                            onClick={() => toggle(e.id)}
                            title="Click to mark taken"
                            className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
                          >
                            <span className="w-8 shrink-0 rounded bg-muted text-center font-mono text-[10px]">{c.val ?? "?"}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {c.name}
                              <span className="text-muted-foreground"> {c.hand ?? ""}{c.year ? ` ’${String(c.year).slice(2)}` : ""}</span>
                            </span>
                            {e.rating != null && <span className="shrink-0 font-mono text-[10px] text-muted-foreground" title={`Glove rating at ${col.label}`}>{e.rating}</span>}
                            {c.isPitcher && c.stamina != null && <span className="shrink-0 font-mono text-[10px] text-muted-foreground" title="Stamina">S{c.stamina}</span>}
                            {!c.isPitcher && <Split r={c.runsR} l={c.runsL} />}
                            <span className="w-11 shrink-0 text-right font-mono tabular-nums">{signed(e.score)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  {live.length === 0 && <p className="text-xs text-muted-foreground">Nothing left.</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {taken.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Taken: {taken.map((id) => byId.get(id)?.name ?? id).join(", ")}. Click a name on the board again to put it back
          (search finds taken cards too once you undo).
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Hitter columns rank bat (both hands, weighted to the field) plus glove at that spot, and only list cards at or above
        the glove floor (70; LF 50; none at 1B) — the small number is the glove rating there. The two bars are the bat vs
        LHP and vs RHP, so a platoon-only bat stands out. A dashed line is a tier break: the next card is {TIER_GAP}+ runs
        worse. Arms rank on runs saved; S is stamina.
      </p>
    </div>
  );
}

/** Two tiny bars, vs LHP and vs RHP, on a shared ±25-run scale. */
function Split({ r, l }: { r: number | null; l: number | null }) {
  if (r == null || l == null) return null;
  const w = (v: number) => `${Math.min(100, (Math.abs(v) / 25) * 100)}%`;
  const bar = (v: number, label: string) => (
    <span className="flex items-center gap-0.5" title={`vs ${label}HP ${signed(v)}`}>
      <span className="w-2 text-[8px] text-muted-foreground">{label}</span>
      <span className="relative h-1.5 w-8 rounded-sm bg-muted">
        <span className={cn("absolute inset-y-0 left-0 rounded-sm", v >= 0 ? "bg-positive" : "bg-negative")} style={{ width: w(v) }} />
      </span>
    </span>
  );
  return <span className="flex shrink-0 flex-col gap-0.5">{bar(l, "L")}{bar(r, "R")}</span>;
}
