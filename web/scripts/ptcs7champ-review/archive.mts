import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { fieldingRuns } from "@/lib/analytics/fielding";
const sql = neon(process.env.DATABASE_URL!);
const champ: Record<string, number> = { ptcs7champbronze: 9070002, ptcs7champsilver: 9070003, ptcs7champgold: 9070004, ptcs7champdiamond: 9070005, ptcs7champopen: 9070006, ptcs7champcap: 9070008 };
const tours = await sql.query(`select id, series, env_year, stadium, ratings_max from tournaments where not is_draft`) as any[];
const bySeries = new Map<string, any>(); for (const t of tours) if (!bySeries.has(t.series)) bySeries.set(t.series, t);
for (const [s, id] of Object.entries(champ)) bySeries.set(s, tours.find((t: any) => t.id === id));
const series = (await sql.query(`select distinct series from observed_card_stats`) as any[]).map((x: any) => x.series).filter((s: string) => bySeries.has(s));
const out: any[] = [];
for (const s of series) {
  const t = bySeries.get(s); const era = eraFor(t.env_year); if (!era) continue; const park = parkFor(t.stadium);
  const rows = await sql.query(`select o.card_id, o.is_pitcher, o.pa, o.ip, o.woba, o.fip, o.counters, c.bats, c.ratings, c.pitcher_role, c.position, c.card_value from observed_card_stats o join cards c on c.card_id=o.card_id where o.series=$1`, [s]) as any[];
  const pool = rows.map((r: any) => ({ cardId: r.card_id, isPitcher: r.is_pitcher, bats: r.bats, ratings: r.ratings, role: r.pitcher_role }));
  const fits = envFitMaps(pool, { era: era.row.rates, park: park.row, eraYear: t.env_year, roleTrust: 0.25 });
  for (const r of rows) {
    const R = fits.runsR.get(r.card_id), L = fits.runsL.get(r.card_id); if (R == null || L == null) continue;
    const pos = r.position as string; const rt = r.ratings as Record<string, number>;
    const fr = !r.is_pitcher && rt[`Pos Rating ${pos}`] ? fieldingRuns(pos, rt[`Pos Rating ${pos}`]) : null;
    out.push({ s, champ: s in champ, year: t.env_year, max: t.ratings_max, p: r.is_pitcher, pa: r.pa, ip: r.ip, bf: r.counters.BF ?? 0, woba: r.woba, fip: r.fip, zr: r.counters.ZR ?? 0, R, L, pos, fr, val: r.card_value, rt: r.is_pitcher ? { Stuff: rt.Stuff, Control: rt.Control, pHR: rt.pHR, pBABIP: rt.pBABIP } : { "Avoid Ks": rt["Avoid Ks"], BABIP: rt.BABIP, Gap: rt.Gap, Power: rt.Power, Eye: rt.Eye } });
  }
  console.log(s, t.env_year, t.stadium, rows.length);
}
writeFileSync(`${process.env.REV_DIR ?? "/tmp/ptcs7rev"}/arch.json`, JSON.stringify(out));
process.exit(0);
