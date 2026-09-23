"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/shell/brand";

/** The nav list itself, shared by the desktop rail and the mobile drawer. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="label-eyebrow px-3 pb-1.5">{group.label}</div>
          {group.items.map(({ href, label, icon: Icon, hint }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={hint}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {active && (
                  <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Fixed rail on large screens; below lg the header's menu opens MobileNav. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/60 backdrop-blur lg:flex">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>
      <div aria-hidden className="stitch-rule mx-5" />
      <div className="flex-1 overflow-y-auto">
        <NavList />
      </div>
      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        OOTP 27 · Perfect Team
      </div>
    </aside>
  );
}
