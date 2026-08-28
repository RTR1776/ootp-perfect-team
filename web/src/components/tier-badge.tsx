import { TIER_COLORS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function TierDot({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 rounded-full", className)}
      style={{ backgroundColor: TIER_COLORS[tier], boxShadow: `0 0 6px ${TIER_COLORS[tier]}66` }}
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
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
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
