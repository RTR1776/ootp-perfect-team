/** Small pieces the Card Model's panels share. */
import { tone } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Colour for runs against the league's average bat; a value that prints as 0.0 takes none. */
export const toneClass = (x: number | null | undefined) => {
  const t = tone(x, 1);
  return t === "positive" ? "text-positive" : t === "negative" ? "text-negative" : "";
};

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</span>
);

export const NativeSelect = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn("h-9 rounded-md border border-border bg-background px-2 text-sm", className)} />
);

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
