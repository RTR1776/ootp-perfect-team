"use client";

/**
 * /runenv — pick an environment, read what it wants, then go build it.
 *
 * The whole page solves client-side off three static tables (eras, park
 * factors, rate curves), so switching ballparks is instant and nothing here
 * depends on a tournament having been played before. That is the point: the
 * PTCS Silver berth has no comparable event in the catalogue and the Cap berth
 * has one run, so ranking cards on observed stats there is guesswork. An era
 * plus a ballpark is enough to say what the roster should look like.
 */

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EraChart, type ChartView } from "@/components/runenv/era-chart";
import { EnvironmentPanel, LeversPanel, ParkPanel } from "@/components/runenv/read-panels";
import { BerthGrid, type BerthRow } from "@/components/runenv/berth-grid";
import { Shortlist, type Filters } from "@/components/runenv/shortlist";
import type { PoolCard } from "@/lib/analytics/pool-shape";
import {
  ERA_YEARS, PARK_NAMES, PT_DEFAULT_ENV_YEAR, parkYears, solve, type EnvSpec,
} from "@/lib/analytics/runenv-view";

/** The PT default engine, not real 2010 — every PT league plays this one. */
const DEFAULT_BASELINE = 0;

export interface ExplorerProps {
  berths: BerthRow[];
  /** Every catalogued tournament, for the "load a scheduled event" picker. */
  events: BerthRow[];
  championshipLabel: string;
  pool: PoolCard[];
  poolAsOf: string | null;
}

