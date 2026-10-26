/**
 * Upgrades — for an event or a group of events (a championship's brackets),
 * what to buy next and what it is worth per PP (lib/upgrades-load):
 *
 *   1. variants of the base cards that start on his saved rosters (×1.08);
 *   2. cards he doesn't own with a price, placed by Card Fit (slots and cap held);
 *   3. confirm a buy: the real rebuild with the card assumed his
 *      (/api/upgrades/confirm), since one-swap gains don't add up.
 *
 *   /upgrades                                the group with the newest saved roster
 *   /upgrades?group=series:PTCS 8 Championship
 *   /upgrades?group=events:9080004,9080005   any events by id
 *
 * The scan scores every card in each event (a few seconds), so it is cached
 * per group and data version (lib/upgrades-cache) and streams in.
 */
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { UpgradesBoard } from "@/components/upgrades-board";
import { upgrades } from "@/lib/upgrades-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function Board({ group }: { group: string | null }) {
  const data = await upgrades(group);
  if (!data) return <p className="py-6 text-center text-sm text-muted-foreground">No event group to scan: two or more current events sharing a series, with a saved roster.</p>;
  return <UpgradesBoard data={data} />;
}

export default async function UpgradesPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const sp = await searchParams;
  const group = sp.group?.trim() || null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Scout"
        title="Upgrades"
        description="What to buy next for an event or a championship's brackets, and what it adds per PP."
        about={<>
          <p>Three reads, all against your newest saved roster in each event, in its run environment and park, tournament play blended in. Runs are in the roster objective&rsquo;s units: a lineup spot counts by the field&rsquo;s share of each hand of pitching, a starter or reliever at the builder&rsquo;s weight.</p>
          <p><b>Variants</b>: each base card that starts, scored again as its variant (its split ratings ×1.08, the median of your own 287 variants; positions stay the base card&rsquo;s). <b>Cards you don&rsquo;t own</b>: Card Fit&rsquo;s one swap, held to the event&rsquo;s tier slots and cap: a card with no slot to sit in pays for the room it needs. <b>Confirm</b>: the full rebuild (env-roster, seeded from the saved roster) with and without the card, because one-swap gains don&rsquo;t simply add.</p>
          <p>Pre-1946 cards&rsquo; ratings don&rsquo;t move week to week; the risk to a buy is a new card taking the job. Rebuild after a drop and scan again.</p>
        </>}
      />
      <Suspense key={group ?? ""} fallback={<p className="animate-pulse py-6 text-center text-sm text-muted-foreground">Scoring every card in each event…</p>}>
        <Board group={group} />
      </Suspense>
    </div>
  );
}
