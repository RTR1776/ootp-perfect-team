"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useDataStore } from "@/lib/data";
import { useRoster } from "@/lib/roster";
import { isPitcher, cardWAR } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { TierDot } from "@/components/tier-badge";
import { Placeholder } from "@/components/placeholder";
import { PageTransition } from "@/components/page-transition";
import { fmtNum, fmtRate } from "@/lib/utils";

export default function RosterPage() {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);
  const { ids, remove } = useRoster();

  React.useEffect(() => {
    load();
  }, [load]);

  const roster = React.useMemo(
    () => ids.map((id) => cards.find((c) => c.cid === id)).filter(Boolean),
    [ids, cards]
  );

  if (status === "ready" && ids.length === 0) {
    return (
      <Placeholder
        icon="roster"
        title="Active Roster"
        description="Star cards from the Explorer to assemble your active roster. WAR totals and lineup tools build on top of this set."
      >
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Go to Explorer →
        </Link>
      </Placeholder>
    );
  }

  const totalWAR = roster.reduce((sum, c) => sum + cardWAR(c!), 0);

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Active Roster</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{roster.length}</span>{" "}
              cards · <span className="tabular-nums text-primary">{fmtNum(totalWAR)}</span> total WAR
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((c) => (
            <Card key={c!.cid} className="group relative">
              <CardContent className="flex items-center gap-3 py-4">
                <TierDot tier={c!.tier} />
                <Link href={`/card/${c!.cid}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium hover:text-primary">{c!.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {c!.pos} ·{" "}
                    {isPitcher(c!)
                      ? `${fmtNum(c!.pitcher_overall?.FIP, 2)} FIP`
                      : `${fmtRate(c!.hitter_overall?.wOBA)} wOBA`}{" "}
                    · {fmtNum(cardWAR(c!))} WAR
                  </div>
                </Link>
                <button
                  onClick={() => remove(c!.cid)}
                  aria-label="Remove from roster"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
