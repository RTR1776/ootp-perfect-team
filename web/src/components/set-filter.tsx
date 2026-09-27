/**
 * Card-set chips: which of the ten sets the pool may draw from. When the
 * event has a set rule, the sets outside it are disabled; when it has none,
 * this is how L.J. keeps the pool to the sets the game allows in two clicks.
 * No chip selected means every set.
 */
import { CARD_TYPES, CARD_TYPE_NAME, CARD_TYPE_SHORT } from "@/lib/card-sets";
import { cn } from "@/lib/utils";

export function SetFilter({
  value, onChange, allowed, counts,
}: {
  /** Selected sets; empty = all. */
  value: number[];
  onChange: (next: number[]) => void;
  /** The event's set rule, when it has one. */
  allowed: number[] | null;
  /** Cards per set in the pool, to show which sets are there at all. */
  counts?: Record<number, number>;
}) {
  const on = new Set(value);
  const toggle = (t: number) => {
    const next = new Set(on);
    if (next.has(t)) next.delete(t); else next.add(t);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Card sets">
      <span className="mr-0.5 text-[11px] text-muted-foreground">Sets</span>
      {CARD_TYPES.map((t) => {
        const barred = allowed != null && !allowed.includes(t);
        const n = counts?.[t] ?? null;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on.has(t)}
            disabled={barred}
            onClick={() => toggle(t)}
            title={`${CARD_TYPE_NAME[t]}${barred ? " — not allowed in this event" : n != null ? ` — ${n} in your pool` : ""}`}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              on.has(t) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              barred && "cursor-not-allowed opacity-35 line-through hover:text-muted-foreground",
              !barred && n === 0 && !on.has(t) && "opacity-60",
            )}
          >
            {CARD_TYPE_SHORT[t]}
          </button>
        );
      })}
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="ml-1 text-[11px] text-muted-foreground underline">
          all sets
        </button>
      )}
    </div>
  );
}
