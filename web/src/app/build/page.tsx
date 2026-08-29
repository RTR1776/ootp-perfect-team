/**
 * /build — the tournament roster builder.
 *
 * Server side: resolve the tournament catalog (grouped for the picker —
 * dailies by tier, weeklies by day, quicks, drafts, specials, retired
 * last; EF events hidden), the chosen tournament's park + legality
 * window, L.J.'s latest collection joined to ratings, model-v0
 * projections per card, observed per-card performance for this series
 * only (career totals mix parks/eras, so /build never shows them), and
 * the suggested-upgrade list of unowned legal cards with
 * shop prices. Only tournament-legal cards are sent — ineligible cards
 * never render. All interaction lives in the RosterBuilder client
 * component.
 */

import { db } from "@/db/client";
import {
  cards,
  cardSnapshots,
  collectionCards,
  observedCardStats,
  parks,
  rosters,
  rosterSlots,
  seriesMeta,
  tournaments,
  uploads,
} from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { projFip, projWoba } from "@/lib/analytics/projection";
import { getRatingScale } from "@/lib/rating-scale";
import coeffs from "@/lib/analytics/projection-coeffs.json";
import {
  RosterBuilder,
  type BuilderCard,
  type CatalogGroup,
  type ObservedLine,
  type SeriesMetaInfo,
  type TournamentInfo,
  type UpgradeCard,
} from "@/components/roster-builder";

export const dynamic = "force-dynamic";

/* ---------------- catalog grouping ---------------- */

const DAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/;
const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function groupOf(t: { name: string; isDraft: boolean; retired: boolean }): string | null {
  if (/^EF\b/.test(t.name)) return null; // default-rules H2H/4T events — hidden
  if (t.retired) return "Retired";
  if (t.isDraft) return "Perfect Drafts";
  if (/\bQuick\b/i.test(t.name)) return "Quicks";
  const day = t.name.match(DAY_RE)?.[1];
  if (day) return `Weeklies — ${day}`;
  if (/^Dail?y\b/i.test(t.name)) {
    for (const tier of TIERS) if (t.name.includes(tier)) return `Dailies — ${tier}`;
    if (/\bLive\b/.test(t.name)) return "Dailies — Live";
    return "Dailies — Other";
  }
  return "Specials";
}

