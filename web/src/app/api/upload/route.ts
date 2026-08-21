/**
 * CSV upload + ingest.
 *
 * POST a file (multipart/form-data, field `file`). The kind is sniffed from the
 * header line, so there is nothing to choose in the UI — drop any PT export and
 * it lands in the right place.
 *
 * Send `?dryRun=1` to parse and report without writing. Use it the first time
 * you upload a new export shape: you get the row counts and warnings back and
 * can eyeball them before anything touches the database.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, standings, uploads } from "@/db/schema";
import { parseShopList, looksLikeShopList } from "@/lib/ingest/pt-card-list";
import {
  looksLikeCollection,
  matchCollectionToShop,
  parseCollection,
} from "@/lib/ingest/collection";
import { looksLikeStandings, parseStandings } from "@/lib/ingest/standings";
import { looksLikeLeagueExport, parseLeagueExport } from "@/lib/ingest/league";
import { leagueSnapshots, leagueStints } from "@/db/schema";

export const runtime = "nodejs";
/** The shop list is ~1.5MB and 3,700 rows; the default 10s is not enough. */
export const maxDuration = 60;

type Kind = "shop_list" | "collection" | "standings" | "league";

function detectKind(headerLine: string): Kind | null {
  // League first: its header also contains POS/Name like the collection's, but
  // ORG + CID + WAR together only ever appear in a league season export.
  if (looksLikeLeagueExport(headerLine)) return "league";
  if (looksLikeShopList(headerLine)) return "shop_list";
  if (looksLikeCollection(headerLine)) return "collection";
  if (looksLikeStandings(headerLine)) return "standings";
  return null;
}

