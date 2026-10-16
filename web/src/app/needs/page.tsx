/**
 * Needs — where the collection is weak by tier and position, weighted by the
 * tiers he plays, and the cards that close each gap with a price call
 * (lib/needs-load, on Era Strength's scoring). Era Strength's cache is shared:
 * the same key, so the five-second scoring runs once for both pages.
 */
import { unstable_cache } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { importBatches } from "@/db/schema";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NeedsBoard } from "@/components/needs-board";
import { latestSources, loadEraStrength } from "@/lib/era-strength-load";
import { loadNeeds } from "@/lib/needs-load";

export const dynamic = "force-dynamic";

export default async function NeedsPage() {
  const [[batch], { collection, shop }] = await Promise.all([
    db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1),
    latestSources(),
  ]);
  if (!collection) {
    return <EmptyState icon="market" title="Needs" description="Where your cards are weakest, and what to buy." hint={<>It needs your collection: drop the collection export on Upload.</>} />;
  }
  const key = ["eras", "v2", String(batch?.id ?? 0), String(collection.id), String(shop?.id ?? 0)];
  const era = await unstable_cache(loadEraStrength, key, { revalidate: 3600, tags: ["eras"] })();
  const data = await unstable_cache(() => loadNeeds(era), ["needs", "v1", ...key], { revalidate: 3600, tags: ["needs"] })();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Scout"
        title="Needs"
        description="Where your cards are weakest, tier by tier and spot by spot, and what to buy at what price."
        about={`Gaps are Era Strength's: your best card at each spot against the best legal card in the tier, each card once, over five eras in a neutral park. Tiers are ordered by how much you play them this PTCS period. Prices are the shop list's ask, bid and last-10 over the last two weeks. Collection ${data.collectionDate ?? "?"} · shop ${data.shopDate ?? "?"}.`}
      />
      <NeedsBoard data={data} />
    </div>
  );
}
