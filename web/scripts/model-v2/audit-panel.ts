// Model audit panel: every observed card-series with the model's prediction and every rating.
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r.rows ?? []);
async function main() {
  const OUT = process.argv[2];
  const series = rowsOf(await db.execute(sql`select t.series, max(t.env_year) y, max(t.park_name) park, max(m.lhp_bf_share) lhp, max(m.lhb_pa_share) lhb from tournaments t left join series_meta m on m.series=t.series where t.series is not null and t.env_year is not null group by 1`));
  const obs = rowsOf(await db.execute(sql`select o.series, o.card_id, o.is_pitcher, o.pa, o.ip, o.woba, o.fip, o.counters, c.bats, c.throws, c.ratings, c.position, c.pitcher_role, c.card_value, c.year cyear, c.card_sub_type sub, c.card_type ctype
    from observed_card_stats o join cards c on c.card_id=o.card_id where (not o.is_pitcher and o.pa >= 100 and o.woba is not null) or (o.is_pitcher and (o.counters->>'BF')::int >= 200)`));
  const by = new Map<string, any[]>(); for (const r of obs) { const g = by.get(r.series) ?? []; g.push(r); by.set(r.series, g); }
  const keys = new Set<string>(); for (const r of obs) for (const k of Object.keys(r.ratings ?? {})) keys.add(k);
  const K = [...keys].sort();
  const hdr = ["series","env_year","lhp","card_id","is_pitcher","bats","throws","role","pos","val","cyear","sub","ctype","pa","bf","woba","ra700","fip","sb","cs","zr","e","modelR","modelL", ...K.map((k) => "r_" + k.replace(/[^A-Za-z0-9]/g, "_"))];
  const out = [hdr.join(",")];
  let n = 0;
  for (const s of series) {
    const g = by.get(s.series); const era = eraTable[String(s.y)]; if (!g || g.length < 12 || !era) continue;
    const pr = s.park ? parkRow(s.park, null) : null;
    const pool = g.map((r) => ({ cardId: r.card_id, isPitcher: r.is_pitcher, bats: r.bats ?? "R", ratings: r.ratings ?? {}, role: r.is_pitcher ? r.pitcher_role : r.position }));
    const f = envFitMaps(pool as any, { era: era.rates, park: pr, eraYear: Number(s.y), tournamentTerms: false, roleTrust: 0.25, leagueLhbShare: s.lhb ?? 0.35 });
    for (const r of g) {
      const c = r.counters ?? {}; const bf = Number(c.BF ?? 0);
      const row = [s.series, s.y, s.lhp ?? 0.3, r.card_id, r.is_pitcher ? 1 : 0, r.bats ?? "", r.throws ?? "", r.pitcher_role ?? "", r.position ?? "", r.card_value ?? "", r.cyear ?? "", r.sub ?? "", r.ctype ?? "",
        r.pa, bf, r.woba ?? "", bf ? (700 * Number(c.Ra ?? 0) / bf).toFixed(3) : "", r.fip ?? "", c.SB ?? 0, c.CS ?? 0, c.ZR ?? 0, c.E ?? 0,
        f.runsR.get(r.card_id)?.toFixed(3) ?? "", f.runsL.get(r.card_id)?.toFixed(3) ?? "", ...K.map((k) => r.ratings?.[k] ?? "")];
      out.push(row.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(",")); n++;
    }
  }
  writeFileSync(OUT, out.join("\n")); console.log(`${n} card-series rows, ${K.length} rating columns`);
  process.exit(0);
}
main();
