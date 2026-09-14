import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps, batsLeftOn } from "@/lib/analytics/env-fit";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { HIT_POS } from "@/lib/roster-fill";
const rows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const f1 = (n:number)=>`${n>=0?"+":""}${n.toFixed(1)}`;
const ROSTER: [string, number][] = [
  // bats
  ["Danny Tartabull",87],["Curtis Granderson",87],["Bip Roberts",86],["Charles Johnson",84],
  ["J.T. Snow",83],["Hanley Ramirez",82],["Brandon Lowe",82],["Matt Carpenter",74],
  ["Tom Herr",58],["Dexter Fowler",53],["Grady Sizemore",53],["Dwayne Hosey",49],
  ["Javier Baez",49],["Jonathan Lucroy",48],["Vladimir Guerrero",48],
  // arms
  ["Kevin Millwood",89],["Dave Stieb",89],["Ricky Romero",82],["Julio Teheran",79],
  ["Alex Claudio",70],["Dallas Braden",57],["Salomon Torres",56],["Alex Reyes",53],
  ["Craig Lefferts",52],["Al Holland",47],
];
const main = async () => {
  const [own] = rows<any>(await db.execute(sql`select id from uploads where kind='collection' order by uploaded_at desc limit 1`));
  const all = rows<any>(await db.execute(sql`
    select cc.id row_id, c.name, c.card_value val, c.year, c.bats, c.throws, c.is_pitcher, c.pitcher_role,
           c.position, c.ratings, cc.ratings copy, cc.is_variant
    from collection_cards cc join cards c on c.card_id=cc.card_id
    where cc.upload_id=${own.id} and c.year between 1980 and 2025 and c.card_value between 40 and 89`))
    .map(r => ({ cardId: r.row_id, name: r.name, val: r.val, year: r.year, bats: r.bats ?? "R",
      throws: r.throws, isPitcher: r.is_pitcher, role: r.is_pitcher ? r.pitcher_role : r.position,
      variant: r.is_variant, ratings: mergeCopyRatings(r.ratings, r.copy) as Record<string, number> }));
  const pool: any[] = [];
  for (const [n, v] of ROSTER) {
    const hit = all.filter(c => c.name === n && c.val === v);
    if (!hit.length) { console.log(`!! ${n} ${v} not found`); continue; }
    pool.push(hit.sort((a,b)=>(b.variant?1:0)-(a.variant?1:0))[0]);
  }
  const fit = envFitMaps(pool as any, { era: eraTable["1945"]!.rates, park: parkRow("Tropicana Field", 2026) });
  const posOf = (c:any,p:string)=> c.ratings[`Pos Rating ${p}`] ?? 0;
  const bestPos = (c:any)=> Math.max(...HIT_POS.map(p=>posOf(c,p)));
  const DEF: Record<string,number> = { C:8, SS:8, CF:7, "2B":6, "3B":5, RF:3, LF:3, "1B":2, DH:0 };
  const bats = pool.filter(c=>!c.isPitcher), arms = pool.filter(c=>c.isPitcher);

  for (const board of ["R","L"] as const) {
    const runs = (c:any)=> (board==="R"?fit.runsR:fit.runsL).get(c.cardId) ?? -1e6;
    const canPlay = (c:any,p:string)=> p==="DH" || (posOf(c,p)>0 && posOf(c,p) >= 0.6*bestPos(c));
    const at = (c:any,p:string)=> canPlay(c,p) ? runs(c) + (p==="DH"?0:(DEF[p]??3)*((posOf(c,p)-80)/40)) : -1e6;
    const slots = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
    const lineup: Record<string,any> = {}; const taken = new Set<number>();
    for (const p of [...slots].sort((a,b)=>bats.filter(c=>canPlay(c,a)).length - bats.filter(c=>canPlay(c,b)).length)) {
      const c = bats.filter(x=>!taken.has(x.cardId)&&canPlay(x,p)).sort((x,y)=>at(y,p)-at(x,p))[0];
      if (c) { lineup[p]=c; taken.add(c.cardId); }
    }
    for (let k=0;k<30;k++){ let moved=false;
      for (const p of slots){ const cur=lineup[p]; const base=cur?at(cur,p):-1e6;
        const b=bats.filter(c=>!taken.has(c.cardId)&&at(c,p)>base).sort((x,y)=>at(y,p)-at(x,p))[0];
        if (b){ if(cur) taken.delete(cur.cardId); lineup[p]=b; taken.add(b.cardId); moved=true; } }
      for (const a of slots) for (const b of slots){ if(a===b||!lineup[a]||!lineup[b])continue;
        if (at(lineup[b],a)+at(lineup[a],b) > at(lineup[a],a)+at(lineup[b],b)+1e-9){ const t=lineup[a]; lineup[a]=lineup[b]; lineup[b]=t; moved=true; } }
      if(!moved) break; }
    console.log(`\n=== LINEUP vs ${board==="R"?"RHP":"LHP"} ===`);
    slots.filter(p=>lineup[p]).sort((a,b)=>runs(lineup[b])-runs(lineup[a])).forEach((p,i)=>{
      const c=lineup[p]; const side = batsLeftOn(c.bats,board)?"bats L":"bats R";
      console.log(`  ${i+1}. ${p.padEnd(3)} ${(c.name+(c.variant?" ✦":"")).padEnd(22)} ${String(c.val).padStart(3)} ${c.bats}  ${f1(runs(c)).padStart(7)}  ${side}${p==="DH"?"":`  DEF ${Math.round(posOf(c,p))}`}`);
    });
    console.log(`  bench: ${bats.filter(c=>!taken.has(c.cardId)).sort((a,b)=>runs(b)-runs(a)).map(c=>`${c.name} ${f1(runs(c))}`).join(" · ")}`);
  }
  console.log(`\n=== STAFF ===`);
  const sp = ["Kevin Millwood","Dave Stieb","Ricky Romero","Julio Teheran"];
  console.log("  rotation:");
  sp.forEach((n,i)=>{ const c=arms.find(x=>x.name===n)!; console.log(`   SP${i+1}  ${(c.name+(c.variant?" ✦":"")).padEnd(20)} ${String(c.val).padStart(3)} ${c.throws}  STM ${Math.round(c.ratings["Stamina"]??0)}  vsRHB ${f1(fit.runsR.get(c.cardId)??0)}  vsLHB ${f1(fit.runsL.get(c.cardId)??0)}`); });
  console.log("  bullpen (best first):");
  arms.filter(c=>!sp.includes(c.name)).sort((a,b)=>(fit.runsR.get(b.cardId)??0)-(fit.runsR.get(a.cardId)??0))
    .forEach(c=>console.log(`   RP   ${(c.name+(c.variant?" ✦":"")).padEnd(20)} ${String(c.val).padStart(3)} ${c.throws}  STM ${String(Math.round(c.ratings["Stamina"]??0)).padStart(3)}  vsRHB ${f1(fit.runsR.get(c.cardId)??0)}  vsLHB ${f1(fit.runsL.get(c.cardId)??0)}`));
  process.exit(0);
};
main();
