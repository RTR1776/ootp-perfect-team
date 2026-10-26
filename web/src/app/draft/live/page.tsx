/**
 * /draft/live — the live draft helper, for Perfect Drafts whose format is on
 * file (lib/draft/formats.ts): Laptophound's 5L Deadball and 6L Power Play.
 *
 * Every legal card is scored once here, in the event's run environment and
 * park with the production model (lib/draft/load.ts); the browser then plays
 * out the rounds left for each candidate between picks (lib/draft/engine.ts,
 * in a worker), so nothing mid-draft waits on the server.
 */
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { LiveDraft } from "@/components/draft/live-draft";
import { DRAFT_FORMATS } from "@/lib/draft/formats";
import { loadDraft, pageData } from "@/lib/draft/load";

export const dynamic = "force-dynamic";

export default async function LiveDraftPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const events = Object.values(DRAFT_FORMATS).map((f) => ({ series: f.series, short: f.short }));
  const series = e && DRAFT_FORMATS[e] ? e : events[0].series;
  const data = await loadDraft(series);

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="draft" />
      <PageHeader
        eyebrow="Play"
        title="Live Draft"
        description="Each pick: the card that leaves your finished team best, in this event's run environment, with the rounds still to come priced in."
        about={
          <>
            <p>
              Pick the event, then each round either type the cards in the pack (a few letters and Enter each) or find
              them on the board. The top row is the pick. Enter on an empty box takes it; Undo takes it back.
            </p>
            <p>
              A card&apos;s score is the expected value of the team you finish with if you take it: your picks scored
              exactly (lineups on both boards with gloves, rotation, pen, bench), and every round left played out as the
              expected best card of a pack from its pool. Runs are the production model&apos;s, as Build and Card Fit
              price them. Docs/Draft Helper 2026-10-26.md has what it is based on and what is assumed.
            </p>
          </>
        }
      />
      {data ? (
        <LiveDraft key={series} events={events} data={pageData(data)} />
      ) : (
        <p className="text-sm text-muted-foreground">No catalogue row for this draft.</p>
      )}
    </div>
  );
}
