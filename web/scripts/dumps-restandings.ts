/**
 * Recompute the standings stored on every dump upload from the file on disk.
 *
 * The upload route computes a dump's category standings once, when the file
 * arrives, and the /ptcs page reads that stored copy. When the window rule or
 * the category map changes (dumps.ts), the stored copies are stale until the
 * next dump is uploaded — this rewrites them in place from Tourney Data/.
 *
 *   pnpm dumps:restandings [--dry]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parseDump, computeStandings } from "@/lib/analytics/dumps";

const DRY = process.argv.includes("--dry");
const DIR = join(process.env.OOTP_DATA_ROOT ?? "..", "Tourney Data");
type Row = { id: number; filename: string; start: string | null; end: string | null; user: string | null; events: string | null };
const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));

async function main() {
  const rows = asRows<Row>(await db.execute(sql`
    select id, filename, report->'standings'->'window'->>'start' "start", report->'standings'->'window'->>'end' "end",
           report->'standings'->>'user' "user", report->'standings'->>'events' events
    from uploads where kind = 'dump' order by id`));
  let done = 0, skipped = 0;
  for (const r of rows) {
    const path = join(DIR, r.filename);
    if (!r.start || !r.end || !existsSync(path)) { skipped++; console.log(`  skip ${r.filename}: ${!existsSync(path) ? "not on disk" : "no window stored"}`); continue; }
    const d = parseDump(readFileSync(path, "utf8"));
    if (!d) { skipped++; console.log(`  skip ${r.filename}: unparseable`); continue; }
    const st = computeStandings(d, { start: r.start, end: r.end }, r.user ?? undefined);
    const cap = st.categories.Cap ?? st.categories["PD Daily"];
    console.log(`  ${r.filename}  ${r.start}→${r.end}  events ${r.events} → ${st.events}` + (cap ? `  (${st.categories.Cap ? "Cap" : "PD Daily"} pts ${cap.pts}, line@128 ${cap.lines.l128})` : ""));
    if (!DRY) await db.execute(sql`update uploads set report = jsonb_set(report, '{standings}', ${JSON.stringify(st)}::jsonb) where id = ${r.id}`);
    done++;
  }
  console.log(`${DRY ? "would rewrite" : "rewrote"} ${done} upload${done === 1 ? "" : "s"}, skipped ${skipped}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
