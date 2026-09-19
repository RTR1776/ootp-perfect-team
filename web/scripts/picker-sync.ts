/**
 * Rewrite the VARNAMES block in "File OOTP Exports.command" from the
 * catalogue, so the download picker shows what the game currently offers
 * under the names it currently uses.
 *
 *   pnpm picker:sync --dry     # show the diff, write nothing
 *   pnpm picker:sync           # rewrite the block
 *
 * WHY THIS EXISTS. VARNAMES was hand-maintained. A tier refresh renames
 * tournaments in place (slot 180 "Diamond Slots Daily" became "Daily Diamond
 * Jumble Slots"), and the list never followed, so by 2026-09-18 forty-two
 * LIVE series were listed under names the game no longer used and a hundred
 * dead ones were still taking up rows. The slot is the durable key — OOTP's
 * event id is slot*10000 + run — so the catalogue keyed by slot is the
 * source of truth for NAMES, and the slug stays whatever it already was so
 * Archive/Completed filenames keep resolving.
 *
 * A series is live when it is not retired AND it has a slot AND it was
 * either touched by a recent refresh or actually played recently. The second
 * clause matters: the 2026-09-15 refresh did not cover the Open and weekly
 * posts, which would have dropped five series he plays every week.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const val = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const REFRESHED_SINCE = val("refreshed-since", "2026-09-15");
const PLAYED_SINCE = val("played-since", "2026-08-20");
const CMD = join(process.cwd(), "..", "File OOTP Exports.command");
const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);

const WEEKDAY = /^(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;
const groupOf = (name: string, isDraft: boolean) =>
  isDraft ? (WEEKDAY.test(name) ? "pdweekly" : "pddaily") : WEEKDAY.test(name) ? "weekly" : "daily";

/** Slugs the archive already uses — changing one orphans its exports. */
function archiveSlugs(): Set<string> {
  const { readdirSync } = require("fs") as typeof import("fs");
  try {
    return new Set(
      readdirSync(join(process.cwd(), "..", "Archive", "Completed"))
        .map((f: string) => f.replace(/_\d+\.csv$/i, ""))
        .filter((s: string) => s && !s.endsWith(".csv")),
    );
  } catch { return new Set(); }
}

