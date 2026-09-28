"use client";

/**
 * A card's name as every table shows it (UI plan G4): tier dot, the name
 * linking to that one card on /cards, one "V" chip for a variant, a dot when
 * it's owned, and a muted "value · year · set" (the set's short tag, its full
 * name on hover; in the tooltip when `compact`). The muted part moves under
 * the name when the cell is narrow, so the name keeps its room on a phone.
 * It replaces each page's own "own", "KC", " VAR" and raw shop titles.
 *
 * The link goes by card id, not by name: two Hank Aarons and two Piazzas
 * share a name. It never prefetches: a table holds hundreds of them, and each
 * would be a request for a dynamic page.
 */
import Link from "next/link";
import { TierDot } from "@/components/tier-badge";
import { CARD_TYPE_NAME, CARD_TYPE_SHORT } from "@/lib/card-sets";
import { isTier } from "@/lib/tiers";
import { tierCode, TIER_NAME } from "@/lib/roster-rules";
import { cn } from "@/lib/utils";

export function cardHref(id: number, eventId?: number | null) {
  return `/cards?id=${id}${eventId ? `&event=${eventId}` : ""}`;
}

export function CardName({
  id, name, val, tier, year, set, owned, variant, eventId, compact = false, className,
}: {
  id: number;
  name: string;
  val: number | null;
  /** Tier name; read from the value when absent. */
  tier?: string | null;
  year?: number | null;
  /** Card set (cards.card_type). */
  set?: number | null;
  owned?: boolean;
  variant?: boolean;
  /** The event the card page reads it in; none (or 0) is the PT default. */
  eventId?: number | null;
  compact?: boolean;
  className?: string;
}) {
  const t = isTier(tier) ? tier : val != null ? TIER_NAME[tierCode(val)] : null;
  const setName = set != null ? CARD_TYPE_NAME[set] ?? null : null;
  const setTag = set != null ? CARD_TYPE_SHORT[set] ?? null : null;
  const meta = [val, year, compact ? null : setTag].filter((x) => x != null).join(" · ");
  return (
    <span className={cn("inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5", className)} title={compact && setName ? setName : undefined}>
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
        {t && isTier(t) && <TierDot tier={t} className="size-2 shrink-0" />}
        <Link href={cardHref(id, eventId)} prefetch={false} className="truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{name}</Link>
        {variant && <span className="shrink-0 rounded bg-accent px-1 text-[10px] font-semibold" title="Variant">V</span>}
        {owned && <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" title="Owned" aria-label="owned" role="img" />}
      </span>
      {meta && <span className="whitespace-nowrap text-[11px] text-muted-foreground" title={!compact && setName ? setName : undefined}>{meta}</span>}
    </span>
  );
}
