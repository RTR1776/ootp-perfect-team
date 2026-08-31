/**
 * Tourney stat-export inventory -> scripts/.inventory.json, then
 * scripts/tourney-inventory-xlsx.py turns it into the workbook.
 *   pnpm inventory        (from web/)
 *
 * Answers "what can I still export?", not just "what do I have" — OOTP only
 * serves about the last 7 days. Key facts encoded here:
 *   - an event id is <3-digit slot><4-digit run>: tournament 185 run 151 = 1850151
 *   - OOTP REUSES a slot when a tournament is renamed, so only the newest name
 *     on a slot is still running and the older ones cannot be exported at all
 *   - every series keeps its OWN run counter; there is no shared epoch
 *   - the filer names files by the id typed in, which sometimes sits on a
 *     different counter than the PT run number — those rows are flagged, not guessed
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const env=Object.fromEntries(readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const { neon } = await import('@neondatabase/serverless');
const _s=neon(env.DATABASE_URL); const q=async(t,p)=>{const r=await _s.query(t,p);return r.rows??r;};
const DAY=86400000, WINDOW=7;
const TODAY = process.argv[2] ?? new Date().toISOString().slice(0,10);

const mine = await q(`select source, name, event_id, start_at::date d, points, finish, field_size from my_results`);
const tr   = await q(`select id, name, series, ratings_min, ratings_max, entrants, is_draft from tournaments`);
const meta = await q(`select series, files from series_meta`);
const M = new Map(meta.map(m=>[m.series,m.files]));

const dir = fileURLToPath(new URL('../../Archive/Completed', import.meta.url));
const disk={};
for (const f of readdirSync(dir)) { const m=/^(.+)_(\d+)\.csv$/i.exec(f); if(m)(disk[m[1]]??=[]).push(+m[2]); }
for (const k in disk) disk[k].sort((a,b)=>a-b);

/* ---- per-event id ladder + cadence, from my_results ---- */
const per=new Map();
for (const r of mine) {
  const id=String(r.event_id); if (id.length!==7) continue;
  const e=per.get(r.name) ?? {ptid:id.slice(0,3), source:r.source, runs:[], entries:0, pts:0, best:999, field:0};
  e.runs.push([+id.slice(3), new Date(r.d).toISOString().slice(0,10)]);
  e.entries++; e.pts+=r.points; e.best=Math.min(e.best,r.finish); e.field=Math.max(e.field,r.field_size);
  per.set(r.name,e);
}
for (const [,e] of per){
  e.runs.sort((a,b)=>a[0]-b[0]);
  const st=[]; for(let i=1;i<e.runs.length;i++){const dr=e.runs[i][0]-e.runs[i-1][0], dd=(Date.parse(e.runs[i][1])-Date.parse(e.runs[i-1][1]))/DAY; if(dr>0&&dd>0) st.push(dd/dr);}
  st.sort((a,b)=>a-b); e.dpr = st.length ? st[st.length>>1] : null;
  const L=e.runs.at(-1); e.lastRun=L[0]; e.lastDate=L[1];
  e.runOf = iso => e.dpr==null?null:Math.round(L[0] + (Date.parse(iso)-Date.parse(L[1]))/DAY/e.dpr);
  e.dateOf = run => e.dpr==null?null:new Date(Date.parse(L[1]) + (run-L[0])*e.dpr*DAY).toISOString().slice(0,10);
}

