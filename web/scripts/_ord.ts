import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mergeCopyRatings } from "@/lib/ingest/collection";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const NINE: [string, number][] = [
  ["Matt Carpenter",74],["Danny Tartabull",87],["J.T. Snow",83],["Bip Roberts",86],
  ["Curtis Granderson",87],["Hanley Ramirez",82],["Brandon Lowe",82],["Charles Johnson",84],
  ["Vladimir Guerrero",48],["Dwayne Hosey",49],["Tom Herr",58],["Dexter Fowler",53],
  ["Grady Sizemore",53],["Javier Baez",49],["Jonathan Lucroy",48],
];
const main = async () => {
  const [own] = rows<any>(await db.execute(sql`select id from uploads where kind='collection' order by uploaded_at desc limit 1`));
  const all = rows<any>(await db.execute(sql`
    select c.name, c.card_value val, c.bats, c.ratings, cc.ratings copy, cc.is_variant
    from collection_cards cc join cards c on c.card_id=cc.card_id
    where cc.upload_id=${own.id} and c.year between 1980 and 2025 and c.card_value between 40 and 89`));
  const p = (n:string,v:number) => {
    const hits = all.filter(x=>x.name===n && x.val===v).sort((a,b)=>(b.is_variant?1:0)-(a.is_variant?1:0));
    if (!hits.length) return null;
    const r = mergeCopyRatings(hits[0].ratings, hits[0].copy) as Record<string,number>;
    return { bats: hits[0].bats, r };
  };
  const g = (r:any,k:string)=>Math.round(Number(r[k] ?? 0));
  console.log("name                  B  |   C   1B   2B   3B   SS   LF   CF   RF |  IFrng IFerr IFarm  OFrng OFerr OFarm | SPE");
  for (const [n,v] of NINE) {
    const x = p(n,v); if (!x) { console.log(`${n} — not found`); continue; }
    const r = x.r;
    const P = (k:string)=>{ const n2=g(r,`Pos Rating ${k}`); return (n2>0?String(n2):"  -").padStart(4); };
    console.log(`${(n+" "+v).padEnd(22)}${x.bats}  |${P("C")} ${P("1B")} ${P("2B")} ${P("3B")} ${P("SS")} ${P("LF")} ${P("CF")} ${P("RF")} | ` +
      `${String(g(r,"Infield Range")).padStart(5)} ${String(g(r,"Infield Error")).padStart(5)} ${String(g(r,"Infield Arm")).padStart(5)}  ` +
      `${String(g(r,"OF Range")).padStart(5)} ${String(g(r,"OF Error")).padStart(5)} ${String(g(r,"OF Arm")).padStart(5)} | ${String(g(r,"Speed")).padStart(3)}`);
  }
  process.exit(0);
};
main();