const GROUP_ORDER = [
  ...TIERS.map((t) => `Dailies — ${t}`),
  "Dailies — Live",
  "Dailies — Other",
  ...DAYS.map((d) => `Weeklies — ${d}`),
  "Quicks",
  "Perfect Drafts",
  "Specials",
  "Retired",
];

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const ratingScale = await getRatingScale();

  const catalog = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      envYear: tournaments.envYear,
      simRuns: tournaments.simRuns,
      isDraft: tournaments.isDraft,
      retired: tournaments.retired,
      series: tournaments.series,
    })
    .from(tournaments)
    .orderBy(tournaments.name);

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

  const groupMap = new Map<string, CatalogGroup>();
  for (const c of catalog) {
    const g = groupOf(c);
    if (!g) continue;
    const entry = groupMap.get(g) ?? { label: g, items: [] };
    entry.items.push({
      id: c.id,
      label: `${c.name}${c.envYear ? ` · ${c.envYear}` : ""}${c.retired ? " · R" : ""}`,
      hasSeries: !!c.series,
      simRuns: c.simRuns ?? 0,
    });
    groupMap.set(g, entry);
  }
  const groups = GROUP_ORDER.filter((g) => groupMap.has(g)).map((g) => groupMap.get(g)!);

  const picked = t ? catalog.find((c) => String(c.id) === t) ?? null : null;

  let tournament: TournamentInfo | null = null;
  let pool: BuilderCard[] = [];
  let upgrades: UpgradeCard[] = [];
  let meta: SeriesMetaInfo | null = null;
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
      retired: full.retired,
      park: park
        ? { name: park.name, avg: avg2(park.avgL, park.avgR), hr: avg2(park.hrL, park.hrR), b2: park.b2, b3: park.b3 }
        : null,
    };

    const isLegal = (val: number | null, year: number | null): boolean => {
      if (full.ratingsMax != null && (val ?? 0) > full.ratingsMax) return false;
      if (full.ratingsMin != null && (val ?? 0) < full.ratingsMin) return false;
      if (full.cardYearMin != null && year != null && year < full.cardYearMin) return false;
      if (full.cardYearMax != null && year != null && year > full.cardYearMax) return false;
      return true;
    };

    if (full.series) {
      const [m] = await db.select().from(seriesMeta).where(eq(seriesMeta.series, full.series));
      if (m) {
        meta = {
          files: m.files, avgTeams: m.avgTeams, avgSp: m.avgSp, avgRp: m.avgRp,
          avgBats: m.avgBats, topCards: m.topCards,
        };
      }
    }

    const [latestCollection] = await db
      .select({ id: uploads.id })
      .from(uploads)
      .where(eq(uploads.kind, "collection"))
      .orderBy(desc(uploads.id))
      .limit(1);

    const owned = latestCollection
      ? await db
          .select({
            cardId: collectionCards.cardId,
            isActive: collectionCards.isActive,
            isVariant: collectionCards.isVariant,
          })
          .from(collectionCards)
          .where(eq(collectionCards.uploadId, latestCollection.id))
      : [];
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

    // Observed: this tournament's series only — career mixes parks and eras.
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

    const bySeries = new Map(seriesRows.map((r) => [r.cardId, r]));

    pool = cardRows
      .filter((c) => isLegal(c.cardValue, c.year))
      .map((c) => {
        const r = (c.ratings ?? {}) as Record<string, number>;
        const isP = c.isPitcher ?? false;
        return {
          cardId: c.cardId,
          name: c.name,
          tier: c.tier,
          val: c.cardValue,
          pos: c.position ?? "?",
          role: c.pitcherRole,
          isPitcher: isP,
          bats: c.bats,
          year: c.year,
          active: activeSet.has(c.cardId),
          variant: variantSet.has(c.cardId),
          ratings: trimRatings(r),
          proj: isP
            ? { all: projFip(r), vL: projFip(r, "vL"), vR: projFip(r, "vR") }
            : { all: projWoba(r), vL: projWoba(r, "vL"), vR: projWoba(r, "vR") },
          obs: bySeries.get(c.cardId) ?? null,
        };
      });

    /* ------- suggested upgrades: best legal cards you DON'T own -------
       Scored in SQL with the model-v0 linear expression so we never pull
       thousands of ratings blobs; only the winners' ratings come back for
       the vL/vR split projections. */
    const model = (m: { intercept: number; features: string[]; coef: number[]; n: number }) =>
      m.n === 0
        ? null
        : sql.raw(
            `(${m.intercept}${m.features
              .map((f, i) => ` + (${m.coef[i]}) * ((ratings->>'${f}')::float)`)
              .join("")})`,
          );
    const hasKeys = (features: string[]) =>
      sql`${cards.ratings} ?& ${sql.raw(`array[${features.map((f) => `'${f}'`).join(",")}]`)}`;
    const legality = [
      full.ratingsMax != null ? sql`coalesce(${cards.cardValue}, 0) <= ${full.ratingsMax}` : null,
      full.ratingsMin != null ? sql`coalesce(${cards.cardValue}, 0) >= ${full.ratingsMin}` : null,
      full.cardYearMin != null ? sql`(${cards.year} is null or ${cards.year} >= ${full.cardYearMin})` : null,
      full.cardYearMax != null ? sql`(${cards.year} is null or ${cards.year} <= ${full.cardYearMax})` : null,
    ].filter((x): x is ReturnType<typeof sql> => x != null);

    const topUnowned = async (wantPitcher: boolean, limit: number) => {
      const m = model(wantPitcher ? coeffs.pit : coeffs.hit);
      if (!m) return [];
      return db
        .select({
          cardId: cards.cardId,
          name: cards.name,
          tier: cards.tier,
          cardValue: cards.cardValue,
          position: cards.position,
          pitcherRole: cards.pitcherRole,
          year: cards.year,
          ratings: cards.ratings,
        })
        .from(cards)
        .where(
          and(
            eq(cards.isPitcher, wantPitcher),
            hasKeys(wantPitcher ? coeffs.pit.features : coeffs.hit.features),
            ownedIds.length ? sql`${cards.cardId} not in (${sql.join(ownedIds.map((i) => sql`${i}`), sql`, `)})` : sql`true`,
            ...legality,
          ),
        )
        .orderBy(wantPitcher ? sql`${m} asc` : sql`${m} desc`)
        .limit(limit);
    };

    const [topHit, topPit] = await Promise.all([topUnowned(false, 30), topUnowned(true, 20)]);
    upgrades = [...topHit.map((c) => ({ c, isP: false })), ...topPit.map((c) => ({ c, isP: true }))].map(({ c, isP }) => {
      const r = (c.ratings ?? {}) as Record<string, number>;
      return {
        cardId: c.cardId,
        name: c.name,
        tier: c.tier,
        val: c.cardValue,
        pos: isP ? c.pitcherRole ?? "P" : c.position ?? "?",
        isPitcher: isP,
        year: c.year,
        ratings: trimRatings(r),
        proj: isP
          ? { all: projFip(r), vL: projFip(r, "vL"), vR: projFip(r, "vR") }
          : { all: projWoba(r), vL: projWoba(r, "vL"), vR: projWoba(r, "vR") },
        last10: null as number | null,
        ask: null as number | null,
      };
    });

    if (upgrades.length) {
      const [latestShop] = await db
        .select({ id: uploads.id })
        .from(uploads)
        .where(eq(uploads.kind, "shop_list"))
        .orderBy(desc(uploads.id))
        .limit(1);
      if (latestShop) {
        const prices = await db
          .select({ cardId: cardSnapshots.cardId, last10: cardSnapshots.last10, ask: cardSnapshots.sellOrderLow })
          .from(cardSnapshots)
          .where(and(eq(cardSnapshots.uploadId, latestShop.id), inArray(cardSnapshots.cardId, upgrades.map((u) => u.cardId))));
        const priceBy = new Map(prices.map((p) => [p.cardId, p]));
        for (const u of upgrades) {
          const p = priceBy.get(u.cardId);
          u.last10 = p?.last10 ?? null;
          u.ask = p?.ask ?? null;
        }
      }
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
      groups={groups}
      ratingScale={ratingScale}
      tournament={tournament}
      pool={pool}
      upgrades={upgrades}
      meta={meta}
      savedRosters={savedRosters}
    />
  );
}

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

function trimRatings(r: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of KEEP_RATINGS) if (r[k] != null) out[k] = r[k];
  return out;
}

function avg2(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return Math.round((((a ?? b)! + (b ?? a)!) / 2) * 1000) / 1000;
}
