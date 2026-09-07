/** Read-only audit. Run from web with:
 * node --env-file=.env.local --import tsx ../Docs/audit-2026-09-06/audit.ts
 * Never writes application tables or prints credentials.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { parseShopList } from "../../web/src/lib/ingest/pt-card-list";
import { parseCollection, matchCollectionToShop } from "../../web/src/lib/ingest/collection";
import { parseDump } from "../../web/src/lib/analytics/dumps";

const root = resolve(process.cwd(), "..");
const require = createRequire(join(root, "web/package.json"));
const { Pool } = require("pg");
const queries: Record<string, string> = {
  uploads: "select kind,count(*)::int as uploads,max(uploaded_at) as latest_recorded_date from uploads group by kind order by kind",
  latestCollection: "select match_quality,is_variant,count(*)::int as rows,count(distinct card_id)::int as distinct_cards from collection_cards where upload_id=(select max(id) from uploads where kind='collection') group by match_quality,is_variant",
  latestOwnership: "select count(*) filter(where owned>0)::int as owned_card_ids,sum(owned)::int as owned_copies from card_snapshots where upload_id=(select max(id) from uploads where kind='shop_list')",
  rules: "select count(*)::int as catalog,count(*) filter(where not retired)::int as current,count(*) filter(where restrictions->>'teamCap' is not null)::int as with_team_cap,count(*) filter(where restrictions->>'variantCap' is not null)::int as with_variant_cap,count(*) filter(where restrictions->>'slots' is not null)::int as with_slots,count(*) filter(where restrictions->>'cardTypes' is not null)::int as with_card_types from tournaments",
  observations: "select count(*)::int as aggregates,count(distinct card_id)::int as card_ids,count(distinct series)::int as series,count(*) filter(where not is_pitcher and pa>=500)::int as hitters_at_500pa,count(*) filter(where is_pitcher and ip>=400)::int as pitchers_at_400ip from observed_card_stats",
  unmatchedObserved: "select count(*)::int as rows,count(distinct o.card_id)::int as card_ids from observed_card_stats o left join cards c on o.card_id=c.card_id where c.card_id is null",
  latestLeague: "select s.league,s.split,max(s.captured_on) as latest,count(*)::int as snapshots from league_snapshots s group by s.league,s.split order by s.league,s.split",
  snapshotCompleteness: "select s.league,s.split,s.captured_on,count(*)::int as rows,count(*) filter(where l.is_pitcher)::int as pitchers from league_snapshots s join league_stints l on l.snapshot_id=s.id where s.split='all' group by s.id order by s.captured_on desc,s.league",
  personalResults: "select source,count(*)::int as entries,min(start_at) as earliest,max(start_at) as latest,count(*) filter(where finish=1)::int as wins from my_results group by source",
  periods: "select id,name,starts_on,ends_on,targets_are_official from periods order by id",
  dailyCoverage: "select min(occurred_on) as earliest,max(occurred_on) as latest,count(distinct occurred_on)::int as days,count(*)::int as rows from daily_totals",
};

function csvFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir,n);
    return statSync(p).isDirectory() ? csvFiles(p) : p.endsWith('.csv') ? [p] : [];
  });
}

async function main() {
  const report: Record<string, unknown> = { auditedAt: new Date().toISOString(), queries };
  report.rawFolders = Object.fromEntries(['LJ Cards and Card Shop','League Data','Archive/Completed','Tourney Data','Inbox'].map(dir => {
    const fs = csvFiles(join(root,dir));
    return [dir,{ csvFiles:fs.length,bytes:fs.reduce((s,p)=>s+statSync(p).size,0) }];
  }));
  const dir = join(root,'LJ Cards and Card Shop');
  const shop = parseShopList(readFileSync(join(dir,'pt_card_list 8.27.csv'),'utf8'));
  const collection = parseCollection(readFileSync(join(dir,'collection 2026-08-27.csv'),'utf8'));
  const match = matchCollectionToShop(collection.cards,shop.cards);
  report.latestRawCards = { shop:shop.stats, collection:collection.stats,matchRate:match.matchRate,
    qualities:match.matched.reduce((a,r)=>{a[r.matchQuality]=(a[r.matchQuality]??0)+1;return a;},{} as Record<string,number>) };
  report.latestDumps = ['pt27_tournaments_competitve_dump_20260831.csv','pt27_drafts_competitve_dump_20260831.csv'].map(file => {
    const d = parseDump(readFileSync(join(root,'Tourney Data',file),'utf8'))!;
    return {file,source:d.source,events:d.events.length,uniqueIds:new Set(d.events.map(e=>e.id)).size,from:d.dateMin,to:d.dateMax,
      personalEntries:d.events.filter(e=>e.finishers.some(u=>u.toLowerCase()==='rtr1776')).length};
  });
  const p = new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
  const db: Record<string, unknown> = {};
  try {
    const c = await p.connect();
    try {
      await c.query('BEGIN READ ONLY');
      for(const t of ['cards','card_snapshots','collection_cards','tournaments','contexts','observed_card_stats','series_meta','league_snapshots','league_stints','rosters','results','daily_totals','my_results','standings']) {
        db[t]=(await c.query('select count(*)::int as rows from '+t)).rows[0].rows;
      }
      for(const [label,q] of Object.entries(queries)) db[label]=(await c.query(q)).rows;
      await c.query('ROLLBACK');
    } finally { c.release(); }
  } finally { await p.end(); }
  report.database=db;
  const out=join(root,'Docs/audit-2026-09-06/evidence.json');
  writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
