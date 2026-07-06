"use client";

import { ListOrdered, Shuffle, Trophy, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/page-transition";

export type PlaceholderIcon = "lineup" | "draft" | "tournaments" | "roster";

const ICONS: Record<PlaceholderIcon, LucideIcon> = {
  lineup: ListOrdered,
  draft: Shuffle,
  tournaments: Trophy,
  roster: Users,
};

export function Placeholder({
  icon,
  title,
  description,
  children,
}: {
  icon: PlaceholderIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const Icon = ICONS[icon];
  return (
    <PageTransition>
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
            </div>
            <Badge variant="muted">Coming soon</Badge>
            {children}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
