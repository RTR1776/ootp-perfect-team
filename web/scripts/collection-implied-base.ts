/**
 * Add the implied base copies (ingest/collection impliedBaseCopies) to a
 * collection upload filed before /upload added them itself: every variant
 * listed without its base, except a clubhouse card's.
 *
 * Dry by default: prints how many and which. --commit writes them. Safe to
 * run twice: a card that already has a base row (the export's or an implied
 * one) is skipped.
 *
 *   node --env-file=.env.local --import tsx scripts/collection-implied-base.ts [--upload 173] [--commit]
 *
 * No --upload: the newest collection upload.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { impliedBaseCopies, impliedBaseRow } from "@/lib/ingest/collection";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

async function main() {
  const asked = val("upload") != null ? Number(val("upload")) : null;
  const [upload] = asked != null
    ? await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(and(eq(uploads.id, asked), eq(uploads.kind, "collection")))
    : await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1);
  if (!upload) throw new Error(asked != null ? `upload ${asked} is not a collection upload` : "no collection upload");

  const rows = await db.select().from(collectionCards).where(eq(collectionCards.uploadId, upload.id));
  const universe = await db.select({ cardId: cards.cardId, title: cards.title, tier: cards.tier }).from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  const clubhouse = (id: number) => /clubhouse/i.test(byId.get(id)?.title ?? "");
  const ids = impliedBaseCopies(rows, clubhouse);
  const skipped = [...new Set(rows.filter((r) => r.isVariant && r.cardId != null && clubhouse(r.cardId)).map((r) => r.cardId!))]
    .filter((id) => !rows.some((r) => r.cardId === id && !r.isVariant));

  const byTier: Record<string, number> = {};
  for (const id of ids) { const t = byId.get(id)?.tier ?? "?"; byTier[t] = (byTier[t] ?? 0) + 1; }
  console.log(`Collection upload ${upload.id} (${upload.at.toISOString().slice(0, 10)}): ${rows.length} rows, ${rows.filter((r) => r.isVariant).length} variants.`);
  console.log(`  ${ids.length} variant${ids.length === 1 ? "" : "s"} listed without the base copy: ${Object.entries(byTier).map(([t, n]) => `${n} ${t}`).join(", ") || "none"}.`);
  if (skipped.length) console.log(`  ${skipped.length} clubhouse card${skipped.length === 1 ? "" : "s"} left as variant-only: ${skipped.map((id) => rows.find((r) => r.cardId === id)!.name).join(", ")}.`);
  const sample = ids.slice(0, 8).map((id) => rows.find((r) => r.cardId === id && r.isVariant)!.name);
  if (sample.length) console.log(`  For example: ${sample.join(", ")}${ids.length > sample.length ? ", …" : ""}.`);
  if (!argv.includes("--commit")) { console.log("\nDry run: nothing written yet (--commit adds the base copies)."); process.exit(0); }
  const add = ids.map((id) => ({ uploadId: upload.id, ...impliedBaseRow(rows.find((r) => r.cardId === id && r.isVariant)!) }));
  for (let i = 0; i < add.length; i += 100) await db.insert(collectionCards).values(add.slice(i, i + 100));
  console.log(`\nAdded ${add.length} implied base cop${add.length === 1 ? "y" : "ies"} to upload ${upload.id}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
