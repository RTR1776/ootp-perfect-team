import { sql } from "drizzle-orm";
import { db } from "@/db/client";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const main = async () => {
  console.log("=== catalogue rows matching gold floor / cap weekly ===");
  console.log(JSON.stringify(rows(await db.execute(sql`
    select id,name,env_year,mode,stadium,park_name,dh,entrants,ratings_min,ratings_max,
           card_year_min,card_year_max,series,retired,restrictions
    from tournaments where name ilike '%gold floor%' or series ilike '%goldfloor%'`)), null, 1));
  console.log("\n=== observed stats for that series ===");
  console.table(rows(await db.execute(sql`
    select series, is_pitcher, count(*) cards, sum(pa)::int pa, round(sum(ip)::numeric,0) ip, max(instances) runs
    from observed_card_stats where series ilike '%goldfloor%' group by 1,2`)));
  process.exit(0);
};
main();
