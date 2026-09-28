"use client";

/**
 * The summary strip (UI plan C6, §5 D), above the boards and sticky on a
 * desktop: what the team is worth and the settings it is scored in.
 * - "Bats +75.6 runs/season": the two boards weighted by the league's share
 *   of PA against LHP, with its definition spelled out, then each board.
 * - "Arms +20.8" (the staff) and "Team +96.4 runs/season vs avg PEL".
 * - With a card included: "With Dave Winfield: +1.3 runs (+0.1 W)".
 * - Undo / Redo for the whole page.
 * - The settings as chips: League as PEL | HD | LD, and Edit for the run
 *   environment, the home park and the glove weight.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { signed } from "@/lib/format";
import { DEFAULT_YEAR, edit, FAMILIES, GLOVES, type Family, type ModelAction, type ModelState } from "@/lib/league-card-state";
import { teamTotals } from "@/lib/league-card-view";
import { cn } from "@/lib/utils";
import { toneClass } from "./bits";
import { UndoBar, type UndoControls } from "./undo-bar";
import type { ScoreResult } from "./use-rescore";

/** What "Bats" counts: the app's definition, not the HD plan's "+49" (UI plan question 2). */
export const BATS_MEANS = "9 slots × 700 PA, glove included, vs the league-average bat";

const yearName = (y: string) => (y === DEFAULT_YEAR ? "2010 · PT default" : y);
const gloveChip = (g: string) => (g === "1" ? "Gloves full" : g === "0.5" ? "Gloves half" : g === "0" ? "Bat only" : `Gloves ×${g}`);

const Chip = ({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) => (
  <span className={cn("inline-flex max-w-full items-center truncate rounded-md bg-muted px-2 py-0.5 text-xs", warn ? "text-warning" : "text-muted-foreground")}>{children}</span>
);

export function SummaryStrip({ state, exportFamily, result, pending, stale, years, parks, card, undo, act, seal, onSelectKeys }: {
  state: ModelState;
  /** The newest export's league: choosing it again means following the export. */
  exportFamily: Family;
  result: ScoreResult | null;
  pending: boolean;
  /** The numbers shown are from before the latest edit: dimmed. */
  stale: boolean;
  /** The run environments to pick from, PT default first. */
  years: string[];
  /** The home parks on file ("1945 Fenway Park"). */
  parks: ReadonlySet<string>;
  /** The modelled card's worth to the team, when it is included and scored. */
  card: { name: string; season: number; wins: number } | null;
  undo: UndoControls;
  act: (a: ModelAction) => void;
  seal: () => void;
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const s = state.settings;
  const t = teamTotals(result);
  const park = s.park.trim();
  const parkOk = !park || parks.has(park);

  return (
    <section aria-label="Team summary" className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:sticky md:top-14 md:z-10">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className={cn("flex min-w-0 flex-wrap items-baseline gap-x-8 gap-y-1 transition-opacity", stale && "opacity-60")} aria-busy={pending}>
          <div className="min-w-0" title={`Bats: the best nine against each hand, weighted by the league's share of PA against LHP; ${BATS_MEANS}.`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium">Bats</span>
              <span className={cn("stat-value", toneClass(t.bats))}>{signed(t.bats)}</span>
              <span className="text-sm text-muted-foreground">runs/season</span>
              {pending && <Loader2 className="size-3.5 animate-spin self-center text-muted-foreground" aria-label="Updating" />}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{`vs RHP ${signed(t.vR)} · vs LHP ${signed(t.vL)}`}</div>
            <div className="text-[11px] text-muted-foreground">{BATS_MEANS}</div>
          </div>
          <div className="flex min-w-0 items-baseline gap-x-2" title={state.arms.length ? "The pitching staff: runs a season better than the league's average arm" : "No pitchers on the team"}>
            <span className="text-sm font-medium">Arms</span>
            <span className={cn("font-display text-2xl font-semibold tabular-nums", toneClass(t.arms))}>{signed(t.arms)}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2" title="Bats and arms together">
            <span className="text-sm font-medium">Team</span>
            <span className={cn("font-display text-2xl font-semibold tabular-nums", toneClass(t.team))}>{signed(t.team)}</span>
            <span className="text-sm text-muted-foreground">{`runs/season vs avg ${result?.family ?? s.family}`}</span>
          </div>
        </div>
        <UndoBar {...undo} />
      </div>
      {card && (
        <p className={cn("mt-2 text-sm transition-opacity", stale && "opacity-60")}>
          <span className="font-medium">{`With ${card.name}: `}</span>
          <span className={cn("font-mono", toneClass(card.season))}>{signed(card.season)}</span>
          <span className="text-muted-foreground">{` runs (${signed(card.wins)} W)`}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
        <Segmented<Family>
          aria-label="League" value={s.family} onChange={(f) => act(edit.family(f, exportFamily))}
          options={FAMILIES.map((f) => ({ value: f, label: f, title: f === exportFamily ? `${f}: the league of your newest export` : `Score in ${f}` }))}
        />
        <Chip>{yearName(s.year)}</Chip>
        <Chip warn={!parkOk}>{park ? (parkOk ? park : `${park} (not on the list)`) : "Neutral park"}</Chip>
        <Chip>{gloveChip(s.glove)}</Chip>
        <Button size="sm" variant="ghost" className="h-7 px-2" aria-expanded={editing} aria-controls="lc-settings" onClick={() => setEditing((on) => !on)}>
          {editing ? "Done" : "Edit"}
        </Button>
      </div>
      {editing && (
        <div id="lc-settings" className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Run environment</span>
            <Select value={s.year} onChange={(e) => act(edit.year(e.target.value))} onKeyDown={onSelectKeys} className="w-44">
              {years.map((y) => <option key={y} value={y}>{yearName(y)}</option>)}
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 sm:max-w-xs">
            <span className="text-xs text-muted-foreground">Home park (blank for neutral)</span>
            <Input list="league-card-parks" value={s.park} placeholder="e.g. 1945 Fenway Park" onBlur={seal} onChange={(e) => act(edit.park(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Glove weight</span>
            <Select value={s.glove} onChange={(e) => act(edit.glove(e.target.value))} onKeyDown={onSelectKeys} className="w-32">
              {GLOVES.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
            </Select>
          </label>
        </div>
      )}
    </section>
  );
}
