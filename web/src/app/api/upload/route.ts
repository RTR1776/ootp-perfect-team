/**
 * CSV upload + ingest.
 *
 * POST a file (multipart/form-data, field `file`). The kind is sniffed from the
 * header line, so there is nothing to choose in the UI — drop any PT export and
 * it lands in the right place.
 *
 * Send `?dryRun=1` to parse and report without writing: the page previews
 * every file this way before anything touches the database. A preview also
 * says what is on file (UI plan U1), so the page can hold back a file that
 * would roll data back:
 * - `onFile`: the newest upload of the same kind (id, filename, date), picked
 *   the way every reader picks it (uploaded_at, then id);
 * - league files: `replaces`, the snapshot of the same league, split and week,
 *   and `weeks`, that league and split's weeks on file, so the page can say
 *   what a different week would replace without sending the file again;
 * - `alreadyImported` when this exact file (sha256) is on file already.
 *
 * Every real write is recorded in import_batches (kind "upload:<kind>", the
 * file's sha256, rows, and the outcome or the error), because on 2026-09-17
 * two files were uploaded here and nothing landed, and there was no record
 * of the attempt. A write that fails part-way is removed again, so a failed
 * file is never half-read. A file whose sha256 is already on an uploads row of
 * the same kind is recognised and not written twice — the same rule the CLI
 * importer (import:cards) applies, so the two paths cannot double-load.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/db/client";
import { cards, cardSnapshots, collectionCards, importBatches, standings, uploads } from "@/db/schema";
import { stampPositionOverrides } from "@/lib/position-overrides";
import { parseShopList, looksLikeShopList } from "@/lib/ingest/pt-card-list";
import {
  looksLikeCollection,
  matchCollectionToShop,
  parseCollection,
} from "@/lib/ingest/collection";
import { looksLikeStandings, parseStandings } from "@/lib/ingest/standings";
import { looksLikeLeagueExport, parseLeagueExport } from "@/lib/ingest/league";
import { looksLikeDump, parseDump, computeStandings } from "@/lib/analytics/dumps";
import { periods } from "@/db/schema";
import { leagueSnapshots, leagueStints } from "@/db/schema";
import { chicagoDay } from "@/lib/format";
import { leagueWeekOf } from "@/lib/league-week";
import { nameDateOf, shopListUpdatesCards, stampFor, type UploadKind as Kind } from "@/lib/upload-rules";

export const runtime = "nodejs";
/** The shop list is ~1.5MB and 3,700 rows; the default 10s is not enough. */
export const maxDuration = 60;

/**
 * The newest upload of a kind, the way every reader picks it. `match` narrows
 * it by a report field: a dump is tournaments or drafts, standings a category.
 */
async function newestOnFile(kind: Kind, match?: { field: string; value: string }) {
  const [row] = await db
    .select({ id: uploads.id, filename: uploads.filename, at: uploads.uploadedAt, rows: uploads.rowCount })
    .from(uploads)
    .where(match ? and(eq(uploads.kind, kind), sql`${uploads.report}->>${match.field} = ${match.value}`) : eq(uploads.kind, kind))
    .orderBy(desc(uploads.uploadedAt), desc(uploads.id))
    .limit(1);
  return row ?? null;
}
type OnFile = Awaited<ReturnType<typeof newestOnFile>>;
const onFileJson = (row: OnFile) => (row ? { id: row.id, filename: row.filename, date: chicagoDay(row.at), rows: row.rows } : null);

/**
 * A tournament stats export is the same 200-column family as a league export.
 * The route cannot take it: the series and run come from the filename the
 * Mac filer assigns, and observed_card_stats is rebuilt per series from
 * Archive/Completed, which this machine does not have. Say so instead of
 * "could not tell which league".
 */
function tournamentExportHint(filename: string): string {
  return `${filename} looks like a per-tournament stats export (or a league export whose filename no longer names its league). ` +
    `Tournament exports are filed and imported by File OOTP Exports.command on the Mac (Archive/Completed → import:observed). ` +
    `A league export must keep its league and split in the filename: pel_all.csv, hd451_vL.csv, ld404vR_….csv.`;
}

