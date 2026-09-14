import { sql } from "drizzle-orm";
import { db } from "@/db/client";
const asRows = <T,>(r:any):T[] => Array.isArray(r)?r:(r.rows??[]);
async function main(){
  const n = asRows<any>(await db.execute(sql`select period, category, count(*) n, max(rank) maxrank, max(captured_on) d from standings group by 1,2 order by 1,2`));
  if(!n.length) console.log("standings is EMPTY");
  for(const x of n) console.log(`  period ${x.period} ${String(x.category).padEnd(10)} ${x.n} rows, max rank ${x.maxrank}, ${String(x.d).slice(0,10)}`);
  process.exit(0);
}
main();
