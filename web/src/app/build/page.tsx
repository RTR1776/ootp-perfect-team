/**
 * /build — the tournament roster builder.
 *
 * Server side: resolve the tournament catalog (grouped for the picker —
 * dailies by tier, weeklies by day, quicks, drafts, specials
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
  rosters,
  rosterSlots,
  seriesMeta,
  tournaments,
  uploads,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { EMPTY_PROJ, projectCard, projectionEnvs, projOf } from "@/lib/analytics/projections";
import { LHP_SHARE_DEFAULT } from "@/lib/roster-objective";
import { eraFor, eraTable, parkFor, solveFor } from "@/lib/analytics/tournament-env";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { loadObservedRuns } from "@/lib/analytics/observed-blend";
import { eraBand } from "@/lib/analytics/calibration";
import { dataConfidence, type Confidence } from "@/lib/data-confidence";
import type { BuilderEnv } from "@/components/roster-builder";
import { getRatingScale } from "@/lib/rating-scale";
import { fieldingRuns } from "@/lib/analytics/fielding";

const FIELD_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
import { cardEligibility, tierCode, tierFitsSlots, type RosterSlot } from "@/lib/roster-rules";
import {
  RosterBuilder,
  type BuilderCard,
  type CatalogGroup,
  type ObservedLine,
  type SeriesMetaInfo,
  type TournamentInfo,
  type UpgradeCard,
} from "@/components/roster-builder";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

/* ---------------- catalog grouping ---------------- */

const DAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/;
const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function groupOf(t: { name: string; isDraft: boolean; retired: boolean }): string | null {
  if (/^EF\b/.test(t.name)) return null; // default-rules H2H/4T events — hidden
  // Retired events stay in the database - their history still feeds /meta and
  // the environment search - but they leave the picker. They remain reachable
  // by id, so a link to an old build keeps working.
  if (t.retired) return null;
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
      <PageHeader
        eyebrow="Play"
        title="Build"
        description={<>No tournaments loaded yet — run <code className="font-mono">pnpm import:tournaments</code> after the next data drop.</>}
      />
    );
  }

  const groupMap = new Map<string, CatalogGroup>();
  for (const c of catalog) {
    const g = groupOf(c);
    if (!g) continue;
    const entry = groupMap.get(g) ?? { label: g, items: [] };
    entry.items.push({
      id: c.id,
      label: `${c.name}${c.envYear ? ` · ${c.envYear}` : ""}`,
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
  let confidence: Confidence | null = null;
  let env: BuilderEnv | null = null;
  let savedRosters: { id: number; name: string; slots: RosterSlot[] }[] = [];
  let collectionDate: string | null = null;
  let collectionAgeDays: number | null = null;

  if (picked) {
    const [full] = await db.select().from(tournaments).where(eq(tournaments.id, picked.id));
    const parkPick = parkFor(full.stadium);
    const park = parkPick.row;
    const notes = (full.restrictions as { notes?: string[] } | null)?.notes;
    const envYear = full.envYear ?? (notes?.includes("default RE") ? 2010 : null);
    const era = eraFor(envYear);
    const environment = era ? solveFor(era.row, park) : null;
    tournament = {
      id: full.id,
      name: full.name,
      envYear,
      mode: full.mode,
      stadium: full.stadium,
      dh: full.dh,
      entrants: full.entrants,
      ratingsMin: full.ratingsMin,
      ratingsMax: full.ratingsMax,
      cardYearMin: full.cardYearMin,
      cardYearMax: full.cardYearMax,
      restrictions: (full.restrictions ?? null) as TournamentInfo["restrictions"],
      series: full.series,
      isDraft: full.isDraft,
      retired: full.retired,
      park: park
        ? { name: parkPick.label, avg: avg2(park.avgL, park.avgR), hr: avg2(park.hrL, park.hrR), b2: park.d2, b3: park.d3 }
        : null,
      environment: {
        eraLabel: era?.label ?? "RE not recorded",
        parkLabel: parkPick.label,
        parkFactors: park,
        runsPerGame: environment?.RG ?? null,
      },
    };

    // A "Slots: S16, B5, I5" spec is a set of per-tier MAXIMUMS and a lower
    // card may sit in a higher slot (L.J., 2026-09-07) — so the only card-level
    // consequence is a ceiling at the highest tier that has a slot. The
    // per-tier budget itself is a whole-roster check (roster-rules.ts).
    const rx = (full.restrictions ?? null) as { slots?: Record<string, number> } | null;
    const slotRules = rx?.slots ?? null;

    const isLegal = (val: number | null, year: number | null): boolean => {
      if (full.ratingsMax != null && (val ?? 0) > full.ratingsMax) return false;
      if (full.ratingsMin != null && (val ?? 0) < full.ratingsMin) return false;
      if (full.cardYearMin != null && year != null && year < full.cardYearMin) return false;
      if (full.cardYearMax != null && year != null && year > full.cardYearMax) return false;
      if (slotRules && val != null && !tierFitsSlots(tierCode(val), slotRules)) return false;
      return true;
    };

    if (full.series) {
      const [m] = await db.select().from(seriesMeta).where(eq(seriesMeta.series, full.series));
      if (m) {
        meta = {
          files: m.files, avgTeams: m.avgTeams, avgSp: m.avgSp, avgRp: m.avgRp,
          avgBats: m.avgBats, topCards: m.topCards,
          lhpBfShare: m.lhpBfShare ?? null, lhbPaShare: m.lhbPaShare ?? null,
        };
      }
    }

    const [latestCollection] = await db
      .select({ id: uploads.id, date: uploads.uploadedAt })
      .from(uploads)
      .where(eq(uploads.kind, "collection"))
      .orderBy(desc(uploads.id))
      .limit(1);
    collectionDate = latestCollection?.date.toISOString().slice(0,10) ?? null;
    collectionAgeDays = latestCollection ? Math.floor((Date.now() - latestCollection.date.getTime()) / 86_400_000) : null;

    const owned = latestCollection
      ? await db
          .select({
            cardId: collectionCards.cardId,
            isActive: collectionCards.isActive,
            isVariant: collectionCards.isVariant,
            ratings: collectionCards.ratings,
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
            cardType: cards.cardType,
          })
          .from(cards)
          .where(inArray(cards.cardId, ownedIds))
      : [];

    const activeSet = new Set(owned.filter((o) => o.isActive).map((o) => o.cardId));
    const variantSet = new Set(owned.filter((o) => o.isVariant).map((o) => o.cardId));
    const baseSet = new Set(owned.filter(o=>!o.isVariant).map(o=>o.cardId));
    const variants = new Map(owned.filter(o=>o.isVariant).map(o=>[o.cardId,o.ratings]));

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

    /* ------- the environment every number on the page is read in -------
       The event's era and park (PT default when no era is recorded), and how
       the FIELD is handed off its exports: the share of batters faced thrown
       left-handed weights the two lineups, the share of PA by left-handed
       bats sets the park an arm works in (series_meta; 0.30 / 0.35 when the
       series has no exports yet). */
    const eraRow = era?.row ?? eraTable["0"];
    const lhpShare = meta?.lhpBfShare ?? LHP_SHARE_DEFAULT;
    const lhbShare = meta?.lhbPaShare ?? 0.35;
    const envs = eraRow ? projectionEnvs(eraRow.rates, park, lhbShare) : null;
    const projFor = (isP: boolean, bats: string | null, r: Record<string, number>) =>
      envs ? projOf(projectCard({ isPitcher: isP, bats, ratings: r }, envs, lhpShare)) : EMPTY_PROJ;

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
          baseOwned: baseSet.has(c.cardId),
          variantOwned: variantSet.has(c.cardId),
          variantRatings: variants.get(c.cardId) ?? null,
          cardType: c.cardType,
          ratings: trimRatings(r),
          proj: projFor(isP, c.bats, r),
          obs: bySeries.get(c.cardId) ?? null,
        };
      }).filter(c => cardEligibility(c, tournament!).errors.length === 0);

    /* ------- the scorer's level, and the upgrade board -------
       The same scorer as env-roster: runs per 700 PA in this event's run
       environment and park, calibrated to what play returns, the relief
       role bonus at the trusted quarter, and observed play blended in by
       precision. The observed level of each series is set from the model's
       runs over EVERY card that played it, so the whole catalogue is scored
       once here; the client re-scores only the pool (with L.J.'s position
       floor) when a variant form is toggled. The same universe scoring is
       the upgrade board: the best legal cards not owned, by the runs they
       would add here. */
    if (eraRow) {
      const universe = await db.select({
        cardId: cards.cardId, name: cards.name, tier: cards.tier, cardValue: cards.cardValue, position: cards.position,
        pitcherRole: cards.pitcherRole, isPitcher: cards.isPitcher, bats: cards.bats, year: cards.year, cardType: cards.cardType, ratings: cards.ratings,
        title: cards.title, firstSeenAt: cards.firstSeenAt,
      }).from(cards);
      const base = envFitMaps(universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> })), { era: eraRow.rates, park, roleTrust: 0.25, leagueLhbShare: lhbShare, eraYear: envYear ?? 2010 });
      const both = (id: number) => { const r = base.runsR.get(id), l = base.runsL.get(id); return r == null || l == null ? null : (1 - lhpShare) * r + lhpShare * l; };
      const observed = await loadObservedRuns(pool.map((c) => c.cardId), both);
      env = { rates: eraRow.rates, park, lhpShare, lhbShare, eraYear: envYear ?? 2010, observed: [...observed.entries()].map(([id, o]) => [id, o.runs, o.n]) };
      {
        const ns = pool.map((c) => observed.get(c.cardId)?.n ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
        const band = eraBand(envYear ?? 2010);
        confidence = dataConfidence({
          seriesFiles: meta?.files ?? 0, seriesTeams: meta?.avgTeams ?? null,
          poolSize: pool.length, poolWithPlay: ns.length, poolMedianN: ns.length ? ns[Math.floor(ns.length / 2)] : 0,
          eraBand: band ? { band: band.band, series: band.series } : null,
          envYearKnown: envYear != null, parkOnFile: park != null,
        });
      }

      const ownedSet = new Set(ownedIds);
      const scored = universe
        .filter((c) => !ownedSet.has(c.cardId) && isLegal(c.cardValue, c.year))
        .map((c) => ({ c, runs: c.isPitcher ? base.runsR.get(c.cardId) : both(c.cardId) }))
        .filter((x): x is { c: (typeof universe)[number]; runs: number } => x.runs != null)
        .filter(({ c }) => cardEligibility({ cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher ?? false, role: c.pitcherRole, cardType: c.cardType, ratings: (c.ratings ?? {}) as Record<string, number>, baseOwned: false, variantOwned: false }, tournament!).errors.length === 0);
      const top = (wantPitcher: boolean, limit: number) => scored
        .filter((x) => (x.c.isPitcher ?? false) === wantPitcher)
        .sort((a, b) => b.runs - a.runs)
        .slice(0, limit);
      /* The shop board ranks these by what they add to the roster on the page,
         so the list has to reach past the best overall bats: the best few at
         every fielding position (bat + glove there) come along too. */
      const byPos = FIELD_POS.flatMap((pos) => scored
        .filter((x) => !(x.c.isPitcher ?? false))
        .map((x) => ({ x, v: x.runs + fieldingRuns(pos, ((x.c.ratings ?? {}) as Record<string, number>)[`Pos Rating ${pos}`] ?? 0), ok: (((x.c.ratings ?? {}) as Record<string, number>)[`Pos Rating ${pos}`] ?? 0) >= 40 }))
        .filter((y) => y.ok)
        .sort((a, b) => b.v - a.v)
        .slice(0, 8)
        .map((y) => y.x));
      // "New" = first seen within a week of the latest card drop on file, so the
      // badge tracks shop uploads rather than the clock.
      const newSince = universe.reduce((m, c) => Math.max(m, c.firstSeenAt.getTime()), 0) - 7 * 86_400_000;
      const picked = new Map<number, (typeof scored)[number]>();
      for (const x of [...top(false, 60), ...top(true, 40), ...byPos]) picked.set(x.c.cardId, x);
      upgrades = [...picked.values()].map(({ c, runs }) => {
        const r = (c.ratings ?? {}) as Record<string, number>;
        const isP = c.isPitcher ?? false;
        return {
          cardId: c.cardId, name: c.name, tier: c.tier, val: c.cardValue,
          pos: isP ? c.pitcherRole ?? "P" : c.position ?? "?", isPitcher: isP, year: c.year, bats: c.bats,
          ratings: trimRatings(r), proj: projFor(isP, c.bats, r), runs,
          runsR: base.runsR.get(c.cardId) ?? null, runsL: base.runsL.get(c.cardId) ?? null,
          isNew: c.firstSeenAt.getTime() >= newSince, clubhouse: /clubhouse/i.test(c.title),
          last10: null as number | null, ask: null as number | null,
        };
      });
    }

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
          .map((s) => ({ cardId: s.cardId, slot: s.slot, versusHand: s.versusHand, lineupOrder: s.lineupOrder, useVariant: s.useVariant })),
      }));
    }
  }

  return (
    <RosterBuilder
      groups={groups}
      ratingScale={ratingScale}
      tournament={tournament}
      pool={pool}
      env={env}
      upgrades={upgrades}
      meta={meta}
      confidence={confidence}
      savedRosters={savedRosters}
      collectionDate={collectionDate}
      collectionAgeDays={collectionAgeDays}
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
