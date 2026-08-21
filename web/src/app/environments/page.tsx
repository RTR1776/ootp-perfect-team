"use client";

/**
 * Environments — every tournament's run environment, rules, and the strategy
 * preset to play it with. This page absorbs `PT Strategy Presets by
 * Environment.html`: the RE-model outputs (bunt break-evens, steal break-evens,
 * modeled R/G) were computed there per environment year and are carried in
 * `src/data/environments.json`, joined to each tournament's rule set.
 *
 * Parks: tournaments run in neutral parks — the park machinery matters for the
 * Season team (and lives in the header's context switcher + optimizer). The
 * preset rules already fold the run environment in.
 */

import * as React from "react";
import ENV_DATA from "@/data/environments.json";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EnvEvent {
  name: string;
  tier?: string | null;
  dh?: boolean | null;
  sizes?: number[] | null;
  multi?: boolean | null;
  key?: string;
  kind?: string;
  valueCeiling?: number | null;
  valueFloor?: number | null;
  teamCap?: number | null;
  variantCap?: number | null;
  mode?: string | null;
  eraMin?: number | null;
  eraMax?: number | null;
}

interface Environment {
  year: number;
  src: string;
  rg: number;
  kPa: number;
  hrPa: number;
  babip: number;
  reStart: number;
  bunt12_0: number;
  sbbe0: number;
  preset: string;
  note: string;
  events: EnvEvent[];
}

const PRESET_TONE: Record<string, string> = {
  Sabermetric: "border-sky-500/40 text-sky-400",
  "Moderate Sabermetric": "border-sky-500/30 text-sky-300",
  Balanced: "border-border text-muted-foreground",
  Traditional: "border-amber-500/30 text-amber-300",
  "Moderate Small Ball": "border-amber-500/40 text-amber-400",
  "Small Ball": "border-orange-500/50 text-orange-400",
};

function PresetChip({ preset }: { preset: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        PRESET_TONE[preset] ?? "border-border text-muted-foreground",
      )}
    >
      {preset}
    </span>
  );
}

const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Perfect"];

export default function EnvironmentsPage() {
  const data = ENV_DATA as unknown as { environments: Environment[]; presetLegend: { order: string[]; rules: string[] } };
  const [query, setQuery] = React.useState("");
  const [tier, setTier] = React.useState<string | null>(null);
  const [preset, setPreset] = React.useState<string | null>(null);

  const environments = data.environments;
  const q = query.trim().toLowerCase();

  const filtered = environments
    .map((env) => ({
      ...env,
      events: env.events.filter(
        (e) =>
          (!q || e.name.toLowerCase().includes(q)) &&
          (!tier || (e.tier ?? "").toLowerCase() === tier.toLowerCase()),
      ),
    }))
    .filter((env) => env.events.length > 0 && (!preset || env.preset === preset));

  const totalEvents = filtered.reduce((s, e) => s + e.events.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Environments</h1>
          <p className="text-sm text-muted-foreground">
            {environments.length} run environments · {environments.reduce((s, e) => s + e.events.length, 0)} scheduled
            tournaments · RE model outputs + rules + the preset to set before first pitch
          </p>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="pt-5 pb-4 text-xs text-muted-foreground">
          <span className="mr-3 font-medium text-foreground">How the preset is chosen:</span>
          {data.presetLegend.rules.join(" ")}
          <span className="ml-2">
            The homer-suppressing environments usually read <i>anti</i>-bunt on paper — until R/G collapses; the
            model prices both.
          </span>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search tournaments…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-56"
        />
        {TIERS.map((t) => (
          <button
            key={t}
            onClick={() => setTier(tier === t ? null : t)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              tier === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
        {data.presetLegend.order.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(preset === p ? null : p)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              preset === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{totalEvents} tournaments shown</span>
      </div>

      {/* Environment groups */}
      {filtered.map((env) => (
        <Card key={env.year + env.src}>
          <CardContent className="pt-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-sm font-semibold">{env.year > 1800 ? `${env.year} environment` : "Modern environment"}</h2>
              <PresetChip preset={env.preset} />
              <span className="font-mono text-xs text-muted-foreground">
                R/G {env.rg.toFixed(2)} · K {(env.kPa * 100).toFixed(1)}% · HR/PA {(env.hrPa * 100).toFixed(2)}% ·
                BABIP {env.babip.toFixed(3)} · bunt BE(1st+2nd,0) {env.bunt12_0 >= 0 ? "+" : ""}
                {env.bunt12_0.toFixed(3)} · SB BE {Math.round(env.sbbe0 * 100)}%
              </span>
              {env.note && <span className="text-xs text-amber-400">{env.note}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Tournament</th>
                    <th className="py-2 pr-4">Tier</th>
                    <th className="py-2 pr-4">Sizes</th>
                    <th className="py-2 pr-4">DH</th>
                    <th className="py-2 pr-4">Mode</th>
                    <th className="py-2 pr-4 text-right">Value cap</th>
                    <th className="py-2 pr-4 text-right">Team cap</th>
                    <th className="py-2 pr-4 text-right">Variant cap</th>
                    <th className="py-2 text-right">Card eras</th>
                  </tr>
                </thead>
                <tbody>
                  {env.events.map((e) => (
                    <tr key={e.name} className="border-b border-border/50">
                      <td className="py-1.5 pr-4">
                        {e.name}
                        {e.multi && (
                          <span className="ml-2 rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
                            multi-tag
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{e.tier ?? "—"}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs">{e.sizes?.join("/") ?? "—"}</td>
                      <td className="py-1.5 pr-4">{e.dh == null ? "—" : e.dh ? "DH" : "no DH"}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs">{e.mode ?? "—"}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">
                        {e.valueFloor != null || e.valueCeiling != null
                          ? `${e.valueFloor ?? "…"}–${e.valueCeiling ?? "…"}`
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{e.teamCap ?? "—"}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">
                        {e.variantCap == null ? "—" : e.variantCap === 0 ? "banned" : e.variantCap}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs">
                        {e.eraMin != null ? `${e.eraMin}–${e.eraMax ?? "now"}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        Rules join covers 73 of 86 scheduled tournaments; the rest (mostly retired or renamed events) show the
        environment only. Tournaments run in neutral parks — park factors apply to the Season team via the context
        switcher.
      </p>
    </div>
  );
}
