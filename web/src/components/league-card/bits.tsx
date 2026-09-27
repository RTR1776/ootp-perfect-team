/** Small pieces the Card Model's panels share. */
import { Button } from "@/components/ui/button";
import { signed, tone } from "@/lib/format";
import { nameOf } from "@/lib/league-card-state";
import { cn } from "@/lib/utils";

/** Colour for runs (or edge per 9, at 2 digits) against the league's average; a value that prints as 0 takes none. */
export const toneClass = (x: number | null | undefined, digits = 1) => {
  const t = tone(x, digits);
  return t === "positive" ? "text-positive" : t === "negative" ? "text-negative" : "";
};

/** An arm's edge per 9 innings as printed: "+0.37", "−0.31". */
export const per9 = (x: number | null | undefined) => signed(x, 2);

/** League innings: "3,306". */
export const innings = (ip: number) => Math.round(ip).toLocaleString("en-US");

/** A warning about the staff (a staff slot, or a pitcher on the list), so each tab shows its own. */
export const staffWarning = (w: string, arms: string[]) => /^(SP\d|CL|RP\d+): /.test(w) || arms.some((e) => w.startsWith(`${nameOf(e)}:`));
/** A warning about the modelled card ("Kenley Jansen 100: can't start …"): its result card says it instead. */
export const cardWarning = (w: string, label: string | null | undefined) => !!label && w.startsWith(`${label.replace(/ \(model\)$/, "")}:`);

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</span>
);

export const NativeSelect = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn("h-9 rounded-md border border-border bg-background px-2 text-sm", className)} />
);

/**
 * Why what's shown isn't for the latest edit: a half-typed year or park
 * (nothing asked yet), or a request that failed, with Retry. `shown` names
 * what is on screen: "The lineups below are".
 */
export function ScoreStatus({ skip, error, retry, shown }: { skip: string | null; error: string | null; retry: () => void; shown: string | null }) {
  return (
    <>
      {skip && <p className="text-xs text-warning">{skip}{shown ? ` ${shown} from before this edit.` : ""}</p>}
      {error && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-xs text-negative">
          <span className="min-w-0 flex-1">{error}</span>
          <Button size="sm" variant="outline" onClick={retry}>Retry</Button>
        </div>
      )}
    </>
  );
}

/**
 * Cmd/Ctrl+Z on a focused select. The page-wide keys stand aside for form
 * fields so typing keeps its own undo, but a select has none: after picking a
 * lock, Cmd/Ctrl+Z should still undo it.
 */
export const selectUndoKeys = (undo: () => void, redo: () => void) => (e: React.KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey)) { e.preventDefault(); redo(); }
};
