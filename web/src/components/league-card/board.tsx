/**
 * One board's best nine (vs RHP or vs LHP). Each slot's select locks a player
 * there. With a modelled card included, the board shows the lineup with it and
 * marks each slot it changes "(was …)".
 */
import { Loader2, Lock } from "lucide-react";
import { signed } from "@/lib/format";
import { BOARD_NAME, nameOf, SLOTS, type Board as BoardKey } from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { NativeSelect, toneClass } from "./bits";
import type { Lineup } from "./use-rescore";

export function Board({ board, bats, locks, now, next, pending, stale, onLock, onSelectKeys }: {
  board: BoardKey;
  bats: string[];
  locks: Record<string, string>;
  now: Lineup | null | undefined;
  /** The lineup with the modelled card, when one is included. */
  next: Lineup | null | undefined;
  pending: boolean;
  /** The lineups shown are from before the latest edit (pending, skipped or failed): dimmed. */
  stale: boolean;
  /** Lock a slot to a roster entry; null unlocks it. */
  onLock: (slot: string, entry: string | null) => void;
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const at = (l: Lineup | null | undefined, slot: string) => l?.lineup.find((x) => x.slot === slot);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{BOARD_NAME[board]}</span>
        <span className="flex items-baseline gap-2">
          {pending && (
            <span className="inline-flex items-center gap-1 self-center text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />Updating…
            </span>
          )}
          <span className={cn("font-mono text-muted-foreground", stale && "opacity-60")}>
            {signed(now?.total)}
            {next && <> → <span className={toneClass(next.total - (now?.total ?? 0))}>{signed(next.total)}</span></>}
          </span>
        </span>
      </div>
      <table className={cn("w-full text-xs transition-opacity", stale && "opacity-60")} aria-busy={pending}>
        <tbody>
          {SLOTS.map((slot) => {
            const a = at(now, slot), b = at(next, slot), shown = b ?? a;
            const moved = next && a && b && a.label !== b.label;
            // The icon marks a lock that held: the slot's player is the one locked there.
            const held = locks[slot] != null && shown?.entry === locks[slot];
            return (
              <tr key={slot} className="border-b border-border/50 align-middle">
                <td className="w-8 py-1 font-mono text-muted-foreground">{slot}</td>
                <td className="w-40 py-1 pr-2">
                  <NativeSelect
                    value={locks[slot] ?? ""}
                    onChange={(e) => onLock(slot, e.target.value || null)}
                    onKeyDown={onSelectKeys}
                    className="h-7 w-full text-xs"
                    aria-label={`Lock ${slot} ${BOARD_NAME[board]}`}
                  >
                    <option value="">Best available</option>
                    {bats.map((e) => <option key={e} value={e}>{nameOf(e)}</option>)}
                  </NativeSelect>
                </td>
                <td className={cn("py-1", moved && "font-medium text-primary")}>
                  {held && <Lock className="mr-1 inline size-3 text-muted-foreground" aria-label="Locked" />}
                  {shown?.label ?? <span className="text-muted-foreground">—</span>}
                  {moved && <span className="ml-1 text-muted-foreground">(was {a!.label})</span>}
                </td>
                <td className={cn("w-14 py-1 text-right font-mono", toneClass(shown?.runs))}>{signed(shown?.runs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
