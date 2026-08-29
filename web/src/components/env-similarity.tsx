"use client";

/**
 * "Which tournaments play like this one?"
 *
 * Pick an era and a ballpark — or start from a tournament and then change
 * either — and every event is ranked by how close its own run environment
 * sits. The target is solved in the browser (one Markov pass, sub-millisecond)
 * so the pickers respond instantly; the tournaments' own environments are
 * solved on the server and arrive with the page.
 *
 * Default ranking is OFFENSE SHAPE — scoring, strikeouts, the homer and hit
 * rates — because that is what decides which cards are worth rostering. Bunt
 * and steal break-evens are shown but excluded, since they only matter when
 * you are picking a small-ball preset; the toggle folds them back in.
 */

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  OFFENSE_KEYS, STRATEGY_KEYS, distance, eraFor, eraTable, eraYears,
  parkNames, parkTable, solveFor, spreads, vectorOf,
  type EnvVector, type MetricKey,
} from "@/lib/analytics/tournament-env";
import { cn } from "@/lib/utils";

export interface TournamentEnv {
  id: number;
  name: string;
  envYear: number | null;
  eraLabel: string;
  stadium: string | null;
  parkLabel: string;
  tier: string | null;
  cap: string | null;
  dh: boolean | null;
  entrants: number | null;
  series: string | null;
  env: EnvVector;
}

const fmtSigned = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(3);

/** Module scope on purpose: an inline component remounts each render, which
 *  drops focus out of the select you are mid-way through changing. */
const Sel = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className="h-8 rounded-md border border-border bg-background px-2 text-xs" />
);

const PRESET_TONE: Record<string, string> = {
  Sabermetric: "text-sky-400", "Moderate Sabermetric": "text-sky-300",
  Balanced: "text-muted-foreground", Traditional: "text-amber-300",
  "Moderate Small Ball": "text-amber-400", "Small Ball": "text-orange-400",
};

