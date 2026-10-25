// his finish distribution as a percentile of the field, all events since 2026-08-01, by kind (draft / tournament) and for Iron-tagged events
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
const sql = neon(process.env.DATABASE_URL!);
const b = await sql.query(`select event_id, source, name, finish, field_size, categories from my_results where start_at >= '2026-08-01'`) as any[];
const a = await sql.query(`select event_id, name, categories, field_size, placement, eliminated from results where occurred_on >= '2026-08-01'`) as any[];
const out: any[] = [];
const seen = new Set(b.map((x) => String(x.event_id)));
for (const x of b) out.push({ src: x.source, name: x.name, pct: x.finish / x.field_size, fs: x.field_size, cats: x.categories });
const band = (p: string | null, fs: number) => { const m = p?.match(/(\d+)\D+(\d+)?/); if (!m) return null; const lo = +m[1], hi = +(m[2] ?? m[1]); return (lo + hi) / 2 / fs; };
for (const x of a) if (!seen.has(String(x.event_id)) && x.field_size) { const p = x.eliminated ? (x.field_size / 2 + x.field_size) / 2 / x.field_size : band(x.placement, x.field_size); if (p != null) out.push({ src: /draft|perfectly|laptop|dynastic|all-gold/i.test(x.name) ? "drafts" : "tournaments", name: x.name, pct: Math.min(p, 1), fs: x.field_size, cats: x.categories.join(",") }); }
writeFileSync("/private/tmp/claude-501/-Users-ljmac-Desktop-OOTP-Perfect-Team/ed5a8c2f-e955-4b32-9f73-5cf729e534d2/scratchpad/finishes.json", JSON.stringify(out));
console.log(out.length, "entries");
process.exit(0);
