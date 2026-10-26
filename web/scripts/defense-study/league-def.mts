// League team-weeks for the defence test: runs allowed, FIP parts, team ZR, PA-weighted glove rating per position (base card's Pos Rating).
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { writeFileSync } from "node:fs";
const rows = (r: any) => r.rows ?? r;
const snaps: any[] = rows(await db.execute(sql`select distinct on (league, captured_on) id, league, captured_on::text as "on" from league_snapshots where split='all' order by league, captured_on, id desc`));
const wkEnd = (s: string) => { const d = new Date(s + "T00:00:00Z"); return new Date(d.getTime() + ((7 - d.getUTCDay()) % 7) * 864e5).toISOString().slice(0, 10); };
const keep = snaps.filter((s) => !snaps.some((o) => o !== s && o.league === s.league && wkEnd(o.on) === wkEnd(s.on) && o.on > s.on));
const ids = keep.map((s) => Number(s.id));
const st: any[] = [];
for (const id of ids) st.push(...rows(await db.execute(sql`select s.snapshot_id sid, s.org, s.pos, s.is_pitcher p, s.pa, s.ip, s.stats->>'Ra' ra, s.stats->>'HRa' hra, s.stats->>'BBa' bba, s.stats->>'HPa' hpa, s.stats->>'Ka' ka, s.stats->>'ZR' zr, (c.ratings->>('Pos Rating ' || s.pos))::numeric prt from league_stints s left join cards c on c.card_id = s.cid where s.snapshot_id = ${id} and not coalesce(s.is_free_agent, false)`)));
const meta = new Map(keep.map((s) => [Number(s.id), s]));
const T = new Map<string, any>();
for (const x of st) {
  const k = `${x.sid}|${x.org}`; const t = T.get(k) ?? { sid: Number(x.sid), league: meta.get(Number(x.sid))!.league, on: meta.get(Number(x.sid))!.on, org: x.org, ra: 0, ip: 0, hr: 0, bb: 0, k: 0, zr: 0, pos: {} as Record<string, [number, number]> };
    if (x.p) { const ip = +x.ip || 0; t.ip += ip; t.ra += +x.ra || 0; t.hr += +x.hra || 0; t.bb += (+x.bba || 0) + (+x.hpa || 0); t.k += +x.ka || 0; }
  else { t.zr += +x.zr || 0; const r = x.prt != null ? +x.prt : null; const pa = +x.pa || 0; if (r && pa && ["C","1B","2B","3B","SS","LF","CF","RF"].includes(x.pos)) { const a = t.pos[x.pos] ?? [0, 0]; a[0] += pa * r; a[1] += pa; t.pos[x.pos] = a; } }
  T.set(k, t);
}
writeFileSync("/private/tmp/claude-501/-Users-ljmac-Desktop-OOTP-Perfect-Team/ed5a8c2f-e955-4b32-9f73-5cf729e534d2/scratchpad/lgdef.json", JSON.stringify([...T.values()].filter((t) => t.ip > 1000)));
console.log(`${T.size} team-weeks; ${[...T.values()].filter((t) => t.ip > 1000).length} with 1000+ IP; ${keep.length} league-weeks`);
process.exit(0);
