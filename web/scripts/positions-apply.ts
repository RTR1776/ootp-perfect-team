/**
 * Stamp position-overrides.json onto the CURRENT collection upload, so a
 * hand-entered defense page takes effect without re-exporting the collection.
 * (Fresh uploads get the same stamp automatically in the upload route.)
 *
 *   pnpm positions:apply
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionCards, uploads } from "@/db/schema";
import { POSITION_OVERRIDES, positionOverride } from "@/lib/position-overrides";

(async () => {
  const [up] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (!up) { console.log("no collection upload"); process.exit(1); }
  const rows = await db.select({ id: collectionCards.id, cardId: collectionCards.cardId, name: collectionCards.name, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, up.id));
  let n = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const o = positionOverride(r.cardId, r.isVariant);
    if (!o) continue;
    const ratings = { ...(r.ratings ?? {}) };
    for (const [p, v] of Object.entries(o.positions)) ratings[`POS ${p}`] = v;
    await db.update(collectionCards).set({ ratings }).where(eq(collectionCards.id, r.id));
    seen.add(`${o.cardId}:${o.variant ? "v" : "b"}`);
    console.log(`stamped ${r.name}${r.isVariant ? " (VAR)" : ""} #${r.cardId}: ${Object.entries(o.positions).map(([p, v]) => `${p} ${v}`).join(", ")}`);
    n++;
  }
  for (const o of POSITION_OVERRIDES) if (!seen.has(`${o.cardId}:${o.variant ? "v" : "b"}`)) console.log(`not in upload ${up.id}: ${o.name ?? o.cardId}${o.variant ? " (VAR)" : ""}`);
  console.log(`${n} copies stamped on upload ${up.id}`);
  process.exit(0);
})().catch((e) => { console.error(String(e)); process.exit(1); });
