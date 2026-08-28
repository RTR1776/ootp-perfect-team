"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Hammer,
  Upload,
  Globe,
  CandlestickChart,
  Medal,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/ptcs", label: "PTCS", icon: Medal },
  { href: "/meta", label: "League Meta", icon: Globe },
  { href: "/market", label: "Market", icon: CandlestickChart },
  { href: "/environments", label: "Environments", icon: Wind },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-card/40 backdrop-blur">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm">
          PT
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">PT Optimizer</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Perfect Team
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-4">
        <div className="label-eyebrow px-2 pb-2">Workspace</div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-4 text-[11px] text-muted-foreground">
        v2 empirical engine · evidence-blended
      </div>
    </aside>
  );
}
