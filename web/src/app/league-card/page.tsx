/**
 * Card model — L.J.'s league lineups and pitching staff, and what a card
 * would add to them. He keeps the team list current (the export also lists
 * cards he has since dropped), locks players into slots, picks a home park,
 * and optionally models a card typed off its face (a variant in the shop,
 * say); a hitter joins the lineups, a pitcher the staff, and both rescore
 * after each change. Same model and lineup solve as `pnpm league:compare`.
 */
import { desc, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { leagueFamily } from "@/lib/analytics/league-model";
import { eraYears, parkTable, PT_DEFAULT_ENV_YEAR } from "@/lib/analytics/tournament-env";
import type { Owned } from "@/lib/card-search";
import type { LeagueExport } from "@/lib/league-card-state";
import { myLeagueArms } from "@/lib/league-arms";
import { loadHitterUniverse, myLeagueBats } from "@/lib/league-hitters";
import { newerTeamSheet } from "@/lib/league-team";
import { PageHeader } from "@/components/page-header";
import { LeagueCardModel } from "@/components/league-card/card-model";

export const dynamic = "force-dynamic";

export default async function LeagueCardPage() {
  const [shop, mine, mineArms, universe] = await Promise.all([
    db.select({ id: cards.cardId, name: cards.name, value: cards.cardValue, year: cards.year, pos: cards.position, isPitcher: cards.isPitcher, role: cards.pitcherRole })
      .from(cards).where(gte(cards.cardValue, 40)).orderBy(desc(cards.cardValue), cards.name),
    myLeagueBats(),
    myLeagueArms(),
    // The newest collection upload, as the scorer reads it: owned cards come first in the search (C9).
    loadHitterUniverse(),
  ]);
  const owned = new Map<number, Owned>();
  for (const o of universe.owned) {
    if (o.cardId != null && owned.get(o.cardId) !== "variant") owned.set(o.cardId, o.isVariant ? "variant" : "base");
  }
  // Hitters "Dave Winfield 97 · 1979 RF"; pitchers end in the staff role, "Kenley Jansen 100 · 2017 CL · RP".
  const options = shop.map((c) => c.isPitcher
    ? { id: c.id, name: c.name, kind: "arm" as const, owned: owned.get(c.id) ?? null, label: `${c.name} ${c.value} · ${c.year ?? "—"}${c.role === "CL" ? " CL" : ""} · ${c.role === "SP" ? "SP" : "RP"}` }
    : { id: c.id, name: c.name, kind: "bat" as const, owned: owned.get(c.id) ?? null, label: `${c.name} ${c.value} · ${c.year ?? "—"} ${c.pos ?? ""}`.trim() });
  const parks = Object.entries(parkTable)
    .flatMap(([name, years]) => Object.keys(years).map((y) => `${y} ${name}`))
    .sort((a, b) => a.slice(5).localeCompare(b.slice(5)) || a.localeCompare(b));
  // Run environments: the PT default (listed as 2010) first, then every year on file, newest first.
  const years = [String(PT_DEFAULT_ENV_YEAR), ...eraYears.filter((y) => y > 0 && y !== PT_DEFAULT_ENV_YEAR).map(String)];
  // The source names the export; the page offers its list again when a newer one arrives.
  // His team sheet takes the export's place while it is the newer of the two.
  const arms = mineArms?.arms.map((a) => a.entry) ?? [];
  const league: LeagueExport = newerTeamSheet(mine?.on ?? null) ?? (mine
    ? { source: `${mine.league}, week of ${mine.on}`, roster: mine.names, arms, family: leagueFamily(mine.league) }
    : { source: null, roster: [], arms, family: "HD" });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="League"
        title="Card model"
        description="Your league lineups and pitching staff: keep the team current, lock players in, try a home park, and see what a card would add."
        about="Bats are scored on the league model (league play, normalised to the league's own average), gloves at the slot, and the best nine solved per board around your locks. A home park moves your bats at half weight (81 home games). Arms are scored on league play too: FIP-type runs per 9 better than each week's league, with a ratings estimate where the sample is thin; the best five start and the rest pitch in relief. A modelled card is typed off its face. Every change rescores on its own, and Undo (Ctrl+Z or ⌘Z) takes back any edit."
      />
      <LeagueCardModel cards={options} parks={parks} years={years} league={league} />
    </div>
  );
}
