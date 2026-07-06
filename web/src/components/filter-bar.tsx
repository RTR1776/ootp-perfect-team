"use client";

import { TIERS, POSITIONS, type Tier, type Position } from "@/lib/types";
import { TIER_COLORS } from "@/lib/tiers";
import { useDataStore, type Mode } from "@/lib/data";
import { cn } from "@/lib/utils";

const HITTER_POS: Position[] = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const PITCHER_POS: Position[] = ["SP", "RP", "CL"];

export function FilterBar() {
  const mode = useDataStore((s) => s.mode);
  const f = useDataStore((s) => s.filters);
  const toggleTier = useDataStore((s) => s.toggleTier);
  const togglePosition = useDataStore((s) => s.togglePosition);
  const setBats = useDataStore((s) => s.setBats);
  const setThrows = useDataStore((s) => s.setThrows);
  const setMinWOBA = useDataStore((s) => s.setMinWOBA);
  const setMinWAR = useDataStore((s) => s.setMinWAR);
  const reset = useDataStore((s) => s.resetFilters);

  const positions = mode === "pitchers" ? PITCHER_POS : HITTER_POS;

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-border bg-card/50 px-4 py-3">
      {/* Tiers */}
      <Group label="Tier">
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map((t) => (
            <TierChip key={t} tier={t} active={f.tiers.has(t)} onClick={() => toggleTier(t)} />
          ))}
        </div>
      </Group>

      {/* Positions */}
      <Group label="Position">
        <div className="flex flex-wrap gap-1.5">
          {positions.map((p) => (
            <Chip key={p} active={f.positions.has(p)} onClick={() => togglePosition(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </Group>

      {/* Handedness */}
      {mode === "hitters" ? (
        <Group label="Bats">
          <Select
            value={f.bats}
            onChange={(v) => setBats(v as typeof f.bats)}
            options={[
              ["any", "Any"],
              ["R", "R"],
              ["L", "L"],
              ["S", "S"],
            ]}
          />
        </Group>
      ) : (
        <Group label="Throws">
          <Select
            value={f.throws}
            onChange={(v) => setThrows(v as typeof f.throws)}
            options={[
              ["any", "Any"],
              ["R", "R"],
              ["L", "L"],
            ]}
          />
        </Group>
      )}

      {mode === "hitters" && (
        <Group label={`Min wOBA · ${f.minWOBA.toFixed(3).replace(/^0/, "")}`}>
          <input
            type="range"
            min={0}
            max={0.45}
            step={0.005}
            value={f.minWOBA}
            onChange={(e) => setMinWOBA(Number(e.target.value))}
            className="w-32 accent-[var(--primary)]"
          />
        </Group>
      )}

      <Group label={`Min WAR · ${f.minWAR.toFixed(1)}`}>
        <input
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={f.minWAR}
          onChange={(e) => setMinWAR(Number(e.target.value))}
          className="w-32 accent-[var(--primary)]"
        />
      </Group>

      <button
        onClick={reset}
        className="ml-auto self-center text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Reset filters
      </button>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function TierChip({
  tier,
  active,
  onClick,
}: {
  tier: Tier;
  active: boolean;
  onClick: () => void;
}) {
  const color = TIER_COLORS[tier];
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        active ? "" : "border-border text-muted-foreground hover:text-foreground"
      )}
      style={
        active
          ? { color, borderColor: `${color}66`, backgroundColor: `${color}1f` }
          : undefined
      }
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {tier}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-popover text-popover-foreground">
          {l}
        </option>
      ))}
    </select>
  );
}

export { Mode };
