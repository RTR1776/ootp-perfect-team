import { TIER_COLORS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** `color` at `pct`% strength — works with the CSS-variable tier colours. */
const mix = (color: string, pct: number) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;

export function TierDot({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 rounded-full", className)}
      style={{ backgroundColor: TIER_COLORS[tier], boxShadow: `0 0 6px ${mix(TIER_COLORS[tier], 40)}` }}
    />
  );
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const color = TIER_COLORS[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        className
      )}
      style={{
        color,
        borderColor: mix(color, 35),
        backgroundColor: mix(color, 8),
      }}
    >
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {tier}
    </span>
  );
}
