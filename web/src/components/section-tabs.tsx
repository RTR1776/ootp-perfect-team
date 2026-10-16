"use client";

/**
 * Tabs across the pages one sidebar entry covers (L.J., 2026-10-16: fold the
 * overlapping pages together): League, Cards, Needs, Environments. Each tab is
 * its own page, so links and the back button keep working.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab { href: string; label: string; hint: string }

const SECTIONS = {
  league: [
    { href: "/league-card", label: "My team", hint: "Lineups and staff on the league model, this week's numbers, and what a card would add" },
    { href: "/league", label: "Card lines", hint: "Every card's league line, the meta at each spot, and where your cards sit" },
    { href: "/meta", label: "Meta", hint: "How the league's teams are built, and who to study" },
  ],
  cards: [
    { href: "/cards", label: "Look up · New", hint: "New cards and where each fits for you; any card's projection and play" },
    { href: "/played", label: "Leaderboard", hint: "Every card with tournament play, ranked by runs" },
  ],
  needs: [
    { href: "/needs", label: "Needs", hint: "Where your cards are weakest by tier and spot, and what to buy at what price" },
    { href: "/eras", label: "By era", hint: "Your cards against the best in each of five eras" },
  ],
  environments: [
    { href: "/environments", label: "Events", hint: "How each tournament plays, and which are alike" },
    { href: "/runenv", label: "Era + park", hint: "Pick an era and a park: which ratings pay" },
  ],
} satisfies Record<string, SectionTab[]>;

/** Named by key: a server page can't read this client module's objects. */
export type Section = keyof typeof SECTIONS;

export function SectionTabs({ section }: { section: Section }) {
  const pathname = usePathname();
  const tabs: SectionTab[] = SECTIONS[section];
  return (
    <nav aria-label="Section" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
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
