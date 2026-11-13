/**
 * One command for every community tourney dump — drop the file anywhere
 * obvious and run this.
 *
 * The dumps are the only durable record of tournament results: events retire on
 * a rolling basis and their pages go away, but the weekly dump lists the whole
 * field in finish order for every event of the season, so a dump kept on disk
 * stays readable forever. That makes "did I import this week's dump" the single
 * most important piece of housekeeping in the project, and it should not take
 * more than a double-click.
 *
 * What it does, in order:
 *   1. finds pt27_*dump*.csv in Inbox/, Downloads/ and Tourney Data/
 *   2. files anything loose into Tourney Data/ under its own name
 *   3. imports each dump not already in the uploads table (matched on filename,
 *      so re-running is safe and cheap)
 *   4. refreshes my_results from the newest tournaments + drafts dump
 *   5. projects the berth lines from the new dump and stores them as the
 *      period's targets (cutoff:project --write), then prints the standing
 *
 *   pnpm dumps:load [--period "PTCS 7"] [--dry]
 */
import { readdirSync, existsSync, renameSync, copyFileSync, unlinkSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dumpFileDate, isCompetitiveDumpFile, periodInPlay } from "@/lib/analytics/dump-files";
import { todayInChicago } from "@/lib/ptcs-progress";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const DRY = argv.includes("--dry");
const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const HOME = process.env.HOME ?? "";
const DEST = join(ROOT, "Tourney Data");
const SOURCES = [join(ROOT, "Inbox"), join(HOME, "Downloads"), join(HOME, "Desktop"), DEST];

const isDump = (f: string) => /^pt27_.*dump.*\.csv$/i.test(f);
const run = (args: string[]) => {
  const out = execFileSync("node", ["--env-file=.env.local", "--import", "tsx", ...args], { encoding: "utf8" });
  return out.trimEnd();
};

