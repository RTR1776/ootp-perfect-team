import {
  CandlestickChart, Gauge, Globe, Hammer, ListOrdered, Medal, Search, Trophy, Upload, Wind,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line for the tooltip and the mobile drawer. */
  hint: string;
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
      { href: "/ptcs", label: "PTCS", icon: Medal, hint: "Qualifying points, pace and berth lines" },
    ],
  },
  {
    label: "Scout",
    items: [
      { href: "/cards", label: "Cards", icon: Search, hint: "One card's projection and every series it played" },
      { href: "/played", label: "Played", icon: ListOrdered, hint: "Every card with tournament play, ranked by runs" },
      { href: "/market", label: "Market", icon: CandlestickChart, hint: "Prices, value per PP and movers" },
    ],
  },
  {
    label: "League",
    items: [
      { href: "/league", label: "League", icon: Trophy, hint: "Card lines from the league exports" },
      { href: "/meta", label: "League Meta", icon: Globe, hint: "How the league's teams are built" },
    ],
  },
  {
    label: "Environment",
    items: [
      { href: "/runenv", label: "Run Environment", icon: Gauge, hint: "Era + park: which ratings pay" },
      { href: "/environments", label: "Environments", icon: Wind, hint: "How each tournament plays" },
    ],
  },
  {
    label: "Data",
    items: [{ href: "/upload", label: "Upload", icon: Upload, hint: "Drop exports; see how fresh each source is" }],
  },
];

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const currentItem = (pathname: string) =>
  NAV.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
