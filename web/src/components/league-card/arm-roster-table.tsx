/**
 * The team's pitchers (UI plan §5 D): where the staff puts each one now, his
 * edge per 9 as a starter and as a reliever, and against each side. The
 * rotation comes first, then the pen; × takes an arm off the staff.
 */
import { X } from "lucide-react";
import { nameOf, STARTER_STAMINA } from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { per9, toneClass } from "./bits";
import type { ScoreResult } from "./use-rescore";

/** Edge per 9 in a column: toned when it's from league play, grey when it's an estimate from ratings. */
const Edge = ({ x, estimate = false }: { x: number | null | undefined; estimate?: boolean }) => (
  <span className={estimate ? "text-muted-foreground" : toneClass(x, 2)}>{per9(x)}</span>
);

export function ArmRosterTable({ arms, result, onRemove }: {
  arms: string[];
  result: ScoreResult | null;
  /** Take an arm off the staff (the panel says so, with Undo). */
  onRemove: (entry: string) => void;
}) {
  const pool = new Map((result?.armPool ?? []).map((a) => [a.entry, a]));
  const staff = result?.staff;
  const at = new Map([...(staff?.rotation ?? []), ...(staff?.bullpen ?? [])].map((s, i) => [s.entry, { slot: s.slot, order: i }]));
  const sitting = new Set((staff?.out ?? []).map((o) => o.entry));
  // Rotation, then the pen, then anyone who sits; an arm not scored yet goes last.
  const rank = (e: string) => at.get(e)?.order ?? (sitting.has(e) ? 900 : 1000);
  const rows = [...arms].sort((a, b) => rank(a) - rank(b));
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
          <th className="py-1 font-medium">Pitcher</th>
          <th className="w-10 py-1 font-medium" title="Where the staff puts him now">Now</th>
          <th className="w-14 py-1 text-right font-medium" title="Edge per 9 innings as a starter; grey is an estimate from ratings">as SP /9</th>
          <th className="w-14 py-1 text-right font-medium" title="Edge per 9 innings as a reliever; grey is an estimate from ratings">as RP /9</th>
          <th className="hidden w-14 py-1 text-right font-medium sm:table-cell" title="League edge per 9 against left-handed batters">vs LHB</th>
          <th className="hidden w-14 py-1 text-right font-medium sm:table-cell" title="League edge per 9 against right-handed batters">vs RHB</th>
          <th className="w-8 py-1"><span className="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const a = pool.get(e);
          const cantStart = a?.stamina != null && a.stamina <= STARTER_STAMINA;
          return (
            <tr key={e} className={cn("border-b border-border/50 align-middle", sitting.has(e) && "text-muted-foreground")}>
              <td className="py-0.5 pr-2">{a?.label ?? nameOf(e)}</td>
              <td className="py-0.5 font-mono text-muted-foreground">{at.get(e)?.slot ?? (sitting.has(e) ? "Sits" : "—")}</td>
              <td className="py-0.5 text-right font-mono">
                {cantStart
                  ? <span className="text-muted-foreground" title={`Stamina ${a.stamina}: can't start`}>—</span>
                  : <Edge x={a?.sp} estimate={a?.spSource === "estimate"} />}
              </td>
              <td className="py-0.5 text-right font-mono"><Edge x={a?.rp} estimate={a?.rpSource === "estimate"} /></td>
              <td className="hidden py-0.5 text-right font-mono sm:table-cell"><Edge x={a?.vL} /></td>
              <td className="hidden py-0.5 text-right font-mono sm:table-cell"><Edge x={a?.vR} /></td>
              <td className="py-0.5 text-right">
                <button
                  onClick={() => onRemove(e)} aria-label={`Remove ${nameOf(e)}`}
                  className="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-negative sm:size-7"
                >
                  <X className="size-3.5" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
