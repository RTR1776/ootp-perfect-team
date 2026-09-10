import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";

async function main() {
  const era = eraTable["1979"], pr = parkRow("Louisville Slugger Field", 2026);
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest!.id));
  const variants = new Map(owned.filter(o => o.isVariant).map(o => [o.cardId!, o.ratings]));
  const ids = [...new Set(owned.map(o => o.cardId!))];
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map(c => [c.cardId, c]));
  const pool = ids.map(id => byId.get(id)).filter(Boolean).filter(c => (c!.cardValue ?? 0) >= 90 && (c!.cardValue ?? 0) <= 100)
    .map(c => {
      const vr = variants.get(c!.cardId) ?? null;
      return { cardId: c!.cardId, isPitcher: c!.isPitcher, bats: c!.bats, name: c!.name, val: c!.cardValue, pos: c!.position, year: c!.year,
               ratings: vr ? formRatings(c!.ratings as Record<string, number>, vr) : (c!.ratings as Record<string, number>) };
    });
  const f = envFitMaps(pool, { era: era.rates, park: pr });
  const bats = pool.filter(c => !c.isPitcher).map(c => ({ ...c, r: f.runsR.get(c.cardId) ?? -99, l: f.runsL.get(c.cardId) ?? -99 }));
  console.log("TOP 15 bats vs RHP (runs/700 PA):");
  for (const c of [...bats].sort((a,b)=>b.r-a.r).slice(0,15))
    console.log(`  ${c.name.padEnd(24)} ${String(c.val).padStart(3)} ${(c.bats??"-")} ${c.pos.padEnd(3)} ${String(c.year).padEnd(5)} R ${c.r.toFixed(1).padStart(6)}  L ${c.l.toFixed(1).padStart(6)}  park:${batsLeftOn(c.bats,"R")?"L":"R"}`);
  const y = pool.find(c => c.name.includes("Yost"));
  if (y) {
    const k = ["Avoid Ks","Eye","Power","Gap","BABIP","Contact","Avoid K vR","Eye vR","Power vR","Gap vR","BABIP vR","Eye vL","Power vL"];
    console.log("\nEddie Yost ratings:", k.map(x => `${x} ${y.ratings[x]}`).join(", "));
  }
  const arms = pool.filter(c => c.isPitcher).map(c => ({ ...c, r: f.runsR.get(c.cardId) ?? -99 }));
  console.log("\nTOP 10 arms (runs prevented/700 BF):");
  for (const c of [...arms].sort((a,b)=>b.r-a.r).slice(0,10))
    console.log(`  ${c.name.padEnd(24)} ${String(c.val).padStart(3)} ${String(c.year).padEnd(5)} ${c.r.toFixed(1).padStart(6)}`);
  console.log("\nvalue distribution of eligible pool:", Object.entries(pool.reduce((a:Record<string,number>,c)=>{a[String(c.val)]=(a[String(c.val)]??0)+1;return a;},{})).sort().map(([v,n])=>`${v}:${n}`).join(" "));
}
main().then(() => process.exit(0));
