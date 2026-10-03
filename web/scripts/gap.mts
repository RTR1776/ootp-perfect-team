/**
 * Played events whose tourney export isn't filed yet: the "exports to grab" list.
 * Logged results (not drafts, pop-ups or Quicks) → slot (id / 10000) and run (id % 10000)
 * → the series slug from the catalogue → "<slug>_<run>.csv", checked against every
 * file in every published observed import. Oldest first; Your Tournaments keeps about a week.
 *
 *   node --import tsx scripts/gap.mts [--since 2026-09-27]
 */
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const i = process.argv.indexOf("--since");
const since = i > 0 ? process.argv[i + 1] : new Date(Date.now() - 8 * 86400e3).toISOString().slice(0, 10);
const batches = await sql`select files from import_batches where kind like 'observed%' and status='published'`;
const filed = new Set<string>();
for (const b of batches) for (const f of (b.files ?? []) as { name?: string }[]) if (f.name) filed.add(f.name.replace(/\.csv$/, ""));
const slugs = new Map<number, string>();
for (const t of await sql`select series, restrictions->>'slot' slot from tournaments where restrictions ? 'slot'`) if (t.series && t.slot) slugs.set(Number(t.slot), t.series);
const byName = new Map<string, string>();
for (const t of await sql`select name, series from tournaments where series is not null and retired = false`) byName.set(t.name, t.series);
const res = await sql`select event_id, occurred_on::text d, name, categories from results where occurred_on >= ${since} and event_id is not null order by occurred_on, event_id`;
let n = 0;
for (const r of res) {
  const cats = (r.categories ?? []).join(",");
  if (/PD (Daily|Weekly)/.test(cats) || /pop-?up|quick/i.test(r.name)) continue;
  const slot = Math.floor(r.event_id / 10000), run = r.event_id % 10000, slug = slugs.get(slot) ?? byName.get(r.name);
  const file = slug ? `${slug}_${run}` : null;
  if (file && filed.has(file)) continue;
  n++;
  console.log(`| ${r.d} | ${r.event_id} | ${r.name} | ${file ?? `slot ${slot} not in catalogue`} |`);
}
console.log(`\n${n} played events since ${since} have no export filed (${filed.size} files on record).`);
