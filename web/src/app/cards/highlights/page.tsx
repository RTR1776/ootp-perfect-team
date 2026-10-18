/**
 * Cards → Highlights: the new cards as tiles (L.J., 2026-10-18: "a little
 * highlights page showing them, where they play, how strong they are … also
 * for my new cards that I get like new variants … something visual and fun").
 *
 *   /cards/highlights    a spotlight on the biggest gain; what he just got
 *                        (cards and variants new since the collection
 *                        before); the game's new cards by the day they
 *                        dropped. Every tile opens /cards?id=<id>.
 *
 * The same cached Card Fit entry as the New table on /cards
 * (lib/card-fit-cache), so whichever page loads first warms the other.
 */
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { EmptyState } from "@/components/empty-state";
import { CardHighlights } from "@/components/card-highlights";
import { newCardsFit } from "@/lib/card-fit-cache";
import { toHighlights } from "@/lib/card-highlights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function Board() {
  const { pulled, variants, data } = await newCardsFit();
  if (!data.cards.length) {
    return (
      <EmptyState
        icon="upload"
        title="No new cards on file"
        description="Drop the shop list (or your collection) on Upload after a release, and the new cards show up here."
        action={{ href: "/upload", label: "Go to Upload" }}
        className="min-h-[30vh]"
      />
    );
  }
  return (
    <CardHighlights
      highlights={toHighlights({ data, pulled, variants })}
      events={data.events.length}
      collectionDate={data.collectionDate}
      shopDate={data.shopDate}
      hasPulled={pulled.length > 0}
    />
  );
}

/** The page's shape while Card Fit places the cards (seconds on a cold cache). */
function Placing() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="animate-pulse text-sm text-muted-foreground">Placing the new cards in every current event…</p>
      <div className="skeleton h-56 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
      </div>
    </div>
  );
}

export default function CardHighlightsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionTabs section="cards" />
      <PageHeader
        eyebrow="Scout"
        title="New card highlights"
        description={<>What you just got and what the game just dropped: where each card starts for you, the runs it adds, and what it costs.</>}
      />
      <Suspense fallback={<Placing />}>
        <Board />
      </Suspense>
    </div>
  );
}
