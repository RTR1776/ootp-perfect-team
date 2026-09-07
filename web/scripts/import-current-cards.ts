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
 * Uses node-postgres directly (not the Neon HTTP driver) because this needs a
 * real transaction.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { parseShopList } from "../src/lib/ingest/pt-card-list";
import { parseCollection, matchCollectionToShop } from "../src/lib/ingest/collection";

async function main() {
  const [shopPath, collectionPath, date] = process.argv.slice(2);
  if (!shopPath || !collectionPath || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Supply shop file, collection file, and capture date.");
  const shopText = readFileSync(shopPath, "utf8"), collectionText = readFileSync(collectionPath, "utf8");
  const shop = parseShopList(shopText), collection = parseCollection(collectionText);
  if (!shop.stats.tierBandsValid || shop.skipped.length || !shop.cards.length) throw new Error("Shop validation failed; nothing written.");
  const matched = matchCollectionToShop(collection.cards, shop.cards);
  if (matched.matchRate !== 1) throw new Error("Unmatched collection rows; resolve before publishing.");
  const hashes = [shopText, collectionText].map(t => createHash("sha256").update(t).digest("hex"));
  console.log(JSON.stringify({ shop: shop.stats, collection: collection.stats, matchRate: matched.matchRate, capturedOn: date }, null, 2));
  if (!process.argv.includes("--commit")) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(270906)");
    const seen = await client.query("SELECT kind FROM uploads WHERE report->>'sha256' = ANY($1::text[])", [hashes]);
    if (seen.rows.some(r => r.kind === "shop_list") && seen.rows.some(r => r.kind === "collection")) {
      await client.query("ROLLBACK"); console.log("Both files already imported; nothing changed."); return;
    }
    const capture = `${date}T12:00:00Z`;
    const upload = async (kind: string, filename: string, count: number, report: object) => (await client.query(
      "INSERT INTO uploads(kind,filename,row_count,uploaded_at,report) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [kind, filename.split("/").pop(), count, capture, JSON.stringify(report)],
    )).rows[0].id as number;
    const shopId = await upload("shop_list", shopPath, shop.cards.length, { ...shop.stats, capturedOn: date, sha256: hashes[0] });
    const fields = ["card_id","title","name","first_name","last_name","nick_name","tier","card_value","position","pitcher_role","is_pitcher","bats","throws","year","era_code","era_label","team","franchise","series","badge","card_type","card_sub_type","bref_id","released_on","ratings"];
    const cardRows = shop.cards.map(c => {
      const row = [c.cardId,c.title,c.name,c.firstName,c.lastName,c.nickName,c.tier,c.cardValue,c.position,c.pitcherRole,c.isPitcher,c.bats,c.throws,c.year,c.eraCode,c.eraLabel,c.team,c.franchise,c.series,c.badge,c.cardType,c.cardSubType,c.brefId,c.date,c.ratings];
      return Object.fromEntries(fields.map((f,i) => [f,row[i]]));
    });
    for (let i=0; i<cardRows.length; i+=250) {
      await client.query(`INSERT INTO cards (${fields.join(",")}) SELECT ${fields.join(",")} FROM jsonb_populate_recordset(null::cards,$1::jsonb) ON CONFLICT(card_id) DO UPDATE SET ${fields.slice(1).map(f=>`${f}=EXCLUDED.${f}`).join(",")},last_seen_at=now()`, [JSON.stringify(cardRows.slice(i,i+250))]);
    }
    const snapshots = shop.cards.map(c => ({upload_id:shopId,card_id:c.cardId,captured_at:capture,owned:c.owned,buy_order_high:c.market.buyOrderHigh,sell_order_low:c.market.sellOrderLow,last10:c.market.last10,last10_variant:c.market.last10Variant,mission_value:c.missionValue,limit:c.limit,packs:c.packs}));
    await client.query('INSERT INTO card_snapshots SELECT * FROM jsonb_populate_recordset(null::card_snapshots,$1::jsonb)',[JSON.stringify(snapshots)]);
    const collectionId = await upload("collection", collectionPath, matched.matched.length, { ...collection.stats, matchRate: matched.matchRate, capturedOn: date, sha256: hashes[1] });
    const rows = matched.matched.map(m => ({upload_id:collectionId,card_id:m.cardId,name:m.name,pos:m.pos,card_value:m.cardValue,is_variant:m.isVariant,is_active:m.isActive,released:m.released,match_distance:m.matchDistance,match_quality:m.matchQuality,ratings:m.ratings}));
    const cols = ["upload_id","card_id","name","pos","card_value","is_variant","is_active","released","match_distance","match_quality","ratings"];
    await client.query(`INSERT INTO collection_cards (${cols.join(",")}) SELECT ${cols.join(",")} FROM jsonb_populate_recordset(null::collection_cards,$1::jsonb)`,[JSON.stringify(rows)]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ committed:true, shopUploadId:shopId,collectionUploadId:collectionId }));
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); await pool.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode=1; });
