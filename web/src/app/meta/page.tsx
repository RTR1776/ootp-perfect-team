/**
 * League Meta — the command-center view of who wins at the top and why,
 * rendered live from the uploaded league season exports.
 *
 * Server component: reads the latest `all`-split snapshot per league, runs the
 * analytics layer, and — when a collection upload exists — audits the active
 * roster against the usage-weighted position bars of ONE tier: High Diamond by
 * default, `?bar=LD` / `?bar=PEL` to score against a different rung.
 */

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, leagueStints, uploads } from "@/db/schema";
import {
  auditCard,
  clanSummaries,
  leagueEnv,
  leagueTier,
  positionPercentiles,
  teamProfiles,
  TIER_LABEL,
  TIER_ORDER,
  type LeagueTier,
  type StintLike,
  type TeamProfile,
} from "@/lib/analytics/league";
import Link from "next/link";
import { latestCompleteSnapshots } from "@/lib/league-snapshots";
import { Card, CardContent } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";

export const dynamic = "force-dynamic";

/** Shop-list rating names → the canonical keys the analytics layer speaks. */
const SHOP_TO_CANONICAL: Array<[canonical: string, shop: string]> = [
  ["POW", "Power"],
  ["EYE", "Eye"],
  ["Kav", "Avoid Ks"],
  ["BABr", "BABIP"],
  ["GAP", "Gap"],
  ["STU", "Stuff"],
  ["CON", "Control"],
  ["PBAB", "pBABIP"],
  ["HRA", "pHR"],
  ["CABI", "CatcherAbil"],
  ["CFRM", "CatcherFrame"],
  ["CARM", "Catcher Arm"],
  ["IFRNG", "Infield Range"],
  ["IFERR", "Infield Error"],
  ["IFARM", "Infield Arm"],
  ["TDP", "DP"],
  ["OFRNG", "OF Range"],
  ["OFERR", "OF Error"],
  ["OFARM", "OF Arm"],
];

function canonicalise(shopRatings: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [canonical, shop] of SHOP_TO_CANONICAL) {
    const v = shopRatings[shop];
    if (v != null && Number.isFinite(v)) out[canonical] = v;
  }
  return out;
}

async function loadLatestSnapshots() {
  // Newest COMPLETE snapshot per league — a truncated export is skipped rather
  // than allowed to strip a league's pitchers out of every pool below.
  const { picks, skipped } = await latestCompleteSnapshots();
  const latest = picks;
  if (latest.size === 0) return null;
  const ids = [...latest.values()].map((s) => s.id);
  const stintRows = await db.select().from(leagueStints).where(inArray(leagueStints.snapshotId, ids));
  const byLeague = new Map<string, StintLike[]>();
  const snapById = new Map([...latest.values()].map((s) => [s.id, s]));
  for (const r of stintRows) {
    const league = snapById.get(r.snapshotId)!.league;
    const list = byLeague.get(league) ?? [];
    list.push({
      cid: r.cid,
      name: r.name,
      pos: r.pos,
      org: r.org,
      clan: r.clan,
      isFreeAgent: r.isFreeAgent,
      isPitcher: r.isPitcher,
      val: r.val,
      isVariant: r.isVariant,
      cardYear: r.cardYear,
      ratings: r.ratings ?? {},
      pa: r.pa,
      ip: r.ip,
      use: r.use,
      war: r.war,
      stats: r.stats ?? {},
    });
    byLeague.set(league, list);
  }
  return { latest, byLeague, skipped };
}

/**
 * Score the active collection against one or more tier pools. The FIRST pool is
 * the bar (its score drives the sort and the verdict); a second pool is the rung
 * being left behind, shown as a delta so a card that only looks good one tier
 * down is obvious.
 */