async function main() {
  const live = asRows<any>(await db.execute(sql`
    with played as (
      select distinct (event_id::bigint / 10000)::int slot
      from (
        select event_id::bigint from my_results where start_at >= ${PLAYED_SINCE}
        union all
        select event_id::bigint from results where occurred_on >= ${PLAYED_SINCE}
      ) e(event_id)
    )
    select t.slot, t.series, t.name, t.is_draft, t.retired,
           (t.updated_at::date >= ${REFRESHED_SINCE}) refreshed,
           (p.slot is not null) played
    from tournaments t left join played p on p.slot = t.slot
    where t.slot is not null
      -- played recently: keep it even if it has since retired, because an
      -- export from its last runs may still be sitting unfiled on disk.
      -- Not retired is the catalogue's own verdict and it is the one to
      -- trust: a row the latest refresh post has not reached yet (the Open
      -- and weekly posts lag) is stale, not dead. Played-recently is the
      -- second clause only so a series that HAS since retired stays pickable
      -- while its last exports might still be unfiled on disk.
      and (not t.retired or p.slot is not null)
    order by t.name`));

  const src = readFileSync(CMD, "utf8");
  const lines = src.split("\n");
  const start = lines.findIndex((l) => l.startsWith("VARNAMES = ["));
  if (start < 0) throw new Error("VARNAMES block not found");
  const end = lines.findIndex((l, i) => i > start && l === "]");
  if (end < 0) throw new Error("end of VARNAMES block not found");

  const old = [...lines.slice(start, end).join("\n").matchAll(/\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g)]
    .map((m) => ({ slug: m[1], name: m[2], group: m[3] }));
  const oldBySlug = new Map(old.map((o) => [o.slug, o]));

  // One row per slot. A slot with two non-retired rows (a rename that landed
  // as a new row) keeps the one the refresh touched.
  const bySlot = new Map<number, any>();
  for (const r of live) {
    const prev = bySlot.get(r.slot);
    const better = !prev || (!r.retired && prev.retired) || (r.refreshed && !prev.refreshed);
    if (better) bySlot.set(r.slot, r);
  }

  const arch = archiveSlugs();
  const rows = [...bySlot.values()]
    .map((r) => ({
      slug: r.series as string,
      // A retired series stays pickable while its last exports might still be
      // unfiled, but it says so, so it is not mistaken for something running.
      name: (r.retired ? `${r.name} (ended)` : r.name) as string,
      group: groupOf(r.name, r.is_draft),
      played: r.played,
    }))
    .filter((r) => r.slug)
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const kept = rows.filter((r) => oldBySlug.has(r.slug));
  const added = rows.filter((r) => !oldBySlug.has(r.slug));
  const dropped = old.filter((o) => !rows.some((r) => r.slug === o.slug));
  const renamed = kept.filter((r) => oldBySlug.get(r.slug)!.name !== r.name);
  const orphaned = dropped.filter((o) => arch.has(o.slug));

  console.log(`\npicker:sync — refreshed since ${REFRESHED_SINCE} or played since ${PLAYED_SINCE}\n`);
  console.log(`  ${old.length} rows in  ->  ${rows.length} rows out`);
  console.log(`  ${renamed.length} renamed · ${added.length} added · ${dropped.length} dropped`);
  console.log(`  ${rows.filter((r) => r.played).length} of the ${rows.length} have been played since ${PLAYED_SINCE}`);
  const stale = [...bySlot.values()].filter((r) => !r.refreshed && !r.retired);
  if (stale.length) console.log(`  ${stale.length} kept on the catalogue's word alone — no refresh post since ${REFRESHED_SINCE}: ${stale.map((r: any) => r.name).join(", ")}\n`);
  if (renamed.length) {
    console.log("  renamed:");
    for (const r of renamed) console.log(`    ${r.slug.padEnd(26)} ${oldBySlug.get(r.slug)!.name}  ->  ${r.name}`);
  }
  if (added.length) {
    console.log("\n  added:");
    for (const r of added) console.log(`    ${r.slug.padEnd(26)} [${r.group}] ${r.name}`);
  }
  if (orphaned.length) {
    console.log("\n  !! dropped but Archive/Completed still has exports under this slug:");
    for (const o of orphaned) console.log(`    ${o.slug.padEnd(26)} ${o.name}`);
    console.log("    (history still resolves — they just will not be offered for new files)");
  }

  const body = rows.map((r) => `    ("${r.slug}", ${JSON.stringify(r.name)}, "${r.group}"),`);
  const out = [
    ...lines.slice(0, start),
    "VARNAMES = [",
    `    # GENERATED by "pnpm picker:sync" — do not hand-edit; a tier refresh`,
    `    # renames tournaments and the sync is what carries the new name over.`,
    `    # Last synced ${new Date().toISOString().slice(0, 10)} from the catalogue.`,
    ...body,
    "]",
    ...lines.slice(end + 1),
  ].join("\n");

  // ---- anchors -----------------------------------------------------------
  // The filer takes a run number from the dumps when it has one and otherwise
  // counts forward from an anchor. Anchors written by hand go stale, and a
  // stale anchor means a long extrapolation and a mis-numbered file, so
  // rewrite them from the newest run each series has in the dumps.
  const anchors = asRows<any>(await db.execute(sql`
    select distinct on (t.series) t.series, t.is_draft,
           m.event_id::bigint id, extract(epoch from m.start_at)::bigint start_unix,
           m.start_at::date d
    from my_results m
    join tournaments t on t.slot = (m.event_id::bigint / 10000)::int
    where t.series is not null
    order by t.series, m.event_id::bigint desc`));
  const weekdayOf = new Map(rows.map((r) => [r.slug, r.group]));
  const fromDump = new Map(anchors.map((a) => [a.series as string, a]));
  /**
   * MERGE, never replace. A series he has not entered has no row in the dumps,
   * and dropping its anchor would leave the filer with no guess at all for it
   * — worse than an old one, since the arithmetic is exact as long as the
   * series kept its cadence. So: keep what is there, overwrite only where the
   * dumps know something newer.
   */
  const block = (name: string, want: (g: string) => boolean, existing: Map<string, string>) => {
    const keys = new Set<string>([...existing.keys()]);
    for (const k of fromDump.keys()) if (want(weekdayOf.get(k) ?? "")) keys.add(k);
    const lines: string[] = [];
    let fresh = 0;
    for (const k of [...keys].sort()) {
      const d = fromDump.get(k);
      if (d && want(weekdayOf.get(k) ?? "")) { lines.push(`    "${k}": (${d.id}, ${d.start_unix}),`); fresh++; }
      else if (existing.has(k)) lines.push(existing.get(k)!);
    }
    return { lines: [`${name} = {`, ...lines, "}"], fresh, total: lines.length };
  };
  let text = out;
  for (const [name, want] of [
    ["WEEKLY_ANCHORS", (g: string) => g === "weekly"],
    ["DRAFT_ANCHORS", (g: string) => g === "pddaily" || g === "pdweekly"],
  ] as [string, (g: string) => boolean][]) {
    const ls = text.split("\n");
    const a = ls.findIndex((l) => l.startsWith(`${name} = {`));
    if (a < 0) { console.log(`  (no ${name} block — left alone)`); continue; }
    const b = ls.findIndex((l, i) => i > a && l === "}");
    const existing = new Map<string, string>();
    for (const l of ls.slice(a + 1, b)) {
      const m = l.match(/"([^"]+)":/);
      if (m) existing.set(m[1], l);
    }
    const built = block(name, want, existing);
    console.log(`  ${name}: ${existing.size} -> ${built.total} anchors (${built.fresh} refreshed from the dumps)`);
    text = [...ls.slice(0, a), ...built.lines, ...ls.slice(b + 1)].join("\n");
  }
  const newest = anchors.map((a) => String(a.d)).sort().pop();
  console.log(`  anchors now reach ${newest} (was 2026-08-24)`);

  if (DRY) { console.log("\n(dry run — nothing written)"); process.exit(0); }
  writeFileSync(CMD, text);
  console.log(`\nwrote ${CMD}`);
  process.exit(0);
}
main();
