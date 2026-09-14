import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pointsFor } from "@/lib/analytics/dumps";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
/** Read off the Your Tournaments screen for Sun 13 Sep. Points are COMPUTED
 *  from placement + field size by the app's own table, never typed by hand. */
const NEW: { id: string; name: string; cats: string[]; field: number; place: string; lo: number }[] = [
  { id:"1270184", name:"Daily Silver Slots",             cats:["Silver","Cap"],  field:64,  place:"33rd-64th",  lo:33 },
  { id:"1910110", name:"Daily High Silver-Low Gold Cap", cats:["Gold","Cap"],    field:64,  place:"33rd-64th",  lo:33 },
  { id:"1800184", name:"Daily Diamond Jumble Slots",     cats:["Diamond","Cap"], field:64,  place:"9th-16th",   lo:9 },
  { id:"1620026", name:"Sunday Open Main Event",         cats:["Open"],          field:256, place:"65th-128th", lo:65 },
  { id:"2470026", name:"Sunday PD Main Event",           cats:["PD Weekly"],     field:256, place:"17th-32nd",  lo:17 },
  { id:"2120183", name:"Daily All-Gold",                 cats:["PD Daily"],      field:64,  place:"17th-32nd",  lo:17 },
  { id:"1610026", name:"Sunday Open Slots",              cats:["Open","Cap"],    field:128, place:"17th-32nd",  lo:17 },
];
const main = async () => {
  const have = new Set(rows<any>(await db.execute(sql`select event_id::text id from results where period_id=2`)).map(r=>r.id));
  let added = 0;
  for (const e of NEW) {
    if (have.has(e.id)) { console.log(`  skip ${e.id} ${e.name} — already logged`); continue; }
    const pts = pointsFor(e.lo, e.field);
    await db.execute(sql`
      insert into results (period_id, event_id, occurred_on, name, categories, field_size, placement, eliminated, points, note)
      values (2, ${Number(e.id)}, '2026-09-13', ${e.name}, ${JSON.stringify(e.cats)}::jsonb, ${e.field}, ${e.place}, true, ${pts},
              'logged from Your Tournaments screenshot, 14 Sep')`);
    console.log(`  + ${e.id} ${e.name.padEnd(32)} ${e.place.padEnd(11)} field ${String(e.field).padStart(3)} → ${pts} pts  [${e.cats.join(", ")}]`);
    added++;
  }
  console.log(`\n${added} added, ${NEW.length - added} skipped as duplicates`);
  process.exit(0);
};
main();