function detectKind(headerLine: string): Kind | null {
  // Community finish-order dump: SEP= preamble or num,title,starttime header.
  if (looksLikeDump(headerLine)) return "dump";
  // League next: its header also contains POS/Name like the collection's, but
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
    /* A Manage Cards export in OOTP's DEFAULT view has POS and Name but not the
       CVAL / VAR columns the collection needs (value, and which copies are
       variants) - say exactly that instead of a bare "unrecognised". */
    const cells = headerLine.split(/[,\t]/).map((c) => c.replace(/^\/+/, "").trim());
    if (cells.includes("POS") && cells.includes("Name")) {
      const missing = ["CVAL", "VAR"].filter((c) => !cells.includes(c));
      if (missing.length) {
        return NextResponse.json(
          {
            error: "Collection export without the value/variant columns.",
            hint: `This looks like a Manage Cards export, but it is missing ${missing.join(" and ")}. It was exported with a view that leaves them out (OOTP's default view does). Switch Manage Cards to the view that shows Card Value and Variant, export again, and upload that file.`,
            headerSeen: headerLine.slice(0, 200),
          },
          { status: 422 },
        );
      }
    }
    return NextResponse.json(
      {
        error: "Unrecognised export.",
        hint: `Expected the shop list (pt_card_list.csv), a Manage Cards export, a league export, a community dump or category standings. First columns seen: ${headerLine.slice(0, 120)}`,
        headerSeen: headerLine.slice(0, 200),
      },
      { status: 422 },
    );
  }

  /**
   * Every export is a snapshot of the moment it was downloaded, and nothing
   * inside the file records that moment. Today is right for a fresh export and
   * wrong for a backfill — which is exactly when it must be overridable — so the
   * caller may supply `capturedOn` (YYYY-MM-DD). It stamps the upload row and,
   * for the shop list, every price snapshot row, so /market's history reads the
   * true dates.
   */
  const capturedOnRaw = (form.get("capturedOn") as string | null)?.trim() || null;
  if (capturedOnRaw && !/^\d{4}-\d{2}-\d{2}$/.test(capturedOnRaw)) {
    return NextResponse.json(
      { error: "capturedOn must be YYYY-MM-DD.", got: capturedOnRaw },
      { status: 400 },
    );
  }
  /**
   * The exports are named for the day they were pulled ("collection
   * 2026-09-15.csv", "pt_card_list 2026-09-15.csv", the dumps'
   * "…_dump_20260921.csv"), and that date is a better default than today:
   * the file is often uploaded a day or two after it was exported. The page
   * always sends the date it shows ("Saved as"); these defaults serve other
   * callers and the preview, and read a name the way the page does. A league
   * file with no date belongs to the week that ends on Sunday.
   */
  const today = chicagoDay(new Date())!;
  const fromName = nameDateOf(file.name, today);
  const dated = capturedOnRaw != null || fromName != null;
  const capturedOn = capturedOnRaw ?? fromName ?? (kind === "league" ? leagueWeekOf(new Date()) : today);
  // Noon UTC so the date survives a round-trip through any timezone.
  const capturedAt = dated ? new Date(`${capturedOn}T12:00:00Z`) : new Date();
  const sha256 = createHash("sha256").update(text).digest("hex");

  /* The same file twice is recognised whether previewing or saving: a preview
     says "Already saved" and the page leaves it out of Save. */
  const [seen] = await db
    .select({ id: uploads.id, at: uploads.uploadedAt, filename: uploads.filename, report: uploads.report })
    .from(uploads)
    .where(sql`${uploads.kind} = ${kind} and ${uploads.report}->>'sha256' = ${sha256}`)
    .orderBy(desc(uploads.uploadedAt), desc(uploads.id))
    .limit(1);
  if (seen) {
    const report = (seen.report ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      kind,
      dryRun,
      uploadId: seen.id,
      alreadyImported: { id: seen.id, filename: seen.filename, date: chicagoDay(seen.at) },
      stats: { ...report, capturedOn: typeof report.capturedOn === "string" ? report.capturedOn : chicagoDay(seen.at) },
    });
  }

  /** Record the attempt, run the write, record the outcome — and turn a thrown
   *  error into a JSON 500 the page can show instead of a blank failure. The
   *  write reports its upload row through `track`; if it then fails, the row
   *  goes again (and its snapshots with it, by cascade), so a half-written
   *  file never reads as the newest. Card values a shop list already moved
   *  before failing stay moved: only the newest list moves them, so they
   *  moved forward, and saving it again finishes the job. */
  const lineage = async (rows: number, write: (track: (uploadId: number) => void) => Promise<NextResponse>): Promise<NextResponse> => {
    const [batch] = await db.insert(importBatches).values({
      kind: `upload:${kind}`, scope: [kind], files: [{ name: file.name, bytes: text.length, sha256 }],
      parserVersion: "upload/3 (preview on-file checks, older shop lists keep card values, 2026-09-27)", rows, status: "staged",
    }).returning({ id: importBatches.id });
    // Set from inside write(); `as` keeps TypeScript from narrowing it to null here.
    let written = null as number | null;
    try {
      const res = await write((uploadId) => { written = uploadId; });
      await db.update(importBatches).set({ status: "published", publishedAt: new Date() }).where(eq(importBatches.id, batch.id));
      return res;
    } catch (e) {
      const message = String((e as { cause?: { message?: string } })?.cause?.message ?? (e as Error)?.message ?? e).slice(0, 2000);
      if (written != null) await db.delete(uploads).where(eq(uploads.id, written)).catch(() => undefined);
      await db.update(importBatches).set({ status: "failed", error: message }).where(eq(importBatches.id, batch.id)).catch(() => undefined);
      return NextResponse.json({ kind, error: "Save failed part-way and was removed. Try again.", detail: message, batchId: batch.id }, { status: 500 });
    }
  };

  /* ---------------------------------------------------------------- */

  if (kind === "dump") {
    const parsed = parseDump(text);
    if (!parsed) {
      return NextResponse.json({ kind, error: "Could not parse the dump." }, { status: 422 });
    }
    const [period] = await db.select().from(periods).orderBy(sql`${periods.id} desc`).limit(1);
    if (!period) {
      return NextResponse.json(
        { kind, error: "No PTCS period in the database — run pnpm import:ptcs6 first." },
        { status: 409 },
      );
    }
    const standings = computeStandings(parsed, { start: period.startsOn, end: period.endsOn });
    const report = {
      source: parsed.source,
      dateMin: parsed.dateMin,
      dateMax: parsed.dateMax,
      period: period.name,
      standings,
      capturedOn,
    } as unknown as Record<string, unknown>;
    // Tournaments and drafts are separate dumps; each is compared with its own.
    const onFile = await newestOnFile(kind, { field: "source", value: parsed.source });
    if (dryRun) {
      const brief = { source: parsed.source, dateMin: parsed.dateMin, dateMax: parsed.dateMax, period: period.name, events: parsed.events.length, capturedOn };
      return NextResponse.json({ kind, dryRun: true, stats: brief, onFile: onFileJson(onFile) });
    }
    const at = dated ? stampFor(capturedOn, onFile) : capturedAt;
    return lineage(parsed.events.length, async (track) => {
      const [upload] = await db
        .insert(uploads)
        .values({ kind, filename: file.name, rowCount: parsed.events.length, report: { ...report, sha256 }, uploadedAt: at })
        .returning();
      track(upload.id);
      return NextResponse.json({ kind, uploadId: upload.id, stats: { source: parsed.source, events: parsed.events.length, dateMax: parsed.dateMax, capturedOn } });
    });
  }

  /* ---------------------------------------------------------------- */

  if (kind === "league") {
    const parsed = parseLeagueExport(text, file.name);

    const league = parsed.league;
    if (!league) {
      return NextResponse.json(
        { error: "Not a league export the app can place.", hint: tournamentExportHint(file.name) },
        { status: 422 },
      );
    }
    if (parsed.stints.length === 0) {
      return NextResponse.json({ kind, error: "No rows parsed from the league export." }, { status: 422 });
    }

    const report = {
      league: parsed.league,
      split: parsed.split,
      ...parsed.stats,
      capturedOn,
      capturedOnWasSupplied: capturedOnRaw != null,
    };

    if (dryRun) {
      /* This league and split's weeks on file, newest first. Readers keep the
         newest snapshot of a week, so this does too: a week saved again is
         the one it replaces. */
      const snaps = await db
        .select({ snapshotId: leagueSnapshots.id, uploadId: leagueSnapshots.uploadId, capturedOn: leagueSnapshots.capturedOn, rows: leagueSnapshots.rows, filename: uploads.filename })
        .from(leagueSnapshots)
        .innerJoin(uploads, eq(uploads.id, leagueSnapshots.uploadId))
        .where(and(eq(leagueSnapshots.league, league), eq(leagueSnapshots.split, parsed.split)))
        .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id));
      const weeks = snaps.filter((s, i) => snaps.findIndex((t) => t.capturedOn === s.capturedOn) === i);
      const newest = weeks[0];
      return NextResponse.json({
        kind,
        dryRun: true,
        stats: report,
        onFile: newest ? { id: newest.uploadId, filename: newest.filename, date: newest.capturedOn, rows: newest.rows } : null,
        replaces: weeks.find((w) => w.capturedOn === capturedOn) ?? null,
        weeks,
      });
    }

    return lineage(parsed.stints.length, async (track) => {
    const [upload] = await db
      .insert(uploads)
      .values({
        kind,
        filename: file.name,
        rowCount: parsed.stints.length,
        report: { ...report, sha256 },
        uploadedAt: capturedAt,
      })
      .returning();
    track(upload.id);

    const [snapshot] = await db
      .insert(leagueSnapshots)
      .values({
        uploadId: upload.id,
        league,
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
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(leagueStints).values(rows.slice(i, i + 100));
    }

    return NextResponse.json({ kind, uploadId: upload.id, snapshotId: snapshot.id, stats: report });
    });
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
          kind,
          error: "Column alignment check failed — refusing to import.",
          detail:
            "Tier codes did not partition Card Value into the expected bands, which means the columns are shifted. Check whether the export's field count changed.",
          stats: parsed.stats,
        },
        { status: 422 },
      );
    }

    const onFile = await newestOnFile(kind);
    const at = dated ? stampFor(capturedOn, onFile) : capturedAt;
    /* Card values (value, tier, ratings) only move forward. A list older than
       the newest on file still adds its prices to card_snapshots, so Market's
       history can be backfilled, but it no longer overwrites newer values:
       an 09-18 list dropped after the 09-25 one used to roll every card back. */
    const updatesCards = shopListUpdatesCards(at, onFile?.at ?? null);
    const report = {
      ...(parsed.stats as unknown as Record<string, unknown>),
      capturedOn,
      capturedOnWasSupplied: capturedOnRaw != null,
      cardsUpdated: updatesCards,
    };

    if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: report, onFile: onFileJson(onFile) });

    return lineage(parsed.cards.length, async (track) => {
    const [upload] = await db
      .insert(uploads)
      .values({
        kind,
        filename: file.name,
        rowCount: parsed.cards.length,
        report: { ...report, sha256 },
        uploadedAt: at,
      })
      .returning();
    track(upload.id);

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

    // Chunked: each row carries a ~90-key ratings blob, and the Neon HTTP
    // driver rejects payloads past a few hundred KB (the CLI uses 50).
    for (let i = 0; i < cardRows.length; i += 100) {
      const insert = db.insert(cards).values(cardRows.slice(i, i + 100));
      await (updatesCards
        ? insert.onConflictDoUpdate({
          target: cards.cardId,
          set: {
            title: sql`excluded.title`,
            cardValue: sql`excluded.card_value`,
            tier: sql`excluded.tier`,
            ratings: sql`excluded.ratings`,
            lastSeenAt: sql`now()`,
          },
        })
        // An older list only adds cards the table lacks (its snapshots need them).
        : insert.onConflictDoNothing({ target: cards.cardId }));
    }

    const snapshotRows = parsed.cards.map((c) => ({
      uploadId: upload.id,
      capturedAt: at,
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
    for (let i = 0; i < snapshotRows.length; i += 250) {
      await db.insert(cardSnapshots).values(snapshotRows.slice(i, i + 250));
    }

    return NextResponse.json({ kind, uploadId: upload.id, stats: report, cardsUpdated: updatesCards });
    });
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
        { kind, error: "Upload pt_card_list.csv first — the collection is matched against it." },
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
      capturedOn,
      capturedOnWasSupplied: capturedOnRaw != null,
    };

    const onFile = await newestOnFile(kind);
    if (dryRun) return NextResponse.json({ kind, dryRun: true, stats: report, onFile: onFileJson(onFile) });
    const at = dated ? stampFor(capturedOn, onFile) : capturedAt;

    return lineage(matched.length, async (track) => {
    const [upload] = await db
      .insert(uploads)
      .values({
        kind,
        filename: file.name,
        rowCount: matched.length,
        report: { ...report, sha256 },
        uploadedAt: at,
      })
      .returning();
    track(upload.id);

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
      ratings: m.ratings,
    }));
    stampPositionOverrides(rows);
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(collectionCards).values(rows.slice(i, i + 100));
    }

    return NextResponse.json({ kind, uploadId: upload.id, stats: report });
    });
  }

  /* ---------------------------------------------------------------- */

  const parsed = parseStandings(text, file.name);
  if (!parsed.category) {
    return NextResponse.json(
      {
        kind,
        error: "Could not tell which category this standings file is for.",
        hint: "Keep the original filename — the category and period are read from it.",
      },
      { status: 422 },
    );
  }

  // A standings export is a snapshot as of when it was downloaded, not the final
  // result for the period in its filename — the PTCS 5 files are named for a
  // period ending Aug 2 but were taken on Jul 28. Hence capturedOn above.
  const report = {
    category: parsed.category,
    period: parsed.period,
    weeks: parsed.weeks,
    rows: parsed.rows.length,
    cutoffs: parsed.cutoffs,
    capturedOn,
    capturedOnWasSupplied: capturedOnRaw != null,
  };

  if (dryRun) {
    const onFile = await newestOnFile(kind, { field: "category", value: parsed.category });
    return NextResponse.json({ kind, dryRun: true, stats: report, onFile: onFileJson(onFile) });
  }

  return lineage(parsed.rows.length, async (track) => {
  const [upload] = await db
    .insert(uploads)
    .values({
      kind,
      filename: file.name,
      rowCount: parsed.rows.length,
      report: { ...report, sha256 },
      uploadedAt: capturedAt,
    })
    .returning();
  track(upload.id);

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
  });
}
