/**
 * Atomic shop + collection refresh — both files land in ONE transaction, or
 * neither does, and a file already imported (by sha256) is skipped.
 *
 *   node --env-file=.env.local --import tsx scripts/import-current-cards.ts SHOP COLLECTION YYYY-MM-DD [--commit]
 *   (or: pnpm import:cards SHOP COLLECTION YYYY-MM-DD --commit)
 *
 * Preview is the default; --commit writes. Collection rows keep the ratings the
 * export recorded for each owned copy (collection_cards.ratings — declared in
 * src/db/schema.ts, applied with `pnpm db:push`), which is what lets a VARIANT
 * copy be scored on its own numbers instead of the base card's.
 *
 * Runs over the Neon HTTP driver's transaction API rather than node-postgres.
 * A raw Postgres TLS connection dies with "bad record mac" from inside the
 * device VM (its egress proxy handles HTTPS, not the Postgres wire protocol),
 * and every other script in this repo already talks to Neon over HTTPS. The
 * transaction API still gives all-or-nothing: the upload ids are reserved from
 * the sequence first so no statement depends on another's result.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sql as dsql } from "drizzle-orm";
import { db as drizzleDb } from "@/db/client";
import { parseShopList } from "../src/lib/ingest/pt-card-list";
import { parseCollection, matchCollectionToShop } from "../src/lib/ingest/collection";

async function main() {
  const [shopPath, collectionPath, date] = process.argv.slice(2);
  if (!shopPath || !collectionPath || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Supply shop file, collection file, and capture date.");
  const shopText = readFileSync(shopPath, "utf8"), collectionText = readFileSync(collectionPath, "utf8");
  const shop = parseShopList(shopText), collection = parseCollection(collectionText);
  if (!shop.stats.tierBandsValid || shop.skipped.length || !shop.cards.length) throw new Error("Shop validation failed; nothing written.");
  const matched = matchCollectionToShop(collection.cards, shop.cards);
  /**
   * The collection is exported the day it is looked at; the shop list may be
   * days older. Anything released in between cannot match, and refusing the
   * whole import over a handful of brand-new commons throws away a 98%+ good
   * refresh. Unmatched rows are written with a null card_id and their own
   * ratings, and named here so a stale shop list is visible rather than silent.
   */
  const unmatched = matched.matched.filter((m) => m.cardId == null || m.matchQuality === "unmatched");
  const allow = Number(process.argv.includes("--allow-unmatched")
    ? process.argv[process.argv.indexOf("--allow-unmatched") + 1] ?? "0" : "0");
  if (unmatched.length) {
    console.log(`\n${unmatched.length} collection rows have no card in this shop list (shop list is older than the collection):`);
    for (const u of unmatched.sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0)).slice(0, 15)) {
      console.log(`  ${String(u.cardValue).padStart(3)} ${u.pos.padEnd(3)} ${u.name}${u.isVariant ? "  VARIANT" : ""}${u.isActive ? "  ACTIVE" : ""}  rel ${u.released ?? "-"}`);
    }
    if (unmatched.length > 15) console.log(`  ...and ${unmatched.length - 15} more`);
    console.log(`Export a fresh pt_card_list to resolve these.\n`);
  }
  if (unmatched.length > allow) throw new Error(`${unmatched.length} unmatched collection rows; re-run with --allow-unmatched ${unmatched.length} to accept them, or export a fresh shop list.`);
  const hashes = [shopText, collectionText].map(t => createHash("sha256").update(t).digest("hex"));
  console.log(JSON.stringify({ shop: shop.stats, collection: collection.stats, matchRate: matched.matchRate, capturedOn: date }, null, 2));
  if (!process.argv.includes("--commit")) return;
  /**
   * Goes through the shared drizzle client rather than a driver created here:
   * this repo's Neon URL only connects through that client's configuration, and
   * a second connection built by hand fails with "fetch failed" from inside the
   * device VM.
   */
  const rowsOf = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
  const J = (x: unknown) => JSON.stringify(x);

  const seen = rowsOf<any>(await drizzleDb.execute(
    dsql`SELECT kind FROM uploads WHERE report->>'sha256' IN (${hashes[0]}, ${hashes[1]})`));
  if (seen.some((r) => r.kind === "shop_list") && seen.some((r) => r.kind === "collection")) {
    console.log("Both files already imported; nothing changed."); return;
  }
  const [ids] = rowsOf<any>(await drizzleDb.execute(
    dsql`SELECT nextval('uploads_id_seq')::int a, nextval('uploads_id_seq')::int b`));
  const shopId = Number(ids.a), collectionId = Number(ids.b);
  const capture = `${date}T12:00:00Z`;

  const steps: Array<() => Promise<unknown>> = [];
  const uploadRow = (id: number, kind: string, filename: string, count: number, report: object) =>
    steps.push(() => drizzleDb.execute(dsql`
      INSERT INTO uploads(id,kind,filename,row_count,uploaded_at,report)
      VALUES(${id}, ${kind}, ${filename.split("/").pop()}, ${count}, ${capture}, ${J(report)}::jsonb)`));

  uploadRow(shopId, "shop_list", shopPath, shop.cards.length, { ...shop.stats, capturedOn: date, sha256: hashes[0] });

  const fields = ["card_id","title","name","first_name","last_name","nick_name","tier","card_value","position","pitcher_role","is_pitcher","bats","throws","year","era_code","era_label","team","franchise","series","badge","card_type","card_sub_type","bref_id","released_on","ratings"];
  const cardRows = shop.cards.map(c => {
    const row = [c.cardId,c.title,c.name,c.firstName,c.lastName,c.nickName,c.tier,c.cardValue,c.position,c.pitcherRole,c.isPitcher,c.bats,c.throws,c.year,c.eraCode,c.eraLabel,c.team,c.franchise,c.series,c.badge,c.cardType,c.cardSubType,c.brefId,c.date,c.ratings];
    return Object.fromEntries(fields.map((f,i) => [f,row[i]]));
  });
  const cols = dsql.raw(fields.join(","));
  const upd = dsql.raw(fields.slice(1).map(f => `${f}=EXCLUDED.${f}`).join(","));
  for (let i = 0; i < cardRows.length; i += 50) {
    const chunk = J(cardRows.slice(i, i + 50));
    steps.push(() => drizzleDb.execute(dsql`
      INSERT INTO cards (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(null::cards, ${chunk}::jsonb)
      ON CONFLICT(card_id) DO UPDATE SET ${upd}, last_seen_at = now()`));
  }

  const snapshots = shop.cards.map(c => ({upload_id:shopId,card_id:c.cardId,captured_at:capture,owned:c.owned,buy_order_high:c.market.buyOrderHigh,sell_order_low:c.market.sellOrderLow,last10:c.market.last10,last10_variant:c.market.last10Variant,mission_value:c.missionValue,limit:c.limit,packs:c.packs}));
  for (let i = 0; i < snapshots.length; i += 50) {
    const chunk = J(snapshots.slice(i, i + 50));
    steps.push(() => drizzleDb.execute(dsql`
      INSERT INTO card_snapshots SELECT * FROM jsonb_populate_recordset(null::card_snapshots, ${chunk}::jsonb)`));
  }

  uploadRow(collectionId, "collection", collectionPath, matched.matched.length,
    { ...collection.stats, matchRate: matched.matchRate, unmatched: unmatched.length, capturedOn: date, sha256: hashes[1] });
  const crows = matched.matched.map(m => ({upload_id:collectionId,card_id:m.cardId,name:m.name,pos:m.pos,card_value:m.cardValue,is_variant:m.isVariant,is_active:m.isActive,released:m.released,match_distance:m.matchDistance,match_quality:m.matchQuality,ratings:m.ratings}));
  const ccols = dsql.raw(["upload_id","card_id","name","pos","card_value","is_variant","is_active","released","match_distance","match_quality","ratings"].join(","));
  for (let i = 0; i < crows.length; i += 50) {
    const chunk = J(crows.slice(i, i + 50));
    steps.push(() => drizzleDb.execute(dsql`
      INSERT INTO collection_cards (${ccols}) SELECT ${ccols} FROM jsonb_populate_recordset(null::collection_cards, ${chunk}::jsonb)`));
  }

  /**
   * The HTTP driver has no session, so this is sequential with a rollback by
   * hand: if any statement fails, the two upload rows are deleted and the child
   * rows go with them on the cascade.
   */
  try {
    /**
     * The device VM's egress proxy drops the connection after a few dozen rapid
     * HTTPS round trips, which surfaces as a bare "fetch failed" about forty
     * statements in. Retrying with backoff rides over it; without this the
     * import dies two thirds of the way through a refresh.
     */
    for (let i = 0; i < steps.length; i++) {
      process.stdout.write(`\r  step ${i + 1}/${steps.length}   `);
      for (let attempt = 1; ; attempt++) {
        try { await steps[i](); break; }
        catch (err) {
          const msg = String((err as any)?.cause?.message ?? (err as any)?.message ?? err);
          if (attempt >= 6 || !/fetch failed|ECONNRESET|socket hang up|ETIMEDOUT/i.test(msg)) throw err;
          await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
        }
      }
    }
    process.stdout.write("\n");
  }
  catch (e) {
    process.stdout.write("\n");
    await drizzleDb.execute(dsql`DELETE FROM uploads WHERE id IN (${shopId}, ${collectionId})`).catch(() => {});
    throw new Error(String((e as any)?.cause?.message ?? (e as any)?.message ?? e).slice(0, 400));
  }
  console.log(JSON.stringify({ committed:true, shopUploadId:shopId, collectionUploadId:collectionId, unmatched: unmatched.length }));
}

main().catch(e => { console.error(e.message); process.exitCode=1; });
