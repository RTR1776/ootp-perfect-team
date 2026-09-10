"use client";

/**
 * The three panels that answer "so what do I buy" for the selected
 * environment: the rate line, the rating levers, and the ballpark.
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { METRICS, handRead, leversOf, metricValue, solve, type EnvSpec, type Solved } from "@/lib/analytics/runenv-view";
import { AVERAGE_RATING, curveMeta } from "@/lib/analytics/card-value";

const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
const pctDelta = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / Math.abs(b)) * 100);

/* --------------------------- the rate line --------------------------- */

export function EnvironmentPanel({ s, base, baseLabel }: { s: Solved; base: Solved | null; baseLabel: string }) {
  if (!s.line || !s.env) return <Card><CardContent className="p-5 text-sm text-muted-foreground">No era row on file for this year.</CardContent></Card>;
  const bunt = s.env.bunt_12_0;
  const buntRead = bunt >= 0.045 ? "bunting pays" : bunt >= 0.005 ? "bunting is roughly break-even" : "do not bunt";

  return (
    <Card className="lg:col-span-2">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-eyebrow">Plays like</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{s.env.RG.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">runs per game</span>
              {base?.env && (
                <span className={cn("text-xs", s.env.RG >= base.env.RG ? "text-emerald-500" : "text-rose-500")}>
                  {signed(pctDelta(s.env.RG, base.env.RG), 0)}% vs {baseLabel}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="label-eyebrow">Strategy preset</div>
            <div className="text-lg font-semibold">{s.env.preset}</div>
            <div className="text-xs text-muted-foreground">{buntRead}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5">
          {METRICS.filter((m) => m.key !== "rg" && m.key !== "ra9").map((m) => {
            const v = metricValue(s, String(m.key));
            const b = base ? metricValue(base, String(m.key)) : null;
            const d = v != null && b != null ? pctDelta(v, b) : null;
            return (
              <div key={m.key} title={m.help}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="font-mono text-sm tabular-nums">{v == null ? "—" : m.fmt(v)}</div>
                {d != null && Math.abs(d) >= 0.5 && (
                  <div className={cn("text-[10px]", (d > 0) === m.offenseUp ? "text-emerald-500" : "text-rose-500")}>
                    {signed(d, 0)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Sac bunt, 1st &amp; 2nd, 0 out: <span className="font-mono text-foreground">{signed(bunt, 3)}</span> runs</span>
          <span>Steal break-even, 0 out: <span className="font-mono text-foreground">{(s.env.sbbe0 * 100).toFixed(1)}%</span></span>
        </div>
        {s.env.notes.length > 0 && (
          <div className="text-xs text-muted-foreground">Preset adjusted — {s.env.notes.join("; ")}.</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- the levers ---------------------------- */

export function LeversPanel({ s, base, baseLabel }: { s: Solved; base: Solved | null; baseLabel: string }) {
  const lv = leversOf(s);
  const bv = base ? leversOf(base) : null;
  if (!lv) return null;
  const top = lv.hit[0];
  const dead = lv.hit[lv.hit.length - 1];

  return (
    <Card className="lg:col-span-2">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <div className="label-eyebrow">What to buy here</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Runs per 700 PA from <span className="text-foreground">+10 rating points</span> on an otherwise
            league-average card, valued with this environment&apos;s own linear weights. Ratings are pushed through the
            fitted rate curves, so this needs no observed data from an event nobody has played.
          </p>
        </div>

        <LeverBars title="Hitters" rows={lv.hit} baseRows={bv?.hit ?? null} baseLabel={baseLabel} />
        <LeverBars title="Pitchers" rows={lv.pit} baseRows={bv?.pit ?? null} baseLabel={baseLabel} />

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Here the top lever is <span className="font-medium text-foreground">{top?.rating}</span>
          {dead && dead.rating !== top?.rating && <> and the deadest is <span className="font-medium text-foreground">{dead.rating}</span></>}.
          The R² tag is how much of the rate that rating actually explains — BABIP is near noise, so a high BA
          rating is not a purchase, it is a coincidence. Curves fitted {curveMeta.fittedAt.slice(0, 10)} on the
          modern PT league; average card taken as {AVERAGE_RATING}s.
        </p>
      </CardContent>
    </Card>
  );
}

function LeverBars({ title, rows, baseRows, baseLabel }: {
  title: string; rows: { rating: string; runs: number; r2: number }[];
  baseRows: { rating: string; runs: number }[] | null; baseLabel: string;
}) {
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.runs)));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-medium">{title}</div>
      {rows.map((r) => {
        const b = baseRows?.find((x) => x.rating === r.rating);
        const d = b ? pctDelta(r.runs, b.runs) : null;
        return (
          <div key={r.rating} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 truncate text-muted-foreground">{r.rating}</span>
            <span className="w-11 shrink-0 text-right font-mono tabular-nums">{signed(r.runs)}</span>
            <span className="relative h-3 flex-1 rounded-sm bg-muted">
              <span className="absolute inset-y-0 left-0 rounded-sm bg-primary" style={{ width: `${(Math.abs(r.runs) / max) * 100}%` }} />
            </span>
            <span className="w-11 shrink-0 text-right text-[10px] text-muted-foreground" title={`R² ${r.r2.toFixed(2)} — how much of the rate this rating explains`}>
              R² {r.r2.toFixed(2)}
            </span>
            <span className={cn("w-14 shrink-0 text-right text-[10px]", d == null ? "text-transparent" : Math.abs(d) < 1 ? "text-muted-foreground" : d > 0 ? "text-emerald-500" : "text-rose-500")}
              title={d == null ? "" : `vs ${baseLabel}`}>
              {d == null ? "—" : `${signed(d, 0)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ the park ----------------------------- */

export function ParkPanel({ s, spec }: { s: Solved; spec: EnvSpec }) {
  const hand = React.useMemo(() => handRead(spec), [spec]);
  const neutral = React.useMemo(
    () => ({ ...spec, park: null, parkYear: null }),
    [spec],
  );
  const neutralSolved = React.useMemo(() => (s.eraRow ? solve(neutral) : null), [neutral, s.eraRow]);

  if (!s.parkRow) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="label-eyebrow">Ballpark</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Neutral — no factors applied. Every tournament runs in a real park and the park rotates through the
            year, so a neutral read is the era only.
          </p>
        </CardContent>
      </Card>
    );
  }

  const f = s.parkRow;
  const dRG = neutralSolved?.env && s.env ? pctDelta(s.env.RG, neutralSolved.env.RG) : null;
  const dHR = neutralSolved?.line && s.line ? pctDelta(s.line.hrPa, neutralSolved.line.hrPa) : null;
  const dAVG = neutralSolved?.line && s.line ? pctDelta(s.line.avg, neutralSolved.line.avg) : null;
  const avgBlend = (f.avgL + f.avgR) / 2, hrBlend = (f.hrL + f.hrR) / 2;
  const trap = avgBlend > 1.03 && hrBlend < 0.97;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div>
          <div className="label-eyebrow">Ballpark</div>
          <div className="text-sm font-medium">{s.parkLabel}</div>
        </div>

        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr><th className="text-left font-medium">Factor</th><th className="text-right font-medium">vs LHB</th><th className="text-right font-medium">vs RHB</th></tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            <tr><td className="text-muted-foreground">Hits</td><td className="text-right">{f.avgL.toFixed(3)}</td><td className="text-right">{f.avgR.toFixed(3)}</td></tr>
            <tr><td className="text-muted-foreground">Home runs</td><td className="text-right">{f.hrL.toFixed(3)}</td><td className="text-right">{f.hrR.toFixed(3)}</td></tr>
            <tr><td className="text-muted-foreground">Doubles</td><td className="text-right" colSpan={2}>{f.d2.toFixed(3)}</td></tr>
            <tr><td className="text-muted-foreground">Triples</td><td className="text-right" colSpan={2}>{f.d3.toFixed(3)}</td></tr>
          </tbody>
        </table>

        {hand && (
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium">Which side to load up</div>
            <div className="mt-1.5 flex items-baseline gap-3 text-xs">
              <span>All-left lineup <span className="font-mono text-foreground">{hand.rgL.toFixed(2)}</span> R/G</span>
              <span>All-right <span className="font-mono text-foreground">{hand.rgR.toFixed(2)}</span></span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {Math.abs(hand.edge) < 0.05
                ? "Even park — handedness is not a lever here, build on ratings alone."
                : <>Worth <span className="font-mono text-foreground">{Math.abs(hand.edge).toFixed(2)}</span> R/G to tilt{" "}
                    <span className="font-medium text-foreground">{hand.edge > 0 ? "left" : "right"}</span>-handed.
                    Home runs are taxed hardest {hand.hrL < hand.hrR ? "against left" : "against right"}-handed bats
                    ({hand.hrL.toFixed(2)} vs {hand.hrR.toFixed(2)}), so put the power on the other side.</>}
            </p>
          </div>
        )}

        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">What the park changed</div>
          <div className="flex flex-wrap gap-x-4">
            {dRG != null && <span>R/G {signed(dRG, 1)}%</span>}
            {dAVG != null && <span>AVG {signed(dAVG, 1)}%</span>}
            {dHR != null && <span>HR/PA {signed(dHR, 1)}%</span>}
          </div>
          {trap && (
            <p className="mt-2 text-amber-500">
              Reads as a small-ball park and is the opposite: hits are up {((avgBlend - 1) * 100).toFixed(0)}% while
              homers are down {((1 - hrBlend) * 100).toFixed(0)}%. The hit factor outweighs the homer factor about
              3 to 1, so outs get MORE expensive here, not less. Don&apos;t bunt.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
