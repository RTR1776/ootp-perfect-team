"use client";

import * as React from "react";
import { useDataStore, filterCards } from "@/lib/data";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/filter-bar";
import { CardTable } from "@/components/card-table";
import { PageTransition } from "@/components/page-transition";

export default function ExplorerPage() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);
  const mode = useDataStore((s) => s.mode);
  const setMode = useDataStore((s) => s.setMode);
  const filters = useDataStore((s) => s.filters);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(
    () => filterCards(cards, mode, filters),
    [cards, mode, filters]
  );

  const totalForMode = React.useMemo(
    () => cards.filter((c) => (mode === "pitchers" ? !!c.pitcher_overall : !!c.hitter_overall)).length,
    [cards, mode]
  );

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Card Explorer</h1>
            <p className="text-sm text-muted-foreground">
              {status === "ready" ? (
                <>
                  <span className="tabular-nums font-medium text-foreground">
                    {filtered.length}
                  </span>{" "}
                  of {totalForMode} {mode}
                  <span className="text-muted-foreground/60"> · {cards.length} cards total</span>
                </>
              ) : status === "error" ? (
                <span className="text-red-400">Failed to load: {error}</span>
              ) : (
                "Loading projections…"
              )}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList>
              <TabsTrigger value="hitters">Hitters</TabsTrigger>
              <TabsTrigger value="pitchers">Pitchers</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <FilterBar />

        {status === "ready" ? (
          <CardTable data={filtered} mode={mode} />
        ) : (
          <div className="flex h-[calc(100vh-19rem)] items-center justify-center rounded-xl border border-border bg-card/40 text-sm text-muted-foreground">
            {status === "error" ? "Could not load card data." : "Loading 2024 cards…"}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