async function main() {
  console.log(`\nTOURNEY DUMP LOADER`);

  /* ---- 1 & 2: find loose dumps and file them ---- */
  const filed: string[] = [];
  for (const dir of SOURCES) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!isDump(f)) continue;
      const from = join(dir, f), to = join(DEST, f);
      if (from === to) continue;
      if (existsSync(to) && statSync(to).size === statSync(from).size) {
        console.log(`  already filed, removing the loose copy: ${f}`);
        if (!DRY) unlinkSync(from);
        continue;
      }
      console.log(`  filing ${f}  (${dir.replace(HOME, "~")} -> Tourney Data)`);
      if (!DRY) { try { renameSync(from, to); } catch { copyFileSync(from, to); unlinkSync(from); } }
      filed.push(f);
    }
  }

  const onDisk = existsSync(DEST) ? readdirSync(DEST).filter(isDump).sort() : [];
  if (!onDisk.length) {
    console.log(`\n  No dumps found. Save the weekly dump anywhere in Downloads, Desktop or the`);
    console.log(`  project's Inbox folder and run this again.\n`);
    process.exit(0);
  }

  /* ---- 3: import anything new ----
     Competitive dumps only: a Quick dump holds no event that scores in a PTCS
     category, and stored as a board it sat on /ptcs for a week (10-19). */
  const stored = asRows<{ filename: string; period: string | null }>(await db.execute(
    sql`select filename, report->>'period' period from uploads where kind = 'dump'`));
  const done = new Set(stored.map((r) => String(r.filename)));
  const competitive = onDisk.filter((f) => isCompetitiveDumpFile(basename(f)));
  const todo = competitive.filter((f) => !done.has(basename(f)));
  console.log(`\n  ${competitive.length} competitive dumps on disk · ${todo.length} new` +
    (onDisk.length > competitive.length ? ` · ${onDisk.length - competitive.length} Quick dump${onDisk.length - competitive.length === 1 ? "" : "s"} filed, not scored` : ""));

  // A name scores a dump in that period alone; with none, import:dump picks
  // the period the dump reaches (and the one that closed the week before).
  const period = val("period");
  const importOne = (f: string, forPeriod?: string) => {
    const on = dumpFileDate(f) ?? "";
    console.log(`\n  importing ${f}${on ? ` (captured ${on})` : ""}${forPeriod ? ` for ${forPeriod}` : ""}`);
    if (DRY) return;
    try {
      // capturedOn is positional, so a period name needs a date before it.
      console.log(run(["scripts/import-dump.ts", join(DEST, f), ...(on ? [on] : forPeriod ? [todayInChicago()] : []), ...(forPeriod ? [forPeriod] : [])])
        .split("\n").map((l) => `    ${l}`).join("\n"));
    } catch (e: any) {
      console.log(`    !! failed: ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`);
    }
  };
  for (const f of todo) importOne(f, period);

  /* ---- 3a: the period in play has a board from every dump since it opened ----
     Dumps loaded under the wrong period name (11-02 and 11-09 went in as
     PTCS 8) left /ptcs with no rank or line for the period in play. */
  if (!period) {
    const periodsOnFile = asRows<{ name: string; startsOn: string; endsOn: string }>(await db.execute(
      sql`select name, starts_on::text "startsOn", ends_on::text "endsOn" from periods order by starts_on`));
    const now = periodInPlay(periodsOnFile, todayInChicago());
    if (now) {
      const have = new Set(stored.filter((r) => r.period === now.name).map((r) => String(r.filename)));
      const missing = competitive.filter((f) => {
        const on = dumpFileDate(f);
        return !!on && on >= now.startsOn && on <= now.endsOn && done.has(basename(f)) && !have.has(basename(f));
      });
      if (missing.length) console.log(`\n  ${missing.length} dump${missing.length === 1 ? "" : "s"} on file carry no ${now.name} board; scoring ${missing.length === 1 ? "it" : "them"} now`);
      for (const f of missing) importOne(f, now.name);
    }
  }

  /* ---- 3b: the catalogue agrees with the dump ----
     Every slot in the newest dumps gets a row, renames land, slot ids fill.
     This is what keeps Perfect Draft events - half of what he enters - from
     going missing again. */
  if (!DRY) {
    console.log(`\n  syncing the tournament catalogue to the newest dumps`);
    try { console.log(run(["scripts/catalogue-sync.ts"]).split("\n").slice(-1).map((l) => `    ${l}`).join("\n")); }
    catch (e: any) { console.log(`    !! ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`); }
  }

  /* ---- 3c: every position the game rates, back onto the cards ----
     The shop dump lists only a card's rated positions; the exports show all
     eight (variants too). Loading the dump resets cards.ratings, so the fill
     has to follow it. */
  if (!DRY) {
    console.log(`\n  harvesting position ratings from the exports`);
    try { console.log(run(["scripts/positions-harvest.ts"]).split("\n").slice(-3).map((l) => `    ${l}`).join("\n")); }
    catch (e: any) { console.log(`    !! ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`); }
  }

  /* ---- 4: refresh my_results from the newest of each kind ---- */
  if (!DRY) {
    console.log(`\n  refreshing my_results from the newest tournaments + drafts dump`);
    try { console.log(run(["scripts/import-myresults.ts"]).split("\n").map((l) => `    ${l}`).join("\n")); }
    catch (e: any) { console.log(`    !! ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`); }
  }

  /* ---- 5: say where he stands ---- */
  if (!DRY) {
    for (const [label, args] of [["PROJECTED LINES", ["scripts/cutoff-project.ts", "--write"]], ["STANDING", ["scripts/ptcs-standing.ts"]], ["BERTH LINES", ["scripts/berth-lines.ts"]]] as const) {
      console.log(`\n  ── ${label} ──`);
      try { console.log(run([...args])); } catch (e: any) { console.log(`  !! ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`); }
    }
  }
  console.log("");
  process.exit(0);
}
main();
