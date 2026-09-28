/**
 * The Lineups tab: the best nine per board around his locks (UI plan C5).
 * Nothing here scores on a button: the boards rescore after every edit and
 * dim while the new lineups come; the settings sit in the summary strip. When
 * the tab is narrow (a phone, or beside the card form) the two boards are
 * tabs, "vs RHP · 53%" and "vs LHP · 47%", instead of stacking.
 */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signed } from "@/lib/format";
import { BOARD_NAME, edit, lockCount, lockMovesFrom, nameOf, type Board as BoardKey, type ModelAction, type ModelState } from "@/lib/league-card-state";
import { boardTitle } from "@/lib/league-card-view";
import { cn } from "@/lib/utils";
import { Board } from "./board";
import { cardWarning, ScoreStatus, staffWarning } from "./bits";
import type { Lineup, ScoreResult } from "./use-rescore";

const BOARDS: BoardKey[] = ["vR", "vL"];
const gloves = (x: number) => (x === 1 ? "full" : x === 0.5 ? "half" : x === 0 ? "off" : `×${x}`);

export function LineupsPanel({ state, hasExport, result, withCard, pending, stale, skip, error, retry, act, told, onSelectKeys }: {
  state: ModelState;
  /** A league export is on file (the empty team says where to get one when not). */
  hasExport: boolean;
  result: ScoreResult | null;
  /** The lineups with the modelled card, when it is included and scored. */
  withCard: Record<BoardKey, Lineup | null> | null;
  pending: boolean;
  /** The lineups shown are from before the latest edit. */
  stale: boolean;
  /** Why nothing is being scored (a half-typed park). */
  skip: string | null;
  error: string | null;
  retry: () => void;
  act: (a: ModelAction) => void;
  /** An edit that drops work, with its Undo toast. */
  told: (a: ModelAction, message: string) => void;
  /** Cmd/Ctrl+Z on a focused select. */
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const [tab, setTab] = useState<BoardKey>("vR");
  const locks = lockCount(state.locks);
  const warnings = (result?.warnings ?? []).filter((w) => !staffWarning(w, state.arms) && !cardWarning(w, result?.candidateArm?.label));
  const clearLocks = () => told(edit.clearLocks(locks), `Cleared ${locks} lock${locks === 1 ? "" : "s"}`);
  // A player locks into one slot per board, so locking him elsewhere moves him: say so.
  const lock = (board: BoardKey) => (slot: string, entry: string | null) => {
    const from = lockMovesFrom(state, board, slot, entry);
    if (from && entry) told(edit.lock(board, slot, entry), `Moved ${nameOf(entry)} from ${from} to ${slot} ${BOARD_NAME[board]}`);
    else act(edit.lock(board, slot, entry));
  };
  const lhp = result?.lhp ?? null;
  const board = (b: BoardKey, showTitle: boolean) => (
    <Board
      board={b} lhp={lhp} showTitle={showTitle} bats={state.bats} pool={result?.pool ?? []} locks={state.locks[b]} now={result?.now[b]} next={withCard?.[b]}
      bad={(result?.badLocks ?? []).filter((x) => x.board === b)} pending={pending} stale={stale} onLock={lock(b)} onSelectKeys={onSelectKeys}
    />
  );
  const parkMove = result?.park && result.neutral && result.now.vR && result.now.vL && result.neutral.vR != null && result.neutral.vL != null
    ? ` Against a neutral park it moves these bats ${signed(result.now.vR.total - result.neutral.vR)} vs RHP and ${signed(result.now.vL.total - result.neutral.vL)} vs LHP.`
    : "";

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-72 text-sm text-muted-foreground">
          Best nine against each hand. Lock a slot to force a player there; the rest fill themselves. Runs are per season above an average league hitter, glove included.
        </p>
        {locks > 0 && (locks >= 3
          ? <ConfirmButton variant="ghost" prompt={`Clear all ${locks} locks?`} onConfirm={clearLocks}>{`Clear ${locks} locks`}</ConfirmButton>
          : <Button size="sm" variant="ghost" onClick={clearLocks}>{`Clear ${locks} lock${locks === 1 ? "" : "s"}`}</Button>)}
      </div>
      <ScoreStatus skip={skip} error={error} retry={retry} shown={result ? "The lineups below are" : null} />
      {!state.bats.length && (hasExport
        ? <p className="text-sm text-muted-foreground">Add a hitter below to see lineups.</p>
        : (
          <p className="text-sm text-muted-foreground">
            {"No league export yet. Add your hitters below, or upload an export on "}
            <Link href="/upload" className="font-medium text-primary underline-offset-4 hover:underline">/upload</Link>.
          </p>
        ))}
      {state.bats.length > 0 && (
        <>
          <div className="hidden gap-6 @min-[38rem]:grid @min-[38rem]:grid-cols-2">{BOARDS.map((b) => <div key={b} className="min-w-0">{board(b, true)}</div>)}</div>
          <Tabs value={tab} onValueChange={(v) => setTab(v === "vL" ? "vL" : "vR")} className="@min-[38rem]:hidden">
            <TabsList aria-label="Which hand's board" className="grid w-full grid-cols-2">
              {BOARDS.map((b) => <TabsTrigger key={b} value={b}>{boardTitle(b, lhp)}</TabsTrigger>)}
            </TabsList>
            {BOARDS.map((b) => <TabsContent key={b} value={b} className="mt-2">{board(b, false)}</TabsContent>)}
          </Tabs>
        </>
      )}
      {result && (
        <div className={cn("space-y-0.5 text-[11px] text-muted-foreground", stale && "opacity-60")}>
          <p>{`${result.family} · run environment ${result.year === 2010 ? "PT default (2010)" : result.year} · ${result.park ? `home park ${result.park} (half weight)` : "neutral park"} · gloves ${gloves(result.defScale)} · boards weighted ${Math.round((1 - result.lhp) * 100)}/${Math.round(result.lhp * 100)} · ${result.rpw.toFixed(1)} runs a win.`}</p>
          <p>{`Park: moves your bats only (half the games are at home).${parkMove}`}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-warning">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
