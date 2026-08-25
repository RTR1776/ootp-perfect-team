/**
 * /build — the tournament roster builder.
 *
 * Server side: resolve the tournament catalog, the chosen tournament's park
 * and legality window, L.J.'s latest collection (joined to card ratings), and
 * observed per-card performance — for this tournament's series and PA/IP-
 * weighted across every series as a fallback. All interaction lives in the
 * RosterBuilder client component.
 */

import { db } from "@/db/client";
import {
  cards,
  collectionCards,
  observedCardStats,
  parks,
  rosters,
  rosterSlots,
  tournaments,
  uploads,
} from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { RosterBuilder, type BuilderCard, type ObservedLine, type TournamentInfo } from "@/components/roster-builder";

export const dynamic = "force-dynamic";

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  const catalog = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      envYear: tournaments.envYear,
      stadium: tournaments.stadium,
      simRuns: tournaments.simRuns,
      isDraft: tournaments.isDraft,
      series: tournaments.series,
      ratingsMax: tournaments.ratingsMax,
    })
    .from(tournaments)
    .orderBy(desc(tournaments.simRuns), tournaments.name);

  if (catalog.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Build</h1>
        <p className="text-sm text-muted-foreground">
          No tournaments loaded yet — run <code>pnpm import:tournaments</code> after the next data drop.
        </p>
      </div>
    );
  }

  const picked = t ? catalog.find((c) => String(c.id) === t) ?? null : null;

  let tournament: TournamentInfo | null = null;
  let pool: BuilderCard[] = [];
  let savedRosters: { id: number; name: string; slots: { cardId: number; slot: string; versusHand: string | null; lineupOrder: number | null }[] }[] = [];

  if (picked) {
    const [full] = await db.select().from(tournaments).where(eq(tournaments.id, picked.id));
    const park = full.parkName
      ? (await db.select().from(parks).where(eq(parks.name, full.parkName)))[0] ?? null
      : null;
    tournament = {
      id: full.id,
      name: full.name,
      envYear: full.envYear,
      mode: full.mode,
      stadium: full.stadium,
      dh: full.dh,
      entrants: full.entrants,
      ratingsMin: full.ratingsMin,
      ratingsMax: full.ratingsMax,
      cardYearMin: full.cardYearMin,
      cardYearMax: full.cardYearMax,
      series: full.series,
      isDraft: full.isDraft,
      park: park
        ? { name: park.name, avg: avg2(park.avgL, park.avgR), hr: avg2(park.hrL, park.hrR), b2: park.b2, b3: park.b3 }
        : null,
    };

    const [latestCollection] = await db
      .select({ id: uploads.id })
      .from(uploads)
      .where(eq(uploads.kind, "collection"))
      .orderBy(desc(uploads.id))
      .limit(1);

    if (latestCollection) {
      const owned = await db
        .select({
          cardId: collectionCards.cardId,
          isActive: collectionCards.isActive,
          isVariant: collectionCards.isVariant,
        })
        .from(collectionCards)
        .where(eq(collectionCards.uploadId, latestCollection.id));
      const ownedIds = [...new Set(owned.map((o) => o.cardId).filter((x): x is number => x != null))];

      const cardRows = ownedIds.length
        ? await db
            .select({
              cardId: cards.cardId,
              name: cards.name,
              tier: cards.tier,
              cardValue: cards.cardValue,
              position: cards.position,
              pitcherRole: cards.pitcherRole,
              isPitcher: cards.isPitcher,
              bats: cards.bats,
              throws: cards.throws,
              year: cards.year,
              ratings: cards.ratings,
            })
            .from(cards)
            .where(inArray(cards.cardId, ownedIds))
        : [];

      const activeSet = new Set(owned.filter((o) => o.isActive).map((o) => o.cardId));
      const variantSet = new Set(owned.filter((o) => o.isVariant).map((o) => o.cardId));

      // Observed: this tournament's series, plus a PA/IP-weighted career line.
      const seriesRows: ObservedLine[] = full.series
        ? (
            await db
              .select({
                cardId: observedCardStats.cardId,
                pa: observedCardStats.pa,
                ip: observedCardStats.ip,
                woba: observedCardStats.woba,
                fip: observedCardStats.fip,
                war: observedCardStats.war,
                instances: observedCardStats.instances,
              })
              .from(observedCardStats)
              .where(eq(observedCardStats.series, full.series))
          ).map((r) => ({ ...r, woba: r.woba ?? null, fip: r.fip ?? null }))
        : [];

      const careerRows = ownedIds.length
        ? await db
            .select({
              cardId: observedCardStats.cardId,
              pa: sql<number>`sum(${observedCardStats.pa})`.mapWith(Number),
              ip: sql<number>`sum(${observedCardStats.ip})`.mapWith(Number),
              war: sql<number>`sum(${observedCardStats.war})`.mapWith(Number),
              woba: sql<number | null>`sum(${observedCardStats.woba} * ${observedCardStats.pa}) / nullif(sum(case when ${observedCardStats.woba} is not null then ${observedCardStats.pa} end), 0)`,
              fip: sql<number | null>`sum(${observedCardStats.fip} * ${observedCardStats.ip}) / nullif(sum(case when ${observedCardStats.fip} is not null then ${observedCardStats.ip} end), 0)`,
              instances: sql<number>`sum(${observedCardStats.instances})`.mapWith(Number),
            })
            .from(observedCardStats)
            .where(inArray(observedCardStats.cardId, ownedIds))
            .groupBy(observedCardStats.cardId)
        : [];

      const bySeries = new Map(seriesRows.map((r) => [r.cardId, r]));
      const byCareer = new Map(careerRows.map((r) => [r.cardId, r as ObservedLine]));

      const KEEP_RATINGS = [
        "Contact", "Gap", "Power", "Eye", "Avoid Ks", "BABIP",
        "Contact vL", "Gap vL", "Power vL", "Eye vL", "Avoid K vL", "BABIP vL",
        "Contact vR", "Gap vR", "Power vR", "Eye vR", "Avoid K vR", "BABIP vR",
        "Stuff", "Movement", "Control", "pHR", "pBABIP",
        "Stuff vL", "Movement vL", "Control vL", "pHR vL", "pBABIP vL",
        "Stuff vR", "Movement vR", "Control vR", "pHR vR", "pBABIP vR",
        "Speed", "Stealing", "Baserunning", "Stamina",
        "Pos Rating C", "Pos Rating 1B", "Pos Rating 2B", "Pos Rating 3B",
        "Pos Rating SS", "Pos Rating LF", "Pos Rating CF", "Pos Rating RF",
      ];
      const trim = (r: Record<string, number>) => {
        const out: Record<string, number> = {};
        for (const k of KEEP_RATINGS) if (r[k] != null) out[k] = r[k];
        return out;
      };

      pool = cardRows.map((c) => ({
        cardId: c.cardId,
        name: c.name,
        tier: c.tier,
        val: c.cardValue,
        pos: c.position ?? "?",
        role: c.pitcherRole,
        isPitcher: c.isPitcher ?? false,
        bats: c.bats,
        year: c.year,
        active: activeSet.has(c.cardId),
        variant: variantSet.has(c.cardId),
        ratings: trim((c.ratings ?? {}) as Record<string, number>),
        obs: bySeries.get(c.cardId) ?? null,
        career: byCareer.get(c.cardId) ?? null,
      }));
    }

    const savedList = await db
      .select()
      .from(rosters)
      .where(eq(rosters.tournamentId, picked.id))
      .orderBy(desc(rosters.updatedAt));
    if (savedList.length) {
      const slotRows = await db
        .select()
        .from(rosterSlots)
        .where(inArray(rosterSlots.rosterId, savedList.map((r) => r.id)));
      savedRosters = savedList.map((r) => ({
        id: r.id,
        name: r.name,
        slots: slotRows
          .filter((s) => s.rosterId === r.id)
          .map((s) => ({ cardId: s.cardId, slot: s.slot, versusHand: s.versusHand, lineupOrder: s.lineupOrder })),
      }));
    }
  }

  return (
    <RosterBuilder
      catalog={catalog.map((c) => ({
        id: c.id,
        label: `${c.name}${c.envYear ? ` · ${c.envYear}` : ""}${c.series ? "" : c.isDraft ? " (PD)" : ""}`,
        simRuns: c.simRuns ?? 0,
        hasSeries: !!c.series,
      }))}
      tournament={tournament}
      pool={pool}
      savedRosters={savedRosters}
    />
  );
}

function avg2(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return Math.round((((a ?? b)! + (b ?? a)!) / 2) * 1000) / 1000;
}
