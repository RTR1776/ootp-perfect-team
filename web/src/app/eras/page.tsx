/**
 * Era Strength — the collection against the best cards in five eras, per
 * tier, and the cards to buy before an event's rules are announced
 * (lib/era-strength).
 *
 *   /eras                    Bronze, ranked by the five-era average
 *   /eras?tier=gold          Silver, Gold or Diamond instead
 *   /eras?rank=worst         ranked by each card's weakest era
 *
 * Scoring every card in fifteen run environments takes about five seconds,
 * so the result is cached, keyed by the newest published tournament import
 * (observed play), collection and shop list: new data makes a new entry.
 */
import { unstable_cache } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { importBatches } from "@/db/schema";
import { EmptyState } from "@/components/empty-state";
import { EraStrengthBoard } from "@/components/era-strength-board";
import { ERA_TIERS, type Rank, type TierKey } from "@/lib/era-strength";
import { latestSources, loadEraStrength } from "@/lib/era-strength-load";

export const dynamic = "force-dynamic";

export default async function ErasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const get = (key: string) => { const v = sp[key]; return Array.isArray(v) ? v[0] : v; };
  const tier: TierKey = ERA_TIERS.find((t) => t.key === get("tier"))?.key ?? "bronze";
  const rank: Rank = get("rank") === "worst" ? "worst" : "avg";

  const [[batch], { collection, shop }] = await Promise.all([
    db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1),
    latestSources(),
  ]);
  if (!collection) {
    return <EmptyState icon="market" title="Era Strength" description="Your cards against the best in five eras, and the buys that close the gaps." hint={<>It needs your collection: drop the collection export on Upload.</>} />;
  }
  const key = ["eras", "v2", String(batch?.id ?? 0), String(collection.id), String(shop?.id ?? 0)];
  const data = await unstable_cache(loadEraStrength, key, { revalidate: 3600, tags: ["eras"] })();
  return <EraStrengthBoard data={data} initialTier={tier} initialRank={rank} />;
}
