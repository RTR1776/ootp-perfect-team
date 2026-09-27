"use client";

/**
 * Toasts: feedback that appears where L.J. is looking (UI plan principle 5),
 * in one fixed corner instead of a line at the bottom of a long column.
 *
 *   toast({ message: "Removed Mel Ott", action: { label: "Undo", onClick: undo } })
 *
 * Info closes after 6 s, a toast with an action after 9 s; an error stays
 * until it is closed. `<Toaster />` sits once in the root layout; `toast()`
 * works from any client code, no provider needed.
 */
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastInput {
  message: string;
  tone?: "info" | "success" | "error";
  action?: { label: string; onClick: () => void };
  /** Milliseconds; 0 keeps it until closed. */
  duration?: number;
}
interface ToastItem extends ToastInput { id: number }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const EMPTY: ToastItem[] = [];

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Show a toast; returns its id. At most four stay on screen, newest last. */
export function toast(input: ToastInput): number {
  const id = nextId++;
  const duration = input.duration ?? (input.tone === "error" ? 0 : input.action ? 9000 : 6000);
  items = [...items.slice(-3), { ...input, id }];
  emit();
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:max-w-sm"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg",
            t.tone === "error" ? "border-negative/60" : t.tone === "success" ? "border-positive/50" : "border-border",
          )}
        >
          <span className={cn("min-w-0 flex-1 [overflow-wrap:anywhere]", t.tone === "error" && "text-negative")}>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded px-1.5 py-0.5 text-sm font-semibold text-primary hover:bg-primary/10"
              onClick={() => { t.action!.onClick(); dismissToast(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Close" className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" onClick={() => dismissToast(t.id)}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
