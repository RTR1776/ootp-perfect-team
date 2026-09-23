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

  /* ---- 3: import anything new ---- */
  const done = new Set(asRows<any>(await db.execute(
    sql`select filename from uploads where kind = 'dump'`)).map((r) => String(r.filename)));
  const todo = onDisk.filter((f) => !done.has(basename(f)));
  console.log(`\n  ${onDisk.length} dumps on disk · ${done.size} already imported · ${todo.length} new`);

  const period = val("period");
  for (const f of todo) {
    const m = /(\d{4})(\d{2})(\d{2})/.exec(f);
    const on = m ? `${m[1]}-${m[2]}-${m[3]}` : "";
    console.log(`\n  importing ${f}${on ? ` (captured ${on})` : ""}`);
    if (DRY) continue;
    try {
      console.log(run(["scripts/import-dump.ts", join(DEST, f), ...(on ? [on] : []), ...(period ? [period] : [])])
        .split("\n").map((l) => `    ${l}`).join("\n"));
    } catch (e: any) {
      console.log(`    !! failed: ${String(e?.stderr ?? e?.message ?? e).split("\n")[0]}`);
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