export async function POST(request: Request) {
  /**
   * Checked here as well as in proxy.ts. The Next docs are explicit that the
   * proxy layer is an optimistic check and not an authorisation boundary, and
   * this is the only endpoint in the app that writes.
   */
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded under field 'file'." }, { status: 400 });
  }

  const text = await file.text();
  const headerLine = text.slice(0, text.indexOf("\n"));
  const kind = detectKind(headerLine);

  if (!kind) {
    return NextResponse.json(
      {
        error: "Unrecognised export.",
        hint: "Expected the PT card shop list, a collection export, or a standings CSV.",
        headerSeen: headerLine.slice(0, 200),
      },
      { status: 422 },
    );
  }

  /* ---------------------------------------------------------------- */

  if (kind === "league") {
    const parsed = parseLeagueExport(text, file.name);

    if (!parsed.league) {
      return NextResponse.json(
        {
          error: "Could not tell which league this export is from.",
          hint: "Keep the original filename — the league (pel / hd450…) and split (vL / vR) are read from it.",
        },
        { status: 422 },
      );
    }
    if (parsed.stints.length === 0) {
      return NextResponse.json({ error: "No rows parsed from the league export." }, { status: 422 });
    }

    // Same capturedOn convention as standings: the export is a snapshot of the
    // week it was taken, and only the caller knows when that was on a backfill.
    const capturedOnRaw = (form.get("capturedOn") as string | null)?.trim() || null;
    if (capturedOnRaw && !/^\d{4}-\d{2}-\d{2}$/.test(capturedOnRaw)) {
      return NextResponse.json(
        { error: "capturedOn must be YYYY-MM-DD.", got: capturedOnRaw },
        { status: 400 },
      );
    }
    const capturedOn = capturedOnRaw ?? new Date().toISOString().slice(0, 10);

    const report = {
      league: parsed.league,
      split: parsed.split,
      ...parsed.stats,
      capturedOn,
      capturedOnWasSupplied: capturedOnRaw != null,
    };

    if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: report });

    const [upload] = await db
      .insert(uploads)
      .values({ kind, filename: file.name, rowCount: parsed.stints.length, report })
      .returning();

    const [snapshot] = await db
      .insert(leagueSnapshots)
      .values({
        uploadId: upload.id,
        league: parsed.league,
        split: parsed.split,
        capturedOn,
        teams: parsed.stats.teams,
        rows: parsed.stints.length,
      })
      .returning();

    const rows = parsed.stints.map((s) => ({
      snapshotId: snapshot.id,
      cid: s.cid,
      name: s.name,
      pos: s.pos,
      org: s.org,
      clan: s.clan,
      isFreeAgent: s.isFreeAgent,
      isPitcher: s.isPitcher,
      val: s.val,
      tier: s.tier,
      isVariant: s.isVariant,
      cardYear: s.cardYear,
      pa: s.pa,
      ip: s.ip,
      use: s.use,
      war: s.war,
      ratings: s.ratings,
      stats: s.stats,
    }));
    // Wide JSONB rows — smaller chunks than the card tables.
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(leagueStints).values(rows.slice(i, i + 200));
    }

    return NextResponse.json({ kind, uploadId: upload.id, snapshotId: snapshot.id, stats: report });
  }

  /* ---------------------------------------------------------------- */

  if (kind === "shop_list") {
    const parsed = parseShopList(text);

    // Refuse to write a shifted file. The tier codes must partition Card Value;
    // when they do not, the offset handling has failed and every price and
    // ownership count in the file is wrong. Better to reject than to poison the
    // history table with plausible-looking garbage.
    if (!parsed.stats.tierBandsValid) {
      return NextResponse.json(
        {
          error: "Column alignment check failed — refusing to import.",
          detail:
            "Tier codes did not partition Card Value into the expected bands, which means the columns are shifted. Check whether the export's field count changed.",
          stats: parsed.stats,
        },
        { status: 422 },
      );
    }

    if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: parsed.stats });

    const [upload] = await db
      .insert(uploads)
      .values({
        kind,
        filename: file.name,
        rowCount: parsed.cards.length,
        report: parsed.stats as unknown as Record<string, unknown>,
      })
      .returning();

    const cardRows = parsed.cards.map((c) => ({
      cardId: c.cardId,
      title: c.title,
      name: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      nickName: c.nickName,
      tier: c.tier,
      cardValue: c.cardValue,
      position: c.position,
      pitcherRole: c.pitcherRole,
      isPitcher: c.isPitcher,
      bats: c.bats,
      throws: c.throws,
      year: c.year,
      eraCode: c.eraCode,
      eraLabel: c.eraLabel,
      team: c.team,
      franchise: c.franchise,
      series: c.series,
      badge: c.badge,
      cardType: c.cardType,
      cardSubType: c.cardSubType,
      brefId: c.brefId,
      releasedOn: c.date,
      ratings: c.ratings,
    }));

    // Chunked so we stay well under Postgres' parameter ceiling.
    for (let i = 0; i < cardRows.length; i += 500) {
      await db
        .insert(cards)
        .values(cardRows.slice(i, i + 500))
        .onConflictDoUpdate({
          target: cards.cardId,
          set: {
            title: sql`excluded.title`,
            cardValue: sql`excluded.card_value`,
            tier: sql`excluded.tier`,
            ratings: sql`excluded.ratings`,
            lastSeenAt: sql`now()`,
          },
        });
    }

    const snapshotRows = parsed.cards.map((c) => ({
      uploadId: upload.id,
      cardId: c.cardId,
      owned: c.owned,
      buyOrderHigh: c.market.buyOrderHigh,
      sellOrderLow: c.market.sellOrderLow,
      last10: c.market.last10,
      last10Variant: c.market.last10Variant,
      missionValue: c.missionValue,
      limit: c.limit,
      packs: c.packs,
    }));
    for (let i = 0; i < snapshotRows.length; i += 500) {
      await db.insert(cardSnapshots).values(snapshotRows.slice(i, i + 500));
    }

    return NextResponse.json({ kind, uploadId: upload.id, stats: parsed.stats });
  }

  /* ---------------------------------------------------------------- */

  if (kind === "collection") {
    const parsed = parseCollection(text);

    // Matching needs the card universe, so the shop list has to land first.
    const universe = await db
      .select({
        cardId: cards.cardId,
        name: cards.name,
        cardValue: cards.cardValue,
        isPitcher: cards.isPitcher,
        ratings: cards.ratings,
      })
      .from(cards);

    if (universe.length === 0) {
      return NextResponse.json(
        { error: "Upload pt_card_list.csv first — the collection is matched against it." },
        { status: 409 },
      );
    }

    const { matched, matchRate } = matchCollectionToShop(
      parsed.cards,
      universe.map((u) => ({ ...u, ratings: u.ratings ?? {} })) as never,
    );

    const report = {
      ...parsed.stats,
      matchRate,
      unmatched: matched.filter((m) => m.cardId == null).length,
    };

    if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: report });

    const [upload] = await db
      .insert(uploads)
      .values({ kind, filename: file.name, rowCount: matched.length, report })
      .returning();

    const rows = matched.map((m) => ({
      uploadId: upload.id,
      cardId: m.cardId,
      name: m.name,
      pos: m.pos,
      cardValue: m.cardValue,
      isVariant: m.isVariant,
      isActive: m.isActive,
      released: m.released,
      matchDistance: m.matchDistance,
      matchQuality: m.matchQuality,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(collectionCards).values(rows.slice(i, i + 500));
    }

    return NextResponse.json({ kind, uploadId: upload.id, stats: report });
  }

  /* ---------------------------------------------------------------- */

  const parsed = parseStandings(text, file.name);
  if (!parsed.category) {
    return NextResponse.json(
      {
        error: "Could not tell which category this standings file is for.",
        hint: "Keep the original filename — the category and period are read from it.",
      },
      { status: 422 },
    );
  }

  /**
   * A standings export is a snapshot as of when it was downloaded, not the
   * final result for the period in its filename — the PTCS 5 files are named
   * for a period ending Aug 2 but were taken on Jul 28. Nothing inside the file
   * records that, so the caller supplies it; today is right for a fresh export
   * and wrong for a backfill, which is exactly when it must be overridable.
   */
  const capturedOnRaw = (form.get("capturedOn") as string | null)?.trim() || null;
  if (capturedOnRaw && !/^\d{4}-\d{2}-\d{2}$/.test(capturedOnRaw)) {
    return NextResponse.json(
      { error: "capturedOn must be YYYY-MM-DD.", got: capturedOnRaw },
      { status: 400 },
    );
  }
  const capturedOn = capturedOnRaw ?? new Date().toISOString().slice(0, 10);

  const report = {
    category: parsed.category,
    period: parsed.period,
    weeks: parsed.weeks,
    rows: parsed.rows.length,
    cutoffs: parsed.cutoffs,
    capturedOn,
    capturedOnWasSupplied: capturedOnRaw != null,
  };

  if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: report });

  const [upload] = await db
    .insert(uploads)
    .values({ kind, filename: file.name, rowCount: parsed.rows.length, report })
    .returning();

  const rows = parsed.rows.map((r) => ({
    uploadId: upload.id,
    category: parsed.category!,
    period: parsed.period,
    weeks: parsed.weeks,
    capturedOn,
    rank: r.rank,
    user: r.user,
    team: r.team,
    points: r.points,
    played: r.played,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(standings).values(rows.slice(i, i + 500));
  }

  return NextResponse.json({ kind, uploadId: upload.id, stats: report });
}
