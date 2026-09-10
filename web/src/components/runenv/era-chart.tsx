"use client";

/**
 * The era spine: every year on file for one metric, as deviation from a
 * baseline year, in whatever ballpark is selected above.
 *
 * Three views because three questions get asked. CHART is "when was this metric
 * high"; SPARKLINES is "how do all the metrics move together"; TABLE is "give me
 * the numbers for the four years I am choosing between".
 */

import * as React from "react";
import { ERA_BANDS, METRICS, bandFor, metricFor, series, type EraBand } from "@/lib/analytics/runenv-view";
import { cn } from "@/lib/utils";

export type ChartView = "chart" | "sparklines" | "table";

interface Props {
  years: number[];
  metric: string;
  onMetric: (k: string) => void;
  view: ChartView;
  onView: (v: ChartView) => void;
  baselineYear: number;
  selectedYear: number | null;
  onSelectYear: (y: number) => void;
  park: string | null;
  parkYear: number | null;
  lhbShare: number;
  /** Era bands switched off filter the chart down to the years that matter. */
  bands: Set<string>;
  onToggleBand: (key: string) => void;
}

const DEV = (v: number, base: number) => (base === 0 ? 0 : (v - base) / base);

export function EraChart(p: Props) {
  const m = metricFor(p.metric);
  const years = React.useMemo(
    () => p.years.filter((y) => p.bands.size === 0 || p.bands.has(bandFor(y).key)),
    [p.years, p.bands],
  );

  const pts = React.useMemo(
    () => series(years, p.metric, p.park, p.parkYear, p.lhbShare),
    [years, p.metric, p.park, p.parkYear, p.lhbShare],
  );

  const baseline = React.useMemo(() => {
    const one = series([p.baselineYear], p.metric, p.park, p.parkYear, p.lhbShare)[0];
    return one?.value ?? null;
  }, [p.baselineYear, p.metric, p.park, p.parkYear, p.lhbShare]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <MetricRow side="bat" label="Batting" metric={p.metric} onMetric={p.onMetric} />
        <MetricRow side="pitch" label="Pitching" metric={p.metric} onMetric={p.onMetric} />
        <div className="ml-auto flex rounded-md border border-border p-0.5">
          {(["chart", "sparklines", "table"] as ChartView[]).map((v) => (
            <button
              key={v}
              onClick={() => p.onView(v)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
                p.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ERA_BANDS.map((b) => {
          const on = p.bands.size === 0 || p.bands.has(b.key);
          return (
            <button
              key={b.key}
              onClick={() => p.onToggleBand(b.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-opacity",
                on ? "border-border" : "border-border/50 opacity-40",
              )}
              title={`${b.label} · ${b.from}–${b.to}`}
            >
              <span className="size-2 rounded-full" style={{ background: b.color }} />
              <span className="text-muted-foreground">{b.label}</span>
              <span className="text-muted-foreground/60">{b.from}–{b.to}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{m.help}</p>

      {p.view === "chart" && (
        <Bars pts={pts} baseline={baseline} metric={p.metric} selected={p.selectedYear} onSelect={p.onSelectYear} baselineYear={p.baselineYear} />
      )}
      {p.view === "sparklines" && (
        <Sparklines years={years} park={p.park} parkYear={p.parkYear} lhbShare={p.lhbShare} selected={p.selectedYear} onMetric={p.onMetric} />
      )}
      {p.view === "table" && (
        <Table years={years} park={p.park} parkYear={p.parkYear} lhbShare={p.lhbShare} selected={p.selectedYear} onSelect={p.onSelectYear} baselineYear={p.baselineYear} />
      )}
    </div>
  );
}

function MetricRow({ side, label, metric, onMetric }: { side: "bat" | "pitch"; label: string; metric: string; onMetric: (k: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {METRICS.filter((m) => m.side === side).map((m) => (
        <button
          key={m.key}
          onClick={() => onMetric(String(m.key))}
          title={m.help}
          className={cn(
            "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
            metric === m.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- chart ------------------------------- */

function Bars({ pts, baseline, metric, selected, onSelect, baselineYear }: {
  pts: { year: number; value: number | null; band: EraBand }[];
  baseline: number | null; metric: string; selected: number | null; onSelect: (y: number) => void; baselineYear: number;
}) {
  const m = metricFor(metric);
  const devs = pts.map((d) => (d.value == null || baseline == null ? null : DEV(d.value, baseline)));
  const max = Math.max(0.001, ...devs.map((d) => (d == null ? 0 : Math.abs(d))));
  const H = 300, mid = H / 2;

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {m.label} <span className="text-muted-foreground">— % away from {baselineYear}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {baseline != null ? `${baselineYear} = ${m.fmt(baseline)}` : "no baseline"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="relative flex items-stretch gap-px" style={{ height: H, minWidth: Math.max(pts.length * 7, 320) }}>
          <div className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: mid }} />
          {pts.map((d, i) => {
            const dev = devs[i];
            const h = dev == null ? 0 : (Math.abs(dev) / max) * (mid - 12);
            const on = selected === d.year;
            return (
              <button
                key={d.year}
                onClick={() => onSelect(d.year)}
                title={`${d.year} · ${d.band.label}\n${m.label} ${d.value == null ? "—" : m.fmt(d.value)}${dev == null ? "" : `  (${dev >= 0 ? "+" : ""}${(dev * 100).toFixed(1)}% vs ${baselineYear})`}`}
                className="group relative flex-1 min-w-[3px]"
              >
                <span
                  className="absolute left-0 right-0 rounded-[1px] transition-opacity group-hover:opacity-100"
                  style={{
                    background: d.band.color,
                    opacity: on ? 1 : 0.78,
                    height: Math.max(h, dev == null ? 0 : 1),
                    top: dev != null && dev >= 0 ? mid - h : mid,
                    outline: on ? "1px solid var(--foreground)" : undefined,
                  }}
                />
                {on && (
                  <span className="absolute inset-x-0 text-[9px] font-semibold text-foreground" style={{ top: dev != null && dev >= 0 ? mid - h - 14 : mid + h + 2 }}>
                    {d.year}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{pts[0]?.year}</span>
        <span>above {baselineYear} ↑ · below ↓ · click a bar to load that era</span>
        <span>{pts[pts.length - 1]?.year}</span>
      </div>
    </div>
  );
}

/* ----------------------------- sparklines ---------------------------- */

function Sparklines({ years, park, parkYear, lhbShare, selected, onMetric }: {
  years: number[]; park: string | null; parkYear: number | null; lhbShare: number; selected: number | null; onMetric: (k: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {METRICS.filter((m) => m.key !== "rg" && m.key !== "ra9").map((m) => (
        <Spark key={m.key} metricKey={String(m.key)} years={years} park={park} parkYear={parkYear} lhbShare={lhbShare} selected={selected} onMetric={onMetric} />
      ))}
    </div>
  );
}

function Spark({ metricKey, years, park, parkYear, lhbShare, selected, onMetric }: {
  metricKey: string; years: number[]; park: string | null; parkYear: number | null; lhbShare: number; selected: number | null; onMetric: (k: string) => void;
}) {
  const m = metricFor(metricKey);
  const pts = React.useMemo(() => series(years, metricKey, park, parkYear, lhbShare), [years, metricKey, park, parkYear, lhbShare]);
  const vals = pts.map((d) => d.value).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const W = 240, H = 44;
  const path = pts.map((d, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * W;
    const y = d.value == null ? H : H - ((d.value - lo) / span) * H;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const selIdx = selected == null ? -1 : pts.findIndex((d) => d.year === selected);
  const sel = selIdx >= 0 ? pts[selIdx] : null;

  return (
    <button onClick={() => onMetric(metricKey)} className="rounded-lg border border-border bg-card/40 p-3 text-left transition-colors hover:border-primary/50">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium">{m.label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {sel?.value != null ? `${sel.year} ${m.fmt(sel.value)}` : `${m.fmt(lo)} – ${m.fmt(hi)}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ height: H }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.2} className="text-primary" vectorEffect="non-scaling-stroke" />
        {sel?.value != null && (
          <circle
            cx={(selIdx / Math.max(pts.length - 1, 1)) * W}
            cy={H - ((sel.value - lo) / span) * H}
            r={2.5} className="fill-foreground"
          />
        )}
      </svg>
    </button>
  );
}

/* -------------------------------- table ------------------------------ */

function Table({ years, park, parkYear, lhbShare, selected, onSelect, baselineYear }: {
  years: number[]; park: string | null; parkYear: number | null; lhbShare: number; selected: number | null; onSelect: (y: number) => void; baselineYear: number;
}) {
  const cols = METRICS.filter((m) => m.key !== "ra9");
  const rows = React.useMemo(() => {
    const byMetric = new Map(cols.map((m) => [String(m.key), series(years, String(m.key), park, parkYear, lhbShare)]));
    return years.map((y, i) => ({
      year: y, band: bandFor(y),
      vals: Object.fromEntries(cols.map((m) => [String(m.key), byMetric.get(String(m.key))![i]?.value ?? null])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years, park, parkYear, lhbShare]);

  const baseRow = rows.find((r) => r.year === baselineYear);

  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Year</th>
            {cols.map((m) => <th key={m.key} className="px-2 py-2 text-right font-medium" title={m.help}>{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.year}
              onClick={() => onSelect(r.year)}
              className={cn("cursor-pointer border-b border-border/40 hover:bg-accent/40", selected === r.year && "bg-primary/10")}
            >
              <td className="whitespace-nowrap px-3 py-1.5">
                <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: r.band.color }} />
                <span className="font-medium">{r.year}</span>
                {r.year === baselineYear && <span className="ml-1.5 text-[10px] text-muted-foreground">base</span>}
              </td>
              {cols.map((m) => {
                const v = r.vals[String(m.key)];
                const b = baseRow?.vals[String(m.key)];
                const dev = v != null && b != null && b !== 0 ? (v - b) / b : null;
                return (
                  <td key={m.key} className="px-2 py-1.5 text-right font-mono">
                    {v == null ? "—" : m.fmt(v)}
                    {dev != null && Math.abs(dev) > 0.005 && (
                      <span className={cn("ml-1 text-[10px]", dev > 0 ? "text-emerald-500" : "text-rose-500")}>
                        {dev > 0 ? "+" : ""}{(dev * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
