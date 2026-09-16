/**
 * Every card's rating at every position, from the stat exports.
 *
 *   pnpm positions:harvest          (also step 3c of pnpm load:dumps)
 *
 * The shop dumps list only the positions on the card (Nimmala: 3B 119, SS
 * 108; the other six are 0 here) and the collection export carries only DEF,
 * the rating at the listed POS. But the game rates every card at every
 * position, and every stat export row shows all eight — for the copy that
 * played, variant or base (the VAR column says which). 205,400 row-positions
 * in the archive carry a rating where the shop lists 0.
 *
 * Where the export and the shop both rate a listed position they agree on 93%
 * of comparisons; the rest are cards whose ratings moved between dumps (live
 * cards), so the shop stays authoritative for listed positions and the
 * export fills the unlisted ones. The newest export seen wins per form.
 *
 * Writes card_positions (both forms), fills cards.ratings `Pos Rating <p>`
 * where it is 0 for base cards, and stamps `POS <p>` onto owned variant copies
 * in the current collection upload (the upload route does the same for new
 * uploads). Re-run after load:dumps, which resets cards.ratings.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cardPositions, cards, collectionCards, uploads } from "@/db/schema";
import { parseCsv } from "@/lib/ingest/eligible-pool";
import { positionOverride } from "@/lib/position-overrides";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DIRS = ["Archive/Completed", "Archive/Completed/Perfect League and HD data", "Archive"].map((d) => join(ROOT, d));
const POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const rows = <T,>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? []));

(async () => {
  await db.execute(sql`create table if not exists card_positions (
    card_id integer not null, variant boolean not null default false, positions jsonb not null,
    source text, updated_at timestamptz not null default now(), primary key (card_id, variant))`);

  const files: { path: string; name: string; mtime: number }[] = [];
  for (const d of DIRS) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (f.endsWith(".csv")) { const p = join(d, f); files.push({ path: p, name: f, mtime: statSync(p).mtimeMs }); }
  }
  files.sort((a, b) => a.mtime - b.mtime); // oldest first; later files overwrite
  const seen = new Map<string, { cardId: number; variant: boolean; positions: Record<string, number>; source: string }>();
  let used = 0;
  for (const f of files) {
    let parsed: Record<string, string>[];
    try { parsed = parseCsv(readFileSync(f.path, "utf8")); } catch { continue; }
    if (!parsed.length || !("CID" in parsed[0]) || !("SS" in parsed[0])) continue;
    used++;
    for (const r of parsed) {
      const cid = Number(r.CID); if (!cid) continue;
      const variant = (r.VAR || "").trim().toUpperCase() === "Y";
      const positions: Record<string, number> = {};
      for (const p of POS) { const v = Number(r[p]); if (Number.isFinite(v) && v > 0) positions[p] = v; }
      if (!Object.keys(positions).length) continue;
      seen.set(`${cid}:${variant ? "v" : "b"}`, { cardId: cid, variant, positions, source: f.name });
    }
  }
  console.log(`${used} export files read; ${seen.size} card forms with positions`);

  const list = [...seen.values()];
  for (let i = 0; i < list.length; i += 500) {
    await db.insert(cardPositions).values(list.slice(i, i + 500).map((s) => ({ ...s, updatedAt: new Date() })))
      .onConflictDoUpdate({ target: [cardPositions.cardId, cardPositions.variant], set: { positions: sql`excluded.positions`, source: sql`excluded.source`, updatedAt: sql`now()` } });
  }
  console.log(`card_positions upserted: ${list.length}`);

  // Base cards: fill the unlisted positions.
  const universe = await db.select({ cardId: cards.cardId, isPitcher: cards.isPitcher, ratings: cards.ratings }).from(cards);
  let filled = 0, fills = 0;
  for (const c of universe) {
    if (c.isPitcher) continue;
    const s = seen.get(`${c.cardId}:b`); if (!s) continue;
    const r = { ...((c.ratings ?? {}) as Record<string, number>) };
    let touched = false;
    for (const p of POS) { if ((r[`Pos Rating ${p}`] ?? 0) <= 0 && s.positions[p] > 0) { r[`Pos Rating ${p}`] = s.positions[p]; touched = true; fills++; } }
    if (touched) { await db.update(cards).set({ ratings: r }).where(eq(cards.cardId, c.cardId)); filled++; }
  }
  console.log(`base cards: ${filled} cards given ${fills} unlisted position ratings`);

  // Owned variant copies in the current upload: stamp POS keys (harvest, then overrides on top).
  const [up] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (up) {
    const own = await db.select({ id: collectionCards.id, cardId: collectionCards.cardId, ratings: collectionCards.ratings, isVariant: collectionCards.isVariant }).from(collectionCards).where(eq(collectionCards.uploadId, up.id));
    let stamped = 0;
    for (const o of own) {
      if (!o.isVariant || o.cardId == null) continue;
      const s = seen.get(`${o.cardId}:v`); const ov = positionOverride(o.cardId, true);
      if (!s && !ov) continue;
      const ratings = { ...(o.ratings ?? {}) };
      if (s) for (const [p, v] of Object.entries(s.positions)) ratings[`POS ${p}`] = v;
      if (ov) for (const [p, v] of Object.entries(ov.positions)) ratings[`POS ${p}`] = v;
      await db.update(collectionCards).set({ ratings }).where(eq(collectionCards.id, o.id)); stamped++;
    }
    console.log(`owned variant copies stamped in upload ${up.id}: ${stamped}`);
  }
  void rows;
  process.exit(0);
})().catch((e) => { console.error(String(e)); process.exit(1); });
