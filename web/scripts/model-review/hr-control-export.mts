/** Control-hinge HR test, step 1 (2026-10-29): export base arms per series for hr-control-cards.py. */
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import CURVES from "@/data/curves.json";
const sql = neon(process.env.DATABASE_URL!);
const P = (CURVES as any).pit.hr;
const mult = (r: number) => { const x = Math.log(r / 50); return Math.exp(P.alpha + P.beta * x + P.gamma * x * x); };
const ts = await sql.query(`select distinct on (series) series, env_year from tournaments where series is not null order by series, id desc`);
const yr = new Map(ts.map((t: any) => [t.series, t.env_year ?? 2010]));
const yOf = (s: string) => yr.get(s) ?? yr.get(s.replace(/-pre\d+$/, "")) ?? null;
// Base pitcher card-series from observed_card_stats (every archived export, imported), with pHR curve multiplier and Control/Stuff blends.
//   node --import tsx scripts/model-review/hr-control-export.mts /tmp/hrcards.json
const rows = await sql.query(`select o.series, o.card_id, (o.counters->>'BF')::float bf, (o.counters->>'BBa')::float bb, (o.counters->>'Ka')::float k, (o.counters->>'HRa')::float hr, coalesce((o.counters->>'HPa')::float,0) hp, c.ratings r
  from observed_card_stats o join cards c using(card_id) where o.is_pitcher and not o.is_variant and (o.counters->>'BF')::float > 0`);
const sp = (r: any, k: string) => { const l = r[k + " vL"] ?? r[k], v = r[k + " vR"] ?? r[k]; return l && v ? 0.45 * l + 0.55 * v : null; };
const out = (rows as any[]).map((x) => ({ s: x.series, y: yOf(x.series), bf: x.bf, bip: x.bf - x.k - x.bb - x.hp, hr: x.hr, con: sp(x.r, "Control"), stu: sp(x.r, "Stuff"), m: (() => { const v = sp(x.r, "pHR"); return v ? mult(v) : null; })() }))
  .filter((x) => x.con && x.m && x.bip > 0 && x.y != null);
writeFileSync(process.argv[2], JSON.stringify(out)); console.log(out.length, "rows"); process.exit(0);
