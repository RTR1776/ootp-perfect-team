/**
 * An event's rules on one line (roster-rules describeRules), wherever cards
 * are recommended. A rule that is missing or unreadable shows too, in amber
 * or red, and says so in words (a title is out of reach on a phone): the
 * 09-27 Hardware roster went wrong because nothing on screen said the event
 * allowed only two card sets.
 */
import type { RuleItem } from "@/lib/roster-rules";
import { cardTypeNames } from "@/lib/card-sets";
import { cn } from "@/lib/utils";

export function RulesStrip({
  items, onUseSets, refreshText, confirmed = [], compact = false, children,
}: {
  items: RuleItem[];
  /** "Use these sets": narrow the pool to the sets a suspect Sets item names. */
  onUseSets?: (codes: number[]) => void;
  /** The rules text as captured from the game, shown muted underneath. */
  refreshText?: string | null;
  /** L.J.'s confirmations on file (roster-rules confirmedNotes); they outrank the captured text. */
  confirmed?: string[];
  /** One plain text line (Draft, Played, Cards, Market). */
  compact?: boolean;
  /** Extra chips at the end (the data-confidence dot on Build). */
  children?: React.ReactNode;
}) {
  if (compact) {
    // One string per item: JSX text around {expressions} can lose its spaces.
    return (
      <p className="text-xs text-muted-foreground" aria-label="Event rules">
        {items.map((i, n) => (
          <span key={i.key} title={i.detail} className={cn(i.state === "suspect" && "text-warning", i.state === "unreadable" && "text-negative")}>
            {`${n > 0 ? " · " : ""}${i.label} ${i.text}`}
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
              "inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-md border px-2 py-0.5 [overflow-wrap:anywhere]",
              i.state === "set" && "border-border",
              i.state === "none" && "border-border/60 text-muted-foreground",
              i.state === "suspect" && "border-warning/60 bg-warning/10 text-warning",
              i.state === "unreadable" && "border-negative/60 bg-negative/10 text-negative",
            )}
          >
            <span className="text-muted-foreground">{i.label}</span>
            {i.key === "slots" && i.slotRows ? <SlotText item={i} /> : <span className="font-medium">{i.text}</span>}
            {i.key === "sets" && i.propose?.length && onUseSets ? (
              <button type="button" onClick={() => onUseSets(i.propose!)} title={`Narrow the pool to ${cardTypeNames(i.propose)}`} className="ml-1 rounded bg-warning/20 px-1.5 font-semibold hover:bg-warning/30">
                Use these sets
              </button>
            ) : null}
          </span>
        ))}
        {children}
      </div>
      {confirmed.map((c) => <p key={c} className="text-[11px]">On file from L.J.: {c.replace(/^(\d{4}-\d{2}-\d{2}) (?:from|confirmed by) L\.J\.:\s*/, "$1: ")}</p>)}
      {refreshText && (
        <p className="text-[11px] text-muted-foreground">
          {confirmed.length ? "Captured before that (where they differ, the line above holds)" : "Rules as captured"}: {refreshText}
        </p>
      )}
    </div>
  );
}

/** "G 13/13 · I 13/13", with cards that have no slot left in red. */
function SlotText({ item }: { item: RuleItem }) {
  const over = Object.entries(item.unplaced ?? {});
  return (
    <span className="font-medium [font-variant-numeric:tabular-nums]">
      {item.slotRows!.map((r, n) => (
        <span key={r.tier}>{n > 0 && " · "}{r.tier} {r.used}/{r.room}</span>
      ))}
      {over.map(([t, k]) => (
        <span key={t} className="text-negative" title={`${k} card${k === 1 ? "" : "s"} at this tier with no slot left at it or above`}> · {t} +{k} no slot</span>
      ))}
    </span>
  );
}
