/**
 * THE DUMP IS THE CATALOGUE'S SOURCE OF TRUTH FOR WHAT EXISTS.
 *
 * The community dump lists every event of the season with its id, title
 * and full field. The first three digits of the id are the SLOT - the
 * tournament as a standing fixture, which keeps its slot across renames and
 * refreshes. On 2026-09-15 the dumps carried 132 slots; L.J. had entered
 * 103 of them (1,500 entries) and the catalogue had rows for 53. The other
 * 50 were nearly all Perfect Draft events - half of his play, invisible to
 * the app.
 *
 * This reads the newest tournaments + drafts dumps and makes the catalogue
 * agree with them:
 *   - every slot gets a row (id 9100000 + slot when the game's own id is
 *     unknown, the scheme import:refresh already uses), named by the slot's
 *     newest title, with the field size and whether it is a draft;
 *   - an existing row whose name lags the slot's newest title is renamed;
 *   - tournaments.slot is filled from scripts/slot-map.json, and from the
 *     dump title when the map has no entry;
 *   - refresh JSON text for a slot with no restrictions on file is parsed
 *     in (Perfect Draft round rules land in notes).
 * It never touches env_year, park, value window or rules that are already
 * set. --dry prints the plan.
 *
 *   pnpm catalogue:sync [--dry]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parseDump } from "@/lib/analytics/dumps";
import { parseRestrictions } from "@/lib/ingest/restrictions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DUMPS = join(ROOT, "Tourney Data");
const DRY = process.argv.includes("--dry");
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const slugOf = (s: string) => s.toLowerCase().replace(/\b(daily|the|with|and|of|to|a|for)\b/g, "").replace(/[^a-z0-9]/g, "");

async function main() {
  const files = readdirSync(DUMPS).filter((f) => /^pt27_(tournaments|drafts)_.*\.csv$/.test(f)).sort();
  const newest = (kind: string) => files.filter((f) => f.startsWith(`pt27_${kind}_`)).at(-1);
  const slots = new Map<number, { title: string; start: number; field: number; runs: number; draft: boolean }>();
  for (const kind of ["tournaments", "drafts"]) {
    const f = newest(kind); if (!f) continue;
    const d = parseDump(readFileSync(join(DUMPS, f), "utf8")); if (!d) continue;
    for (const e of d.events) {
      const slot = Math.floor(Number(e.id) / 10000);
      const cur = slots.get(slot);
      if (!cur) slots.set(slot, { title: e.name.trim(), start: e.start, field: e.finishers.length, runs: 1, draft: kind === "drafts" });
      else { cur.runs++; if (e.start > cur.start) { cur.start = e.start; cur.title = e.name.trim(); cur.field = e.finishers.length; } }
    }
  }
  const slotMap = JSON.parse(readFileSync(join(__dirname, "slot-map.json"), "utf8"));
  const renames = slotMap._cutover?.renames ?? {};
  let refresh: any = {};
  try { refresh = JSON.parse(readFileSync(join(ROOT, "Tourney Data/refresh-2026-09.json"), "utf8")); } catch {}
  /** A parse that set nothing but notes is a remark ("removed", "see Twitch"), not a rule. */
  const meaningful = (r: ReturnType<typeof parseRestrictions>) =>
    Object.entries(r).some(([k, v]) => k !== "notes" && v != null && !(Array.isArray(v) && !v.length));
  const refreshText = (slot: number): string | null => {
    for (const tier of ["silver", "iron", "bronze", "gold", "diamond", "open", "perfectDraft"]) { const e = refresh[tier]?.[String(slot)]; if (e?.text) return e.text; }
    return null;
  };

  await db.execute(sql`alter table tournaments add column if not exists slot integer`);
  const rows = asRows<any>(await db.execute(sql`select id, name, series, slot, is_draft, entrants, restrictions from tournaments`));
  const bySeries = new Map(rows.map((r) => [r.series, r]));
  const byName = new Map(rows.map((r) => [r.name.trim().toLowerCase(), r]));
  const bySlot = new Map(rows.filter((r) => r.slot != null).map((r) => [r.slot, r]));

  let inserted = 0, renamed = 0, slotted = 0, ruled = 0, resized = 0;
  for (const [slot, s] of [...slots].sort((a, b) => a[0] - b[0])) {
    const mapped = typeof slotMap[String(slot)] === "string" ? slotMap[String(slot)] as string : null;
    const ren = renames[String(slot)];
    const candidates = [mapped, ren?.new, ren?.old].filter((x): x is string => !!x);
    const row = bySlot.get(slot) ?? candidates.map((c) => bySeries.get(c)).find(Boolean) ?? byName.get(s.title.toLowerCase());
    const series = mapped ?? row?.series ?? slugOf(s.title);
    if (!row) {
      const text = refreshText(slot);
      const r = text ? parseRestrictions(text) : null;
      // drafts keep the round rule in notes even when nothing parses ("101+ Round 1" is the rule)
      const restrictions = r && (meaningful(r) || s.draft) ? { ...r, notes: [...(r.notes ?? []), `from refresh post: ${text}`] } : null;
      console.log(`+ ${slot} ${s.draft ? "D" : "T"} ${s.title}  [${series}] field ${s.field}, ${s.runs} runs${text ? `  rules: ${text.slice(0, 60)}` : ""}`);
      if (!DRY) await db.execute(sql`
        insert into tournaments (id, name, series, slot, is_draft, entrants, restrictions, retired)
        values (${9100000 + slot}, ${s.title}, ${series}, ${slot}, ${s.draft}, ${[32, 64, 128, 256].find((n) => n >= s.field) ?? 256}, ${restrictions ? JSON.stringify(restrictions) : null}::jsonb, false)
        on conflict (id) do update set name = excluded.name, slot = excluded.slot, entrants = excluded.entrants`);
      inserted++;
      continue;
    }
    if (row.slot == null) { if (!DRY) await db.execute(sql`update tournaments set slot = ${slot} where id = ${row.id}`); slotted++; }
    /**
     * Field size drives the points table, and it changes: Thursday Night Gold
     * Rush went from 128 to 256 on 2026-08-20 and the catalogue still said 128
     * a month later, because this only ever filled a null. The newest run's
     * scheduled size (the dump's finisher count rounded up to 32/64/128/256)
     * is the truth and overwrites.
     */
    const scheduled = [32, 64, 128, 256].find((n) => n >= s.field) ?? 256;
    if (row.entrants !== scheduled) {
      console.log(`# ${slot} field ${row.entrants ?? "?"} -> ${scheduled} (${s.field} finishers in the newest run)`);
      if (!DRY) await db.execute(sql`update tournaments set entrants = ${scheduled}, updated_at = now() where id = ${row.id}`);
      resized++;
    }
    // The refresh post runs ahead of the dumps: a slot the post renamed keeps
    // showing its old title until the renamed event has actually run. Do not
    // rename the row back to the old title in the meantime.
    const renamedTo = ((): string | null => {
      for (const tier of ["silver", "iron", "bronze", "gold", "diamond", "open", "perfectDraft"]) { const e = refresh[tier]?.[String(slot)]; if (e?.new && e?.old?.trim().toLowerCase() === s.title.toLowerCase()) return e.new; }
      return null;
    })();
    if (renamedTo && row.name.trim().toLowerCase() === renamedTo.toLowerCase()) continue;
    if (row.name.trim().toLowerCase() !== s.title.toLowerCase()) {
      console.log(`~ ${slot} rename "${row.name}" -> "${s.title}"`);
      if (!DRY) await db.execute(sql`update tournaments set name = ${s.title}, updated_at = now() where id = ${row.id}`);
      renamed++;
    }
    if (row.restrictions == null) {
      const text = refreshText(slot);
      const r = text ? parseRestrictions(text) : null;
      if (text && r && meaningful(r)) {
        const restrictions = { ...r, notes: [...(r.notes ?? []), `from refresh post: ${text}`] };
        console.log(`  ${slot} rules from refresh text: ${text.slice(0, 70)}`);
        if (!DRY) await db.execute(sql`update tournaments set restrictions = ${JSON.stringify(restrictions)}::jsonb, updated_at = now() where id = ${row.id}`);
        ruled++;
      }
    }
  }
  console.log(`\n${DRY ? "dry run - " : ""}${slots.size} slots in the dumps: ${inserted} rows added, ${renamed} renamed, ${slotted} slot ids filled, ${resized} field sizes updated, ${ruled} rule sets parsed from the refresh post`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