/* ---- name matching to the catalog ---- */
const sq=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const cat=tr.map(t=>({...t, sq:sq(t.name)}));
const bySq=new Map(cat.map(t=>[t.sq,t]));
function lev(a,b){const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
const findCat=n=>{const s=sq(n); if(bySq.has(s))return bySq.get(s);
  let b=null,bd=Infinity; for(const t of cat){const d=lev(s,t.sq); if(d<bd){bd=d;b=t;}}
  return (b && bd<=Math.max(2,Math.round(s.length*0.08))) ? b : null;};

/* ---- tier ---- */
const TIER_ORDER=['Diamond','Gold','Silver','Bronze','Iron','Open','Live','Cap','Other'];
// LEVEL WINS over Cap/Live, matching the filer's picker order
function tierOf(name, cap){
  if (cap!=null){ if(cap>=100) return 'Open'; if(cap>=90) return 'Diamond'; if(cap>=80) return 'Gold';
                  if(cap>=70) return 'Silver'; if(cap>=60) return 'Bronze'; return 'Iron'; }
  for (const t of ['Diamond','Gold','Silver','Bronze','Iron']) if (new RegExp('\\b'+t,'i').test(name)) return t;
  if (/\blive\b/i.test(name)) return 'Live';
  if (/\bcap\b/i.test(name)) return 'Cap';
  if (/\bopen\b|deadball|wide open/i.test(name)) return 'Open';
  return 'Other';
}
const cadence = e => e.dpr==null?'?' : e.dpr<1.5?'daily' : e.dpr<10?'weekly' : 'occasional';

/* ---- rows ---- */
const names = new Set([...per.keys(), ...tr.map(t=>t.name)]);
const rows=[];
for (const name of names) {
  const e = per.get(name);
  const c = findCat(name);
  const series = c?.series ?? null;
  const held = series ? (disk[series] ?? []) : [];
  const cap = c?.ratings_max ?? null;
  const isDraft = e ? e.source==='drafts' : !!c?.is_draft;
  // runs whose start date falls inside the last WINDOW days
  let winRuns=[], missing=[], latestDate=null, numbering='—';
  if (e && e.dpr!=null && held.length) {
    // the filer names files by the id L.J. types; older dailies used a shared
    // days-since-Mar-13 counter, newer ones the per-series run number. If the two
    // ladders disagree the "missing run" arithmetic is meaningless, so say so.
    const lo=e.runs[0][0], hi=e.lastRun, span=hi-lo;
    const inside = held.filter(h=>h>=lo-span*0.25 && h<=hi+span*0.5).length;
    numbering = inside/held.length >= 0.6 ? 'matches' : 'MISMATCH — file numbers are on a different counter';
  }
  if (e && e.dpr!=null) {
    const lo = e.runOf(new Date(Date.parse(TODAY)-(WINDOW-1)*DAY).toISOString().slice(0,10));
    const hi = e.runOf(TODAY);
    for (let r=lo; r<=hi; r++) if (r>0) winRuns.push(r);
    missing = numbering.startsWith('MISMATCH') ? [] : winRuns.filter(r=>!held.includes(r));
    if (held.length) latestDate = e.dateOf(held.at(-1));
  }
  rows.push({
    tier: tierOf(name, cap), isDraft, name,
    ptid: e?.ptid ?? '', series: series ?? '', cadence: e?cadence(e):'?',
    runsOnFile: series ? (M.get(series) ?? held.length) : 0,
    filesOnDisk: held.length,
    latestRun: held.length ? held.at(-1) : '',
    latestDate: latestDate ?? '',
    daysBehind: latestDate ? Math.round((Date.parse(TODAY)-Date.parse(latestDate))/DAY) : '',
    missingCount: missing.length,
    numbering, retired:undefined,
    grabIds: e ? missing.map(r=>e.ptid+String(r).padStart(4,'0')).join(', ') : '',
    cap: cap!=null ? `${c.ratings_min ?? 40}-${cap}` : '',
    field: c?.entrants ?? e?.field ?? '',
    entries: e?.entries ?? 0, pts: e?.pts ?? 0,
    inCatalog: c ? 'yes' : 'no',
  });
}
/* An event id is <slot><run>, and OOTP REUSES the slot when a tournament is
   renamed or replaced — 218 was Treasure Trove until Aug 6 and 6L Power Play
   from Aug 15. Only the newest name on a slot is still running, so the older
   ones are retired and their "grabbable" ids now belong to the successor. */
const bySlot=new Map();
for (const r of rows) if (r.ptid) (bySlot.get(r.ptid) ?? bySlot.set(r.ptid,[]).get(r.ptid)).push(r);
for (const [slot,list] of bySlot) {
  if (list.length<2) continue;
  const live = list.reduce((a,b)=> (per.get(b.name)?.lastDate ?? '') > (per.get(a.name)?.lastDate ?? '') ? b : a);
  for (const r of list) if (r!==live) {
    r.retired = `retired — slot ${slot} is now "${live.name}"`;
    r.grabIds=''; r.missingCount=0;
  }
  live.retired='';
}
for (const r of rows) r.retired ??= '';

/* A few series sit on more than one catalog row — two are pure spelling
   duplicates ("Retrospecticus"/"Retrospectus", "Up to 1969"/"Up To 1969") and
   one is the CWhit slot family. Counting files on each would inflate the totals,
   so only the primary row (most entries, then still-running) carries the counts. */
const bySeries=new Map();
for (const r of rows) if (r.series) (bySeries.get(r.series) ?? bySeries.set(r.series,[]).get(r.series)).push(r);
for (const [series,list] of bySeries) {
  if (list.length<2) continue;
  const rank = r => [r.retired ? 1 : 0, -r.entries, r.name];
  const primary = list.slice().sort((a,b)=>{
    const [ar,ae,an]=rank(a), [br,be,bn]=rank(b);
    return ar-br || ae-be || an.localeCompare(bn);
  })[0];
  for (const r of list) if (r!==primary) {
    r.runsOnFile=0; r.filesOnDisk=0; r.latestRun=''; r.latestDate=''; r.daysBehind=''; r.missingCount=0; r.grabIds='';
    r.retired = r.retired || `duplicate listing — exports counted on "${primary.name}"`;
  }
}
/* A series can have files on disk while its catalog row carries series=null,
   which would leave those exports invisible. Give each orphan its own row rather
   than silently dropping it. */
for (const [series, nums] of Object.entries(disk)) {
  if (rows.some(r=>r.series===series)) continue;
  const guess = tr.find(t=>sq(t.name).includes(series)) ?? null;
  rows.push({
    tier: tierOf(guess?.name ?? series, guess?.ratings_max ?? null),
    isDraft: !!guess?.is_draft, name: guess?.name ?? `(series "${series}")`,
    ptid: '', series, cadence: '?',
    runsOnFile: M.get(series) ?? nums.length, filesOnDisk: nums.length,
    latestRun: nums.at(-1), latestDate: '', daysBehind: '', missingCount: 0, grabIds: '',
    cap: guess?.ratings_max!=null ? `${guess.ratings_min ?? 40}-${guess.ratings_max}` : '',
    field: guess?.entrants ?? '', entries: 0, pts: 0, inCatalog: guess?'yes':'no',
    numbering: '—', retired: 'series not linked to a catalog tournament',
  });
}

const ord=t=>TIER_ORDER.indexOf(t);
const tourneys = rows.filter(r=>!r.isDraft).sort((a,b)=>
  ord(a.tier)-ord(b.tier) || (b.filesOnDisk>0)-(a.filesOnDisk>0) || (a.cadence==='daily'?0:1)-(b.cadence==='daily'?0:1) || b.entries-a.entries || a.name.localeCompare(b.name));
const drafts = rows.filter(r=>r.isDraft).sort((a,b)=> (b.filesOnDisk>0)-(a.filesOnDisk>0) || b.entries-a.entries || a.name.localeCompare(b.name));
writeFileSync(fileURLToPath(new URL('.inventory.json', import.meta.url)), JSON.stringify({tourneys, drafts, today:TODAY, window:WINDOW}));
console.log('tournaments %d | drafts %d', tourneys.length, drafts.length);
console.log('retired (slot reused): %d ->', rows.filter(r=>r.retired).length,
  rows.filter(r=>r.retired).map(r=>r.name).slice(0,8).join(' · '));
console.log('with full data in the last 7 days (nothing missing, has files):', rows.filter(r=>r.filesOnDisk>0&&r.missingCount===0).length);
console.log('by tier:', TIER_ORDER.map(t=>`${t} ${tourneys.filter(r=>r.tier===t).length}`).join(' · '));
console.log('\nsample:'); for (const r of tourneys.slice(0,5))
  console.log('  %s %s ptid %s series %s files %s latest %s (%s d ago) missing %s -> %s',
    r.tier.padEnd(8), r.name.slice(0,34).padEnd(34), r.ptid, (r.series||'—').padEnd(18), r.filesOnDisk, r.latestRun, r.daysBehind, r.missingCount, r.grabIds.slice(0,40));
