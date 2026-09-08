/** Compare all known past and present non-draft formats, regardless of data coverage.
 * September 4 snapshot preserves pre-refresh RE/park settings lost on catalog updates.
 * Run from web: pnpm exec tsx scripts/ptcs6-all-format-matches.ts
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {eraFor,parkFor,solveFor,vectorOf,spreads,distance,OFFENSE_KEYS} from '../src/lib/analytics/tournament-env';

type Format={id:number;name:string;year:number;stadium:string|null;dh:boolean|null;series:string|null;status:string;runs:number;valMin:number|null;valMax:number|null;yrMin:number|null;yrMax:number|null;source:string};
const root='../Docs/ptcs6-audit-2026-09-07/';
const audit=JSON.parse(readFileSync(root+'evidence.json','utf8'));
const prior=JSON.parse(readFileSync('scripts/.champ-comparables.json','utf8'));
const inv=JSON.parse(readFileSync('scripts/.inventory.json','utf8'));
const draftNames=new Set(inv.drafts.map((r:{name:string})=>r.name));
const draftSeries=new Set(inv.drafts.map((r:{series:string})=>r.series).filter(Boolean));
const formats=new Map<string,Format>();
const key=(f:Format)=>`${f.name}|${f.year}|${f.stadium}|${f.dh}`;
const add=(f:Format)=>{if(!draftNames.has(f.name)&&!(f.series&&draftSeries.has(f.series))&&!/^EF\b/.test(f.name))formats.set(key(f),f)};
for(const c of audit.builds[0].matches){
  add({id:c.id,name:c.name,year:c.env.year,stadium:c.coverage?.stadium??c.env.park.label,dh:c.dh,series:c.series,status:'Current catalog',runs:c.coverage?.currentFiles??0,valMin:c.ratingsMin,valMax:c.ratingsMax,yrMin:c.yearMin,yrMax:c.yearMax,source:'September 7 catalog / archive coverage'});
}
for(const c of prior[0].matches){
  const f:Format={id:c.id,name:c.name,year:c.envYear,stadium:c.stadium,dh:c.dh,series:c.series,status:'Past format',runs:c.runs??0,valMin:c.valMin,valMax:c.valMax,yrMin:c.yrMin,yrMax:c.yrMax,source:'September 4 pre-refresh snapshot'};
  if(!formats.has(key(f)))add(f);
}
const resolved=[...formats.values()].flatMap(f=>{
  const era=eraFor(f.year),park=parkFor(f.stadium);
  if(!era||(!park.row&&!/Standard Stadium/i.test(f.stadium??'')))return [];
  return [{...f,era:era.label,park,vector:vectorOf(solveFor(era.row,park.row))}];
});
const sd=spreads(resolved.map(f=>f.vector),OFFENSE_KEYS);
const builds=audit.builds.map((b:{category:string;tournament:{envYear:number;stadium:string;dh:boolean}})=>{
  const t=b.tournament,era=eraFor(t.envYear)!,park=parkFor(t.stadium);
  const v=vectorOf(solveFor(era.row,park.row));
  const rankings=resolved.map(f=>({...f,gap:distance(v,f.vector,OFFENSE_KEYS,sd),sameDh:t.dh===f.dh,sameEra:t.envYear===f.year,samePark:t.stadium===f.stadium})).sort((a,b)=>a.gap-b.gap);
  return {category:b.category,target:t,rankings};
});
writeFileSync(root+'all-format-matches.json',JSON.stringify({method:'All known non-draft formats, past and present; no card-data availability filter. Offense-shape distance, not roster compatibility. Explicitly exclude draft names/series and unknown parks.',candidateCount:resolved.length,sd,builds},null,2));
for(const b of builds){console.log('\n'+b.category);for(const r of b.rankings.slice(0,6))console.log(`${r.gap.toFixed(2)} | ${r.name} | ${r.status} | ${r.year} | ${r.stadium} | DH ${r.dh} | ${r.runs} exports`)}
