"use client";

/**
 * The board for a Perfect Draft whose format is on file (lib/draft/formats):
 * one column per position for the round the draft is on, and nothing else.
 *
 * - It follows the draft: the round is the live helper's (the one chosen
 *   there, else the one its pack's first card fits, else the next the game
 *   deals), so it moves from Perfect to Diamond and on as picks go in.
 * - It shows only that round's pool: its tier, inside its value band (a Low
 *   of Lows Diamond round deals 90-94), from cards the event allows (card
 *   years and types come from the catalogue row on the server).
 * - Picks are the live helper's (components/draft/use-live-draft), and a
 *   player picked leaves every column. A click here takes the card as this
 *   round's pick, in both views; Undo takes it back.
 *
 * Cards are scored as the live helper scores them (lib/draft/load.ts: the
 * production model in the event's environment and park): a bat at each spot
 * on both boards weighted to the field's lefties, glove and framing priced as
 * the event prices them, L.J.'s glove floor off a card's listed position.
 */
import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FIELD, makeEngine, poolOf, slotRuns, starterBatRuns, takenOf } from "@/lib/draft/engine";
import { nextRound, replay, roundFor, withCounts, type RoundKind } from "@/lib/draft/formats";
import type { DraftPageData } from "@/lib/draft/load";
import { useLiveDraft, withPick } from "@/components/draft/use-live-draft";
import { TIER_COLORS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** A drop this big between neighbours starts a new tier (runs per 700). */
const TIER_GAP = 2;
const SHOW = 15;
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

interface Entry { idx: number; score: number; rating: number | null }

export function RoundBoard({ data, search }: { data: DraftPageData; search: string }) {
  const E = React.useMemo(() => makeEngine(data.cards, data.ctx), [data]);
  const [saved, update, loaded] = useLiveDraft(data.format.series, data.format.packSize);
  const f = React.useMemo(() => withCounts(data.format, saved.counts), [data.format, saved.counts]);
  // A round looked ahead at, until the next pick (`at` is the pick count it was chosen at).
  const [pin, setPin] = React.useState<{ key: string; at: number } | null>(null);

  const team = React.useMemo(() => saved.picks.map((id) => E.byId.get(id)).filter((i): i is number => i != null), [saved.picks, E]);
  const pack = React.useMemo(() => saved.pack.map((id) => E.byId.get(id)).filter((i): i is number => i != null), [saved.pack, E]);
  const { rem } = React.useMemo(() => replay(f, team.map((i) => E.cards[i])), [f, team, E]);
  const taken = React.useMemo(() => takenOf(E, team), [E, team]);
  const done = team.length >= f.cards;

  // The draft's round, as the live helper has it.
  const current: RoundKind | null = React.useMemo(() => {
    const chosen = saved.round ? f.rounds.find((r) => r.key === saved.round && (rem[r.key] ?? 0) > 0) : undefined;
    if (chosen) return chosen;
    if (pack.length) return roundFor(f, rem, E.cards[pack[0]]);
    return nextRound(f, rem);
  }, [f, rem, saved.round, pack, E]);
  const pinned = pin && pin.at === team.length ? pin.key : null;
  const setPinned = (key: string | null) => setPin(key ? { key, at: team.length } : null);
  const pinnedRound = pinned ? f.rounds.find((r) => r.key === pinned) ?? null : null;
  const shown = pinnedRound ?? current;

  const columns = React.useMemo(() => {
    if (!shown) return [];
    const lhp = data.ctx.lhp;
    const pool = poolOf(E, shown, shown.groups, taken, true);
    const out: { key: string; label: string; entries: Entry[] }[] = [];
    const rank = (key: string, label: string, entries: Entry[]) => {
      if (entries.length) out.push({ key, label, entries: entries.sort((a, b) => b.score - a.score || a.idx - b.idx) });
    };
    const bats = pool.filter((i) => !E.cards[i].isPitcher);
    for (const pos of [...FIELD, ...(data.ctx.dh ? ["DH"] : [])]) {
      rank(pos, pos, bats.flatMap((i) => {
        const c = E.cards[i];
        const r = slotRuns(c, pos, "R", data.ctx), l = slotRuns(c, pos, "L", data.ctx);
        return r == null || l == null ? [] : [{ idx: i, score: (1 - lhp) * r + lhp * l, rating: pos === "DH" ? null : c.pos[pos as keyof typeof c.pos] ?? null }];
      }));
    }
    const arms = pool.filter((i) => E.cards[i].isPitcher);
    rank("SP", "SP", arms.filter((i) => E.cards[i].role === "SP").map((i) => ({ idx: i, score: E.cards[i].runsR + starterBatRuns(E.cards[i], data.ctx), rating: null })));
    rank("RP", "RP", arms.filter((i) => E.cards[i].role !== "SP").map((i) => ({ idx: i, score: E.cards[i].runsR, rating: null })));
    return out;
  }, [shown, E, taken, data.ctx]);

  const q = search.trim().toLowerCase();
  const inPack = new Set(pack);
  const take = (idx: number) => update((s) => withPick(s, E.cards[idx].id));
  const following = !pinnedRound || pinnedRound.key === current?.key;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{done ? "Draft done" : `Pick ${team.length + 1} of ${f.cards}`}</span>
            {shown && (
              <span className="text-sm">
                <span className="text-muted-foreground">{following ? "This round: " : "Looking ahead at: "}</span>
                {shown.label}
                <span className="text-muted-foreground"> · {rem[shown.key] ?? 0} of {shown.count} left</span>
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <button className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40" disabled={!team.length}
                onClick={() => update((s) => ({ ...s, picks: s.picks.slice(0, -1), pack: [], round: null, group: null }))}>Undo last pick</button>
              <Link className="rounded border border-border px-2 py-1 hover:text-foreground" href={`/draft/live?e=${data.format.series}`}>Live helper</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {f.rounds.map((r) => {
              const left = rem[r.key] ?? 0;
              const isShown = shown?.key === r.key, isCurrent = current?.key === r.key;
              return (
                <button key={r.key} onClick={() => setPinned(isCurrent ? null : r.key)}
                  title={isCurrent ? "The round the draft is on" : "Look ahead at this round's pool (the board goes back to the draft's round on the next pick)"}
                  className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                    isShown ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground", !left && "opacity-40")}>
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: TIER_COLORS[r.tier] }} />
                  {r.label}
                  <span className="font-mono">{left}/{r.count}</span>
                  {isCurrent && !done && <span className="text-[10px] text-primary">now</span>}
                </button>
              );
            })}
            {!following && <button className="text-xs text-primary hover:underline" onClick={() => setPinned(null)}>Back to the draft&apos;s round</button>}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {f.envYear} run environment · {data.env.park} · {f.dh ? "DH" : "no DH"} · {f.cards} cards{f.starts ? ` · starts ${f.starts}` : ""}.
            {" "}Picks are shared with the live helper in this browser: a card taken on either leaves both. Click a card here to take it as this round&apos;s pick.
            {!f.ordered && " The round order isn't on file for this draft: the board shows the live helper's round, or the one with most left."}
          </p>
        </CardContent>
      </Card>

      {!loaded ? null : !shown ? (
        <p className="text-sm text-muted-foreground">
          {done ? `All ${f.cards} picks are in.` : "Pick the round on the live helper (or above) to lay out its pool."}
        </p>
      ) : columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No card left in this round&apos;s pool.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {columns.map((col) => {
            const rows = (q ? col.entries.filter((e) => E.cards[e.idx].name.toLowerCase().includes(q)) : col.entries).slice(0, SHOW);
            return (
              <Card key={col.key} className="min-w-0">
                <CardContent className="flex flex-col gap-1 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="text-[11px] text-muted-foreground">{col.entries.length} in pool</span>
                  </div>
                  <ol className="flex flex-col">
                    {rows.map((e, i) => {
                      const c = E.cards[e.idx];
                      const prev = i > 0 ? rows[i - 1] : null;
                      const newTier = !q && prev != null && prev.score - e.score >= TIER_GAP;
                      return (
                        <li key={c.id}>
                          {newTier && <div className="my-1 border-t border-dashed border-border" aria-label="tier break" />}
                          <button onClick={() => take(e.idx)} disabled={done}
                            title={`Take ${c.name} as this round's pick`}
                            className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted disabled:hover:bg-transparent",
                              inPack.has(e.idx) && "ring-1 ring-primary")}>
                            <span className="w-8 shrink-0 rounded bg-muted text-center font-mono text-[10px]" style={{ color: TIER_COLORS[c.tier] }}>{c.val}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {c.name}
                              <span className="text-muted-foreground"> {c.hand ?? ""}{c.year ? ` ’${String(c.year).slice(2)}` : ""}</span>
                              {c.out && <span className="ml-1 text-[10px] text-warning" title="Drafted in earlier runs, by nobody lately: may have left the pool">left pool?</span>}
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
                  {rows.length === 0 && <p className="text-xs text-muted-foreground">{q ? "No match." : "Nothing left."}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {team.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Your picks: {team.map((i) => `${E.cards[i].name} (${E.cards[i].val})`).join(", ")}.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {`Hitter columns rank the bat on both boards (weighted to the field's lefties) plus the glove at that spot as this event prices it, and list a card off its own position only at L.J.'s glove floor or better; the small number is the glove rating there. The two bars are the bat vs LHP and vs RHP. Arms rank on runs saved per 700 batters (a starter's own bat added with no DH); S is stamina. A dashed line is a drop of ${TIER_GAP}+ runs. A ringed card is in the pack typed on the live helper.`}
      </p>
    </div>
  );
}

/** Two tiny bars, vs LHP and vs RHP, on a shared ±25-run scale. */
function Split({ r, l }: { r: number; l: number }) {
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
