/** Read-only audit of saved PTCS6 rosters and available comparison evidence.
 * node --env-file=.env.local --import tsx scripts/audit-ptcs6.ts
 * Run pnpm coverage first. No roster or catalog writes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../src/db/client';
import { cards, collectionCards, uploads, tournaments, rosters, rosterSlots, observedCardStats, parks } from '../src/db/schema';
import { desc, eq } from 'drizzle-orm';
import { cardEligibility, validateRoster, type RosterCard, type RosterRules } from '../src/lib/roster-rules';
import { formRatings } from '../src/lib/card-forms';
import { eraFor, parkFor, solveFor, vectorOf, spreads, distance, OFFENSE_KEYS } from '../src/lib/analytics/tournament-env';

const queryLog: {sql:string;params:unknown[]}[]=[];
async function read<T>(query: PromiseLike<T> & {toSQL():{sql:string;params:unknown[]}}):Promise<T> {
  queryLog.push(query.toSQL()); return await query;
}
async function main() {
  const dest = resolve('../Docs/ptcs6-audit-2026-09-07'); mkdirSync(dest,{recursive:true});
  const all = await read(db.select().from(tournaments));
  const universe = await read(db.select().from(cards));
  const byCard = new Map(universe.map(c=>[c.cardId,c]));
  const [latest] = await read(db.select().from(uploads).where(eq(uploads.kind,'collection')).orderBy(desc(uploads.id)).limit(1));
  const owned = await read(db.select().from(collectionCards).where(eq(collectionCards.uploadId,latest.id)));
  const obs = await read(db.select({series:observedCardStats.series,cardId:observedCardStats.cardId,isPitcher:observedCardStats.isPitcher,pa:observedCardStats.pa,ip:observedCardStats.ip,instances:observedCardStats.instances}).from(observedCardStats));
  const parkRows = await read(db.select().from(parks));
  const coverage = JSON.parse(readFileSync('scripts/.coverage.json','utf8')).rows;
  const inventory = JSON.parse(readFileSync('scripts/.inventory.json','utf8')).tourneys;
  const seed = JSON.parse(readFileSync('src/db/seed/ptcs6-championship.json','utf8'));
  const envOf = (t:typeof all[number]) => {
    const rx = t.restrictions as { notes?:string[] } | null;
    const year = t.envYear ?? (rx?.notes?.includes('default RE') ? 2010 : null);
    const era = eraFor(year); const park = parkFor(t.stadium);
    if (!era) return null;
    const v = vectorOf(solveFor(era.row,park.row));
    return {year,era:era.label,park,v,knownPark:!!park.row || /Standard Stadium/i.test(t.stadium??'')};
  };
  const activeIds = new Set(coverage.map((r:{id:number})=>r.id));
  const candidates = all.filter(t=>activeIds.has(t.id)&&!t.isDraft&&!t.retired&&t.series!==seed.series && !/^EF\b/.test(t.name));
  const sd = spreads(candidates.flatMap(t=>{const e=envOf(t); return e?.knownPark?[e.v]:[];}),OFFENSE_KEYS);
  const out=[];
  for (const category of ['Bronze','Silver','Gold','Diamond','Cap']) {
    const t=all.find(t=>t.series===seed.series&&(t.restrictions as {category?:string})?.category===category)!;
    const rules=t as RosterRules;
    const env=envOf(t)!;
    const saved=await read(db.select().from(rosters).where(eq(rosters.tournamentId,t.id)));
    const checks: {
      id:number; name:string; validation:ReturnType<typeof validateRoster>;
      staff:{slot:string;card:string|undefined}[];
      cards:{id:number;name:string;value:number|null;year:number|null;variant:boolean|undefined}[];
    }[]=[];
    for (const roster of saved) {
      const slots=await read(db.select().from(rosterSlots).where(eq(rosterSlots.rosterId,roster.id)));
      const chosen=new Map(slots.map(s=>[s.cardId,s.useVariant]));
      const rosterCards:RosterCard[]=[...chosen].flatMap(([id,variant])=>{
        const c=byCard.get(id); if(!c)return [];
        const own=owned.filter(o=>o.cardId===id); const vr=own.find(o=>o.isVariant)?.ratings;
        return [{cardId:id,name:c.name,val:c.cardValue,year:c.year,isPitcher:c.isPitcher,role:c.pitcherRole,cardType:c.cardType,
          ratings:variant&&vr?formRatings(c.ratings??{},vr):c.ratings??{},baseOwned:own.some(o=>!o.isVariant),variantOwned:own.some(o=>o.isVariant)}];
      });
      const validation=validateRoster(slots,rosterCards,rules);
      checks.push({id:roster.id,name:roster.name,validation,
        staff:slots.filter(s=>s.slot==='CL'||/^(SP|RP)/.test(s.slot)).map(s=>({slot:s.slot,card:byCard.get(s.cardId)?.name})),
        cards:rosterCards.map(c=>({id:c.cardId,name:c.name,value:c.val,year:c.year,variant:chosen.get(c.cardId)}))});
    }
    const eligible=new Set(universe.filter(c=>{const r=cardEligibility({cardId:c.cardId,name:c.name,val:c.cardValue,year:c.year,isPitcher:c.isPitcher,role:c.pitcherRole,cardType:c.cardType,ratings:c.ratings??{},baseOwned:true,variantOwned:true},rules);return !r.errors.length&&!r.incomplete.length}).map(c=>c.cardId));
    const ids=new Set(checks.flatMap(r=>r.cards.map(c=>c.id)));
    const comparison = (c:typeof all[number], historical=false) => {
      const e=envOf(c);if(!e)return [];
      const cov=coverage.find((r:{id:number})=>r.id===c.id);
      const inv=inventory.find((r:{series:string})=>r.series===c.series);
      const rows=obs.filter(o=>o.series===c.series), legal=rows.filter(o=>eligible.has(o.cardId));
      const rosterData=legal.filter(o=>ids.has(o.cardId));
      const individuallyLegal=checks[0]?.cards.filter(card=>{
        const cc=byCard.get(card.id)!;
        const v=cardEligibility({cardId:cc.cardId,name:cc.name,val:cc.cardValue,year:cc.year,isPitcher:cc.isPitcher,role:cc.pitcherRole,cardType:cc.cardType,ratings:cc.ratings??{},baseOwned:true,variantOwned:true},c as RosterRules);
        return !v.errors.length&&!v.incomplete.length;
      }).length??0;
      return [{id:c.id,name:c.name,series:c.series,env:e,dh:c.dh,retired:c.retired,historical,archivedFiles:inv?.filesOnDisk??0,ratingsMin:c.ratingsMin,ratingsMax:c.ratingsMax,yearMin:c.cardYearMin,yearMax:c.cardYearMax,restrictions:c.restrictions,
        individuallyLegal,
        rosterData:rosterData.map(o=>({...o,name:byCard.get(o.cardId)?.name})),
        distance:distance(env.v,e.v,OFFENSE_KEYS,sd),sameDh:t.dh===c.dh,sameEra:env.year===e.year,samePark:t.stadium===c.stadium,
        coverage:cov??null,storedRows:rows.length,eligibleRows:legal.length,eligiblePa:legal.filter(o=>!o.isPitcher).reduce((n,o)=>n+o.pa,0),eligibleIp:legal.filter(o=>o.isPitcher).reduce((n,o)=>n+o.ip,0),
        rosterCardsWithData:rosterData.length,rosterHitters500:rosterData.filter(o=>!o.isPitcher&&o.pa>=500).length,rosterPitchers400:rosterData.filter(o=>o.isPitcher&&o.ip>=400).length}];
    };
    const matches=candidates.flatMap(c=>comparison(c)).sort((a,b)=>a.distance-b.distance);
    // Retired series retain historical park/RE metadata; never label these as current events.
    const historical=all.filter(c=>c.retired&&!c.isDraft&&inventory.some((r:{series:string,isDraft:boolean})=>r.series===c.series&&!r.isDraft))
      .flatMap(c=>comparison(c,true)).filter(m=>m.env.knownPark&&m.archivedFiles>0&&m.eligibleRows>0)
      .sort((a,b)=>a.distance-b.distance);
    const direct=obs.filter(o=>o.series===t.series);
    const oldPark=parkRows.find(p=>p.name===t.parkName);
    out.push({category,tournament:t,announcement:seed.events.find((e:{category:string})=>e.category===category),env,oldBuilderPark:oldPark??null,rosters:checks,eligibleCards:eligible.size,directRows:direct.length,
      matches,historicalDonors:historical.slice(0,8),topKnown:matches.filter(m=>m.env.knownPark).slice(0,8),topGold:matches.filter(m=>m.env.knownPark&&/Gold/.test(m.name)).slice(0,5),
      dataDonors:matches.filter(m=>m.env.knownPark&&m.coverage?.currentFiles>0&&m.eligibleRows>0).slice(0,8)});
  }
  writeFileSync(resolve(dest,'evidence.json'),JSON.stringify({capturedAt:new Date().toISOString(),collectionUpload:latest.id,queries:queryLog,sd,builds:out},null,2));
  for(const b of out){console.log(JSON.stringify({category:b.category,env:b.env,rosters:b.rosters.map(r=>({id:r.id,...r.validation})),direct:b.directRows,oldPark:b.oldBuilderPark,
    top:b.topKnown.slice(0,5).map(m=>({name:m.name,gap:m.distance,RE:m.env.year,park:m.env.park.label,dh:m.dh,current:m.coverage?.currentFiles,old:m.coverage?.preRefreshFiles})),
    donors:b.dataDonors.slice(0,4).map(m=>({name:m.name,gap:m.distance,current:m.coverage.currentFiles,legalCards:m.eligibleRows,pa:m.eligiblePa,ip:m.eligibleIp,rostered:m.rosterCardsWithData,hit500:m.rosterHitters500,pit400:m.rosterPitchers400}))},null,2));}
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
