"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Home, MapPin, Sparkles, TrendingUp } from "lucide-react";
import { useDataStore } from "@/lib/data";
import {
  type Card as CardType,
  type Position,
  isPitcher,
} from "@/lib/types";
import {
  loadParks,
  findPark,
  useParkStore,
  activeParkLabel,
  NEUTRAL_PARK,
  HOME_PARK_LABEL,
  type Park,
} from "@/lib/parks";
import { useContextStore, composeParks } from "@/lib/contexts";
import {
  compareLineups,
  type Comparison,
  type Hand,
  type OrderedSlot,
  type PitcherEntry,
} from "@/lib/optimizer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TierDot } from "@/components/tier-badge";
import { PageTransition } from "@/components/page-transition";
import { fmtRate, fmtNum, cn } from "@/lib/utils";

type Pool = "active" | "variants" | "all";

interface TeamFile {
  home_park: string;
  activeCids: number[];
  variantCids: number[];
}

export function LineupOptimizer() {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);

  const [parks, setParks] = React.useState<Park[] | null>(null);
  const [team, setTeam] = React.useState<TeamFile | null>(null);
  const [hand, setHand] = React.useState<Hand>("R");
  const [pool, setPool] = React.useState<Pool>("variants");

  const homeParkLabel = useParkStore((s) => s.homeParkLabel);
  const awayParkLabel = useParkStore((s) => s.awayParkLabel);
  const side = useParkStore((s) => s.side);
  const setAwayParkLabel = useParkStore((s) => s.setAwayParkLabel);
  const setSide = useParkStore((s) => s.setSide);

  const loadContexts = useContextStore((s) => s.load);
  const contextKey = useContextStore((s) => s.selectedKey);
  const contextsLoaded = useContextStore((s) => s.loaded);

  React.useEffect(() => {
    load();
    loadContexts();
    loadParks().then(setParks).catch(() => setParks([]));
    fetch("/data/team.json")
      .then((r) => r.json())
      .then(setTeam)
      .catch(() => setTeam(null));
  }, [load, loadContexts]);

  const park: Park = React.useMemo(() => {
    const label = activeParkLabel({ homeParkLabel, awayParkLabel, side });
    const physical = findPark(label, parks ?? undefined) ?? NEUTRAL_PARK;
    // Compose the selected tournament context's era on top of the park —
    // an era is just another set of component multipliers.
    const era = contextsLoaded ? useContextStore.getState().eraPark() : NEUTRAL_PARK;
    return composeParks(era, physical);
    // contextKey is the reactive trigger; eraPark derives from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeParkLabel, awayParkLabel, side, parks, contextKey, contextsLoaded]);

  const comparison: Comparison | null = React.useMemo(() => {
    if (status !== "ready" || !team) return null;
    const by = new Map(cards.map((c) => [c.cid, c]));
    const active = team.activeCids.map((id) => by.get(id)).filter(Boolean) as CardType[];
    const variants = team.variantCids.map((id) => by.get(id)).filter(Boolean) as CardType[];
    let expanded: CardType[];
    if (pool === "active") expanded = active;
    else if (pool === "variants") expanded = [...active, ...variants];
    else
      expanded = cards.filter(
        (c) =>
          ((c.tier === "Perfect" || c.tier === "Diamond") && !isPitcher(c)) ||
          c.var === "Y" ||
          isPitcher(c),
      );
    return compareLineups(active, expanded, hand, park);
  }, [status, team, cards, pool, hand, park]);

  if (status !== "ready" || !team || !parks) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading lineup optimizer…
      </div>
    );
  }

  if (!comparison || comparison.optimized.batting.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        Not enough hitters in the pool to build a lineup.
      </div>
    );
  }

  const { optimized, runsGained, upgrades } = comparison;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lineup Optimizer</h1>
            <p className="text-sm text-muted-foreground">
              Platoon- and park-aware best 9 in{" "}
              <span className="font-medium text-foreground">{park.label}</span>.
            </p>
          </div>
          <DeltaCallout runsGained={runsGained} />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={hand} onValueChange={(v) => setHand(v as Hand)}>
            <TabsList>
              <TabsTrigger value="L">vs LHP</TabsTrigger>
              <TabsTrigger value="R">vs RHP</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={pool} onValueChange={(v) => setPool(v as Pool)}>
            <TabsList>
              <TabsTrigger value="active">Active 26</TabsTrigger>
              <TabsTrigger value="variants">Active + Variants</TabsTrigger>
              <TabsTrigger value="all">All Diamonds</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex items-center gap-2">
            <Tabs value={side} onValueChange={(v) => setSide(v as "home" | "away")}>
              <TabsList>
                <TabsTrigger value="home">
                  <Home className="size-3.5" /> Home
                </TabsTrigger>
                <TabsTrigger value="away">
                  <MapPin className="size-3.5" /> Away
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <ParkSelect
              parks={parks}
              disabled={side === "home"}
              value={side === "home" ? HOME_PARK_LABEL : awayParkLabel ?? ""}
              onChange={setAwayParkLabel}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Batting order */}
          <Card>
            <CardContent className="pt-5">
              <div className="label-eyebrow mb-4">Optimized batting order — vs {hand}HP</div>
              <div className="flex flex-col">
                <div className="grid grid-cols-[1.5rem_2.5rem_1fr_auto] items-center gap-3 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>#</span>
                  <span>Pos</span>
                  <span>Player</span>
                  <span className="text-right">Park-adj line</span>
                </div>
                <Separator />
                {optimized.batting.map((slot) => (
                  <LineupRow key={slot.card.cid} slot={slot} />
                ))}
                <Separator className="my-2" />
                <div className="flex items-center justify-between px-1 text-sm">
                  <span className="text-muted-foreground">Total runs above avg / game</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {fmtNum(optimized.totalRunsAboveAvg, 2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side column: upgrades + pitching + bench */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="pt-5">
                <div className="label-eyebrow mb-3 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" /> Suggested upgrades
                </div>
                {upgrades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    The active 26 already fields the optimal 9 in this park & split.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {upgrades.map((u) => (
                      <div
                        key={u.in.cid}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                          u.isVariant
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card/60",
                        )}
                      >
                        <Badge variant="outline" className="shrink-0">
                          {u.position}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-muted-foreground line-through">
                              {u.out.name}
                            </span>
                            <ArrowUpRight className="size-3.5 shrink-0 text-primary" />
                            <span className="flex items-center gap-1 truncate font-medium">
                              <TierDot tier={u.in.tier} />
                              {u.in.name}
                            </span>
                            {u.isVariant && (
                              <Badge variant="default" className="shrink-0">
                                Variant
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-primary">
                          +{fmtNum(u.runsGained, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="label-eyebrow mb-3">Rotation & bullpen</div>
                <PitcherList title="Rotation (SP)" entries={optimized.rotation} />
                <Separator className="my-3" />
                <PitcherList title="Bullpen (RP / CL)" entries={optimized.bullpen} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="label-eyebrow mb-3">Bench</div>
                {optimized.bench.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra hitters in this pool.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {optimized.bench.map((c) => (
                      <Link
                        key={c.cid}
                        href={`/card/${c.cid}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1 text-xs hover:border-primary/40"
                      >
                        <TierDot tier={c.tier} />
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.pos}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function LineupRow({ slot }: { slot: OrderedSlot }) {
  const s = slot.split;
  return (
    <>
      <Link
        href={`/card/${slot.card.cid}`}
        className="grid grid-cols-[1.5rem_2.5rem_1fr_auto] items-center gap-3 py-2 transition-colors hover:bg-accent/40"
      >
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {slot.order}
        </span>
        <Badge variant="outline" className="justify-center">
          {slot.position}
        </Badge>
        <span className="flex min-w-0 items-center gap-2">
          <TierDot tier={slot.card.tier} />
          <span className="truncate font-medium">{slot.card.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{slot.card.bats}</span>
          {slot.card.var === "Y" && (
            <Badge variant="default" className="shrink-0">
              V
            </Badge>
          )}
        </span>
        <span className="text-right text-xs tabular-nums">
          <span className="text-foreground">
            {fmtRate(s.BA)}/{fmtRate(s.OBP)}/{fmtRate(s.SLG)}
          </span>{" "}
          <span className="font-semibold text-primary">{fmtRate(s.wOBA)}</span>
          <span className="text-muted-foreground"> wOBA</span>
        </span>
      </Link>
      <Separator />
    </>
  );
}

function PitcherList({ title, entries }: { title: string; entries: PitcherEntry[] }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">None in pool.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((e) => (
            <Link
              key={e.card.cid}
              href={`/card/${e.card.cid}`}
              className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/40"
            >
              <TierDot tier={e.card.tier} />
              <span className="truncate font-medium">{e.card.name}</span>
              <span className="text-xs text-muted-foreground">{e.card.pos}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {fmtNum(e.card.pitcher_overall?.FIP, 2)} FIP
              </span>
              <span className="w-14 text-right text-xs font-medium tabular-nums text-primary">
                {e.runValue >= 0 ? "+" : ""}
                {fmtNum(e.runValue, 2)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DeltaCallout({ runsGained }: { runsGained: number }) {
  const positive = runsGained > 0.005;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-2.5",
        positive ? "border-primary/40 bg-primary/10" : "border-border bg-card/60",
      )}
    >
      <TrendingUp className={cn("size-4", positive ? "text-primary" : "text-muted-foreground")} />
      <div className="leading-tight">
        <div className="text-lg font-semibold tabular-nums">
          {positive ? "+" : ""}
          {fmtNum(runsGained, 2)}{" "}
          <span className="text-xs font-normal text-muted-foreground">runs / game</span>
        </div>
        <div className="text-[11px] text-muted-foreground">vs current Active 26</div>
      </div>
    </div>
  );
}

function ParkSelect({
  parks,
  value,
  onChange,
  disabled,
}: {
  parks: Park[];
  value: string;
  onChange: (label: string) => void;
  disabled?: boolean;
}) {
  const sorted = React.useMemo(
    () => [...parks].sort((a, b) => a.label.localeCompare(b.label)),
    [parks],
  );
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 w-56 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <option value="" disabled>
        Select away park…
      </option>
      {sorted.map((p) => (
        <option key={p.label} value={p.label}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
