"use client";

/**
 * A button that asks once, inline, before doing something that can't be taken
 * back: "Reset team and clear 2 locks? Cancel / Confirm". It cancels itself
 * after five seconds, so a stray click never arms it for later. The confirm
 * button ignores clicks for its first half second, so a double tap (or a
 * second tap because the first seemed to do nothing) can't land on it, wherever
 * the layout puts it; the safe choice comes first and takes the focus.
 */
import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  onConfirm: () => void | Promise<void>;
  /** The question shown while armed, e.g. "Remove this result?". */
  prompt?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Milliseconds before an armed button disarms itself. */
  timeoutMs?: number;
}

/** Longer than a double tap. */
const ARM_DELAY_MS = 500;

export function ConfirmButton({
  onConfirm, prompt, confirmLabel = "Confirm", cancelLabel = "Cancel", timeoutMs = 5000,
  children, className, size = "sm", variant = "outline", disabled, ...rest
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    const r = setTimeout(() => setReady(true), ARM_DELAY_MS);
    return () => { clearTimeout(t); clearTimeout(r); setReady(false); };
  }, [armed, timeoutMs]);

  if (!armed) {
    return (
      <Button type="button" size={size} variant={variant} className={className} disabled={disabled || busy} onClick={() => setArmed(true)} {...rest}>
        {children}
      </Button>
    );
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={prompt ?? "Confirm"}>
      {prompt && <span className="text-xs text-muted-foreground">{prompt}</span>}
      <Button type="button" size={size} variant="ghost" autoFocus onClick={() => setArmed(false)}>{cancelLabel}</Button>
      <Button
        type="button"
        size={size}
        variant="default"
        disabled={busy || !ready}
        onClick={async () => {
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
        }}
      >
        {confirmLabel}
      </Button>
    </span>
  );
}