async function loadAudit(pools: Array<{ tier: LeagueTier; stints: StintLike[] }>) {
  // Latest collection upload → active cards; ratings come from the card
  // universe (identical for base cards; approximate for the few active VARs).
  const [latestCollection] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.kind, "collection"))
    .orderBy(desc(uploads.id))
    .limit(1);
  if (!latestCollection) return null;
  const actives = await db
    .select({
      name: collectionCards.name,
      pos: collectionCards.pos,
      cardValue: collectionCards.cardValue,
      isVariant: collectionCards.isVariant,
      cardId: collectionCards.cardId,
    })
    .from(collectionCards)
    .where(eq(collectionCards.uploadId, latestCollection.id));
  const active = actives.filter((a) => a.cardId != null);
  const activeOnly = await db
    .select({ cardId: collectionCards.cardId, isActive: collectionCards.isActive })
    .from(collectionCards)
    .where(eq(collectionCards.uploadId, latestCollection.id));
  const activeSet = new Set(activeOnly.filter((a) => a.isActive).map((a) => a.cardId));
  const rows = active.filter((a) => activeSet.has(a.cardId));
  if (rows.length === 0) return null;

  const universe = await db
    .select({ cardId: cards.cardId, ratings: cards.ratings })
    .from(cards)
    .where(inArray(cards.cardId, rows.map((r) => r.cardId!)));
  const ratingsById = new Map(universe.map((u) => [u.cardId, u.ratings ?? {}]));

  const keys = [
    "POW","EYE","Kav","BABr","GAP","STU","CON","PBAB","HRA",
    "CABI","CFRM","CARM","IFRNG","IFERR","IFARM","TDP","OFRNG","OFERR","OFARM",
  ];
  const pcts = pools.map((p) => positionPercentiles(p.stints, keys));

  return rows
    .map((r) => {
      const canon = canonicalise(ratingsById.get(r.cardId!) ?? {});
      const scored = pcts.map((m) => auditCard(r.pos ?? "", canon, m));
      const primary = scored[0];
      const alt = scored[1];
      return {
        pos: r.pos ?? "",
        name: r.name,
        val: r.cardValue,
        isVariant: r.isVariant,
        score: Number.isFinite(primary.score) ? Math.round(primary.score) : null,
        altScore: alt && Number.isFinite(alt.score) ? Math.round(alt.score) : null,
        defPct: primary.defPct == null ? null : Math.round(primary.defPct),
      };
    })
    .filter((r) => r.score != null)
    .sort((a, b) => a.score! - b.score!);
}

function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function ScoreBar({ value }: { value: number }) {
  const tone = value < 30 ? "bg-red-500" : value < 45 ? "bg-amber-500" : "bg-primary";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block h-2 w-24 overflow-hidden rounded-full bg-muted">
        <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="tabular-nums text-sm">{value}</span>
    </span>
  );
}

