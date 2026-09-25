/**
 * /draft — a draft board by position.
 *
 * Every legal card for the chosen event, scored once on the server in that
 * event's era and park (env-fit, the builder's scorer), then laid out one
 * column per position: hitters ranked on bat + glove AT that position under
 * L.J.'s glove floor, arms split into starters and relievers. The client only
 * reorders and hides what gets taken, so the board stays fast mid-draft.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, seriesMeta, tournaments } from "@/db/schema";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import { cardEligibility, type RosterRules } from "@/lib/roster-rules";
import { LHP_SHARE_DEFAULT } from "@/lib/roster-objective";
import { DraftBoard, type DraftCard, type DraftColumn, type DraftEvent } from "@/components/draft/draft-board";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const FIELD = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
/** Deep enough that a column survives a long draft of taken cards. */
const DEPTH = 60;

export default async function DraftPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const catalog = await db
    .select({ id: tournaments.id, name: tournaments.name, envYear: tournaments.envYear, isDraft: tournaments.isDraft, retired: tournaments.retired })
    .from(tournaments)
    .orderBy(tournaments.name);
  const events: DraftEvent[] = catalog
    .filter((c) => !c.retired && !/^EF\b/.test(c.name))
    .map((c) => ({ id: c.id, label: `${c.name}${c.envYear ? ` · ${c.envYear}` : ""}`, isDraft: c.isDraft }));

  const picked = t ? catalog.find((c) => String(c.id) === t) ?? null : null;
  const columns: DraftColumn[] = [];
  let cardsOut: DraftCard[] = [];
  let context: string | null = null;

  if (picked) {
    const [full] = await db.select().from(tournaments).where(eq(tournaments.id, picked.id));
    const park = parkFor(full.stadium);
    const notes = (full.restrictions as { notes?: string[] } | null)?.notes;
    const envYear = full.envYear ?? (notes?.includes("default RE") ? 2010 : null);
    const eraRow = eraFor(envYear)?.row ?? eraTable["0"];
    const [m] = full.series ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, full.series)) : [];
    const lhpShare = m?.lhpBfShare ?? LHP_SHARE_DEFAULT;
    const lhbShare = m?.lhbPaShare ?? 0.35;
    context = `${envYear ?? "PT default"} run environment · ${park.label} · lineups weighted ${Math.round((1 - lhpShare) * 100)}/${Math.round(lhpShare * 100)} vs RHP/LHP`;

    const rules: RosterRules = {
      name: full.name, dh: full.dh, ratingsMin: full.ratingsMin, ratingsMax: full.ratingsMax,
      cardYearMin: full.cardYearMin, cardYearMax: full.cardYearMax, isDraft: full.isDraft,
      restrictions: (full.restrictions ?? {}) as RosterRules["restrictions"],
    };
    const universe = (await db.select({
      cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, position: cards.position, pitcherRole: cards.pitcherRole,
      isPitcher: cards.isPitcher, bats: cards.bats, throws: cards.throws, year: cards.year, cardType: cards.cardType, ratings: cards.ratings,
    }).from(cards)).filter((c) => cardEligibility({
      cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher ?? false, role: c.pitcherRole,
      cardType: c.cardType, ratings: (c.ratings ?? {}) as Record<string, number>, baseOwned: false, variantOwned: false,
    }, rules).errors.length === 0);

    if (eraRow && universe.length) {
      const fit = envFitMaps(
        universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> })),
        { era: eraRow.rates, park: park.row, roleTrust: 0.25, leagueLhbShare: lhbShare, eraYear: envYear ?? 2010 },
      );
      const keep = new Set<number>();
      const col = (key: string, label: string, entries: { id: number; score: number; rating: number | null }[]): DraftColumn => {
        const top = entries.sort((a, b) => b.score - a.score).slice(0, DEPTH);
        for (const e of top) keep.add(e.id);
        return { key, label, entries: top };
      };
      const bats = universe.filter((c) => !c.isPitcher);
      const both = (id: number) => {
        const r = fit.runsR.get(id), l = fit.runsL.get(id);
        return r == null || l == null ? null : (1 - lhpShare) * r + lhpShare * l;
      };
      for (const pos of FIELD) {
        const floor = posFloorAt(LJ_FLOOR, pos);
        const entries = bats.flatMap((c) => {
          const rating = ((c.ratings ?? {}) as Record<string, number>)[`Pos Rating ${pos}`] ?? 0;
          const bat = both(c.cardId);
          if (bat == null || rating <= 0 || rating < floor) return [];
          return [{ id: c.cardId, score: bat + fieldingRuns(pos, rating), rating }];
        });
        columns.push(col(pos, pos, entries));
      }
      columns.push(col("BAT", "Bat only", bats.flatMap((c) => {
        const bat = both(c.cardId);
        return bat == null ? [] : [{ id: c.cardId, score: bat, rating: null }];
      })));
      const arms = universe.filter((c) => c.isPitcher);
      const armCol = (key: string, label: string, sp: boolean) => col(key, label, arms.flatMap((c) => {
        const r = fit.runsR.get(c.cardId);
        return r == null || (c.pitcherRole === "SP") !== sp ? [] : [{ id: c.cardId, score: r, rating: null }];
      }));
      columns.push(armCol("SP", "SP", true), armCol("RP", "RP", false));

      cardsOut = universe.filter((c) => keep.has(c.cardId)).map((c) => {
        const r = (c.ratings ?? {}) as Record<string, number>;
        return {
          id: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher ?? false,
          hand: c.isPitcher ? c.throws : c.bats, pos: c.isPitcher ? c.pitcherRole ?? "P" : c.position ?? "?",
          runsR: fit.runsR.get(c.cardId) ?? null, runsL: fit.runsL.get(c.cardId) ?? null,
          stamina: c.isPitcher ? r["Stamina"] ?? null : null,
        };
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Play"
        title="Draft Board"
        description="Every legal card for an event, one column per position, ranked on runs in that event's era and park — gloves priced in at each spot."
      />
      <DraftBoard
        events={events}
        eventId={picked?.id ?? null}
        eventName={picked?.name ?? null}
        context={context}
        columns={columns}
        cards={cardsOut}
      />
    </div>
  );
}