export function EnvSimilarity({ tournaments }: { tournaments: TournamentEnv[] }) {
  const [from, setFrom] = React.useState<string>("");            // tournament id, or "" for custom
  const [eraYear, setEraYear] = React.useState<number>(1998);
  const [parkName, setParkName] = React.useState<string>("Coors Field");
  const [parkYear, setParkYear] = React.useState<string>("1996");
  const [lhb, setLhb] = React.useState<number>(0.35);
  const [withStrategy, setWithStrategy] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const parkYears = React.useMemo(
    () => (parkName === "" ? [] : Object.keys(parkTable[parkName] ?? {}).sort((a, b) => +b - +a)),
    [parkName],
  );

  /** Starting from a tournament just fills the boxes — they stay editable. */
  const startFrom = (id: string) => {
    setFrom(id);
    const t = tournaments.find((x) => String(x.id) === id);
    if (!t) return;
    if (t.envYear != null) setEraYear(t.envYear);
    const m = /^(\d{4})\s+(.*)$/.exec(t.stadium ?? "");
    const nm = (m ? m[2] : t.stadium ?? "").trim();
    if (parkTable[nm]) {
      setParkName(nm);
      const ys = Object.keys(parkTable[nm]).map(Number);
      const want = m ? Number(m[1]) : ys[ys.length - 1];
      setParkYear(String(ys.reduce((b, y) => (Math.abs(y - want) < Math.abs(b - want) ? y : b), ys[0])));
    } else { setParkName(""); setParkYear(""); }
  };

  const era = eraFor(eraYear);
  const parkRow = parkName && parkYear ? parkTable[parkName]?.[parkYear] ?? null : null;

  const target = React.useMemo(
    () => (era ? vectorOf(solveFor(era.row, parkRow, lhb)) : null),
    [era, parkRow, lhb],
  );

  const keys: readonly MetricKey[] = React.useMemo(
    () => (withStrategy ? [...OFFENSE_KEYS, ...STRATEGY_KEYS] : OFFENSE_KEYS),
    [withStrategy],
  );
  const sd = React.useMemo(() => spreads(tournaments.map((t) => t.env), [...OFFENSE_KEYS, ...STRATEGY_KEYS]), [tournaments]);

  const q = query.trim().toLowerCase();
  const ranked = React.useMemo(() => {
    if (!target) return [];
    return tournaments
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .map((t) => ({ ...t, d: distance(t.env, target, keys, sd) }))
      .sort((a, b) => a.d - b.d);
  }, [tournaments, target, keys, sd, q]);

  const neutral = era ? vectorOf(solveFor(era.row, null, lhb)) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Similar environments</h2>
          <p className="text-xs text-muted-foreground">
            Era and ballpark are set separately in PT, and both rotate — pick the pair you care about and every
            tournament is ranked by how close its own run environment sits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Start from</span>
          <Sel value={from} onChange={(e) => startFrom(e.target.value)}>
            <option value="">— set it by hand —</option>
            {[...tournaments].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.envYear ? ` · ${t.envYear}` : ""}</option>
            ))}
          </Sel>

          <span className="ml-2 text-muted-foreground">Era</span>
          <Sel value={eraYear} onChange={(e) => { setEraYear(+e.target.value); setFrom(""); }}>
            {eraYears.map((y) => (
              <option key={y} value={y}>
                {y === 0 ? "PT default (modern)" : y} · {eraTable[String(y)].rg.toFixed(2)} R/G
                {eraTable[String(y)].src === "MLB-derived" ? "" : " ★"}
              </option>
            ))}
          </Sel>

          <span className="ml-2 text-muted-foreground">Park</span>
          <Sel
            value={parkName}
            onChange={(e) => {
              const n = e.target.value; setParkName(n); setFrom("");
              const ys = Object.keys(parkTable[n] ?? {}).sort((a, b) => +b - +a);
              setParkYear(ys[0] ?? "");
            }}
          >
            <option value="">Neutral / Standard Stadium</option>
            {parkNames.map((p) => <option key={p} value={p}>{p}</option>)}
          </Sel>
          {parkYears.length > 0 && (
            <Sel value={parkYear} onChange={(e) => { setParkYear(e.target.value); setFrom(""); }}>
              {parkYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </Sel>
          )}

          <span className="ml-2 text-muted-foreground">LHB</span>
          <Sel value={lhb} onChange={(e) => setLhb(+e.target.value)}>
            {[0.25, 0.35, 0.5, 0.65].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
          </Sel>

          <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={withStrategy} onChange={(e) => setWithStrategy(e.target.checked)} />
            match small-ball too
          </label>
          <Input placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} className="ml-auto h-8 w-40 text-xs" />
        </div>

        {/* target */}
        {target && era && neutral && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold">
                {eraYear === 0 ? "PT default" : eraYear} at {parkRow ? `${parkName} ${parkYear}` : "a neutral park"}
              </span>
              <span className={cn("text-xs font-medium", PRESET_TONE[target.preset])}>{target.preset}</span>
              <span className="font-mono text-xs text-muted-foreground">
                R/G {target.rg.toFixed(2)} · K {(target.k * 100).toFixed(1)}% · HR/PA {(target.hr * 100).toFixed(2)}% ·
                1B/PA {(target.b1 * 100).toFixed(1)}% · bunt {fmtSigned(target.bunt)} · SB BE {Math.round(target.sb * 100)}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {era.label}
              {parkRow
                ? ` · park moves R/G ${neutral.rg.toFixed(2)} → ${target.rg.toFixed(2)} (AVG ×${
                    (parkRow.avgL * lhb + parkRow.avgR * (1 - lhb)).toFixed(3)
                  }, HR ×${(parkRow.hrL * lhb + parkRow.hrR * (1 - lhb)).toFixed(3)})`
                : " · neutral park"}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Tournament</th>
                <th className="py-2 pr-3">Era · park</th>
                <th className="py-2 pr-3 text-right">R/G</th>
                <th className="py-2 pr-3 text-right">K%</th>
                <th className="py-2 pr-3 text-right">HR/PA</th>
                <th className="py-2 pr-3 text-right">1B/PA</th>
                <th className="py-2 pr-3 text-right">bunt</th>
                <th className="py-2 pr-3 text-right">SB BE</th>
                <th className="py-2 pr-3">Cap</th>
                <th className="py-2 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="[font-variant-numeric:tabular-nums]">
              {ranked.slice(0, 25).map((t, i) => (
                <tr key={t.id} className={cn("border-b border-border/50", i < 3 && "bg-primary/5")}>
                  <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-3">
                    <Link href={`/build?t=${t.id}`} className="hover:underline">{t.name}</Link>
                    {t.series && <span className="ml-1.5 text-[10px] text-emerald-500 dark:text-emerald-400">●</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                    {t.envYear ?? "—"} · {t.stadium ?? "neutral"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs font-semibold">{t.env.rg.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">{(t.env.k * 100).toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">{(t.env.hr * 100).toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs">{(t.env.b1 * 100).toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground">{fmtSigned(t.env.bunt)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground">{Math.round(t.env.sb * 100)}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">{t.cap ?? "—"}</td>
                  <td className="py-1.5 text-right font-mono text-xs">{t.d.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Gap is a standard-deviation distance across {withStrategy ? "scoring, K, HR, hits AND the bunt/steal break-evens" : "scoring, K, HR and the hit rates"} —
          0 is identical, 1 means one typical spread apart. ★ marks an era fitted to PT itself; the rest are derived
          from MLB year-by-year rates. ● marks an event you already have observed stats for. Card caps differ even
          when the environment matches — a Bronze event deadens a hitter&apos;s park that a Diamond field would exploit.
        </p>
      </CardContent>
    </Card>
  );
}
