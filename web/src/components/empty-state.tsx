import Link from "next/link";
import {
  CandlestickChart, Globe, ListOrdered, Medal, SearchX, Trophy, Upload, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICONS = {
  league: Trophy,
  meta: Globe,
  market: CandlestickChart,
  ptcs: Medal,
  played: ListOrdered,
  upload: Upload,
  search: SearchX,
} satisfies Record<string, LucideIcon>;

export type EmptyStateIcon = keyof typeof ICONS;

/**
 * What a page shows before its data exists: what it will become, and the one
 * step that fills it. Not "coming soon" — every page behind one of these works.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
  className,
}: {
  icon: EmptyStateIcon;
  title: string;
  description: React.ReactNode;
  /** The primary next step, e.g. { href: "/upload", label: "Go to Upload" }. */
  action?: { href: string; label: string };
  /** A secondary, terminal-side way to fill it. */
  hint?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <div className={cn("flex min-h-[60vh] items-center justify-center", className)}>
      <Card className="w-full max-w-lg overflow-hidden text-center">
        <div aria-hidden className="stitch-rule opacity-60" />
        <div className="flex flex-col items-center gap-4 px-6 py-10">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="size-7" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="page-title text-3xl">{title}</h1>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
          </div>
          {action && (
            <Link
              href={action.href}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {action.label}
            </Link>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </Card>
    </div>
  );
}
