"use client";

/**
 * A page section (UI plan G4): a title, one line saying what it answers, the
 * method behind a small "How this works", optional actions, and optionally
 * collapsible with its open state remembered per page.
 */
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};
const readOpen = (key: string): boolean | null => {
  try { const v = localStorage.getItem(key); return v == null ? null : v === "1"; } catch { return null; }
};

export function Section({
  id, title, summary, help, actions, collapsible = false, defaultOpen = true, className, children,
}: {
  id: string;
  title: string;
  /** One line, 14 words or fewer: what this section answers. */
  summary?: React.ReactNode;
  /** The method, behind "How this works". */
  help?: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const key = `section:${pathname}:${id}`;
  const stored = useSyncExternalStore(noSubscribe, () => (collapsible ? readOpen(key) : null), () => null);
  const [picked, setPicked] = useState<boolean | null>(null);
  const open = !collapsible || (picked ?? stored ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setPicked(next);
    try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* storage unavailable */ }
  };
  return (
    <section id={id} className={cn("rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {collapsible ? (
            <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`${id}-body`} className="flex items-center gap-1.5 text-left text-base font-semibold">
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden />
              {title}
            </button>
          ) : (
            <h2 className="text-base font-semibold">{title}</h2>
          )}
          {summary && <p className="truncate text-sm text-muted-foreground">{summary}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {open && (
        <div id={`${id}-body`} className="mt-3">
          {children}
          {help && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">How this works</summary>
              <div className="mt-1.5 space-y-1.5">{help}</div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
