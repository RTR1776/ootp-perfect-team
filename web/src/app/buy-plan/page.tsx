/**
 * Buy Plan (lib/buy-plan-load): where to put PP and CS across every tier he
 * plays. Refreshes itself when a new collection, card list, saved roster or
 * logged result arrives; the Clubhouse prices come from his screenshots.
 *
 * The scan scores every card in each event he plays (Upgrades' scan over
 * those events), so it is cached per data version (lib/buy-plan-cache) and
 * streams in.
 */
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { BuyPlanBoard } from "@/components/buy-plan-board";
import { buyPlan } from "@/lib/buy-plan-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function Board() {
  const data = await buyPlan();
  if (!data.events.length) return <p className="py-6 text-center text-sm text-muted-foreground">No logged results in the last three weeks to weight the events by. Log results on PTCS.</p>;
  return <BuyPlanBoard data={data} />;
}

export default function BuyPlanPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="needs" />
      <PageHeader
        eyebrow="Scout"
        title="Buy Plan"
        description="Where you're short across the tiers you play, what to buy for PP and CS, and what to sell to pay for it."
        about={<>
          <p>Every event you&rsquo;ve entered in the last three weeks counts, by how often you enter it. A card&rsquo;s worth is what it adds to your saved roster in each of those events (Card Fit&rsquo;s one swap) times your entries a week there.</p>
          <p>It updates on its own when you upload a collection or card list, save a roster or log results. Clubhouse prices need new screenshots.</p>
        </>}
      />
      <Suspense fallback={<p className="animate-pulse py-6 text-center text-sm text-muted-foreground">Scoring every card in each event you play…</p>}>
        <Board />
      </Suspense>
    </div>
  );
}
