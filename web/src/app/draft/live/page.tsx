/**
 * /draft/live — the live draft helper: Perfect Drafts whose format is on file
 * (lib/draft/formats.ts), and any other draft set up at draft time from what
 * the event screen shows (lib/draft/custom.ts, "Any draft").
 *
 * Every legal card is scored once here, in the event's run environment and
 * park with the production model (lib/draft/load.ts); the browser then plays
 * out the rounds left for each candidate between picks (lib/draft/engine.ts,
 * in a worker), so nothing mid-draft waits on the server.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { LiveDraft } from "@/components/draft/live-draft";
import { DraftSetup } from "@/components/draft/draft-setup";
import { parkNames } from "@/lib/analytics/tournament-env";
import { customFormat, customFromParams } from "@/lib/draft/custom";
import { DRAFT_FORMATS } from "@/lib/draft/formats";
import { loadDraft, loadDraftFormat, pageData } from "@/lib/draft/load";

export const dynamic = "force-dynamic";

/** The "any draft" entry beside the formats on file (lib/draft/custom). */
const CUSTOM = "custom";

export default async function LiveDraftPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const e = Array.isArray(q.e) ? q.e[0] : q.e;
  const events = [...Object.values(DRAFT_FORMATS).map((f) => ({ series: f.series, short: f.short })), { series: CUSTOM, short: "Any draft" }];
  const isCustom = e === CUSTOM;
  const series = e && DRAFT_FORMATS[e] ? e : events[0].series;

  // A set-up draft: its rounds and environment come from the query string.
  const setup = isCustom ? customFromParams(q) : null;
  const drafts = isCustom
    ? await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments)
      .where(and(eq(tournaments.isDraft, true), eq(tournaments.retired, false))).orderBy(tournaments.name)
    : [];
  const data = isCustom
    ? setup?.draft ? await loadDraftFormat(customFormat(setup.draft), { custom: { stadium: setup.draft.park } }) : null
    : await loadDraft(series);

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
      {isCustom && (
        <DraftSetup key={`setup:${setup?.draft ? customFormat(setup.draft).series : "new"}`} drafts={drafts.filter((d) => !/^(PD-)?(EF|Q)-/i.test(d.name))} parks={parkNames}
          initial={setup?.draft ?? null} errors={setup?.errors ?? []} open={!setup?.draft} />
      )}
      {data ? (
        <LiveDraft key={`draft:${data.format.series}`} events={events} openEvent={isCustom ? CUSTOM : series} data={pageData(data)} />
      ) : isCustom ? (
        !setup?.started && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Or a format on file:</span>
            {events.filter((ev) => ev.series !== CUSTOM).map((ev) => (
              <a key={ev.series} href={`/draft/live?e=${ev.series}`} className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground">{ev.short}</a>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">No catalogue row for this draft.</p>
      )}
    </div>
  );
}
