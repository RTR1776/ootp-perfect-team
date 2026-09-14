import { sql } from "drizzle-orm";
import { db } from "@/db/client";
const asRows = <T,>(r:any):T[] => Array.isArray(r)?r:(r.rows??[]);
async function main(){
  for (const nm of ["De Vries","Manush"]) {
    const r = asRows<any>(await db.execute(sql`
      select card_id, name, card_value, year, position, bats, throws, tier,
             ratings->>'Avoid Ks' k, ratings->>'BABIP' babip, ratings->>'Power' pow,
             ratings->>'Gap' gap, ratings->>'Eye' eye,
             ratings->>'Pos Rating 2B' p2b, ratings->>'Pos Rating SS' pss, ratings->>'Pos Rating LF' plf,
             ratings->>'Pos Rating CF' pcf, ratings->>'Pos Rating 3B' p3b
      from cards where name ilike ${'%'+nm+'%'} order by card_value desc limit 4`));
    console.log(`\n--- ${nm} ---`);
    for(const x of r) console.log(`  ${x.card_id} ${x.name} VAL ${x.card_value} ${x.year} ${x.position} bats ${x.bats} ${x.tier} | K ${x.k} BABIP ${x.babip} POW ${x.pow} GAP ${x.gap} EYE ${x.eye} | 2B ${x.p2b} SS ${x.pss} 3B ${x.p3b} LF ${x.plf} CF ${x.pcf}`);
    if(!r.length) console.log("  NOT IN cards TABLE");
  }
  process.exit(0);
}
main();
