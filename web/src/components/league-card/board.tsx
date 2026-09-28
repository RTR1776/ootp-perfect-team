/**
 * One board's best nine (vs RHP or vs LHP), one row per slot (UI plan C5):
 * the slot, one select that shows who plays there and locks a player in, a
 * 24px × that unlocks it, and the slot's runs. The select offers only the
 * players who can play the slot ("Scott Rolen · 3B 137"; anyone at DH); its
 * empty choice reads "Auto · Ed Bailey 97 VAR", the player the solve put
 * there. With a modelled card included, the rows show the lineup with it, a
 * slot it changes says "was …", and a Δ column shows each slot's change. A
 * lock that can't make a legal nine gets a red note; the server shows the
 * best nine without it.
 */
import { Loader2, Lock, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { signed } from "@/lib/format";
import { BOARD_NAME, nameOf, SLOTS, type Board as BoardKey } from "@/lib/league-card-state";
import { boardTitle, lockOptions, type PoolRow } from "@/lib/league-card-view";
import { cn } from "@/lib/utils";
import { toneClass } from "./bits";
import type { Lineup } from "./use-rescore";

export interface BadLock { board: BoardKey; slot: string; entry: string | null }

/** "Total +49.7", and with a modelled card "→ +51.0". */
export function BoardTotal({ now, next, pending, stale }: { now: number | null | undefined; next: number | null | undefined; pending: boolean; stale: boolean }) {
  return (
    <span className="flex items-baseline gap-2 text-xs">
      {pending && (
        <span className="inline-flex items-center gap-1 self-center text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />Updating…
        </span>
      )}
      <span className={cn("whitespace-nowrap text-muted-foreground", stale && "opacity-60")}>
        {"Total "}<span className="font-mono text-foreground">{signed(now)}</span>
        {next != null && <>{" → "}<span className={cn("font-mono", toneClass(next - (now ?? 0)))}>{signed(next)}</span></>}
      </span>
    </span>
  );
}

export function Board({ board, lhp, showTitle = true, bats, pool, locks, now, next, bad, pending, stale, onLock, onSelectKeys }: {
  board: BoardKey;
  /** The league's share of PA against LHP, for the title's weight; null before the first score. */
  lhp: number | null;
  /** In the phone tabs the tab names the board, so the board doesn't. */
  showTitle?: boolean;
  bats: string[];
  /** Each hitter's bat and glove ratings, for the lock menus. */
  pool: PoolRow[];
  locks: Record<string, string>;
  now: Lineup | null | undefined;
  /** The lineup with the modelled card, when one is included. */
  next: Lineup | null | undefined;
  /** This board's locks the server had to leave out. */
  bad: BadLock[];
  pending: boolean;
  /** The lineups shown are from before the latest edit (pending, skipped or failed): dimmed. */
  stale: boolean;
  /** Lock a slot to a roster entry; null unlocks it. */
  onLock: (slot: string, entry: string | null) => void;
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const at = (l: Lineup | null | undefined, slot: string) => l?.lineup.find((x) => x.slot === slot);
  const withCard = next != null;
  return (
    <div className="min-w-0">
      <div className={cn("mb-1 flex items-baseline gap-2 text-xs", showTitle ? "justify-between" : "justify-end")}>
        {showTitle && <span className="font-semibold">{boardTitle(board, lhp)}</span>}
        <BoardTotal now={now?.total} next={next?.total} pending={pending} stale={stale} />
      </div>
      <table className={cn("w-full table-fixed text-xs transition-opacity", stale && "opacity-60")} aria-busy={pending}>
        <colgroup>
          <col className="w-8" />
          <col />
          <col className="w-14" />
          {withCard && <col className="w-12" />}
        </colgroup>
        <thead className="sr-only">
          <tr><th>Slot</th><th>Player</th><th>Runs</th>{withCard && <th>Change with the card</th>}</tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => {
            const a = at(now, slot), b = at(next, slot), shown = b ?? a;
            const moved = withCard && a && b && a.label !== b.label;
            const lock = locks[slot];
            // The icon marks a lock that held: the slot's player is the one locked there.
            const held = lock != null && shown?.entry === lock;
            const dropped = lock != null && bad.some((x) => x.slot === slot && x.entry === lock);
            // The slot's change with the card; blank where it changes nothing that shows.
            const delta = a && b && Math.abs(b.runs - a.runs) >= 0.05 ? b.runs - a.runs : null;
            const note = !dropped ? null
              : bad.length > 1
                ? "Can't field a legal nine with these locks together; showing the best nine without them."
                : `Can't field a legal nine with ${nameOf(lock)} at ${slot}; showing the best nine without that lock${shown ? ` (${shown.label} plays ${slot})` : ""}.`;
            return (
              // Top-aligned, with the slot and the runs on the select's line, so a note under a select doesn't move them.
              <tr key={slot} className="border-b border-border/50 align-top">
                <td className="py-1 font-mono leading-7 text-muted-foreground">{slot}</td>
                <td className="py-1 pr-1">
                  <div className="flex min-w-0 items-center gap-1">
                    {held && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Locked" />}
                    <Select
                      value={lock ?? ""}
                      onChange={(e) => onLock(slot, e.target.value || null)}
                      onKeyDown={onSelectKeys}
                      className={cn("h-7 min-w-0 flex-1 px-1.5 text-xs", moved && "font-medium text-primary", dropped && "border-negative")}
                      aria-label={`${slot} ${BOARD_NAME[board]}: who plays there`}
                      aria-invalid={dropped || undefined}
                    >
                      <option value="">{lock ? "Auto" : `Auto · ${shown?.label ?? "—"}`}</option>
                      {lockOptions(slot, board, bats, pool, lock).map(([e, label]) => <option key={e} value={e}>{label}</option>)}
                    </Select>
                    {lock != null && (
                      <button
                        type="button" onClick={() => onLock(slot, null)} title={`Unlock ${slot}`} aria-label={`Unlock ${slot} ${BOARD_NAME[board]}`}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {moved && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{`was ${a!.label}`}</div>}
                  {note && <p className="mt-0.5 text-[11px] leading-snug text-negative">{note}</p>}
                </td>
                <td className={cn("py-1 text-right font-mono leading-7", toneClass(shown?.runs))}>{signed(shown?.runs)}</td>
                {withCard && <td className={cn("py-1 text-right font-mono leading-7", toneClass(delta))}>{delta != null ? signed(delta) : ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
