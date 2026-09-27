/**
 * An event's rules on one line (roster-rules describeRules), wherever cards
 * are recommended. A rule that is missing or unreadable shows too, in amber
 * or red: the 09-27 Hardware roster went wrong because nothing on screen said
 * the event allowed only two card sets.
 */
import type { RuleItem } from "@/lib/roster-rules";
import { TIER_ORDER } from "@/lib/roster-rules";
import { cn } from "@/lib/utils";

export function RulesStrip({
  items, onUseSets, useSets, refreshText, compact = false, children,
}: {
  items: RuleItem[];
  /** "Use these sets": filter the pool to what the field plays, when no set rule is on file. */
  onUseSets?: () => void;
  useSets?: string;
  /** The rules text as captured from the game, shown muted underneath. */
  refreshText?: string | null;
  /** One plain text line (Draft, Played, Cards, Market). */
  compact?: boolean;
  /** Extra chips at the end (the data-confidence dot on Build). */
  children?: React.ReactNode;
}) {
  if (compact) {
    return (
      <p className="text-xs text-muted-foreground">
        {items.map((i, n) => (
          <span key={i.key} title={i.detail} className={cn(i.state === "suspect" && "text-warning", i.state === "unreadable" && "text-negative")}>
            {n > 0 && " · "}{i.label} {i.text}
          </span>
        ))}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Event rules">
        {items.map((i) => (
          <span
            key={i.key}
            title={i.detail}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
              i.state === "set" && "border-border",
              i.state === "none" && "border-border/60 text-muted-foreground",
              i.state === "suspect" && "border-warning/60 bg-warning/10 text-warning",
              i.state === "unreadable" && "border-negative/60 bg-negative/10 text-negative",
            )}
          >
            <span className="text-muted-foreground">{i.label}</span>
            {i.key === "slots" && i.used ? <SlotText item={i} /> : <span className="font-medium">{i.text}</span>}
            {i.key === "sets" && i.state === "suspect" && onUseSets && (
              <button type="button" onClick={onUseSets} className="ml-1 rounded bg-warning/20 px-1.5 font-semibold hover:bg-warning/30">
                {useSets ?? "Use these sets"}
              </button>
            )}
          </span>
        ))}
        {children}
      </div>
      {refreshText && <p className="text-[11px] text-muted-foreground">Rules as captured: {refreshText}</p>}
    </div>
  );
}

/** "P 8/8 · D 6/6 …", the first overflowing tier in red. */
function SlotText({ item }: { item: RuleItem }) {
  const parts = item.text.split(" · ");
  const tiers = [...TIER_ORDER].reverse();
  return (
    <span className="font-medium [font-variant-numeric:tabular-nums]">
      {parts.map((p, n) => {
        const t = tiers.find((x) => p.startsWith(`${x} `));
        return (
          <span key={p} className={cn(t && t === item.over && "text-negative")} title={t && t === item.over ? "Too many cards at this tier or better" : undefined}>
            {n > 0 && " · "}{p}
          </span>
        );
      })}
    </span>
  );
}
