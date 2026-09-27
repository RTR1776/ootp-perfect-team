/**
 * The team's hitters (UI plan C6): each bat per board and where the lineups
 * play him ("C vs R · DH vs L"), starters first, then the bench greyed under
 * "Bench (n)". The bench is only where today's best nine leave a player
 * (Brandon Wood sits on both boards and is still the planned utility glove).
 * × takes a hitter off the team. On a phone "Plays" moves under the name.
 */
import { X } from "lucide-react";
import { signed } from "@/lib/format";
import { nameOf } from "@/lib/league-card-state";
import { rosterRows, type RosterRow } from "@/lib/league-card-view";
import { cn } from "@/lib/utils";
import { toneClass } from "./bits";
import type { ScoreResult } from "./use-rescore";

const BAT_ONLY = "Bat only; lineup numbers add the glove at the slot.";

export function RemoveButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={`Remove ${name}`} title={`Remove ${name}`}
      className="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-negative"
    >
      <X className="size-3.5" />
    </button>
  );
}

export function RosterTable({ bats, result, onRemove }: {
  bats: string[];
  result: ScoreResult | null;
  /** Take a hitter off the team (the panel says so, with Undo). */
  onRemove: (entry: string) => void;
}) {
  const { starters, bench, waiting } = rosterRows(bats, result?.pool ?? [], result?.now, result?.lhp ?? 0.5);
  const row = (r: RosterRow, benched: boolean) => (
    <tr key={r.entry} className={cn("border-b border-border/50 align-middle", benched && "text-muted-foreground")}>
      <td className="py-0.5 pr-2">
        <div className="truncate">{r.label}</div>
        {!benched && <div className="truncate text-[11px] text-muted-foreground @lg:hidden">{r.plays}</div>}
      </td>
      <td className={cn("py-0.5 text-right font-mono", !benched && toneClass(r.vR))}>{signed(r.vR)}</td>
      <td className={cn("py-0.5 text-right font-mono", !benched && toneClass(r.vL))}>{signed(r.vL)}</td>
      <td className="hidden truncate py-0.5 pl-4 @lg:table-cell">{r.plays}</td>
      <td className="py-0.5 text-right"><RemoveButton name={nameOf(r.entry)} onClick={() => onRemove(r.entry)} /></td>
    </tr>
  );
  return (
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
          <th className="py-1 font-medium">Hitter</th>
          <th className="w-14 py-1 text-right font-medium @lg:w-20" title={BAT_ONLY}><span className="@lg:hidden">vs RHP</span><span className="hidden @lg:inline">Bat vs RHP</span></th>
          <th className="w-14 py-1 text-right font-medium @lg:w-20" title={BAT_ONLY}><span className="@lg:hidden">vs LHP</span><span className="hidden @lg:inline">Bat vs LHP</span></th>
          <th className="hidden w-40 py-1 pl-4 font-medium @lg:table-cell" title="Where today's best nine play him">Plays</th>
          <th className="w-9 py-1"><span className="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody>
        {starters.map((r) => row(r, false))}
        {bench.length > 0 && (
          <tr>
            {/* Four columns show on a phone; a wider span would add an empty column to the fixed layout. */}
            <th scope="rowgroup" colSpan={4} className="pb-0.5 pt-2.5 text-left text-[11px] font-medium text-muted-foreground">{`Bench (${bench.length})`}</th>
          </tr>
        )}
        {bench.map((r) => row(r, true))}
        {waiting.map((r) => row(r, false))}
      </tbody>
    </table>
  );
}
