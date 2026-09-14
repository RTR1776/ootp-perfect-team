import { sql } from "drizzle-orm";
import { db } from "@/db/client";
const asRows = <T,>(r:any):T[] => Array.isArray(r)?r:(r.rows??[]);
async function main(){
  const t = asRows<any>(await db.execute(sql`select table_name from information_schema.tables where table_schema='public' and (table_name like '%result%' or table_name like '%period%' or table_name like '%standing%')`));
  console.log("tables:", t.map(x=>x.table_name).join(", "));
  process.exit(0);
}
main();
