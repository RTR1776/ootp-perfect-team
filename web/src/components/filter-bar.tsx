"use client";

/**
 * A page's filters (UI plan G4). From md everything sits inline. On a phone
 * only the primary controls show (the kind switch and search); the rest open
 * from "Filters · n" in a bottom sheet, so the table's first rows stay on the
 * first screen. Active filters are listed as removable chips with "Clear".
 * The sheet takes the focus when it opens and gives it back to the button
 * when it closes (Escape, the scrim or ×).
 */
import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActiveFilter { key: string; label: string; clear: () => void }

export function FilterBar({ primary, active = [], onClearAll, children }: {
  /** Always visible: the kind switch and the search box. */
  primary: React.ReactNode;
  /** Filters in effect, as removable chips. */
  active?: ActiveFilter[];
  onClearAll?: () => void;
  /** The secondary filters. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const opener = React.useRef<HTMLButtonElement>(null);
  const closer = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const back = opener.current;
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      back?.focus();
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {primary}
        {children && (
          <>
            <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">{children}</div>
            <Button ref={opener} type="button" size="sm" variant="outline" className="md:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
              <SlidersHorizontal aria-hidden />
              {`Filters${active.length ? ` · ${active.length}` : ""}`}
            </Button>
          </>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {active.map((f) => (
            <button key={f.key} type="button" onClick={f.clear} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:bg-muted" aria-label={`Remove filter: ${f.label}`}>
              {f.label} <X className="size-3" aria-hidden />
            </button>
          ))}
          {onClearAll && <button type="button" onClick={onClearAll} className="text-muted-foreground underline">Clear filters</button>}
        </div>
      )}
      {children && (
        <div className={open ? "md:hidden" : "pointer-events-none md:hidden"} aria-hidden={!open}>
          <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            inert={!open}
            className={`fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-xl border-t border-border bg-card p-4 shadow-2xl transition-transform duration-200 ${open ? "translate-y-0" : "translate-y-full"}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Filters</span>
              <Button ref={closer} type="button" variant="ghost" size="icon" aria-label="Close filters" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <div className="flex flex-col gap-4 text-sm">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
