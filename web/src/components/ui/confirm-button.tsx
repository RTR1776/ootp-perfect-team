"use client";

/**
 * A button that asks once, inline, before doing something that can't be taken
 * back: "Reset team and clear 2 locks? Confirm / Cancel". It cancels itself
 * after five seconds, so a stray click never arms it for later.
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

export function ConfirmButton({
  onConfirm, prompt, confirmLabel = "Confirm", cancelLabel = "Cancel", timeoutMs = 5000,
  children, className, size = "sm", variant = "outline", disabled, ...rest
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(t);
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
      <Button
        type="button"
        size={size}
        variant="default"
        autoFocus
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" size={size} variant="ghost" onClick={() => setArmed(false)}>{cancelLabel}</Button>
    </span>
  );
}
