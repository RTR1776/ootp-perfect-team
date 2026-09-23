"use client";

/**
 * Slim top bar: the menu button and brand on small screens, where you are
 * on large ones, and the theme toggle.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/shell/brand";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NAV, currentItem } from "@/lib/nav";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const item = currentItem(pathname);
  const group = item && NAV.find((g) => g.items.includes(item));

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <Brand className="lg:hidden" />
        {item && (
          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="text-muted-foreground">{group?.label}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium">{item.label}</span>
            <span className="ml-2 hidden text-xs text-muted-foreground xl:inline">{item.hint}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
      <MobileNav open={open} onClose={close} />
    </>
  );
}
