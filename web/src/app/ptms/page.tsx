/**
 * PTMS 3 — Saturday 2026-11-21 (L.J. qualified for both standings and enters
 * all six). One place for the six events: each one's rules as the catalogue
 * holds them (src/db/seed/ptms3.json, ids 9130001-06), the park, the roster
 * saved for it, and the way into Build, Upgrades and the draft helper.
 *
 * The tournaments' rosters are the newest saved roster for each event
 * (scripts/roster-save.ts writes "Claude pick <date>"); the drafts show the
 * round structure the live helper uses (lib/draft/formats) with what is
 * assumed in it, since the announcement gives no rounds.
 */

import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rosterSlots, rosters, tournaments } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { RulesStrip } from "@/components/rules-strip";
import { describeRules, type RosterRules } from "@/lib/roster-rules";
import { parkFor } from "@/lib/analytics/tournament-env";
import { DRAFT_FORMATS } from "@/lib/draft/formats";

export const dynamic = "force-dynamic";

const SERIES = "PTMS 3";
const PLAYED_ON = "2026-11-21";

const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
const factor = (v: number | undefined) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));

export default async function PtmsPage() {
  const events = await db.select().from(tournaments).where(eq(tournaments.series, SERIES)).orderBy(tournaments.id);
  const ids = events.map((e) => e.id);
  const saved = ids.length
    ? await db.select({
      id: rosters.id, name: rosters.name, tournamentId: rosters.tournamentId, updatedAt: rosters.updatedAt,
      cards: sql<number>`(select count(*) from ${rosterSlots} where ${rosterSlots.rosterId} = ${rosters.id})`.mapWith(Number),
    }).from(rosters).where(inArray(rosters.tournamentId, ids)).orderBy(desc(rosters.updatedAt))
    : [];
  const newest = new Map<number, (typeof saved)[number]>();
  for (const r of saved) if (r.tournamentId != null && !newest.has(r.tournamentId)) newest.set(r.tournamentId, r);
  const formatOf = new Map(Object.values(DRAFT_FORMATS).map((f) => [f.eventId, f]));

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const days = Math.round((Date.parse(PLAYED_ON) - Date.parse(today)) / 864e5);

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="ptcs" />
      <PageHeader
        eyebrow="Championship"
        title="PTMS 3"
        description={`Saturday, Nov 21${days > 0 ? ` · in ${days} day${days === 1 ? "" : "s"}` : days === 0 ? " · today" : ""}. Three tournaments and three Perfect Drafts, every one best of 9, on the PTMS 1 and 2 points and standings.`}
        about="Rules from the PTMS 3 announcement (11-10), loaded as catalogue events 9130001-06 from src/db/seed/ptms3.json. Rosters are the newest one saved for each tournament; the drafts' rounds are the live helper's, with what is assumed listed under each."
      />

      {events.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">
          The PTMS 3 events aren&apos;t in the catalogue yet: run <code>scripts/import-ptcs6-championship.ts --seed src/db/seed/ptms3.json --id-base 9130000</code>.
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {events.map((e, i) => {
          const rules: RosterRules = {
            name: e.name, dh: e.dh, ratingsMin: e.ratingsMin, ratingsMax: e.ratingsMax,
            cardYearMin: e.cardYearMin, cardYearMax: e.cardYearMax, isDraft: e.isDraft,
            restrictions: (e.restrictions ?? {}) as RosterRules["restrictions"],
          };
          const rx = (e.restrictions ?? {}) as { announcedText?: string; draftFormat?: string };
          const park = parkFor(e.stadium);
          const roster = newest.get(e.id);
          const fmt = formatOf.get(e.id);
          const label = e.isDraft ? `PD ${i - 2}` : `Tournament ${i + 1}`;
          return (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  <span className="text-muted-foreground">{label} · </span>{e.name.replace(/^PTMS 3 (Tournament \d|PD \d) - /, "")}
                </h2>
                <span className="font-mono text-xs text-muted-foreground">#{e.id}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{rx.announcedText}</p>
              <div className="mt-2"><RulesStrip items={describeRules(rules)} compact /></div>
              <p className="mt-2 text-xs">
                <span className="text-muted-foreground">Park </span>{park.label}
                {park.row && (
                  <span className="text-muted-foreground">
                    {" "}· AVG L {factor(park.row.avgL)} / R {factor(park.row.avgR)} · HR L {factor(park.row.hrL)} / R {factor(park.row.hrR)} · 2B {factor(park.row.d2)} · 3B {factor(park.row.d3)}
                  </span>
                )}
              </p>

              {!e.isDraft && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {roster
                    ? <span>Saved: <Link className="underline underline-offset-2" href={`/build?t=${e.id}`}>{roster.name}</Link> <span className="text-muted-foreground">· #{roster.id} · {roster.cards} cards · {fmtDay(roster.updatedAt)}</span></span>
                    : <span className="text-warning">No roster saved yet</span>}
                  <Link className="text-primary underline-offset-2 hover:underline" href={`/build?t=${e.id}`}>Build</Link>
                  <Link className="text-primary underline-offset-2 hover:underline" href={`/upgrades?group=events:${e.id}`}>Upgrades</Link>
                </div>
              )}

              {e.isDraft && (
                <div className="mt-3 text-sm">
                  {fmt ? (
                    <>
                      <p>
                        {fmt.cards} cards: {fmt.rounds.map((r) => `${r.count} ${r.label}`).join(", ")} · packs of {fmt.packSize}
                      </p>
                      <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                        {fmt.assumed.map((a) => <li key={a}><span className="text-warning">Assumed:</span> {a}</li>)}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-4">
                        <Link className="text-primary underline-offset-2 hover:underline" href={`/draft/live?e=${fmt.series}`}>Live draft helper</Link>
                        <Link className="text-primary underline-offset-2 hover:underline" href={`/draft?t=${e.id}`}>Board by position</Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-warning">No draft format set up for this event ({rx.draftFormat ?? "format unknown"}).</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        What to buy across the three tournaments: <Link className="underline" href="/upgrades?group=events:9130001,9130002,9130003">Upgrades for PTMS 3</Link>.
        Qualifying points for PTMS 3 and where they put you are on <Link className="underline" href="/qualifying">PTMS · PTWC</Link>.
      </p>
    </div>
  );
}
