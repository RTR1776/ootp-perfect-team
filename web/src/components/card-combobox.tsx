"use client";

/**
 * Card search (UI plan C9): type any part of a name and pick from the best
 * eight matches, owned cards first and marked "owned" (or "VAR" for an owned
 * variant). ↑/↓ move, Enter picks, Esc closes; no match says so. The ARIA 1.2
 * combobox pattern: the focus stays in the input and the list names the
 * active row. Matching and ranking are lib/card-search.
 */
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cardIndex, matchCards, type SearchCard } from "@/lib/card-search";
import { cn } from "@/lib/utils";

export interface ComboCard extends SearchCard { id: number }

export function CardCombobox<T extends ComboCard>({
  id, options, onPick, selected = "", keepPick = false, noun = "card", placeholder = "Start typing a name…", note, className,
}: {
  /** The input's id, for its <label htmlFor>. */
  id: string;
  options: T[];
  onPick: (card: T) => void;
  /** The label of the card already picked: the box shows it, and goes back to it when left without a pick. */
  selected?: string;
  /** After a pick, show its label (Card) instead of clearing for the next one (Add a player). */
  keepPick?: boolean;
  /** "No player matches …". */
  noun?: string;
  placeholder?: string;
  /** A muted note on a row, e.g. "on team". */
  note?: (card: T) => string | null;
  className?: string;
}) {
  const index = React.useMemo(() => cardIndex(options), [options]);
  const [text, setText] = React.useState(selected);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const matches = React.useMemo(() => matchCards(index, text), [index, text]);
  const shown = open && text.trim() !== "";
  const listId = `${id}-list`;
  const rowId = (i: number) => `${id}-row-${i}`;

  const pick = (card: T) => {
    onPick(card);
    setText(keepPick ? card.label : "");
    setOpen(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown) { setOpen(true); setActive(0); return; }
      const n = matches.length;
      if (n) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      if (!shown || !matches.length) return;
      e.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && matches.length ? rowId(Math.min(active, matches.length - 1)) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }}
        onFocus={(e) => { if (keepPick) e.currentTarget.select(); }}
        onBlur={() => { setOpen(false); if (keepPick) setText(selected); }}
        onKeyDown={onKeyDown}
      />
      {shown && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {matches.length ? (
            <ul role="listbox" id={listId} aria-label="Matching cards" className="py-1">
              {matches.map((card, i) => {
                const extra = note?.(card);
                return (
                  <li
                    key={card.id}
                    id={rowId(i)}
                    role="option"
                    aria-selected={i === active}
                    // Keep the focus in the input, so the pick lands before its blur closes the list.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(card)}
                    onMouseMove={() => { if (i !== active) setActive(i); }}
                    className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm", i === active && "bg-accent text-accent-foreground")}
                  >
                    <span className="min-w-0 flex-1 truncate">{card.label}</span>
                    {extra && <span className="shrink-0 text-xs text-muted-foreground">{extra}</span>}
                    {card.owned && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 text-[11px] font-semibold text-primary" title={card.owned === "variant" ? "You own the variant" : "You own it"}>
                        {card.owned === "variant" ? "VAR" : "owned"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p id={listId} role="status" className="px-3 py-2 text-sm text-muted-foreground">{`No ${noun} matches "${text.trim()}"`}</p>
          )}
        </div>
      )}
    </div>
  );
}
