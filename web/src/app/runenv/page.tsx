/**
 * /runenv — the run-environment workbench.
 *
 * Server side is thin on purpose: it hands down which events exist and what
 * era + ballpark each runs, and the entire model runs in the browser off the
 * static era/park/curve tables. No observed stats are consulted anywhere on
 * this page, which is exactly why it works for a championship berth nobody has
 * a comparable run for.
 */

import { and, asc, eq, isNotNull, like, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";
import { RunEnvExplorer } from "@/components/runenv/explorer";
import type { BerthRow } from "@/components/runenv/berth-grid";
import { ownedPool } from "@/lib/analytics/runenv-pool";
import { parkFor } from "@/lib/analytics/tournament-env";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

export const dynamic = "force-dynamic";

/** "PTCS 7 Championship - Gold" → "PTCS 7 Championship". */
const champOf = (name: string) => /^(.*Championship) - /.exec(name)?.[1] ?? null;

/** Berth order as the ladder runs it, not alphabetical. */
const TIER_ORDER = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Live", "Cap"];

/**
 * Resolve the stadium string through the same matcher /environments uses, so
 * databotai's spellings and its missing park-years land on a real factor row
 * rather than silently going neutral.
 */
const splitStadium = (stadium: string | null): { park: string | null; parkYear: number | null } => {
  if (!stadium) return { park: null, parkYear: null };
  const pick = parkFor(stadium);
  if (pick.row) return { park: pick.name, parkYear: pick.year };
  const m = /^(\d{4})\s+(.*)$/.exec(stadium);
  return m ? { park: m[2].trim(), parkYear: Number(m[1]) } : { park: stadium.trim(), parkYear: null };
};

const band = (min: number | null, max: number | null) =>
  min == null && max == null ? null : `val ${min ?? ""}–${max ?? ""}`;

const cardYears = (min: number | null, max: number | null) =>
  min == null && max == null ? null : `${min ?? ""}–${max ?? ""}`;

type Row = typeof tournaments.$inferSelect;

function toBerth(t: Row): BerthRow {
  const { park, parkYear } = splitStadium(t.stadium);
  const category = t.name.includes(" - ") ? t.name.split(" - ").pop()!.trim() : null;
  return {
    key: String(t.id),
    label: champOf(t.name) ? t.name.replace(`${champOf(t.name)} - `, "") : t.name,
    category,
    year: t.envYear,
    park,
    parkYear,
    dh: t.dh,
    band: band(t.ratingsMin, t.ratingsMax),
    cardYears: cardYears(t.cardYearMin, t.cardYearMax),
    yearMin: t.cardYearMin,
    yearMax: t.cardYearMax,
    valMin: t.ratingsMin,
    valMax: t.ratingsMax,
    note: null,
  };
}

export default async function RunEnvPage() {
  const pool = await ownedPool();

  // The berth strip is the championship still to be played (its events not
  // retired), newest first; with none coming up the page opens on a current event.
  const champ = await db
    .select().from(tournaments)
    .where(and(like(tournaments.name, "%Championship - %"), eq(tournaments.isDraft, false), eq(tournaments.retired, false)));
  const CHAMPIONSHIP = champ.reduce<{ name: string | null; id: number }>((best, t) => (t.id > best.id ? { name: champOf(t.name), id: t.id } : best), { name: null, id: -1 }).name;

  const berths = champ
    .filter((t) => CHAMPIONSHIP && champOf(t.name) === CHAMPIONSHIP)
    .map(toBerth)
    .sort((a, b) => TIER_ORDER.indexOf(a.category ?? "") - TIER_ORDER.indexOf(b.category ?? ""));

  const scheduled = await db
    .select().from(tournaments)
    .where(and(
      eq(tournaments.retired, false),
      eq(tournaments.isDraft, false),
      isNotNull(tournaments.envYear),
      ne(tournaments.name, ""),
    ))
    .orderBy(asc(tournaments.name));

  const events = scheduled
    .filter((t) => !champOf(t.name))
    .map((t) => ({ ...toBerth(t), label: t.name }));

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="environments" />
      <PageHeader
        eyebrow="Environment"
        title="Era + park"
        description="Pick an era and a ballpark and read what the roster should look like — which ratings pay, which side of the plate the park favours, and which strategy preset to set."
        about="Solved from the model, so it works for an event with no observed data behind it."
      />
      <RunEnvExplorer
        berths={berths}
        events={events}
        championshipLabel={CHAMPIONSHIP ?? ""}
        pool={pool.cards}
        poolAsOf={pool.asOf}
      />
    </div>
  );
}
