import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const WL = 0.3, f1 = (n:number)=>`${n>=0?"+":""}${n.toFixed(1)}`;
const main = async () => {
  const [own] = rows<any>(await db.execute(sql`select id from uploads where kind='collection' order by uploaded_at desc limit 1`));
  const pool = rows<any>(await db.execute(sql`
    select cc.id row_id, c.name, c.card_value val, c.year, c.bats, c.is_pitcher, c.pitcher_role, c.position,
           c.ratings, cc.ratings copy, cc.is_variant
    from collection_cards cc join cards c on c.card_id=cc.card_id
    where cc.upload_id=${own.id} and c.card_value between 40 and 89 and c.year between 1980 and 2025`))
    .map(r => ({ cardId: r.row_id, name: r.name, val: r.val, year: r.year, bats: r.bats ?? "R",
      isPitcher: r.is_pitcher, role: r.is_pitcher ? r.pitcher_role : r.position, variant: r.is_variant,
      stm: Number(r.ratings?.["Stamina"] ?? 0),
      posC: Number(r.ratings?.["Pos Rating C"] ?? 0),
      ratings: mergeCopyRatings(r.ratings, r.copy) as Record<string, number> }));
  const fit = envFitMaps(pool as any, { era: eraTable["1945"]!.rates, park: parkRow("Tropicana Field", 2026) });
  const v = (c:any) => (1-WL)*(fit.runsR.get(c.cardId) ?? 0) + WL*(fit.runsL.get(c.cardId) ?? 0);
  const HIGH = pool.filter(c => c.val >= 60).sort((a,b)=>v(b)-v(a));
  const IRON = pool.filter(c => c.val < 60 && c.isPitcher).sort((a,b)=>v(b)-v(a));
  console.log("=== best IRON arms you own (the 13 free slots) ===");
  for (const c of IRON.slice(0,10))
    console.log(`  ${String(c.val).padStart(3)} ${String(c.year).padStart(4)}  ${c.name.padEnd(22)}${c.variant?"✦":" "} ${f1(v(c)).padStart(7)}  STM ${String(Math.round(c.stm)).padStart(3)}${c.stm>=60?"  can start":""}`);
  const IB = pool.filter(c => c.val < 60 && !c.isPitcher).sort((a,b)=>v(b)-v(a));
  console.log("\n=== best IRON bats you own ===");
  for (const c of IB.slice(0,8))
    console.log(`  ${String(c.val).padStart(3)} ${String(c.year).padStart(4)}  ${c.name.padEnd(22)}${c.variant?"✦":" "} ${f1(v(c)).padStart(7)}${c.posC>=50?`  C ${Math.round(c.posC)}`:""}`);
  console.log("");
  console.log("=== every card VAL 60-89 you own that fits this event, best 22 ===");
  console.log("   val  yr  name                        runs  role");
  for (const c of HIGH.slice(0,22))
    console.log(`  ${String(c.val).padStart(4)} ${String(c.year).padStart(4)}  ${c.name.padEnd(24)}${c.variant?"✦":" "} ${f1(v(c)).padStart(7)}  ${c.isPitcher ? `arm STM ${Math.round(c.stm)}` : (c.posC>=60?`bat C ${Math.round(c.posC)}`:"bat")}`);
  console.log("\n=== the cards on his roster that the model would cut ===");
  for (const n of ["Bobby Witt Jr.","Ben Zobrist","Charles Johnson","Ricky Romero","Jordan Montgomery","Brandon Lowe","Hanley Ramirez"]) {
    const c = HIGH.find(x=>x.name===n); if (!c) continue;
    const rank = HIGH.indexOf(c)+1;
    console.log(`  ${n.padEnd(20)} ${f1(v(c)).padStart(7)}   rank ${rank} of ${HIGH.length} eligible high-slot cards`);
  }
  process.exit(0);
};
main();
