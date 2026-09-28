"use client";

/**
 * A few choices of which exactly one is on (UI plan G4): League PEL | HD | LD,
 * a pitcher's Best | Starter | Reliever. The ARIA radio group pattern: arrow
 * keys (and Home/End) move the choice, and only the chosen option is a tab
 * stop. One active style everywhere.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export function Segmented<T extends string>({ options, value, onChange, size = "sm", className, ...aria }: {
  options: Array<SegmentedOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const chosen = options.findIndex((o) => o.value === value);
  // The one tab stop: the chosen option, else the first that can be chosen.
  const stop = chosen >= 0 && !options[chosen].disabled ? chosen : enabled[0] ?? -1;

  const move = (e: React.KeyboardEvent, i: number) => {
    const at = enabled.indexOf(i);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = e.key === "Home" ? enabled[0] : e.key === "End" ? enabled[enabled.length - 1] : step && at >= 0 ? enabled[(at + step + enabled.length) % enabled.length] : undefined;
    if (to == null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    if (to !== chosen) onChange(options[to].value);
  };

  return (
    <div role="radiogroup" {...aria} className={cn("inline-flex items-center gap-0.5 rounded-md border border-border p-0.5", className)}>
      {options.map((o, i) => {
        const on = i === chosen;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === stop ? 0 : -1}
            disabled={o.disabled}
            title={o.title}
            onClick={() => { if (!on) onChange(o.value); }}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
              on ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
