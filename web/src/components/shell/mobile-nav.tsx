"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { NavList } from "@/components/sidebar";
import { Button } from "@/components/ui/button";

/** Slide-in drawer for phones and narrow windows. Escape or the scrim closes it. */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className={open ? "lg:hidden" : "pointer-events-none lg:hidden"} aria-hidden={!open}>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Brand />
          <Button variant="ghost" size="icon" aria-label="Close menu" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div aria-hidden className="stitch-rule mx-4" />
        <div className="flex-1 overflow-y-auto">
          <NavList onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}
