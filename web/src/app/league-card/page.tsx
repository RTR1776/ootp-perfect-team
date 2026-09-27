/**
 * Card model — L.J.'s league lineups on the league model, and what a card
 * would add to them. He keeps the team list current (the export also lists
 * cards he has since dropped), locks players into slots, picks a home park,
 * and scores; optionally with a card typed off its face (a variant in the
 * shop, say). Same model and lineup solve as `pnpm league:compare`.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily } from "@/lib/analytics/league-model";
import { parkTable } from "@/lib/analytics/tournament-env";
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
  const options = hitters.map((h) => ({ id: h.id, name: h.name, label: `${h.name} ${h.value} · ${h.year ?? "—"} ${h.pos ?? ""}`.trim() }));
  const parks = Object.entries(parkTable)
    .flatMap(([name, years]) => Object.keys(years).map((y) => `${y} ${name}`))
    .sort((a, b) => a.slice(5).localeCompare(b.slice(5)) || a.localeCompare(b));
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="League"
        title="Card model"
        description="Your league lineups on the league model: keep the team current, lock players in, try a home park, and see what a card would add."
        about="Bats are scored on the league model (league play, normalised to the league's own average), gloves at the slot, and the best nine solved per board around your locks. A home park moves your bats at half weight (81 home games). A modelled card is typed off its face. The same numbers as pnpm league:compare."
      />
      <LeagueCardModel
        cards={options}
        parks={parks}
        roster={mine?.names ?? []}
        rosterSource={mine ? `${mine.league}, week of ${mine.on}` : null}
        defaultFamily={mine ? leagueFamily(mine.league) : "HD"}
      />
    </div>
  );
}
