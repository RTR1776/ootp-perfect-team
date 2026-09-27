/**
 * The Lineups tab: League, run environment, home park and glove weight, and
 * the best nine per board. Nothing here scores on a button: the boards
 * rescore after every edit and dim while the new lineups come.
 */
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BOARD_NAME, edit, FAMILIES, GLOVES, lockCount, lockMovesFrom, nameOf,
  type Board as BoardKey, type Family, type ModelAction, type ModelState,
} from "@/lib/league-card-state";
import { Board } from "./board";
import { Eyebrow, NativeSelect, ScoreStatus, staffWarning } from "./bits";
import type { Lineup, ScoreResult } from "./use-rescore";

const BOARDS: BoardKey[] = ["vR", "vL"];
const gloves = (x: number) => (x === 1 ? "full" : x === 0.5 ? "half" : x === 0 ? "off" : `×${x}`);

export function LineupsPanel({ state, exportFamily, result, withCard, pending, stale, skip, error, retry, act, told, seal, onSelectKeys }: {
  state: ModelState;
  /** The newest export's league: choosing it again means following the export. */
  exportFamily: Family;
  result: ScoreResult | null;
  /** The lineups with the modelled card, when it is included and scored. */
  withCard: Record<BoardKey, Lineup | null> | null;
  pending: boolean;
  /** The lineups shown are from before the latest edit. */
  stale: boolean;
  /** Why nothing is being scored (a half-typed year or park). */
  skip: string | null;
  error: string | null;
  retry: () => void;
  act: (a: ModelAction) => void;
  /** An edit that drops work, with its Undo toast. */
  told: (a: ModelAction, message: string) => void;
  seal: () => void;
  /** Cmd/Ctrl+Z on a focused select. */
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const s = state.settings;
  const locks = lockCount(state.locks);
  const warnings = (result?.warnings ?? []).filter((w) => !staffWarning(w, state.arms));
  const clearLocks = () => told(edit.clearLocks(locks), `Cleared ${locks} lock${locks === 1 ? "" : "s"}`);
  // A player locks into one slot per board, so locking him elsewhere moves him: say so.
  const lock = (board: BoardKey) => (slot: string, entry: string | null) => {
    const from = lockMovesFrom(state, board, slot, entry);
    if (from && entry) told(edit.lock(board, slot, entry), `Moved ${nameOf(entry)} from ${from} to ${slot} ${BOARD_NAME[board]}`);
    else act(edit.lock(board, slot, entry));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Best nine against each hand. Lock a slot to force a player there, even below your position floor; the rest fill
        themselves. Runs are per 700 PA above the league&apos;s average bat, glove included.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <Eyebrow>League</Eyebrow>
          <NativeSelect value={s.family} onChange={(e) => act(edit.family(e.target.value as Family, exportFamily))} onKeyDown={onSelectKeys}>
            {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <Eyebrow>Run environment</Eyebrow>
          <Input
            value={s.year} inputMode="numeric" onBlur={seal} className="h-9 w-24 font-mono"
            onChange={(e) => act(edit.year(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)))}
            title="2010 is the PT default; a theme week's year when one is announced"
          />
        </label>
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 sm:max-w-xs">
          <Eyebrow>Home park (blank = neutral)</Eyebrow>
          <Input list="league-card-parks" value={s.park} placeholder="e.g. 1945 Fenway Park" onBlur={seal} onChange={(e) => act(edit.park(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <Eyebrow>Glove weight</Eyebrow>
          <NativeSelect value={s.glove} onChange={(e) => act(edit.glove(e.target.value))} onKeyDown={onSelectKeys}>
            {GLOVES.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </NativeSelect>
        </label>
        {locks > 0 && (locks >= 3
          ? <ConfirmButton variant="ghost" prompt={`Clear all ${locks} locks?`} onConfirm={clearLocks}>Clear {locks} locks</ConfirmButton>
          : <Button size="sm" variant="ghost" onClick={clearLocks}>Clear {locks} lock{locks === 1 ? "" : "s"}</Button>)}
      </div>
      <ScoreStatus skip={skip} error={error} retry={retry} shown={result ? "The lineups below are" : null} />
      {!state.bats.length && <p className="text-sm text-muted-foreground">Add a hitter above to see lineups.</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {BOARDS.map((b) => (
          <Board
            key={b} board={b} bats={state.bats} locks={state.locks[b]} now={result?.now[b]} next={withCard?.[b]}
            pending={pending} stale={stale} onLock={lock(b)} onSelectKeys={onSelectKeys}
          />
        ))}
      </div>
      {result && (
        <div className={cn("text-[11px] text-muted-foreground", stale && "opacity-60")}>
          {`${result.family} · run environment ${result.year === 2010 ? "PT default (2010)" : result.year} · ${result.park ? `home park ${result.park} (half weight)` : "neutral park"} · gloves ${gloves(result.defScale)} · boards weighted ${Math.round((1 - result.lhp) * 100)}/${Math.round(result.lhp * 100)} · ${result.rpw.toFixed(1)} runs a win.`}
          {result.park && result.neutral && result.now.vR && result.now.vL && result.neutral.vR != null && result.neutral.vL != null && (
            <>
              {" "}Against a neutral park the park moves these bats{" "}
              <span className="font-mono">{signed(result.now.vR.total - result.neutral.vR)}</span> vs RHP and{" "}
              <span className="font-mono">{signed(result.now.vL.total - result.neutral.vL)}</span> vs LHP.
            </>
          )}
          {" "}{result.park
            ? "The other team bats there too and it charges your pitchers, which this does not count, so use it to set the nine for a park; park:sweep makes the park pick."
            : "Picking a home park is park:sweep's job, which also counts your pitchers and the field."}
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
