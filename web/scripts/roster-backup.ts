/**
 * Every saved roster, written to one file before anything replaces it.
 *
 * Saved rosters are one per event: "Claude pick <tag>" replaces the event's
 * earlier Claude pick, so the rosters L.J. actually played with were gone the
 * moment a rebuild ran, and nothing could later ask "did the pick that was
 * live that week win?". current-rosters --save runs this first.
 *
 *   pnpm roster:backup [--out ../Docs/Archive/saved-rosters-YYYY-MM-DD.json.gz] [--why "before the 11-12 rebuild"]
 *
 * The file is gzipped JSON: { savedAt, why, rosters[], slots[] }, each slot
 * with its card's name and value so it reads without the database.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todayInChicago } from "@/lib/ptcs-progress";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const rows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));

async function main() {
  const day = todayInChicago();
  let out = val("out") ?? join(process.env.OOTP_DATA_ROOT ?? "..", "Docs", "Archive", `saved-rosters-${day}.json.gz`);
  // Never overwrite an earlier backup from the same day: that one holds what this run is about to replace.
  for (let n = 2; existsSync(out); n++) out = out.replace(/(-\d+)?\.json\.gz$/, `-${n}.json.gz`);
  const rosters = rows<Record<string, unknown>>(await db.execute(sql`
    select r.*, t.name tournament_name from rosters r left join tournaments t on t.id = r.tournament_id order by r.id`));
  const slots = rows<Record<string, unknown>>(await db.execute(sql`
    select s.*, c.name card_name, c.card_value from roster_slots s left join cards c on c.card_id = s.card_id order by s.roster_id, s.id`));
  if (!rosters.length) { console.log("no saved rosters; nothing to back up"); process.exit(0); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, gzipSync(Buffer.from(JSON.stringify({ savedAt: new Date().toISOString(), why: val("why") ?? null, rosters, slots }))));
  console.log(`backed up ${rosters.length} rosters, ${slots.length} slots -> ${out}`);
  process.exit(0);
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
