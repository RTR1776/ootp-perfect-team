/**
 * Keep one saved roster per event: the newest. Everything that reads saved
 * rosters reads only that one (/build's recommended pick, current-rosters'
 * new-card triage and seeds), so the older picks are clutter on /build.
 *
 *   node --import tsx scripts/roster-prune.ts            preview: counts per event
 *   node --import tsx scripts/roster-prune.ts --go       back up, then delete
 *
 * The backup (rosters + slots, gzipped JSON) goes to
 * Docs/Archive/saved-rosters-pruned-<date>.json.gz before anything is deleted.
 * roster:save now replaces an event's earlier picks itself, so this is for
 * the rows saved before that.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { asc, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rosters, rosterSlots } from "@/db/schema";

const rowsOf = <T>(r: unknown): T[] => (Array.isArray(r) ? r : (r as { rows: T[] }).rows);

async function main() {
  const old = rowsOf<{ id: number; tournament_id: number; name: string }>(await db.execute(sql`
    select r.* from rosters r
    where exists (select 1 from rosters n where n.tournament_id = r.tournament_id and (n.updated_at, n.id) > (r.updated_at, r.id))
    order by r.tournament_id, r.id`));
  const total = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int n from rosters`))[0].n;
  console.log(`${total} saved rosters; ${old.length} superseded, ${total - old.length} kept (the newest per event)`);
  if (!old.length) process.exit(0);
  if (!process.argv.includes("--go")) { console.log("preview only: --go backs up and deletes"); process.exit(0); }

  const ids = old.map((r) => r.id);
  const slots = await db.select().from(rosterSlots).where(inArray(rosterSlots.rosterId, ids)).orderBy(asc(rosterSlots.rosterId), asc(rosterSlots.id));
  const file = resolve(process.cwd(), "..", "Docs", "Archive", `saved-rosters-pruned-${new Date().toISOString().slice(0, 10)}.json.gz`);
  writeFileSync(file, gzipSync(JSON.stringify({ prunedAt: new Date().toISOString(), rosters: old, slots })));
  console.log(`backed up ${old.length} rosters, ${slots.length} slots → ${file}`);
  const gone = await db.delete(rosters).where(inArray(rosters.id, ids)).returning({ id: rosters.id });
  console.log(`deleted ${gone.length}; slots go with them (on delete cascade)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