export function RunEnvExplorer({ berths, events, championshipLabel, pool, poolAsOf }: ExplorerProps) {
  const first = berths[0];
  const [spec, setSpec] = React.useState<EnvSpec>({
    year: first?.year ?? null,
    park: first?.park ?? null,
    parkYear: first?.parkYear ?? null,
    lhbShare: 0.35,
  });
  const [activeKey, setActiveKey] = React.useState<string | null>(first?.key ?? null);
  const [baselineYear, setBaselineYear] = React.useState(DEFAULT_BASELINE);
  const [metric, setMetric] = React.useState("kPct");
  const [view, setView] = React.useState<ChartView>("chart");
  const [bands, setBands] = React.useState<Set<string>>(new Set());
  const [from, setFrom] = React.useState(1910);
  const [to, setTo] = React.useState(2026);
  const [chartInPark, setChartInPark] = React.useState(true);

  const solved = React.useMemo(() => solve(spec), [spec]);
  const baseSpec = React.useMemo<EnvSpec>(
    () => ({ year: baselineYear === 0 ? null : baselineYear, park: null, parkYear: null, lhbShare: spec.lhbShare }),
    [baselineYear, spec.lhbShare],
  );
  const baseSolved = React.useMemo(() => solve(baseSpec), [baseSpec]);

  const years = React.useMemo(() => ERA_YEARS.filter((y) => y >= from && y <= to), [from, to]);
  const availableParkYears = React.useMemo(() => (spec.park ? parkYears(spec.park) : []), [spec.park]);

  const activeRow = React.useMemo(
    () => [...berths, ...events].find((b) => b.key === activeKey) ?? null,
    [berths, events, activeKey],
  );
  const filters = React.useMemo<Filters>(() => ({
    yearMin: activeRow?.yearMin ?? null, yearMax: activeRow?.yearMax ?? null,
    valMin: activeRow?.valMin ?? null, valMax: activeRow?.valMax ?? null,
    label: activeRow?.label ?? null,
  }), [activeRow]);

  const update = (patch: Partial<EnvSpec>) => { setSpec((s) => ({ ...s, ...patch })); setActiveKey(null); };
  const pick = (s: EnvSpec, key: string) => { setSpec({ ...s, lhbShare: spec.lhbShare }); setActiveKey(key); };

  const toggleBand = (key: string) =>
    setBands((prev) => {
      const next = new Set(prev.size === 0 ? [] : prev);
      if (prev.size === 0) { next.add(key); return next; }
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------- controls ---------------------------- */}
      <Card className="sticky top-2 z-20 backdrop-blur">
        <CardContent className="flex flex-col gap-3 p-4">
          {berths.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label-eyebrow mr-1">{championshipLabel}</span>
              {berths.map((b) => (
                <button
                  key={b.key}
                  onClick={() => pick({ year: b.year, park: b.park, parkYear: b.parkYear, lhbShare: spec.lhbShare }, b.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    activeKey === b.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  title={`${b.year ?? "default"} RE · ${b.parkYear ?? ""} ${b.park ?? "neutral"}`}
                >
                  {b.category ?? b.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Era (run environment)">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={spec.year ?? ""}
                onChange={(e) => update({ year: e.target.value === "" ? null : Number(e.target.value) })}
              >
                <option value="">PT default engine (what every PT league runs)</option>
                {[...ERA_YEARS].reverse().map((y) => (
                  <option key={y} value={y}>{y === PT_DEFAULT_ENV_YEAR ? `${y} — real ${y}, NOT the PT default` : y}</option>
                ))}
              </select>
            </Field>

            <Field label="Ballpark">
              <select
                className="h-8 w-56 rounded-md border border-input bg-background px-2 text-sm"
                value={spec.park ?? ""}
                onChange={(e) => {
                  const name = e.target.value || null;
                  const ys = name ? parkYears(name) : [];
                  update({ park: name, parkYear: ys.length ? ys[ys.length - 1] : null });
                }}
              >
                <option value="">Neutral (no park factors)</option>
                {PARK_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            {spec.park && (
              <Field label="Park year">
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={spec.parkYear ?? ""}
                  onChange={(e) => update({ parkYear: Number(e.target.value) })}
                >
                  {availableParkYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            )}

            <Field label={`Lineup ${Math.round(spec.lhbShare * 100)}% left-handed`}>
              <input
                type="range" min={0} max={100} step={5}
                value={Math.round(spec.lhbShare * 100)}
                onChange={(e) => setSpec((s) => ({ ...s, lhbShare: Number(e.target.value) / 100 }))}
                className="h-8 w-40 accent-[var(--primary)]"
                title="Blends the park's vs-LHB and vs-RHB factors. A park's read changes with who is standing in the box."
              />
            </Field>

            <Field label="Compare against">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={baselineYear}
                onChange={(e) => setBaselineYear(Number(e.target.value))}
              >
                <option value={0}>PT default engine, neutral</option>
                {[...ERA_YEARS].reverse().map((y) => (
                  <option key={y} value={y}>{y === PT_DEFAULT_ENV_YEAR ? `${y} neutral — real ${y}` : `${y} neutral`}</option>
                ))}
              </select>
            </Field>

            <div className="ml-auto flex items-end gap-2">
              <Link
                href="/build"
                className="h-8 rounded-md border border-border px-3 text-sm leading-8 text-muted-foreground transition-colors hover:text-foreground"
              >
                Open roster builder →
              </Link>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <span className="text-foreground">{solved.eraLabel}</span>
            {" · "}
            <span className="text-foreground">{solved.parkLabel}</span>
            {solved.parkRow == null && spec.park && <span className="text-amber-500"> — no factors on file, running neutral</span>}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------ the read -------------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <EnvironmentPanel s={solved} base={baseSolved} baseLabel={baselineYear === 0 ? "PT default" : String(baselineYear)} />
        <ParkPanel s={solved} spec={spec} />
        <LeversPanel s={solved} base={baseSolved} baseLabel={baselineYear === 0 ? "PT default" : String(baselineYear)} />
        <NextSteps s={solved} />
      </div>

      {/* --------------------------- the shortlist ------------------------ */}
      <Shortlist pool={pool} asOf={poolAsOf} s={solved} filters={filters} />

      {/* ---------------------------- the berths -------------------------- */}
      <BerthGrid
        rows={berths}
        lhbShare={spec.lhbShare}
        activeKey={activeKey}
        onPick={pick}
        title={championshipLabel}
        blurb="Five berths, five environments. The buy column is the top two hitting levers solved for that event — it is not the same list twice."
      />

      {/* ----------------------------- the chart -------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Every era on file, {chartInPark && solved.parkRow ? `in ${solved.parkLabel}` : "neutral park"}</div>
              <p className="text-xs text-muted-foreground">
                What the OOTP engine produces per year — not MLB history. Click any bar to load that era above.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <Field label="From">
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                  {ERA_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="To">
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={to} onChange={(e) => setTo(Number(e.target.value))}>
                  {ERA_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={chartInPark} onChange={(e) => setChartInPark(e.target.checked)} className="accent-[var(--primary)]" />
                apply the ballpark
              </label>
            </div>
          </div>

          <EraChart
            years={years}
            metric={metric}
            onMetric={setMetric}
            view={view}
            onView={setView}
            baselineYear={baselineYear}
            selectedYear={spec.year}
            onSelectYear={(y) => update({ year: y })}
            park={chartInPark ? spec.park : null}
            parkYear={chartInPark ? spec.parkYear : null}
            lhbShare={spec.lhbShare}
            bands={bands}
            onToggleBand={toggleBand}
          />
        </CardContent>
      </Card>

      {/* ------------------------- scheduled events ----------------------- */}
      {events.length > 0 && (
        <BerthGrid
          rows={events}
          lhbShare={spec.lhbShare}
          activeKey={activeKey}
          onPick={pick}
          title="Scheduled tournaments"
          blurb="The current catalogue, solved the same way. Era and park both rotate through the year, so this is the read as of the last import."
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-eyebrow">{label}</span>
      {children}
    </label>
  );
}

/** The bridge from "this is the environment" to "here is the roster note". */
function NextSteps({ s }: { s: ReturnType<typeof solve> }) {
  if (!s.line || !s.env) return null;
  const k = s.line.kPct, hr = s.line.hrPa;
  const lines: string[] = [];
  lines.push(k < 0.10
    ? `Only ${(k * 100).toFixed(1)}% of plate appearances end in a strikeout, so buying strikeout avoidance buys almost nothing — there is nothing left to avoid. Spend on Eye and contact quality instead.`
    : k > 0.18
      ? `${(k * 100).toFixed(1)}% strikeouts: the highest-leverage thing a bat can do here is put the ball in play. Avoid Ks and Eye both pay.`
      : `${(k * 100).toFixed(1)}% strikeouts — middling. Neither extreme applies; rank cards on total value, not on one rating.`);
  lines.push(hr < 0.018
    ? `Homers are scarce (${(hr * 100).toFixed(2)}% of PA). Power still leads the lever list but its edge over Eye narrows sharply, and slugging-only bats lose most of their advantage.`
    : hr > 0.030
      ? `Homers are cheap here (${(hr * 100).toFixed(2)}% of PA) — power is the biggest single lever and worth paying up for.`
      : `Homer rate is ordinary (${(hr * 100).toFixed(2)}% of PA).`);
  if (s.env.preset) lines.push(`Set the in-game strategy preset to ${s.env.preset}.`);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="label-eyebrow">Roster note</div>
        {lines.map((l) => <p key={l} className="text-xs leading-relaxed text-muted-foreground">{l}</p>)}
      </CardContent>
    </Card>
  );
}
