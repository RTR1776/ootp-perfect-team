import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const WL=0.3, f1=(n:number)=>`${n>=0?"+":""}${n.toFixed(1)}`;
const WANT = ["Ben Zobrist","Jackie Robinson","Aidan Miller","Rogers Hornsby","Lou Gehrig","Jim Dyck",
  "Mark Grace","Albie Pearson","Tarik Skubal","A.J. Burnett","Jim Kaat","Payton Tolle","Trey Yesavage",
  "Orel Hershiser","Ernie Banks","Al Rosen","Seth Hernandez","Matt Garza","Ricky Romero","J.A. Happ","Cy Young"];
const main = async () => {
  const [own] = rows<any>(await db.execute(sql`select id from uploads where kind='collection' order by uploaded_at desc limit 1`));
  const pool = rows<any>(await db.execute(sql`
    select cc.id row_id, c.card_id, c.name, c.card_value val, c.year, c.bats, c.is_pitcher, c.pitcher_role,
           c.position, c.ratings, cc.ratings copy, cc.is_variant
    from collection_cards cc join cards c on c.card_id=cc.card_id where cc.upload_id=${own.id} and c.card_value between 80 and 102`))
    .map(r=>({cardId:r.row_id, realId:r.card_id, name:r.name, val:r.val, year:r.year, bats:r.bats??"R",
      isPitcher:r.is_pitcher, role:r.is_pitcher?r.pitcher_role:r.position, variant:r.is_variant,
      ss:Number(r.ratings?.["Pos Rating SS"]??0), stm:Number(r.ratings?.["Stamina"]??0),
      ratings: mergeCopyRatings(r.ratings, r.copy) as Record<string,number>}));
  const fit = envFitMaps(pool as any, { era: eraTable["2010"]!.rates, park: parkRow("Standard Stadium", 2025) });
  const v=(c:any)=>(1-WL)*(fit.runsR.get(c.cardId)??0)+WL*(fit.runsL.get(c.cardId)??0);
  const obs = new Map(rows<any>(await db.execute(sql`select card_id,woba,fip,pa,ip from observed_card_stats where series='goldfloorcapweekly'`)).map(r=>[Number(r.card_id),r]));
  console.log("   val  yr  name                     model   per-pt   observed here");
  for (const n of WANT) {
    const g = pool.filter(c=>c.name===n).sort((a,b)=>v(b)-v(a));
    for (const c of g.slice(0,1)) {
      const o=obs.get(c.realId);
      const rec=o?(c.isPitcher?`FIP ${Number(o.fip).toFixed(2)} / ${Math.round(o.ip)} IP`:`wOBA ${Number(o.woba).toFixed(3)} / ${o.pa} PA`):"no record here";
      console.log(`  ${String(c.val).padStart(4)} ${String(c.year).padStart(4)}  ${c.name.slice(0,22).padEnd(23)}${c.variant?"✦":" "} ${f1(v(c)).padStart(6)} ${(v(c)/Math.max(c.val-79,1)).toFixed(2).padStart(7)}   ${rec}${c.ss>0?`   SS ${Math.round(c.ss)}`:""}${c.isPitcher?`  STM ${Math.round(c.stm)}`:""}`);
    }
  }
  process.exit(0);
};
main();
