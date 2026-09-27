/**
 * Card model — what a card would add to L.J.'s league lineups, from the
 * numbers on its face. For a variant in the shop (or any card) before buying
 * it: pick the base card, type the variant's ratings and positions, score it.
 * Same model and lineup solve as `pnpm league:compare`.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily } from "@/lib/analytics/league-model";
import { myLeagueBats } from "@/lib/league-hitters";
import { PageHeader } from "@/components/page-header";
import { LeagueCardModel } from "@/components/league-card-model";

export const dynamic = "force-dynamic";

export default async function LeagueCardPage() {
  const [hitters, mine] = await Promise.all([
    db.select({ id: cards.cardId, name: cards.name, value: cards.cardValue, year: cards.year, pos: cards.position })
      .from(cards).where(and(eq(cards.isPitcher, false), gte(cards.cardValue, 40))).orderBy(desc(cards.cardValue), cards.name),
    myLeagueBats(),
  ]);
  const options = hitters.map((h) => ({ id: h.id, label: `${h.name} ${h.value} · ${h.year ?? "—"} ${h.pos ?? ""}`.trim() }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="League"
        title="Card model"
        description="What a card would add to your league lineups, from the numbers on its face."
        about="Pick the base card, type the variant's ratings and positions, and score it. Bats are scored on the league model (league play, normalised to the league's own average), gloves at the slot, and the best nine solved per board with and without the card — the same numbers as pnpm league:compare."
      />
      <LeagueCardModel
        cards={options}
        roster={mine?.names ?? []}
        rosterSource={mine ? `${mine.league}, week of ${mine.on}` : null}
        defaultFamily={mine ? leagueFamily(mine.league) : "HD"}
      />
    </div>
  );
}
