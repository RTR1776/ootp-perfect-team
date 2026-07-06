"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Lock, TrendingUp, TrendingDown, Star } from "lucide-react";
import { useDataStore } from "@/lib/data";
import {
  type Card as CardType,
  type HitterSplit,
  type PitcherSplit,
  type HitterValue,
  type PitcherValue,
  isPitcher,
  cardWAR,
  parseMarket,
} from "@/lib/types";
import { useRoster } from "@/lib/roster";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/tier-badge";
import { RatingsRadar, type RadarDatum } from "@/components/ratings-radar";
import { PageTransition } from "@/components/page-transition";
import { fmtRate, fmtNum, fmtMoney, cn } from "@/lib/utils";

export function CardDetail({ cid }: { cid: number }) {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);

  React.useEffect(() => {
    load();
  }, [load]);

  const card = React.useMemo(() => cards.find((c) => c.cid === cid), [cards, cid]);

  if (status !== "ready") {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading card…
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        Card #{cid} not found.
        <Link href="/" className="text-primary hover:underline">
          Back to Explorer
        </Link>
      </div>
    );
  }

  return (
    <PageTransition>
      <CardDetailBody card={card} />
    </PageTransition>
  );
}

function CardDetailBody({ card }: { card: CardType }) {
  const pitcher = isPitcher(card);
  const { has, add, remove } = useRoster();
  const inRoster = has(card.cid);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Explorer
      </Link>

      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{card.name}</h1>
        <TierBadge tier={card.tier} />
        <Badge variant="outline">{card.pos}</Badge>
        <Badge variant="muted">
          {pitcher ? `Throws ${card.throws}` : `${card.bats} / ${card.throws}`}
        </Badge>
        {card.lock && (
          <Badge variant="outline" className="border-amber-400/40 text-amber-400">
            <Lock className="size-3" /> Locked
          </Badge>
        )}
        {card.var === "Y" && <Badge variant="muted">Variant</Badge>}
        <Button
          variant={inRoster ? "secondary" : "outline"}
          size="sm"
          className="ml-auto"
          onClick={() => (inRoster ? remove(card.cid) : add(card.cid))}
        >
          <Star className={cn("size-4", inRoster && "fill-primary text-primary")} />
          {inRoster ? "In roster" : "Add to roster"}
        </Button>
      </div>

      {/* Market meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="WAR" value={fmtNum(cardWAR(card))} accent />
        <Stat
          label={pitcher ? "RAA / 180 IP" : "wRAA / 600 PA"}
          value={fmtNum(secondaryValue(card))}
        />
        <Stat
          label="Buy"
          value={fmtMoney(parseMarket(card.buy))}
          icon={<TrendingUp className="size-3.5 text-primary" />}
        />
        <Stat
          label="Sell"
          value={fmtMoney(parseMarket(card.sell))}
          icon={<TrendingDown className="size-3.5 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Slash / split lines */}
        <Card>
          <CardContent className="pt-5">
            <div className="label-eyebrow mb-4">
              {pitcher ? "Projected pitching — by split" : "Projected slash line — by split"}
            </div>
            {pitcher ? <PitcherSplits card={card} /> : <HitterSplits card={card} />}
          </CardContent>
        </Card>

        {/* Radar (outcome components, normalized 0-100) */}
        <Card>
          <CardContent className="pt-5">
            <div className="label-eyebrow mb-2">Projection profile</div>
            <RatingsRadar data={radarData(card)} />
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              Outcome components, scaled 0–100
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Defense / baserunning for hitters */}
      {!pitcher && (card.defense?.positions.length || card.baserun) && (
        <div className="grid gap-6 md:grid-cols-2">
          {card.defense && card.defense.positions.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <div className="label-eyebrow mb-4">Defensive runs by position (/162)</div>
                <DefenseList card={card} />
              </CardContent>
            </Card>
          )}
          {card.baserun && (
            <Card>
              <CardContent className="pt-5">
                <div className="label-eyebrow mb-4">Baserunning</div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Speed" value={String(card.baserun.SPE)} />
                  <Stat label="Stealing" value={String(card.baserun.STE)} />
                  <Stat label="Baserunning" value={String(card.baserun.RUN)} />
                  <Stat
                    label="BsR / 162"
                    value={fmtNum(card.baserun.bsr_runs_per_162)}
                    accent
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pitcher extras */}
      {pitcher && (card.stamina != null || card.hold != null) && (
        <Card>
          <CardContent className="pt-5">
            <div className="label-eyebrow mb-4">Usage</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {card.stamina != null && <Stat label="Stamina" value={String(card.stamina)} />}
              {card.hold != null && <Stat label="Hold" value={String(card.hold)} />}
              <Stat label="RAA / 180 IP" value={fmtNum(secondaryValue(card))} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function secondaryValue(card: CardType): number {
  const v = card.value as Partial<HitterValue & PitcherValue>;
  return v.wRAA_per_600 ?? v.RAA_per_180IP ?? 0;
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <div className="label-eyebrow flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function HitterSplits({ card }: { card: CardType }) {
  const cols: { key: string; label: string; split?: HitterSplit }[] = [
    { key: "vL", label: "vs LHP", split: card.hitter_vL },
    { key: "overall", label: "Overall", split: card.hitter_overall },
    { key: "vR", label: "vs RHP", split: card.hitter_vR },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {cols.map(({ key, label, split }) => (
        <div
          key={key}
          className={cn(
            "rounded-lg border px-3 py-3",
            key === "overall" ? "border-primary/30 bg-primary/5" : "border-border"
          )}
        >
          <div className="label-eyebrow mb-2">{label}</div>
          <div className="flex items-baseline gap-1.5 text-lg font-semibold tabular-nums">
            <span>{fmtRate(split?.BA)}</span>
            <span className="text-muted-foreground">/</span>
            <span>{fmtRate(split?.OBP)}</span>
            <span className="text-muted-foreground">/</span>
            <span>{fmtRate(split?.SLG)}</span>
          </div>
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="wOBA" value={fmtRate(split?.wOBA)} highlight />
            <Row label="OPS" value={fmtNum(split?.OPS, 3)} />
            <Row label="ISO" value={fmtRate(split?.ISO)} />
            <Row label="BB%" value={pct(split?.["BB%"])} />
            <Row label="K%" value={pct(split?.["K%"])} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function PitcherSplits({ card }: { card: CardType }) {
  const cols: { key: string; label: string; split?: PitcherSplit }[] = [
    { key: "vL", label: "vs LHB", split: card.pitcher_vL },
    { key: "overall", label: "Overall", split: card.pitcher_overall },
    { key: "vR", label: "vs RHB", split: card.pitcher_vR },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {cols.map(({ key, label, split }) => (
        <div
          key={key}
          className={cn(
            "rounded-lg border px-3 py-3",
            key === "overall" ? "border-primary/30 bg-primary/5" : "border-border"
          )}
        >
          <div className="label-eyebrow mb-2">{label}</div>
          <div className="text-lg font-semibold tabular-nums">
            {fmtNum(split?.FIP, 2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">FIP</span>
          </div>
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="K/9" value={fmtNum(split?.["K/9"])} highlight />
            <Row label="BB/9" value={fmtNum(split?.["BB/9"], 2)} />
            <Row label="HR/9" value={fmtNum(split?.["HR/9"], 2)} />
            <Row label="wOBA-a" value={fmtRate(split?.wOBA_against)} />
            <Row label="BABIP-a" value={fmtRate(split?.BABIP_against)} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", highlight ? "font-semibold text-primary" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}

function DefenseList({ card }: { card: CardType }) {
  const entries = card.defense?.positions ?? [];
  const max = Math.max(10, ...entries.map((d) => Math.abs(d.with_position_adj)));
  return (
    <div className="space-y-3">
      {entries.map((d) => {
        const runs = d.with_position_adj;
        const pctw = (Math.abs(runs) / max) * 100;
        const positive = runs >= 0;
        return (
          <div key={d.pos} className="flex items-center gap-3">
            <span className="w-10 text-sm font-medium tabular-nums">{d.pos}</span>
            <div className="relative h-2 flex-1 rounded-full bg-muted">
              <div
                className={cn(
                  "absolute top-0 h-2 rounded-full",
                  positive ? "bg-primary" : "bg-red-400"
                )}
                style={{ width: `${pctw}%` }}
              />
            </div>
            <span className="w-20 text-right text-sm tabular-nums">
              {runs >= 0 ? "+" : ""}
              {fmtNum(runs)} <span className="text-muted-foreground">rns</span>
            </span>
            <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
              {d.position_rating} rt
            </span>
          </div>
        );
      })}
    </div>
  );
}

function pct(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Radar of projected OUTCOME components, normalized to 0-100 against rough
 * league reference ranges (the dataset has no scouting ratings).
 */
function radarData(card: CardType): RadarDatum[] {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  if (isPitcher(card)) {
    const s = card.pitcher_overall;
    if (!s) return [];
    return [
      { axis: "K/9", value: clamp((s["K/9"] / 14) * 100) },
      { axis: "Control", value: clamp((1 - s["BB/9"] / 6) * 100) },
      { axis: "Suppress HR", value: clamp((1 - s["HR/9"] / 2) * 100) },
      { axis: "Limit contact", value: clamp((1 - (s.wOBA_against - 0.2) / 0.2) * 100) },
      { axis: "FIP", value: clamp((1 - (s.FIP - 1) / 5) * 100) },
    ];
  }
  const s = card.hitter_overall;
  if (!s) return [];
  return [
    { axis: "Contact", value: clamp(((s.BA - 0.18) / 0.2) * 100) },
    { axis: "Eye", value: clamp((s["BB%"] / 0.18) * 100) },
    { axis: "Power", value: clamp((s.ISO / 0.3) * 100) },
    { axis: "Avoid K", value: clamp((1 - s["K%"] / 0.35) * 100) },
    { axis: "wOBA", value: clamp(((s.wOBA - 0.25) / 0.25) * 100) },
  ];
}
