"use client";

/**
 * Slim top bar. The v1 global search and tournament-context switcher were
 * retired with the v1 routes (2026-08-27) — tournament context now lives
 * where it's used, in /build's picker.
 */

import { Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-medium tracking-tight text-muted-foreground">
        <Trophy className="size-4" />
        Kansas City Torrent · Perfect Team 27
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
