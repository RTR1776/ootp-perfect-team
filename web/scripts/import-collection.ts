/**
 * Import a collection export from the command line — the same parse, shop
 * matching, position overrides and lineage as the /upload page, for when the
 * browser is not to hand (or the session is running out of time).
 *
 *   pnpm import:collection "path/to/collection - manage cards.csv" [--date 2026-09-17]
 *
 * The date is the day the export was taken: --date, else a YYYY-MM-DD in the
 * file name, else today. A file already imported (same sha256) is skipped.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, importBatches, uploads } from "@/db/schema";
import { stampPositionOverrides } from "@/lib/position-overrides";
import { matchCollectionToShop, parseCollection } from "@/lib/ingest/collection";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const FILE = argv.find((a) => !a.startsWith("--") && a !== val("date"));
if (!FILE) { console.error("usage: pnpm import:collection FILE [--date YYYY-MM-DD]"); process.exit(1); }
const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));

async function main() {
  const text = readFileSync(FILE!, "utf8");
  const filename = basename(FILE!);
  const sha256 = createHash("sha256").update(text).digest("hex");
  const dup = asRows<{ id: number; uploaded_at: string }>(await db.execute(sql`
    select id, uploaded_at from uploads where kind = 'collection' and report->>'sha256' = ${sha256} limit 1`));
  if (dup.length) { console.log(`already imported as upload ${dup[0].id} (${String(dup[0].uploaded_at).slice(0, 10)}) — nothing to do`); process.exit(0); }

  const fromName = /(\d{4}-\d{2}-\d{2})/.exec(filename)?.[1];
  const capturedOn = val("date") ?? fromName ?? new Date().toISOString().slice(0, 10);
  const capturedAt = val("date") || fromName ? new Date(`${capturedOn}T12:00:00Z`) : new Date();

  const parsed = parseCollection(text);
  const universe = await db.select({ cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, isPitcher: cards.isPitcher, ratings: cards.ratings }).from(cards);
  if (!universe.length) throw new Error("the card table is empty — import pt_card_list.csv first; the collection is matched against it");
  const { matched, matchRate } = matchCollectionToShop(parsed.cards, universe.map((u) => ({ ...u, ratings: u.ratings ?? {} })) as never);
  const unmatched = matched.filter((m) => m.cardId == null).length;
  const report = { ...parsed.stats, matchRate, unmatched, capturedOn, capturedOnWasSupplied: val("date") != null, sha256, via: "import:collection" };
  console.log(`${filename}: ${matched.length} cards, match rate ${(matchRate * 100).toFixed(1)}%, ${unmatched} unmatched, as of ${capturedOn}`);

  const [batch] = await db.insert(importBatches).values({
    kind: "upload:collection", scope: ["collection"], files: [{ name: filename, bytes: text.length, sha256 }],
    parserVersion: "import-collection/1 (mirrors upload/2)", rows: matched.length, status: "staged",
  }).returning({ id: importBatches.id });
  try {
    const [upload] = await db.insert(uploads).values({ kind: "collection", filename, rowCount: matched.length, report, uploadedAt: capturedAt }).returning();
    const rows = matched.map((m) => ({
      uploadId: upload.id, cardId: m.cardId, name: m.name, pos: m.pos, cardValue: m.cardValue, isVariant: m.isVariant, isActive: m.isActive,
      released: m.released, matchDistance: m.matchDistance, matchQuality: m.matchQuality, ratings: m.ratings,
    }));
    stampPositionOverrides(rows);
    for (let i = 0; i < rows.length; i += 100) await db.insert(collectionCards).values(rows.slice(i, i + 100));
    await db.update(importBatches).set({ status: "published", publishedAt: new Date() }).where(eq(importBatches.id, batch.id));
    console.log(`upload ${upload.id} published (${rows.length} rows)`);
  } catch (e) {
    await db.update(importBatches).set({ status: "failed", error: String((e as Error)?.message ?? e).slice(0, 2000) }).where(eq(importBatches.id, batch.id)).catch(() => undefined);
    throw e;
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
