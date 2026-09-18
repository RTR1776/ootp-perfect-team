/**
 * Learn the game's STANDINGS tag per event name from the results ledger.
 *
 * Every row logged from the Your Tournaments screen carries the STANDINGS
 * column as the game printed it ("Gold,Cap", "Op,Cp,TW", "PDW"). That column
 * is the only authority on which PTCS categories an event scores in, and
 * the name-based guesses in dumps.ts get it wrong often enough to move the
 * berth lines. This writes what the ledger knows to
 * src/data/standings-tags.json, which categoriesOf() consults first.
 *
 *   pnpm standings:map        (run after logging results; commit the JSON)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));

/** The game's abbreviations, as seen on the screen. TW is not a PTCS category. */
const TOKEN: Record<string, string | null> = {
  "pd daily": "PD Daily", pdd: "PD Daily", "pd weekly": "PD Weekly", pdw: "PD Weekly",
  gold: "Gold", gld: "Gold", silver: "Silver", slv: "Silver", bronze: "Bronze", brz: "Bronze",
  diamond: "Diamond", dia: "Diamond", iron: "Iron", irn: "Iron", open: "Open", op: "Open",
  cap: "Cap", cp: "Cap", live: "Live", lv: "Live", tw: null,
};
const ORDER = ["Iron", "Bronze", "Silver", "Gold", "Diamond", "Open", "Cap", "Live", "PD Daily", "PD Weekly"];

export function parseTag(tag: string): { cats: string[]; unknown: string[] } {
  const cats = new Set<string>(), unknown: string[] = [];
  for (const raw of tag.split(/[,;/]+/)) {
    const t = raw.trim().toLowerCase(); if (!t) continue;
    if (t in TOKEN) { const c = TOKEN[t]; if (c) cats.add(c); } else unknown.push(raw.trim());
  }
  return { cats: ORDER.filter((c) => cats.has(c)), unknown };
}

async function main() {
  type Row = { name: string; standings_tag: string; n: string; last: string };
  const rows = asRows<Row>(await db.execute(sql`
    select name, standings_tag, count(*)::text n, max(occurred_on)::text last
    from results where standings_tag is not null and standings_tag <> ''
    group by 1, 2 order by 1, 4 desc`));
  const names: Record<string, { cats: string[]; n: number; last: string; raw: string[] }> = {};
  const warnings: string[] = [];
  for (const r of rows) {
    const { cats, unknown } = parseTag(r.standings_tag);
    if (unknown.length) warnings.push(`${r.name}: tag "${r.standings_tag}" has unknown token(s) ${unknown.join(", ")}`);
    if (!cats.length) continue;
    // A name can appear with a suffix the dump does not carry ("… - ORD").
    for (const key of new Set([r.name, r.name.replace(/\s+-\s+[A-Z]{2,4}$/, "")])) {
      const cur = names[key];
      if (!cur) { names[key] = { cats, n: Number(r.n), last: r.last.slice(0, 10), raw: [r.standings_tag] }; continue; }
      cur.n += Number(r.n); cur.raw.push(r.standings_tag);
      if (cur.cats.join() !== cats.join()) {
        // Disagreement between screens: the more recent row wins, and it is printed.
        warnings.push(`${key}: ${cur.cats.join(",")} (${cur.raw[0]}) vs ${cats.join(",")} (${r.standings_tag}) — keeping the newer, ${r.last.slice(0, 10) > cur.last ? cats.join(",") : cur.cats.join(",")}`);
        if (r.last.slice(0, 10) > cur.last) { cur.cats = cats; cur.last = r.last.slice(0, 10); }
      }
    }
  }
  const out = { generatedAt: new Date().toISOString().slice(0, 10), source: "results.standings_tag (Your Tournaments screen)", names };
  const path = join(process.cwd(), "src", "data", "standings-tags.json");
  writeFileSync(path, JSON.stringify(out, null, 1) + "\n");
  console.log(`${Object.keys(names).length} event names with the game's own STANDINGS tag → src/data/standings-tags.json`);
  for (const w of warnings) console.log(`  !! ${w}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