function ClanBadge({ clan }: { clan: string | null }) {
  if (!clan) return null;
  return (
    <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {clan}
    </span>
  );
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ bar?: string }>;
}) {
  const { bar } = await searchParams;
  const data = await loadLatestSnapshots();

  if (!data) {
    return (
      <Placeholder
        icon="tournaments"
        title="League Meta"
        description="Upload a league season export (pel_all.csv, hd450_all.csv, …) on the Upload page and this becomes the live map of who plays what at the top — league environments, team strategies, clans, and your roster audited against the level."
      />
    );
  }

  const { latest, byLeague, skipped } = data;
  const leagues = [...byLeague.keys()].sort((a, b) =>
    a === "PEL" ? -1 : b === "PEL" ? 1 : a.localeCompare(b),
  );
  const envs = leagues.map((lg) => leagueEnv(lg, byLeague.get(lg)!));
  const profiles: TeamProfile[] = leagues.flatMap((lg) => teamProfiles(lg, byLeague.get(lg)!));
  const topTeams = [...profiles].sort((a, b) => b.war - a.war).slice(0, 15);
  const clans = clanSummaries(profiles);

  /**
   * The audit bar is ONE tier, never a blend. Pooling every non-PEL league —
   * which is what this did before Low Diamond exports existed — quietly drops
   * the line a roster has to clear the moment an LD season lands, and the
   * roster you are promoting INTO HD is the one that gets flattered. Default
   * to High Diamond; `?bar=` picks another rung.
   */
  const tiersPresent = TIER_ORDER.filter((t) => leagues.some((lg) => leagueTier(lg) === t));
  const requested = (bar ?? "").toUpperCase() as LeagueTier;
  const barTier: LeagueTier | null = tiersPresent.includes(requested)
    ? requested
    : tiersPresent.includes("HD")
      ? "HD"
      : (tiersPresent[0] ?? null);
  const barLeagues = barTier ? leagues.filter((lg) => leagueTier(lg) === barTier) : [];
  const barStints = barLeagues.flatMap((lg) => byLeague.get(lg)!);
  /* Leagues refresh on different weeks, so a tier pool can straddle dates —
     label the span rather than whichever one happened to come first. */
  const barDates = [
    ...new Set(barLeagues.map((lg) => latest.get(lg)?.capturedOn).filter(Boolean) as string[]),
  ].sort();
  const barDate =
    barDates.length === 0
      ? ""
      : barDates.length === 1
        ? barDates[0]
        : `${barDates[0]}–${barDates[barDates.length - 1]}`;
  /* The rung below the bar — the level a promoted roster is leaving. Its column
     is what turns "good card" into "good card HERE". */
  const refTier = [...tiersPresent].reverse().find((t) => t !== barTier) ?? null;
  const refStints = refTier
    ? leagues.filter((lg) => leagueTier(lg) === refTier).flatMap((lg) => byLeague.get(lg)!)
    : [];
  const audit =
    barStints.length > 0 && barTier
      ? await loadAudit([
          { tier: barTier, stints: barStints },
          ...(refTier && refStints.length ? [{ tier: refTier, stints: refStints }] : []),
        ])
      : null;
  const auditMean =
    audit && audit.length
      ? Math.round(audit.reduce((s, a) => s + (a.score ?? 0), 0) / audit.length)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">League Meta</h1>
          <p className="text-sm text-muted-foreground">
            {leagues.length} league{leagues.length === 1 ? "" : "s"} ·{" "}
            {profiles.length} teams · latest snapshots{" "}
            {[...latest.values()][0]?.capturedOn ?? ""} · usage-weighted, league-relative — the
            normalization frame
          </p>
          {skipped.length > 0 && (
            <p className="mt-1 text-xs text-amber-500">
              Skipped {skipped.length} truncated export
              {skipped.length === 1 ? "" : "s"} —{" "}
              {skipped
                .map((x) => `${x.league} ${x.capturedOn} (${x.pitchers} pitcher rows in ${x.rows})`)
                .join(", ")}
              . Those leagues are reading the previous complete week; re-export to refresh.
            </p>
          )}
        </div>
      </div>

      {/* League environments */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">League environments</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            The bar each league actually sets. 101+ share is the creep gauge; variants double at the
            top. Every league runs PT&rsquo;s default environment (year 2010), so the gaps between
            these rows are talent, not park or era — no normalisation needed to read across them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">League</th>
                  <th className="py-2 pr-4 text-right">Teams</th>
                  <th className="py-2 pr-4 text-right">wOBA</th>
                  <th className="py-2 pr-4 text-right">FIP</th>
                  <th className="py-2 pr-4 text-right">K%</th>
                  <th className="py-2 pr-4 text-right">HR/PA</th>
                  <th className="py-2 pr-4 text-right">BABIP</th>
                  <th className="py-2 pr-4 text-right">101+ usage</th>
                  <th className="py-2 text-right">Variant usage</th>
                </tr>
              </thead>
              <tbody>
                {envs.map((e) => (
                  <tr key={e.league} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{e.league}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.teams}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.woba.toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.fip.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(e.kPct)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(e.hrPa)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.babip.toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(e.v101Share, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(e.varShare, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top teams */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Top teams by WAR — who to study</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            The rating mix shows each team&apos;s bet: EYE and HR-avoid are the levers everyone at the
            top shares; contact-vs-power is a style choice. Clan tags (CG, HotL, GH…) run +
            {(clans.clanAvgWar - clans.soloAvgWar).toFixed(1)} WAR over solo teams here.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Team</th>
                  <th className="py-2 pr-4">League</th>
                  <th className="py-2 pr-4 text-right">WAR</th>
                  <th className="py-2 pr-4 text-right">wOBA</th>
                  <th className="py-2 pr-4 text-right">FIP</th>
                  <th className="py-2 pr-4 text-right">EYE</th>
                  <th className="py-2 pr-4 text-right">K-av</th>
                  <th className="py-2 pr-4 text-right">POW</th>
                  <th className="py-2 pr-4 text-right">HRA</th>
                  <th className="py-2 pr-4 text-right">Arms</th>
                  <th className="py-2 text-right">Var</th>
                </tr>
              </thead>
              <tbody>
                {topTeams.map((t) => (
                  <tr key={`${t.league}-${t.org}`} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      {t.org}
                      <ClanBadge clan={t.clan} />
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{t.league}</td>
                    <td className="py-2 pr-4 text-right font-medium tabular-nums">{t.war.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.woba.toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.fip.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Math.round(t.mix.EYE)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Math.round(t.mix.Kav)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Math.round(t.mix.POW)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Math.round(t.mix.HRA)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.pitchers}</td>
                    <td className="py-2 text-right tabular-nums">{pct(t.varShare, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Clans */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Clans</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {clans.clanTeams} tagged teams vs {clans.soloTeams} solo — average WAR{" "}
            {clans.clanAvgWar.toFixed(1)} vs {clans.soloAvgWar.toFixed(1)}. When one of these tags is
            in your bracket, expect an HR-avoid staff and up-the-middle defense.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clans.clans.map((c) => (
              <div key={c.clan} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{c.clan}</span>
                  <span className="text-xs text-muted-foreground">{c.teams} teams</span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{c.avgWar.toFixed(1)}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  best: {c.bestOrg} ({c.bestWar.toFixed(1)})
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Roster audit */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Active roster vs the {barTier ? TIER_LABEL[barTier] : "league"} bar
              {auditMean != null && (
                <span className="ml-2 text-muted-foreground">· roster mean {auditMean}th pct</span>
              )}
            </h2>
            {tiersPresent.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs text-muted-foreground">bar:</span>
                {tiersPresent.map((t) => (
                  <Link
                    key={t}
                    href={`/meta?bar=${t}`}
                    scroll={false}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      t === barTier
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {TIER_LABEL[t]}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {!audit ? (
            <p className="text-xs text-muted-foreground">
              Upload the collection export (with the ACT column) and the shop list, and every active
              card gets scored here against the cards actually played at its position.
            </p>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                Composite percentile vs usage-weighted position peers in{" "}
                {barLeagues.join(", ")}
                {barDate ? ` (${barDate})` : ""} — hitters EYE·30 / K-avoid·22 / POW·21 / GAP·10 /
                defense·17, pitchers HRA·33 / STU·31 / CON·28 / pBABIP·8. 50 = the median card in use
                at that spot. Worst first — the top of this table is the shopping list.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Pos</th>
                      <th className="py-2 pr-4">Card</th>
                      <th className="py-2 pr-4 text-right">Val</th>
                      <th className="py-2 pr-4">vs {barTier ?? "league"} peers</th>
                      {refTier && <th className="py-2 pr-4 text-right">vs {refTier}</th>}
                      <th className="py-2 pr-4 text-right">Def</th>
                      <th className="py-2">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={`${a.pos}-${a.name}`} className="border-b border-border/50">
                        <td className="py-2 pr-4">{a.pos}</td>
                        <td className="py-2 pr-4">
                          {a.name}
                          {a.isVariant && (
                            <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              VAR
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{a.val ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <ScoreBar value={a.score!} />
                        </td>
                        {refTier && (
                          <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                            {a.altScore == null ? (
                              "—"
                            ) : (
                              <>
                                {a.altScore}
                                <span
                                  className={`ml-1 text-[11px] ${
                                    a.score! - a.altScore <= -8 ? "text-amber-500" : ""
                                  }`}
                                >
                                  {a.score! - a.altScore > 0 ? "+" : ""}
                                  {a.score! - a.altScore}
                                </span>
                              </>
                            )}
                          </td>
                        )}
                        <td className="py-2 pr-4 text-right tabular-nums">{a.defPct ?? "—"}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {a.score! < 30
                            ? "replace now"
                            : a.score! < 45
                              ? "upgrade target"
                              : a.score! < 60
                                ? "holds the line"
                                : "carries the roster"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
