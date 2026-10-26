import {
  CandlestickChart, Crosshair, Hammer, LayoutGrid, Medal, Search, Trophy, Upload, Wind,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line for the tooltip and the mobile drawer. */
  hint: string;
  /** Other pages that sit under this entry (its tabs). */
  also?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Grouped by the job you're doing, in the order a week usually runs. */
export const NAV: NavGroup[] = [
  {
    label: "Play",
    items: [
      { href: "/build", label: "Build", icon: Hammer, hint: "Roster for an event, scored in its era and park" },
      { href: "/ptcs", label: "PTCS", icon: Medal, hint: "Qualifying points and pace; PTMS and PTWC standing", also: ["/qualifying"] },
      { href: "/draft/live", label: "Draft", icon: LayoutGrid, hint: "Live drafts: each pick's best card with the rounds left priced in; the board by position", also: ["/draft"] },
    ],
  },
  {
    label: "Scout",
    items: [
      { href: "/needs", label: "Needs", icon: Crosshair, hint: "Where your cards are weakest by tier and spot, and what to buy at what price", also: ["/eras"] },
      { href: "/cards", label: "Cards", icon: Search, hint: "New cards and where each one fits for you; any card's projection, play and the leaderboard", also: ["/played"] },
      { href: "/market", label: "Market", icon: CandlestickChart, hint: "Prices, value per PP, movers and sell candidates" },
    ],
  },
  {
    label: "League",
    items: [
      // One entry, three tabs (L.J. 10-16): My team (lineups, this week), Card lines, Meta.
      { href: "/league-card", label: "League", icon: Trophy, hint: "Your league lineups and staff, this week's numbers, card lines and the meta", also: ["/league", "/meta"] },
    ],
  },
  {
    label: "Environment",
    items: [
      { href: "/environments", label: "Environments", icon: Wind, hint: "How each tournament plays; pick an era and a park to see which ratings pay", also: ["/runenv"] },
    ],
  },
  {
    label: "Data",
    items: [{ href: "/upload", label: "Upload", icon: Upload, hint: "Drop exports; see how fresh each source is" }],
  },
];

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** The entry a page belongs to: its own, or the one whose tabs include it. */
export const itemActive = (pathname: string, item: Pick<NavItem, "href" | "also">) =>
  isActive(pathname, item.href) || (item.also ?? []).some((h) => isActive(pathname, h));

export const currentItem = (pathname: string) =>
  NAV.flatMap((g) => g.items).find((i) => itemActive(pathname, i));
