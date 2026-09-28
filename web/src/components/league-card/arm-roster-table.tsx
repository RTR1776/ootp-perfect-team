/**
 * The team's pitchers (UI plan §5 D), in the same shape as the hitters'
 * table: where the staff puts each one now, his edge per 9 as a starter and
 * as a reliever, and against each side. The rotation and then the pen in slot
 * order, then the arms who sit greyed under "Sits (n)" (past the staff's
 * size). × takes an arm off the staff. On a phone "Now" moves under the name.
 */
import { nameOf, STARTER_STAMINA } from "@/lib/league-card-state";
import { armRows } from "@/lib/league-card-view";
import { cn } from "@/lib/utils";
import { per9, toneClass } from "./bits";
import { RemoveButton } from "./roster-table";
import type { ArmRow, ScoreResult } from "./use-rescore";

/** Edge per 9 in a column: toned when it's from league play, grey when it's an estimate from ratings. */
const Edge = ({ x, estimate = false, quiet = false }: { x: number | null | undefined; estimate?: boolean; quiet?: boolean }) => (
  <span className={estimate || quiet ? "text-muted-foreground" : toneClass(x, 2)}>{per9(x)}</span>
);

export function ArmRosterTable({ arms, result, onRemove }: {
  arms: string[];
  result: ScoreResult | null;
  /** Take an arm off the staff (the panel says so, with Undo). */
  onRemove: (entry: string) => void;
}) {
  const { pitching, sits, waiting } = armRows(arms, result?.armPool ?? [], result?.staff);
  const row = (entry: string, now: string, a: ArmRow | undefined, sitting: boolean) => {
    const cantStart = a?.stamina != null && a.stamina <= STARTER_STAMINA;
    return (
      <tr key={entry} className={cn("border-b border-border/50 align-middle", sitting && "text-muted-foreground")}>
        <td className="py-0.5 pr-2">
          <div className="truncate">{a?.label ?? nameOf(entry)}</div>
          <div className="font-mono text-[11px] text-muted-foreground @md:hidden">{now}</div>
        </td>
        <td className="hidden py-0.5 font-mono text-muted-foreground @md:table-cell">{now}</td>
        <td className="py-0.5 text-right font-mono">
          {cantStart
            ? <span className="text-muted-foreground" title={`Stamina ${a.stamina}: can't start`}>—</span>
            : <Edge x={a?.sp} estimate={a?.spSource === "estimate"} quiet={sitting} />}
        </td>
        <td className="py-0.5 text-right font-mono"><Edge x={a?.rp} estimate={a?.rpSource === "estimate"} quiet={sitting} /></td>
        {/* Context only: raw, every league pooled; muted so they don't read like the scored columns. */}
        <td className="hidden py-0.5 text-right font-mono text-muted-foreground @lg:table-cell">{per9(a?.vL)}</td>
        <td className="hidden py-0.5 text-right font-mono text-muted-foreground @lg:table-cell">{per9(a?.vR)}</td>
        <td className="py-0.5 text-right"><RemoveButton name={nameOf(entry)} onClick={() => onRemove(entry)} /></td>
      </tr>
    );
  };
  return (
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
          <th className="py-1 font-medium">Pitcher</th>
          <th className="hidden w-12 py-1 font-medium @md:table-cell" title="Where the staff puts him now">Now</th>
          <th className="w-16 py-1 text-right font-medium" title="Edge per 9 innings as a starter; grey is an estimate from ratings">as SP /9</th>
          <th className="w-16 py-1 text-right font-medium" title="Edge per 9 innings as a reliever; grey is an estimate from ratings">as RP /9</th>
          <th className="hidden w-16 py-1 text-right font-medium @lg:table-cell" title="Against left-handed batters: edge per 9 as pitched, every league pooled. Not scaled to your league and not used in any score.">vs LHB</th>
          <th className="hidden w-16 py-1 text-right font-medium @lg:table-cell" title="Against right-handed batters: edge per 9 as pitched, every league pooled. Not scaled to your league and not used in any score.">vs RHB</th>
          <th className="w-9 py-1"><span className="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody>
        {pitching.map((x) => row(x.entry, x.slot, x.arm, false))}
        {sits.length > 0 && (
          <tr>
            {/* Four columns show on a phone; a wider span would add an empty column to the fixed layout. */}
            <th scope="rowgroup" colSpan={4} className="pb-0.5 pt-2.5 text-left text-[11px] font-medium text-muted-foreground" title="Past the staff's size: they don't pitch">{`Sits (${sits.length})`}</th>
          </tr>
        )}
        {sits.map((x) => row(x.entry, "Sits", x.arm, true))}
        {waiting.map((e) => row(e, "—", undefined, false))}
      </tbody>
    </table>
  );
}
