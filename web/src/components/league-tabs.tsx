"use client";

/** The League section's tabs (L.J., 2026-10-16: one League page, not three). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/league-card", label: "My team", hint: "Lineups and staff on the league model, this week's numbers, and what a card would add" },
  { href: "/league", label: "Card lines", hint: "Every card's league line, the meta at each spot, and where your cards sit" },
  { href: "/meta", label: "Meta", hint: "How the league's teams are built, and who to study" },
];

export function LeagueTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="League" className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const on = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} title={t.hint} aria-current={on ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
