import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
const sql = neon(process.env.DATABASE_URL);
const OUT = process.argv[2];
const drop = new Set(["HD452|2026-10-01","HD452|2026-10-08","HD452|2026-10-10"]);
const snaps = (await sql`select id, league, captured_on::text d, split from league_snapshots where split in ('vL','vR')`).filter(s=>!drop.has(`${s.league}|${s.d}`));
const ids = snaps.map(s=>s.id); const by = new Map(snaps.map(s=>[s.id,s]));
const rows = await sql`select snapshot_id sid, cid, pa, stats from league_stints where snapshot_id = any(${ids}) and not is_pitcher and not is_variant and cid is not null and pa > 0`;
const cids = [...new Set(rows.map(r=>r.cid))];
const cards = await sql`select card_id, bats, ratings from cards where card_id = any(${cids})`;
const cm = new Map(cards.map(c=>[c.card_id,c]));
const K = ["BABIP","Gap","Power","Eye","Avoid K"]; const KO = {"BABIP":"BABIP","Gap":"Gap","Power":"Power","Eye":"Eye","Avoid K":"Avoid Ks"};
const agg = new Map();
for (const r of rows) { const s = by.get(r.sid); const key = `${s.league}|${s.d}|${s.split}|${r.cid}`; const a = agg.get(key) ?? { league:s.league, d:s.d, split:s.split, cid:r.cid, st:{} }; for (const [k,v] of Object.entries(r.stats)) a.st[k]=(a.st[k]??0)+(Number(v)||0); agg.set(key,a); }
const hdr = ["league","week","split","cid","bats","pa","woba", ...K.map(k=>`o_${k}`), ...K.map(k=>`l_${k}`), ...K.map(k=>`r_${k}`), "speed"];
const out = [hdr.join(",")];
for (const a of agg.values()) { const c = cm.get(a.cid); if (!c?.ratings) continue; const R=c.ratings, s=a.st;
  const ab=s.AB??0,bb=(s.BB??0)-(s.IBB??0),hp=s.HP??0,sf=s.SF??0,b1=s.b1??0,b2=s.b2??0,b3=s.b3??0,hr=s.HR??0; const den=ab+bb+hp+sf; if (den<=0) continue;
  const woba=(0.69*bb+0.72*hp+0.89*b1+1.27*b2+1.62*b3+2.10*hr)/den;
  const v=k=>R[k]; if (K.some(k=>v(KO[k])==null||v(`${k} vL`)==null||v(`${k} vR`)==null)) continue;
  out.push([a.league,a.d,a.split,a.cid,c.bats,den,woba.toFixed(4),...K.map(k=>v(KO[k])),...K.map(k=>v(`${k} vL`)),...K.map(k=>v(`${k} vR`)),R.Speed??""].join(",")); }
writeFileSync(OUT, out.join("\n")); console.log(`${out.length-1} rows (card × week × split) from ${snaps.length} split snapshots`);
